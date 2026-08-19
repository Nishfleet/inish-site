import { requireAdmin } from "../../lib/admin-auth.js";
import { syncDodoProductPrices } from "../../lib/dodo.js";
import { json, methodNotAllowed } from "../../lib/http.js";

const CONFIRM_TEXT = "sync-inr-prices";

export function onRequestGet() {
  return methodNotAllowed("POST");
}

export async function onRequestPost({ request, env }) {
  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const dryRun = body.dryRun !== false;
  if (!dryRun && body.confirm !== CONFIRM_TEXT) {
    return json(
      {
        ok: false,
        error: `Set confirm to ${CONFIRM_TEXT} to update live Dodo prices.`
      },
      { status: 400 }
    );
  }

  const result = await syncDodoProductPrices(env, { dryRun });
  return json(result, { status: result.ok ? 200 : 502 });
}
