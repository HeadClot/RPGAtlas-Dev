/* RPGAtlas desktop wrapper — native commands.
   GPL-3.0-or-later (see ../LICENSE).

   The editor is the existing static web app, embedded as the frontend. These
   commands give it the few things a browser tab cannot do well: native file
   dialogs for project save/load, and a dedicated window for play-testing. */

use base64::Engine as _;
use std::path::PathBuf;
use tauri::{Manager, WindowEvent};
use tauri_plugin_dialog::DialogExt;

/// Save the editor's project JSON to a user-chosen file. Returns the chosen
/// path, or `None` if the user cancelled the dialog.
#[tauri::command]
fn save_project(
    app: tauri::AppHandle,
    json: String,
    suggested: String,
) -> Result<Option<String>, String> {
    let mut dialog = app
        .dialog()
        .file()
        .add_filter("RPGAtlas project", &["json"])
        .set_file_name(format!("{suggested}.json"));
    // Exports default to the user's Downloads folder (honors a relocated known
    // folder on Windows) instead of the dialog's Documents default.
    if let Ok(dir) = app.path().download_dir() {
        dialog = dialog.set_directory(dir);
    }
    let picked = dialog.blocking_save_file();

    match picked {
        Some(file) => {
            let path = file.into_path().map_err(|e| e.to_string())?;
            std::fs::write(&path, json).map_err(|e| e.to_string())?;
            Ok(Some(path.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

/// Write the project JSON straight to a known path (no dialog). Used by the
/// Save button once the project is bound to a file. The path originates from a
/// prior Save dialog, so it is already user-authorized.
#[tauri::command]
fn save_project_to_path(path: String, json: String) -> Result<(), String> {
    std::fs::write(&path, json).map_err(|e| e.to_string())
}

/// Open a project file chosen by the user and return its contents. Returns
/// `None` if the user cancelled.
#[tauri::command]
fn open_project(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("RPGAtlas project", &["json"])
        .blocking_pick_file();

    match picked {
        Some(file) => {
            let path = file.into_path().map_err(|e| e.to_string())?;
            let contents = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
            Ok(Some(contents))
        }
        None => Ok(None),
    }
}

/// Open (or focus) the play-test window, pointed at the bundled play.html.
/// localStorage is shared across windows of the same origin, so the player
/// reads the project the editor just autosaved.
#[tauri::command]
fn open_playtest(app: tauri::AppHandle) -> Result<(), String> {
    // The play-test window is declared in tauri.conf.json and created at startup
    // (hidden). Building a window on demand from inside a command instead causes
    // a blank/frozen webview, so we reuse the pre-built one: reload it to re-read
    // the project the editor just autosaved, then show and focus it. Closing it
    // only hides it (see the window-event handler in `run`), so it is always
    // here to reuse, no matter how many times the user plays and closes.
    let playtest = app
        .get_webview_window("playtest")
        .ok_or_else(|| "Play-test window was not initialized.".to_string())?;

    playtest.reload().map_err(|e| e.to_string())?;
    playtest.show().map_err(|e| e.to_string())?;
    playtest.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Asset library (Phase 6): the desktop half of the AssetStore abstraction.
// Layout: <app-data>/library/index.json (JSON array of asset metadata) +
// <app-data>/library/blobs/<sha-256-hex> (content-addressed binaries). The
// metadata shape is owned by the frontend (src/shared/services.ts AssetMeta);
// Rust treats it as opaque JSON and only reads the "key", "hash", and "mime"
// fields it needs for file bookkeeping.
// ---------------------------------------------------------------------------

fn library_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("library");
    Ok(dir)
}

fn read_index(app: &tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let path = library_dir(app)?.join("index.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    match serde_json::from_str::<serde_json::Value>(&raw) {
        Ok(serde_json::Value::Array(items)) => Ok(items),
        // A corrupt index must not brick the library: surface an empty list
        // (blobs stay on disk; re-imports are hash-deduped by the frontend).
        _ => Ok(Vec::new()),
    }
}

fn write_index(app: &tauri::AppHandle, items: &[serde_json::Value]) -> Result<(), String> {
    let dir = library_dir(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("index.json");
    let tmp = dir.join("index.json.tmp");
    let json = serde_json::to_string(items).map_err(|e| e.to_string())?;
    // Atomic-ish: write the temp file fully, then rename over the index so a
    // crash mid-write never leaves a truncated index behind.
    std::fs::write(&tmp, json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(())
}

fn meta_str(meta: &serde_json::Value, field: &str) -> Option<String> {
    meta.get(field).and_then(|v| v.as_str()).map(String::from)
}

/// A safe blob filename: the content hash is produced by the frontend as
/// SHA-256 hex, but never trust IPC input as a path component.
fn blob_file_name(hash: &str) -> Result<String, String> {
    if !hash.is_empty() && hash.chars().all(|c| c.is_ascii_hexdigit()) {
        Ok(hash.to_ascii_lowercase())
    } else {
        Err("invalid blob hash".into())
    }
}

/// The library metadata index as a JSON string (empty array when absent).
#[tauri::command]
fn library_list(app: tauri::AppHandle) -> Result<String, String> {
    let items = read_index(&app)?;
    serde_json::to_string(&items).map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
struct LibraryBlob {
    data: String,
    mime: Option<String>,
}

/// Read one asset's blob (base64) by its stable key, or None when absent.
#[tauri::command]
fn library_read(app: tauri::AppHandle, key: String) -> Result<Option<LibraryBlob>, String> {
    let items = read_index(&app)?;
    let Some(meta) = items.iter().find(|m| meta_str(m, "key").as_deref() == Some(&key)) else {
        return Ok(None);
    };
    let hash = meta_str(meta, "hash").ok_or("asset has no hash")?;
    let path = library_dir(&app)?.join("blobs").join(blob_file_name(&hash)?);
    if !path.exists() {
        return Ok(None);
    }
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(Some(LibraryBlob {
        data: base64::engine::general_purpose::STANDARD.encode(bytes),
        mime: meta_str(meta, "mime"),
    }))
}

/// Write (or replace) one asset: blob to blobs/<hash>, metadata upserted into
/// the index by key.
#[tauri::command]
fn library_write(
    app: tauri::AppHandle,
    meta_json: String,
    data_base64: String,
) -> Result<(), String> {
    let meta: serde_json::Value = serde_json::from_str(&meta_json).map_err(|e| e.to_string())?;
    let key = meta_str(&meta, "key").ok_or("asset metadata has no key")?;
    let hash = meta_str(&meta, "hash").ok_or("asset metadata has no hash")?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(data_base64)
        .map_err(|e| e.to_string())?;

    let blobs = library_dir(&app)?.join("blobs");
    std::fs::create_dir_all(&blobs).map_err(|e| e.to_string())?;
    std::fs::write(blobs.join(blob_file_name(&hash)?), bytes).map_err(|e| e.to_string())?;

    let mut items = read_index(&app)?;
    items.retain(|m| meta_str(m, "key").as_deref() != Some(&key));
    items.push(meta);
    write_index(&app, &items)
}

/// Remove one asset from the index; its blob file is deleted only when no
/// other asset shares the content hash (imports are content-addressed).
#[tauri::command]
fn library_delete(app: tauri::AppHandle, key: String) -> Result<(), String> {
    let mut items = read_index(&app)?;
    let removed_hash = items
        .iter()
        .find(|m| meta_str(m, "key").as_deref() == Some(&key))
        .and_then(|m| meta_str(m, "hash"));
    items.retain(|m| meta_str(m, "key").as_deref() != Some(&key));
    write_index(&app, &items)?;

    if let Some(hash) = removed_hash {
        let still_used = items.iter().any(|m| meta_str(m, "hash").as_deref() == Some(&hash));
        if !still_used {
            if let Ok(name) = blob_file_name(&hash) {
                let _ = std::fs::remove_file(library_dir(&app)?.join("blobs").join(name));
            }
        }
    }
    Ok(())
}

/// Update an asset's metadata (tags/kind/importer payloads) without touching
/// its blob.
#[tauri::command]
fn library_set_meta(app: tauri::AppHandle, meta_json: String) -> Result<(), String> {
    let meta: serde_json::Value = serde_json::from_str(&meta_json).map_err(|e| e.to_string())?;
    let key = meta_str(&meta, "key").ok_or("asset metadata has no key")?;
    let mut items = read_index(&app)?;
    items.retain(|m| meta_str(m, "key").as_deref() != Some(&key));
    items.push(meta);
    write_index(&app, &items)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .on_window_event(|window, event| {
            // Hide the play-test window on close rather than destroying it, so it
            // can be reused for every subsequent play-test. Destroying it would
            // free its "playtest" label and leave nothing for open_playtest to
            // reopen. The main window keeps the default behavior (quits the app).
            if window.label() == "playtest" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            save_project,
            save_project_to_path,
            open_project,
            open_playtest,
            library_list,
            library_read,
            library_write,
            library_delete,
            library_set_meta
        ])
        .run(tauri::generate_context!())
        .expect("error while running RPGAtlas");
}
