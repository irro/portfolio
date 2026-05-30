/* =====================================================================
   World land-outline generator for the globe page
   ---------------------------------------------------------------------
   Converts the Natural Earth 110m land TopoJSON (shipped in the npm
   "world-atlas" package) into a compact GeoJSON object and writes it to
   js/globe-data.js as `window.WORLD_LAND`. Embedding it as a script (vs.
   fetching a .json) means the globe also works from the file:// protocol.

   Regenerate with:
     npm i -D world-atlas topojson-client
     node js/build-globe-data.mjs
   ===================================================================== */
import { writeFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const topojson = require("topojson-client");
const world = require("world-atlas/land-110m.json");

const land = topojson.feature(world, world.objects.land);

// Round coordinates to 2 decimals (~1 km) to shrink the file; far finer
// than a 110m globe rendered at screen scale can show.
const round = (c) =>
  Array.isArray(c[0])
    ? c.map(round)
    : [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100];
for (const f of land.features) {
  f.geometry.coordinates = round(f.geometry.coordinates);
}

const out = join(dirname(fileURLToPath(import.meta.url)), "globe-data.js");
const header =
  "/* GENERATED FILE — do not edit by hand.\n" +
  "   World land outline (Natural Earth 110m) via the npm \"world-atlas\"\n" +
  "   package, converted to GeoJSON. Regenerate with build-globe-data.mjs.\n" +
  "   Exposes window.WORLD_LAND for js/globe.js. */\n";

writeFileSync(out, header + "window.WORLD_LAND = " + JSON.stringify(land) + ";\n");
console.log(`wrote ${out} (${(statSync(out).size / 1024).toFixed(1)} KB)`);
