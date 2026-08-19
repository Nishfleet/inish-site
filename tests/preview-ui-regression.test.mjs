import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");

test("preview button exposes every customer-facing block reason", () => {
  assert.match(source, /const previewBlockReason = !file/);
  assert.match(source, /This file is over the \$\{selectedMaxSizeMb\} MB limit/);
  assert.match(source, /Loading secure upload checks/);
  assert.match(source, /Secure upload settings could not load/);
  assert.match(source, /Complete the human check to generate your preview/);
  assert.match(source, /Human check expired/);
  assert.match(source, /Human check failed to load/);
  assert.match(source, /preview-blocker-note/);
  assert.match(source, /Retry human check/);
});

test("preview funnel hooks cover file, output, click, success, and error", () => {
  assert.match(source, /trackFunnelEvent\(eventType/);
  assert.match(source, /trackPreviewEvent\("file_selected"/);
  assert.match(source, /trackPreviewEvent\("output_selected"/);
  assert.match(source, /trackPreviewEvent\("preview_click"/);
  assert.match(source, /trackPreviewEvent\("preview_success"/);
  assert.match(source, /trackPreviewEvent\("preview_error"/);
  assert.match(source, /trackFunnelEvent\("page_view"/);
  assert.match(source, /trackPreviewEvent\("free_sample_download"/);
  assert.match(source, /trackPreviewEvent\("checkout_click"/);
  assert.match(source, /trackPreviewEvent\("checkout_redirect"/);
  assert.match(source, /trackPreviewEvent\("download_success"/);
  assert.match(source, /form\.append\("funnelSessionId", funnelSessionIdRef\.current\)/);
});
