# The Asset Browser

**Tools ▸ Asset Browser** manages your imported art and audio. RPGAtlas is
still procedural-first — everything works with zero imports — but the Asset
Browser is where your own PNGs and sound files join the toolkit.

## Importing

Drag files onto the browser (or click **Import Files…**):

| You drop | It becomes |
|---|---|
| PNG / WebP / JPEG | An image asset of the type in the **Images as** selector — Characters (3×4 walk sheets), Facesets, Enemies (battlers), or Tiles (one 48×48 tile per image) |
| OGG / MP3 / WAV | An audio asset, with its role (BGM / BGS / ME / SE) guessed from the file name — edit it any time |

Imported images appear immediately in the same pickers as the built-in art:
character sheets in sprite pickers, tiles in the palette, battlers in the
Enemies tab. Tile names ending `.pass` are passable; `.terrain` marks
walkable terrain.

Imports are stored in a **per-device library** — IndexedDB in the browser,
the app-data folder in the desktop app — so they don't count against the
browser's project-size limit and are shared by every project you edit on
this device.

## Where assets travel

- **Project files**: saving or exporting a `.json` embeds the imported
  assets the project actually uses. Open that file on another machine and
  they are imported into that machine's library automatically.
- **Game exports**: standalone games embed only the assets your game
  references — players never need your library.

## Managing

- **Search / tags**: filter by name or tag; click **Tags** on a card to
  edit its labels. Tags starting `pack:` mark starter-pack installs.
- **Used/unused audit**: each card shows whether the current project
  references it; **Unused only** finds dead weight, and the footer totals
  the library's size.
- **Rename** rewrites every reference in the current project so nothing
  breaks. Other projects that reference the old name will show fallbacks
  until you rename it back or re-import.
- **Delete** warns when the current project still uses the asset.
- **Export** downloads the original file back out of the library.

The **Resource Manager** remains the browser for the built-in procedural
tiles, characters, and icons.
