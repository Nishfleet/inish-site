import test from "node:test";
import assert from "node:assert/strict";
import { jobAccessCookie, tokenFromBodyOrCookie, tokenFromJobCookie } from "../functions/lib/jobs.js";

test("job access cookie is HttpOnly and scoped to the current job", () => {
  const cookie = jobAccessCookie("job_123", "tok_456");
  assert.match(cookie, /^__Host-aiconverter_job=job_123\.tok_456;/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);

  const request = new Request("https://aiconverter.app/api/job", {
    headers: { Cookie: cookie.split(";")[0] }
  });
  assert.equal(tokenFromJobCookie(request, "job_123"), "tok_456");
  assert.equal(tokenFromJobCookie(request, "job_other"), "");
});

test("explicit body token wins over cookie token", () => {
  const request = new Request("https://aiconverter.app/api/job", {
    headers: { Cookie: jobAccessCookie("job_123", "cookie_token").split(";")[0] }
  });
  assert.equal(tokenFromBodyOrCookie(request, "job_123", "body_token"), "body_token");
  assert.equal(tokenFromBodyOrCookie(request, "job_123", ""), "cookie_token");
});
