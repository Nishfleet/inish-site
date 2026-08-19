export const UNIVERSAL_CONVERTER_ID = "universal-file";
export const UNIVERSAL_MAX_FILE_BYTES = 50 * 1024 * 1024;

export const UNIVERSAL_COLUMNS = [
  { key: "file", label: "File" },
  { key: "input", label: "Input" },
  { key: "output", label: "Output" },
  { key: "route", label: "Step" },
  { key: "status", label: "Status" }
];

export const UNIVERSAL_OUTPUT_FORMATS = [
  "pdf",
  "docx",
  "txt",
  "html",
  "md",
  "csv",
  "xlsx",
  "pptx",
  "png",
  "jpg",
  "webp",
  "gif",
  "svg",
  "mp3",
  "wav",
  "m4a",
  "ogg",
  "flac",
  "mp4",
  "webm",
  "mov",
  "zip",
  "7z",
  "tar"
];

export const UNIVERSAL_ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".rtf",
  ".txt",
  ".md",
  ".html",
  ".htm",
  ".csv",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".odt",
  ".ods",
  ".odp",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".heic",
  ".heif",
  ".svg",
  ".mp3",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".flac",
  ".webm",
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".wmv",
  ".zip",
  ".7z",
  ".tar",
  ".gz",
  ".rar"
];

export const UNIVERSAL_ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/rtf",
  "text/plain",
  "text/markdown",
  "text/html",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/heic",
  "image/heif",
  "image/svg+xml",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/webm",
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
  "video/x-ms-wmv",
  "video/webm",
  "application/zip",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  "application/vnd.rar",
  "application/x-rar-compressed"
];

const TEXT_EXTENSIONS = new Set(["txt", "md", "html", "htm", "csv", "rtf"]);
const ZIP_CONTAINER_EXTENSIONS = new Set(["docx", "xlsx", "pptx", "odt", "ods", "odp", "zip"]);
const COMPOUND_OFFICE_EXTENSIONS = new Set(["doc", "xls", "ppt"]);

export function isUniversalConverter(converterId = "") {
  return String(converterId || "").toLowerCase() === UNIVERSAL_CONVERTER_ID;
}

export function normalizeUniversalOutputFormat(value = "") {
  const normalized = String(value || "").trim().toLowerCase().replace(/^jpeg$/, "jpg");
  return UNIVERSAL_OUTPUT_FORMATS.includes(normalized) ? normalized : "pdf";
}

export function normalizeAnyOutputFormat(value = "") {
  const normalized = String(value || "").trim().toLowerCase().replace(/^jpeg$/, "jpg");
  if (["qif", "ofx", "qbo"].includes(normalized)) return normalized;
  return normalizeUniversalOutputFormat(normalized);
}

export function universalOutputLabel(format = "") {
  const labels = {
    pdf: "PDF",
    docx: "DOCX",
    txt: "TXT",
    html: "HTML",
    md: "Markdown",
    csv: "CSV",
    xlsx: "XLSX",
    pptx: "PPTX",
    png: "PNG",
    jpg: "JPG",
    webp: "WEBP",
    gif: "GIF",
    svg: "SVG",
    mp3: "MP3",
    wav: "WAV",
    m4a: "M4A",
    ogg: "OGG",
    flac: "FLAC",
    mp4: "MP4",
    webm: "WEBM",
    mov: "MOV",
    zip: "ZIP",
    "7z": "7Z",
    tar: "TAR"
  };
  return labels[format] || String(format || "file").toUpperCase();
}

export function extensionFromFileName(fileName = "") {
  const match = String(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

export function cloudConvertInputFormat(fileName = "") {
  const extension = extensionFromFileName(fileName);
  if (extension === "jpeg") return "jpg";
  if (extension === "htm") return "html";
  if (extension === "tif") return "tiff";
  if (extension === "gz") return "gzip";
  return extension;
}

export function cloudConvertOutputFormat(format = "") {
  return normalizeUniversalOutputFormat(format);
}

export function universalFileKind(fileName = "", contentType = "") {
  const extension = extensionFromFileName(fileName);
  const type = String(contentType || "").toLowerCase();
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "heic", "heif", "svg"].includes(extension)) return "image";
  if (type.startsWith("audio/") || ["mp3", "wav", "m4a", "aac", "ogg", "flac", "webm"].includes(extension)) return "audio";
  if (type.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "wmv", "webm"].includes(extension)) return "video";
  if (["zip", "7z", "tar", "gz", "rar"].includes(extension)) return "archive";
  return "document";
}

export function contentTypeForOutputFormat(format = "") {
  const normalized = normalizeAnyOutputFormat(format);
  const types = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    txt: "text/plain; charset=utf-8",
    html: "text/html; charset=utf-8",
    md: "text/markdown; charset=utf-8",
    csv: "text/csv; charset=utf-8",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    png: "image/png",
    jpg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    flac: "audio/flac",
    mp4: "video/mp4",
    webm: "video/webm",
    mov: "video/quicktime",
    zip: "application/zip",
    "7z": "application/x-7z-compressed",
    tar: "application/x-tar",
    qif: "application/x-qif; charset=utf-8",
    ofx: "application/x-ofx; charset=utf-8",
    qbo: "application/vnd.intu.qbo; charset=utf-8"
  };
  return types[normalized] || "application/octet-stream";
}

export function isBinaryOutputFormat(format = "") {
  return !["csv", "json", "txt", "md", "html", "qif", "ofx", "qbo"].includes(String(format || "").toLowerCase());
}

export function universalPreviewRow(fileName, contentType, outputFormat, route = "Preview ready") {
  const input = cloudConvertInputFormat(fileName) || universalFileKind(fileName, contentType);
  return {
    file: fileName,
    input: input.toUpperCase(),
    output: universalOutputLabel(outputFormat),
    route,
    status: "Ready to unlock"
  };
}

export function assertUniversalSignature(fileName, fileType, arrayBuffer) {
  const extension = extensionFromFileName(fileName);
  const bytes = new Uint8Array(arrayBuffer.slice(0, Math.min(1024, arrayBuffer.byteLength)));
  const ascii = new TextDecoder("latin1").decode(arrayBuffer.slice(0, Math.min(1024, arrayBuffer.byteLength)));

  if (extension === "pdf") return ascii.startsWith("%PDF-") ? "" : "That PDF does not look valid.";
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "heic", "heif"].includes(extension)) {
    return looksLikeImage(extension, bytes, ascii) ? "" : "That image file does not look valid.";
  }
  if (["mp3", "wav", "m4a", "aac", "ogg", "flac", "webm"].includes(extension)) {
    return looksLikeAudio(extension, bytes, ascii) ? "" : "That audio file does not look valid.";
  }
  if (["mp4", "mov", "avi", "mkv", "wmv"].includes(extension)) {
    return looksLikeVideo(extension, bytes, ascii) ? "" : "That video file does not look valid.";
  }
  if (ZIP_CONTAINER_EXTENSIONS.has(extension)) return isZipContainer(bytes) ? "" : "That ZIP-based file does not look valid.";
  if (COMPOUND_OFFICE_EXTENSIONS.has(extension)) return isCompoundOffice(bytes) ? "" : "That Office file does not look valid.";
  if (extension === "7z") return bytes[0] === 0x37 && bytes[1] === 0x7a && bytes[2] === 0xbc ? "" : "That 7Z archive does not look valid.";
  if (extension === "rar") return ascii.startsWith("Rar!\x1a\x07") ? "" : "That RAR archive does not look valid.";
  if (extension === "gz") return bytes[0] === 0x1f && bytes[1] === 0x8b ? "" : "That GZIP file does not look valid.";
  if (extension === "tar") return ascii.slice(257, 262) === "ustar" ? "" : "That TAR archive does not look valid.";
  if (extension === "svg") return looksLikeSvg(ascii) ? "" : "That SVG file does not look valid.";
  if (TEXT_EXTENSIONS.has(extension)) return looksTextLike(ascii) ? "" : "That text document does not look valid.";
  if (String(fileType || "").toLowerCase() === "application/octet-stream") return "";
  return "";
}

function looksLikeImage(extension, bytes, ascii) {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  const isGif = ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a");
  const isBmp = ascii.startsWith("BM");
  const isTiff = ascii.startsWith("II*\x00") || ascii.startsWith("MM\x00*");
  const brand = ascii.slice(4, 12).toLowerCase();
  const isHeic = brand.startsWith("ftyp") && /(heic|heif|mif1|msf1)/.test(brand + ascii.slice(12, 32).toLowerCase());
  return { png: isPng, jpg: isJpeg, jpeg: isJpeg, webp: isWebp, gif: isGif, bmp: isBmp, tif: isTiff, tiff: isTiff, heic: isHeic, heif: isHeic }[extension];
}

function looksLikeAudio(extension, bytes, ascii) {
  const isMp3 = ascii.startsWith("ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  const isWav = ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE";
  const isMp4Audio = ascii.slice(4, 8) === "ftyp";
  const isAdtsAac = bytes[0] === 0xff && (bytes[1] === 0xf1 || bytes[1] === 0xf9);
  const isOgg = ascii.startsWith("OggS");
  const isFlac = ascii.startsWith("fLaC");
  const isWebm = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return { mp3: isMp3, wav: isWav, m4a: isMp4Audio, aac: isMp4Audio || isAdtsAac, ogg: isOgg, flac: isFlac, webm: isWebm }[extension];
}

function looksLikeVideo(extension, bytes, ascii) {
  const isMp4Family = ascii.slice(4, 8) === "ftyp";
  const isAvi = ascii.startsWith("RIFF") && ascii.slice(8, 12) === "AVI ";
  const isMatroska = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  const isWmv = bytes[0] === 0x30 && bytes[1] === 0x26 && bytes[2] === 0xb2 && bytes[3] === 0x75;
  return { mp4: isMp4Family, mov: isMp4Family, avi: isAvi, mkv: isMatroska, wmv: isWmv }[extension];
}

function isZipContainer(bytes) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isCompoundOffice(bytes) {
  return (
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  );
}

function looksLikeSvg(text) {
  const start = String(text || "").trimStart().slice(0, 200).toLowerCase();
  return start.startsWith("<svg") || start.includes("<svg");
}

function looksTextLike(text) {
  const sample = String(text || "").slice(0, 512);
  if (!sample.trim()) return false;
  const controlCount = [...sample].filter((char) => {
    const code = char.charCodeAt(0);
    return code < 32 && ![9, 10, 13].includes(code);
  }).length;
  return controlCount / sample.length < 0.05;
}
