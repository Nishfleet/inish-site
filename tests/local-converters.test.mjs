import test from "node:test";
import assert from "node:assert/strict";
import { buildPosterizedSvg } from "../src/local-converters.js";

test("raster-to-SVG posterizer keeps visible pixels and skips transparent ones", () => {
  const pixels = new Uint8ClampedArray([
    255, 0, 0, 255,
    0, 255, 0, 0,
    0, 0, 255, 255,
    255, 255, 255, 255
  ]);

  const svg = buildPosterizedSvg(pixels, 2, 2, 1);

  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="2" height="2"/);
  assert.match(svg, /fill="rgba\(255,0,0,1\.000\)"/);
  assert.match(svg, /fill="rgba\(0,0,255,1\.000\)"/);
  assert.doesNotMatch(svg, /fill="rgba\(0,255,0,0\.000\)"/);
  assert.equal((svg.match(/<rect/g) || []).length, 3);
});

test("raster-to-SVG posterizer averages blocks deterministically", () => {
  const pixels = new Uint8ClampedArray([
    255, 0, 0, 255,
    0, 255, 0, 255,
    0, 0, 255, 255,
    255, 255, 255, 255
  ]);

  const svg = buildPosterizedSvg(pixels, 2, 2, 2);

  assert.match(svg, /fill="rgba\(128,128,128,1\.000\)"/);
  assert.equal((svg.match(/<rect/g) || []).length, 1);
});
