import { json } from "../lib/http.js";
import { hasCloudConvertConfig } from "../lib/cloudconvert.js";
import { hasConvertioConfig } from "../lib/convertio.js";

export function onRequestPost() {
  return json({ error: "Method not allowed. Use GET." }, { status: 405, headers: { Allow: "GET" } });
}

export function onRequestGet({ env }) {
  return json({
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || "",
    payments: {
      provider: "dodo",
      mode: String(env.DODO_ENVIRONMENT || env.DODO_MODE || "live").toLowerCase().includes("test")
        ? "test"
        : "live"
    },
    capabilities: {
      cloudConvert: hasCloudConvertConfig(env),
      convertioBackup: hasConvertioConfig(env),
      universalProvider: hasCloudConvertConfig(env) || hasConvertioConfig(env)
    }
  });
}
