import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("upload Turnstile renders after a file becomes active", () => {
  const source = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
  assert.match(source, /const shouldRenderTurnstile = Boolean\(turnstileSiteKey && file && !isLocalImageConverter\)/);
  assert.match(source, /const \[turnstileStatus, setTurnstileStatus\] = useState\("idle"\)/);
  assert.match(source, /if \(!shouldRenderTurnstile\) \{/);
  assert.match(source, /\}, \[turnstileSiteKey, shouldRenderTurnstile, activeFileId, turnstileRetryKey\]\);/);
  assert.match(source, /\{shouldRenderTurnstile && \(\s*<div className="turnstile-wrap"/);
  assert.match(source, /form\.append\("turnstileToken", turnstileToken\)/);
  assert.match(source, /resetTurnstile\(\);/);
  assert.match(source, /trackPreviewEvent\("turnstile_loaded"/);
  assert.match(source, /trackPreviewEvent\("turnstile_pass"/);
  assert.match(source, /trackPreviewEvent\("turnstile_fail"/);
});
