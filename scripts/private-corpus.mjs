import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { convertFileToCsv } from "../functions/lib/extract.js";
import { assertSupportedUpload } from "../functions/lib/jobs.js";

const cwd = process.cwd();
const manifestPath = process.env.AICONVERTER_PRIVATE_CORPUS_MANIFEST || path.join(cwd, ".private-corpus", "manifest.json");
const corpusRequired = process.env.AICONVERTER_PRIVATE_CORPUS_REQUIRED === "true";

await loadEnvFiles([
  path.join(cwd, ".dev.vars"),
  path.join(cwd, ".monitor.env"),
  path.join(cwd, ".private-corpus", ".env")
]);

const manifest = await readManifest(manifestPath);
if (!manifest) {
  const result = {
    ok: !corpusRequired,
    skipped: true,
    reason: `No private corpus manifest found at ${manifestPath}`,
    required: corpusRequired
  };
  console.log(JSON.stringify(result, null, 2));
  if (corpusRequired) process.exit(1);
  process.exit(0);
}

const baseDir = path.resolve(path.dirname(manifestPath), manifest.baseDir || ".");
const cases = Array.isArray(manifest.cases) ? manifest.cases : [];
if (!cases.length) {
  console.log(JSON.stringify({ ok: !corpusRequired, skipped: true, reason: "Private corpus manifest has no cases.", required: corpusRequired }, null, 2));
  if (corpusRequired) process.exit(1);
  process.exit(0);
}

const env = buildConversionEnv();
const results = [];
let failed = 0;
let skipped = 0;

for (const item of cases) {
  const result = await runCase(item, baseDir, env).catch((error) => ({
    name: item?.name || item?.file || "unnamed",
    ok: false,
    error: error?.message || String(error)
  }));
  results.push(result);
  if (result.skipped) skipped += 1;
  if (!result.ok && !result.skipped) failed += 1;
}

const summary = {
  ok: failed === 0 && (!corpusRequired || results.some((result) => result.ok && !result.skipped)),
  manifest: manifestPath,
  cases: cases.length,
  passed: results.filter((result) => result.ok && !result.skipped).length,
  skipped,
  failed,
  results
};

console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);

async function runCase(item, baseDir, env) {
  const name = String(item?.name || item?.file || "unnamed");
  const requiredEnv = Array.isArray(item?.requiresEnv) ? item.requiresEnv : [];
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);
  if (missingEnv.length) {
    return { name, ok: false, skipped: true, reason: `Missing env: ${missingEnv.join(", ")}` };
  }

  const filePath = path.resolve(baseDir, String(item.file || ""));
  if (!filePath.startsWith(baseDir + path.sep) && filePath !== baseDir) {
    return { name, ok: false, error: "File path escapes private corpus directory." };
  }

  const bytes = await fs.readFile(filePath);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const converter = String(item.converter || "bank");
  const fileName = path.basename(filePath);
  const contentType = item.contentType || mimeTypeFor(fileName);
  const uploadError = assertSupportedUpload({ name: fileName, type: contentType, size: bytes.byteLength }, arrayBuffer, converter);
  if (uploadError) return { name, ok: false, error: uploadError };

  const conversion = await convertFileToCsv(env, converter, fileName, contentType, arrayBuffer, {
    outputFormat: item.outputFormat || item.output || "",
    accountingMetadata: item.accountingMetadata || {}
  });

  if (!conversion.ok) {
    return { name, ok: false, provider: conversion.provider || "", error: conversion.message || "Conversion failed." };
  }

  const content = String(conversion.content || conversion.csv || "");
  const checks = [];
  assertMinimum("rowCount", conversion.rowCount, item.minRows, checks);
  assertMinimum("confidence", conversion.confidence, item.minConfidence, checks);
  assertMinimum("trustScore", conversion.trustScore, item.minTrustScore, checks);
  assertIncludes(content, item.mustContain, "mustContain", checks);
  assertNotIncludes(content, item.mustNotContain, "mustNotContain", checks);
  assertHeader(content, item.expectedHeaders, checks);
  assertWarnings(conversion.warnings || [], item.maxWarnings, checks);

  const errors = checks.filter((check) => !check.ok);
  return {
    name,
    ok: errors.length === 0,
    converter,
    outputFormat: conversion.outputFormat || item.outputFormat || item.output || "",
    provider: conversion.provider || "",
    rows: conversion.rowCount || 0,
    confidence: round(conversion.confidence),
    trustScore: round(conversion.trustScore),
    warnings: (conversion.warnings || []).length,
    checks
  };
}

function assertMinimum(label, actual, expected, checks) {
  if (expected === undefined) return;
  const value = Number(actual || 0);
  const minimum = Number(expected);
  checks.push({ label, ok: value >= minimum, actual: value, expected: `>= ${minimum}` });
}

function assertIncludes(content, values, label, checks) {
  for (const value of Array.isArray(values) ? values : []) {
    const found = content.includes(String(value));
    checks.push({ label, ok: found, expected: String(value) });
  }
}

function assertNotIncludes(content, values, label, checks) {
  for (const value of Array.isArray(values) ? values : []) {
    const found = content.includes(String(value));
    checks.push({ label, ok: !found, expected: `not ${String(value)}` });
  }
}

function assertHeader(content, headers, checks) {
  if (!Array.isArray(headers) || !headers.length) return;
  const firstLine = content.split(/\r?\n/)[0] || "";
  for (const header of headers) {
    checks.push({ label: "expectedHeaders", ok: firstLine.includes(String(header)), expected: String(header) });
  }
}

function assertWarnings(warnings, maxWarnings, checks) {
  if (maxWarnings === undefined) return;
  const maximum = Number(maxWarnings);
  checks.push({ label: "maxWarnings", ok: warnings.length <= maximum, actual: warnings.length, expected: `<= ${maximum}` });
}

async function readManifest(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function buildConversionEnv() {
  return {
    MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || "",
    CLOUDCONVERT_API_KEY: process.env.CLOUDCONVERT_API_KEY || "",
    CONVERTIO_API_KEY: process.env.CONVERTIO_API_KEY || ""
  };
}

async function loadEnvFiles(files) {
  for (const file of files) {
    let text = "";
    try {
      text = await fs.readFile(file, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...parts] = trimmed.split("=");
      if (!key || process.env[key]) continue;
      process.env[key] = parts.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

function mimeTypeFor(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  return {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".csv": "text/csv",
    ".html": "text/html",
    ".htm": "text/html",
    ".xml": "application/xml",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".webm": "audio/webm"
  }[extension] || "application/octet-stream";
}

function round(value) {
  const number = Number(value || 0);
  return Math.round(number * 1000) / 1000;
}
