import { json, methodNotAllowed } from "../lib/http.js";
import { recordFunnelEvent } from "../lib/funnel-telemetry.js";

export function onRequestGet() {
  return methodNotAllowed("POST");
}

export async function onRequestPost({ request, env }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Send a JSON funnel event." }, { status: 400 });
  }

  const result = await recordFunnelEvent(env, request, payload);
  if (!result.ok) {
    return json({ error: result.message }, { status: result.message === "Unknown funnel event." ? 400 : 202 });
  }
  return json({ ok: true });
}
