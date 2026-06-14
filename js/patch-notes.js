/* RPGAtlas - patch-notes.js
   Keep newest entries first. See AGENTS.md for the update policy. */
"use strict";

export const PATCH_NOTES = [
  {
    date: "June 14, 2026",
    title: "Lighting polish: smoother lights, shadows disabled",
    summary: "Improve radial light visuals and temporarily disable shadow generation while debugging.",
    items: [
      "Smoothed radial gradient for more natural light falloff (less burnt centers).",
      "Removed the ambient overlay sprite in favor of a single ambient background color.",
      "Temporarily disabled per-tile shadow generation to prevent visual artifacts.",
      "Fixed PIXI v8 compatibility: string blend modes and linear scaleMode usage.",
      "Credits: Kiro (Dirgefall Studio) — PIXI integration and lighting polish",
    ],
  },
  {
    date: "June 14, 2026",
    title: "PIXI v8 HD-2D Lighting System",
    summary: "Replaced basic circle-based light rendering with a GPU-efficient radial gradient light map for PIXI v8.",
    items: [
      "Lights now use radial gradient sprites with smooth falloff instead of hard-edged circles.",
      "Ambient darkness overlay darkens unlit areas; lights pierce through via ADD blend mode.",
      "Fixed TILE size mismatch (32 to 48) for correct sprite and light positioning.",
      "Camera zoom is now applied to the PIXI scene container.",
      "Light sprites are pooled and reused each frame (zero GC pressure).", 
      "Editor GLRender alias added for HD-2D preview compatibility.",
      "Credits: Kiro (Dirgefall Studio) — PIXI integration and lighting polish",
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
