import { refreshCloudConvertConversion, startCloudConvertConversion } from "./cloudconvert.js";
import { hasConvertioConfig, refreshConvertioConversion, startConvertioConversion } from "./convertio.js";

export async function startUniversalProviderConversion(env, job, arrayBuffer) {
  const attempts = [];

  const cloudConvert = await attemptProvider("cloudconvert", () => startCloudConvertConversion(env, job, arrayBuffer));
  if (cloudConvert.result?.ok) return cloudConvert.result;
  attempts.push(cloudConvert.failure);

  if (hasConvertioConfig(env)) {
    const convertio = await attemptProvider("convertio", () => startConvertioConversion(env, job, arrayBuffer));
    if (convertio.result?.ok) return convertio.result;
    attempts.push(convertio.failure);
  }

  const meaningful = attempts.filter(Boolean);
  const message = meaningful.length
    ? "This conversion option is temporarily unavailable."
    : "This conversion option is not ready yet.";

  return {
    ok: false,
    message,
    confidence: 0,
    rowCount: 0,
    provider: meaningful.at(-1)?.provider || "provider",
    attempts: meaningful
  };
}

export async function refreshUniversalProviderConversion(env, job) {
  if (job.external_provider === "convertio") return refreshConvertioConversion(env, job);
  return refreshCloudConvertConversion(env, job);
}

async function attemptProvider(provider, run) {
  try {
    const result = await run();
    if (result?.ok) return { result, failure: null };
    return {
      result,
      failure: {
        provider,
        message: result?.message || "Conversion route was unavailable."
      }
    };
  } catch (error) {
    return {
      result: null,
      failure: {
        provider,
        message: error?.message || "Conversion route failed."
      }
    };
  }
}
