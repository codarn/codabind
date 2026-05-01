// Render public/og-image.svg → public/og-image.png at 1200x630.
// Crawlers like X/Twitter and some legacy aggregators prefer raster,
// so we ship both formats and let HTML reference whichever is best.
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const SRC = "public/og-image.svg";
const DST = "public/og-image.png";

const svg = readFileSync(SRC, "utf-8");
const resvg = new Resvg(svg, {
  background: "rgba(0,0,0,0)",
  fitTo: { mode: "width", value: 1200 },
  font: {
    loadSystemFonts: true,
    defaultFontFamily: "Arial",
  },
});
const png = resvg.render().asPng();
writeFileSync(DST, png);
console.log(`${DST}: ${(png.length / 1024).toFixed(1)} kB`);
