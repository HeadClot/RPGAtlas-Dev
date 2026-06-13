/* RPGAtlas - patch-notes.js
   Keep newest entries first. See AGENTS.md for the update policy. */
"use strict";

export const PATCH_NOTES = [
  {
    date: "June 13, 2026",
    title: "Select Multiple Event Commands",
    summary: "Shift+click a range of commands in the event editor and copy, cut, paste, delete, move, or drag them as one block.",
    items: [
      "Click a command, then Shift+click another to select the whole run between them.",
      "Copy/Cut/Paste/Delete and the ↑/↓ buttons act on the entire selection at once.",
      "Drag a selected block to a new spot, including into another branch.",
      "Selection stays within one branch level; selecting across an If/Choices carries the whole block along.",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Copy & Paste Event Commands",
    summary: "Copy, cut, and paste commands in the event editor — within an event or from one event to another.",
    items: [
      "Select a command and use Ctrl+C / Ctrl+X / Ctrl+V (or the Copy/Cut/Paste buttons) in the Commands list.",
      "Paste works across events, so you can copy a command in one event and paste it into another.",
      "Container commands (If / Choices) copy with everything nested inside them.",
      "Right-click a command for a menu with all the list actions (add, edit, cut, copy, paste, move, delete).",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Drag-to-Reorder Event Commands",
    summary: "Reorder commands in the event editor by dragging them, not just the ↑/↓ buttons.",
    items: [
      "Click and drag a command in the Commands list to move it anywhere in the event.",
      "Drag commands into or out of If/Choices branches, not just within a single list.",
      "A drop line shows where the command will land; the ↑/↓ buttons still work too, and now keep the command selected so you can tap them repeatedly.",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Cinematic and Control Event Command Expansion",
    summary: "Added new visual effects commands and advanced branching controls to map events.",
    items: [
      "Shake Screen - shakes the game viewport horizontally and vertically in both 2D and HD-2D modes.",
      "Flash Screen - overlays a fading color overlay for thunder strikes, hit impacts, or magical bursts.",
      "Change Weather - triggers map weather changes visually without requiring JavaScript Script blocks.",
      "Actor Conditional Branch - checks party membership and specific weapon/armor equipment in event branches.",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Faster Event Command Navigation",
    summary: "Increased the Add Command menu from 12 to 24 buttons per page and added direct numbered page tabs.",
    items: [
      "Each Event Command page now displays up to 24 buttons.",
      "Page tabs appear above the command grid for one-click access without cycling through pages.",
      "Saved custom command buttons and +Add New remain at the end of the picker.",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Patch Notes",
    summary: "Added an easily digestible Patch Notes menu under Help so players and creators can review feature updates.",
    items: [
      "Patch notes are shown newest-first and older entries remain available by scrolling.",
      "Added a project instruction requiring future AI-assisted features and major changes to include a short patch note.",
    ],
  },
  {
    date: "June 13, 2026",
    title: "Event Command Expansion",
    summary: "Expanded Event Commands into multiple pages with 12 buttons per page and the ability to add reusable event buttons on demand.",
    items: [
      "Camera Zoom - zoom the player camera in or out immediately or over time.",
      "+Add New - create project-saved JavaScript command buttons for reusable event flow and scene-management tasks.",
      "Saved command buttons can be inserted with one click, or edited and deleted with right-click.",
    ],
  },
];
