/* =====================================================================
   Placeholder image generator
   ---------------------------------------------------------------------
   Produces lightweight SVG stand-ins so the framework renders out of the
   box. Replace these files with your own photographs (keep the same file
   names, or update the references in the HTML and sitemap).

   Run with:  node images/generate-placeholders.mjs
   ===================================================================== */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const outDir = dirname(fileURLToPath(import.meta.url));

/* Escape XML special characters so labels like "Concrete & Sky" stay
   well-formed inside the SVG. */
function esc(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* A single reusable scene: layered gradient + abstract shapes + label.
   Looks like an abstract photograph and keeps file sizes tiny. */
function scene({ width, height, from, to, accent, label }) {
  const id = label.replace(/\W+/g, "");
  const safe = esc(label);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${safe}">
  <defs>
    <linearGradient id="bg${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg${id})"/>
  <circle cx="${width * 0.78}" cy="${height * 0.28}" r="${height * 0.22}" fill="${accent}" opacity="0.35"/>
  <path d="M0 ${height} L${width * 0.32} ${height * 0.55} L${width * 0.55} ${height * 0.78} L${width * 0.78} ${height * 0.5} L${width} ${height * 0.72} L${width} ${height} Z" fill="#000" opacity="0.22"/>
  <path d="M0 ${height} L${width * 0.45} ${height * 0.68} L${width * 0.7} ${height * 0.85} L${width} ${height * 0.66} L${width} ${height} Z" fill="#000" opacity="0.3"/>
  <text x="${width / 2}" y="${height / 2}" fill="#ffffff" opacity="0.92" font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(height * 0.07)}" font-style="italic" text-anchor="middle" dominant-baseline="middle">${safe}</text>
  <text x="${width / 2}" y="${height / 2 + height * 0.09}" fill="#ffffff" opacity="0.7" font-family="-apple-system, Segoe UI, Roboto, sans-serif" font-size="${Math.round(height * 0.032)}" letter-spacing="3" text-anchor="middle" dominant-baseline="middle">PLACEHOLDER · REPLACE ME</text>
</svg>
`;
}

// The 12 files referenced across the site. Titles match the HTML/sitemap.
const files = [
  // Hero background (wide).
  { name: "hero.svg", width: 1600, height: 900, from: "#16323a", to: "#0b1d22", accent: "#2f6f7a", label: "Alex Rivera Photography" },
  // About portrait (tall).
  { name: "portrait.svg", width: 800, height: 1000, from: "#3a2f2a", to: "#1d1714", accent: "#8a6f5a", label: "Alex Rivera" },
  // Social share card (1.91:1).
  { name: "og-cover.svg", width: 1200, height: 630, from: "#16323a", to: "#0b1d22", accent: "#2f6f7a", label: "Alex Rivera Photography" },
  // Gallery — landscape and portrait orientations.
  { name: "gallery-01.svg", width: 1200, height: 800, from: "#1b3b4a", to: "#2e6b6f", accent: "#7fd1c5", label: "Dawn over the Ridge" },
  { name: "gallery-02.svg", width: 1200, height: 800, from: "#1a1430", to: "#3a2350", accent: "#c79bff", label: "Harbour Lights" },
  { name: "gallery-03.svg", width: 800, height: 1200, from: "#3a2a22", to: "#6b4a3a", accent: "#e0a06a", label: "Studio Portrait No. 4" },
  { name: "gallery-04.svg", width: 1200, height: 800, from: "#22272b", to: "#4a525a", accent: "#9fb4c2", label: "Concrete & Sky" },
  { name: "gallery-05.svg", width: 800, height: 1200, from: "#2a2410", to: "#5a4a1a", accent: "#d9c46a", label: "Market Morning" },
  { name: "gallery-06.svg", width: 1200, height: 800, from: "#13303a", to: "#1f5a66", accent: "#6fc7d6", label: "Still Water" },
  { name: "gallery-07.svg", width: 1200, height: 800, from: "#2b1f1a", to: "#574036", accent: "#c79a7a", label: "The Old Workshop" },
  { name: "gallery-08.svg", width: 1200, height: 800, from: "#23351a", to: "#4a6b2a", accent: "#a6d96a", label: "Wildflower Field" },
  { name: "gallery-09.svg", width: 800, height: 1200, from: "#241a24", to: "#4a2a44", accent: "#d98ac0", label: "City in Motion" },
];

for (const file of files) {
  writeFileSync(join(outDir, file.name), scene(file));
  console.log("wrote", file.name);
}
console.log(`\nGenerated ${files.length} placeholder images.`);
