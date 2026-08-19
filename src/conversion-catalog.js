export const TOP_CONVERSION_REQUESTS = [
  {
    label: "Bank statement PDF to QuickBooks CSV",
    converterId: "bank",
    input: "PDF",
    output: "QuickBooks CSV",
    category: "Data extraction",
    qaPriority: "core"
  },
  {
    label: "Bank statement PDF to Xero CSV",
    converterId: "bank",
    input: "PDF",
    output: "Xero CSV",
    category: "Data extraction",
    qaPriority: "core"
  },
  {
    label: "Receipt image to expense CSV",
    converterId: "receipt",
    input: "Image / PDF",
    output: "Expense CSV",
    category: "Data extraction",
    qaPriority: "core"
  },
  {
    label: "Invoice PDF to JSON",
    converterId: "invoice",
    input: "PDF",
    output: "JSON",
    category: "Data extraction",
    qaPriority: "core"
  },
  {
    label: "Screenshot table to CSV",
    converterId: "screenshot",
    input: "PNG / JPG",
    output: "CSV",
    category: "Data extraction",
    qaPriority: "core"
  },
  {
    label: "JPG to PNG",
    converterId: "image-format",
    input: "JPG",
    output: "PNG",
    category: "Images",
    qaPriority: "core"
  },
  {
    label: "PNG to JPG",
    converterId: "image-format",
    input: "PNG",
    output: "JPG",
    category: "Images",
    qaPriority: "core"
  },
  {
    label: "WEBP to PNG",
    converterId: "image-format",
    input: "WEBP",
    output: "PNG",
    category: "Images",
    qaPriority: "core"
  },
  {
    label: "Audio to transcript",
    converterId: "audio-transcript",
    input: "MP3 / WAV / M4A",
    output: "TXT",
    category: "Audio",
    qaPriority: "core"
  },
  {
    label: "Document to Markdown",
    converterId: "document-markdown",
    input: "PDF / DOCX / XLSX / HTML",
    output: "MD",
    category: "Documents",
    qaPriority: "core"
  },
  {
    label: "PDF to Word",
    converterId: "universal-file",
    input: "PDF",
    output: "DOCX",
    category: "Documents",
    qaPriority: "provider"
  },
  {
    label: "Word to PDF",
    converterId: "universal-file",
    input: "DOCX",
    output: "PDF",
    category: "Documents",
    qaPriority: "provider"
  },
  {
    label: "PDF to JPG",
    converterId: "universal-file",
    input: "PDF",
    output: "JPG",
    category: "Documents",
    qaPriority: "provider"
  },
  {
    label: "HEIC to JPG",
    converterId: "universal-file",
    input: "HEIC",
    output: "JPG",
    category: "Images",
    qaPriority: "provider"
  },
  {
    label: "SVG to PNG",
    converterId: "universal-file",
    input: "SVG",
    output: "PNG",
    category: "Images",
    qaPriority: "provider"
  },
  {
    label: "MP4 to MP3",
    converterId: "universal-file",
    input: "MP4",
    output: "MP3",
    category: "Audio",
    qaPriority: "provider"
  },
  {
    label: "MOV to MP4",
    converterId: "universal-file",
    input: "MOV",
    output: "MP4",
    category: "Video",
    qaPriority: "provider"
  },
  {
    label: "GIF to MP4",
    converterId: "universal-file",
    input: "GIF",
    output: "MP4",
    category: "Video",
    qaPriority: "provider"
  },
  {
    label: "WAV to MP3",
    converterId: "universal-file",
    input: "WAV",
    output: "MP3",
    category: "Audio",
    qaPriority: "provider"
  },
  {
    label: "XLSX to CSV",
    converterId: "universal-file",
    input: "XLSX",
    output: "CSV",
    category: "Spreadsheets",
    qaPriority: "provider"
  },
  {
    label: "CSV to XLSX",
    converterId: "universal-file",
    input: "CSV",
    output: "XLSX",
    category: "Spreadsheets",
    qaPriority: "provider"
  }
];

const DIRECT_CONVERSION_PAIRS = {
  bank: [
    { input: "PDF", output: "QuickBooks CSV", label: "Bank statement PDF to QuickBooks CSV" },
    { input: "PDF", output: "Xero CSV", label: "Bank statement PDF to Xero CSV" },
    { input: "PDF", output: "Wave CSV", label: "Bank statement PDF to Wave CSV" },
    { input: "PDF", output: "GnuCash CSV", label: "Bank statement PDF to GnuCash CSV" },
    { input: "PDF", output: "CSV", label: "Bank statement PDF to CSV" }
  ],
  receipt: [
    { input: "Image", output: "Expense CSV", label: "Receipt image to expense CSV" },
    { input: "PDF", output: "Expense CSV", label: "Receipt PDF to expense CSV" }
  ],
  screenshot: [
    { input: "PNG", output: "CSV", label: "Screenshot table to CSV" },
    { input: "JPG", output: "CSV", label: "JPG table to CSV" },
    { input: "PDF", output: "CSV", label: "Image PDF table to CSV" }
  ],
  invoice: [
    { input: "PDF", output: "CSV", label: "Invoice PDF to CSV" },
    { input: "PDF", output: "JSON", label: "Invoice PDF to JSON" },
    { input: "Image", output: "CSV", label: "Invoice image to CSV" },
    { input: "Image", output: "JSON", label: "Invoice image to JSON" }
  ],
  "audio-transcript": [
    { input: "Audio", output: "TXT", label: "Audio to transcript" },
    { input: "MP3", output: "TXT", label: "MP3 to transcript" },
    { input: "WAV", output: "TXT", label: "WAV to transcript" },
    { input: "M4A", output: "TXT", label: "M4A to transcript" },
    { input: "Audio", output: "JSON", label: "Audio to JSON transcript" }
  ],
  "document-markdown": [
    { input: "Document", output: "MD", label: "Document to Markdown" },
    { input: "PDF", output: "MD", label: "PDF to Markdown" },
    { input: "DOCX", output: "MD", label: "DOCX to Markdown" },
    { input: "XLSX", output: "MD", label: "XLSX to Markdown" },
    { input: "HTML", output: "MD", label: "HTML to Markdown" }
  ],
  "screenshot-code": [
    { input: "PNG", output: "HTML", label: "Screenshot PNG to HTML" },
    { input: "JPG", output: "HTML", label: "Screenshot JPG to HTML" },
    { input: "PDF", output: "HTML", label: "Screenshot PDF to HTML" }
  ]
};

const FORMAT_ALIASES = {
  jpeg: "jpg",
  htm: "html",
  tif: "tiff",
  gz: "gzip"
};

const FORMAT_LABELS = {
  "7z": "7Z",
  csv: "CSV",
  doc: "DOC",
  docx: "DOCX",
  gif: "GIF",
  gzip: "GZIP",
  heic: "HEIC",
  heif: "HEIF",
  html: "HTML",
  jpg: "JPG",
  json: "JSON",
  m4a: "M4A",
  md: "MD",
  mov: "MOV",
  mp3: "MP3",
  mp4: "MP4",
  odp: "ODP",
  ods: "ODS",
  odt: "ODT",
  pdf: "PDF",
  png: "PNG",
  ppt: "PPT",
  pptx: "PPTX",
  rar: "RAR",
  rtf: "RTF",
  svg: "SVG",
  tar: "TAR",
  txt: "TXT",
  wav: "WAV",
  webm: "WEBM",
  webp: "WEBP",
  xls: "XLS",
  xlsx: "XLSX",
  zip: "ZIP"
};

export function normalizeFormatId(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^\./, "");
  return FORMAT_ALIASES[normalized] || normalized;
}

export function formatLabel(value = "") {
  const normalized = normalizeFormatId(value);
  return FORMAT_LABELS[normalized] || normalized.toUpperCase();
}

export function isLiveConverter(converter) {
  return converter?.id !== "email" && converter?.state !== "Upcoming";
}

export function isLocalConverter(converter) {
  return ["local-image", "local-svg"].includes(converter?.mode);
}

export function isProviderConverter(converter) {
  return converter?.mode === "provider-cloudconvert";
}

export function acceptedExtensionsForConverter(converter) {
  return [
    ...new Set(
      String(converter?.accept || "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.startsWith("."))
        .map((value) => normalizeFormatId(value))
        .filter(Boolean)
    )
  ];
}

export function familyForFormat(format = "") {
  const normalized = normalizeFormatId(format);
  if (["png", "jpg", "webp", "gif", "bmp", "tiff", "heic", "heif", "svg"].includes(normalized)) return "image";
  if (["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(normalized)) return "audio";
  if (["mp4", "mov", "avi", "mkv", "wmv", "webm"].includes(normalized)) return "video";
  if (["zip", "7z", "tar", "gzip", "rar"].includes(normalized)) return "archive";
  if (["xls", "xlsx", "xlsm", "xlsb", "csv", "ods", "numbers"].includes(normalized)) return "spreadsheet";
  if (["ppt", "pptx", "odp"].includes(normalized)) return "presentation";
  if (["pdf", "doc", "docx", "rtf", "txt", "md", "html", "odt"].includes(normalized)) return "document";
  return "file";
}

export function customerCategoryForPair(input = "", output = "") {
  const inputFamily = familyForFormat(input);
  const outputFamily = familyForFormat(output);
  if (inputFamily === "spreadsheet" || outputFamily === "spreadsheet") return "Spreadsheets";
  if (inputFamily === "video" || outputFamily === "video") return "Video";
  if (inputFamily === "audio" || outputFamily === "audio") return "Audio";
  if (inputFamily === "image" || outputFamily === "image") return "Images";
  if (inputFamily === "archive" || outputFamily === "archive") return "Archives";
  return "Documents";
}

export function universalOutputCapabilityIds(format = "") {
  const normalized = normalizeFormatId(format);
  const groups = {
    text: ["txt", "md", "html", "pdf", "docx"],
    pdf: ["pdf", "docx", "txt", "html", "md", "png", "jpg"],
    word: ["docx", "pdf", "txt", "html", "md"],
    spreadsheet: ["xlsx", "csv", "pdf", "html"],
    presentation: ["pptx", "pdf", "png", "jpg"],
    image: ["png", "jpg", "webp", "gif", "svg", "pdf", "mp4"],
    svg: ["svg", "png", "jpg", "webp", "pdf"],
    audio: ["mp3", "wav", "m4a", "ogg", "flac"],
    video: ["mp4", "webm", "mov", "gif", "mp3"],
    archive: ["zip", "7z", "tar"]
  };

  if (["txt", "md", "html", "rtf"].includes(normalized)) return groups.text;
  if (normalized === "pdf") return groups.pdf;
  if (["doc", "docx", "odt"].includes(normalized)) return groups.word;
  if (["csv", "xls", "xlsx", "xlsm", "xlsb", "ods", "numbers"].includes(normalized)) return groups.spreadsheet;
  if (["ppt", "pptx", "odp"].includes(normalized)) return groups.presentation;
  if (normalized === "svg") return groups.svg;
  if (familyForFormat(normalized) === "image") return groups.image;
  if (familyForFormat(normalized) === "audio") return groups.audio;
  if (familyForFormat(normalized) === "video") return groups.video;
  if (familyForFormat(normalized) === "archive") return groups.archive;
  return groups.text;
}

export function capableOutputFormats(converter, candidateOrFormat) {
  const formats = converter?.outputFormats || [];
  if (!candidateOrFormat) return formats;
  const inputFormat =
    typeof candidateOrFormat === "string"
      ? normalizeFormatId(candidateOrFormat)
      : normalizeFormatId(candidateOrFormat.name?.split(".").pop() || "");
  if (converter?.id === "image-format") return formats.filter((format) => normalizeFormatId(format.id) !== inputFormat);
  if (converter?.id !== "universal-file") return formats;
  const capableIds = universalOutputCapabilityIds(inputFormat);
  return formats.filter((format) => capableIds.includes(format.id) && normalizeFormatId(format.id) !== inputFormat);
}

export function buildConversionCatalog(converters, options = {}) {
  const universalProviderReady = Boolean(options.universalProviderReady);
  const pairs = [];

  for (const converter of converters.filter(isLiveConverter)) {
    if (isProviderConverter(converter)) {
      for (const input of acceptedExtensionsForConverter(converter)) {
        for (const format of capableOutputFormats(converter, input)) {
          const output = normalizeFormatId(format.id);
          if (!output || output === input) continue;
          const inputLabel = formatLabel(input);
          const outputLabel = formatLabel(output);
          pairs.push(pairForConverter(converter, {
            input: inputLabel,
            output: outputLabel,
            label: displayLabelForPair(converter.id, inputLabel, outputLabel),
            category: customerCategoryForPair(input, output),
            available: universalProviderReady,
            detail: universalProviderReady ? "Preview first, full file after unlock" : "Coming soon"
          }));
        }
      }
      continue;
    }

    if (converter.id === "image-format") {
      const inputs = ["png", "jpg", "webp"];
      for (const input of inputs) {
        for (const format of capableOutputFormats(converter, input)) {
          const output = normalizeFormatId(format.id);
          pairs.push(pairForConverter(converter, {
            input: formatLabel(input),
            output: formatLabel(output),
            label: `${formatLabel(input)} to ${formatLabel(output)}`,
            category: "Images",
            available: true,
            detail: "Image format conversion"
          }));
        }
      }
      continue;
    }

    if (converter.id === "raster-vector") {
      for (const input of ["png", "jpg", "webp"]) {
        pairs.push(pairForConverter(converter, {
          input: formatLabel(input),
          output: "SVG",
          label: `${formatLabel(input)} to SVG`,
          category: "Images",
          available: true,
          detail: "Image to SVG conversion"
        }));
      }
      continue;
    }

    for (const pair of DIRECT_CONVERSION_PAIRS[converter.id] || []) {
      pairs.push(pairForConverter(converter, {
        ...pair,
        category: pair.category || (converter.id === "audio-transcript" ? "Audio" : converter.id === "document-markdown" ? "Documents" : "Data extraction"),
        available: true,
        detail: converter.state === "Live" ? "Preview before full export" : "Preview first"
      }));
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const pair of pairs) {
    const key = `${pair.converterId}:${pair.input}:${pair.output}:${pair.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(pair);
  }

  return deduped.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export function availableConversionCount(converters, options = {}) {
  return buildConversionCatalog(converters, options).filter((pair) => pair.available).length;
}

export function availableConversionCountLabel(count) {
  if (count >= 200) return "Many conversion options available";
  if (count >= 100) return "100+ conversion options available";
  return `${count} conversion options available`;
}

export function confidenceDetailsForConverter(converter, outputFormat, options = {}) {
  const local = isLocalConverter(converter);
  const provider = isProviderConverter(converter);
  const providerReady = Boolean(options.universalProviderReady);
  const maxSizeMb = converter?.id === "audio-transcript" ? 25 : converter?.id === "screenshot-code" ? 8 : 50;
  const output = formatLabel(outputFormat || converter?.outputFormats?.[0]?.id || converter?.output || "file");

  return {
    output: provider
      ? `${output} file`
      : local
        ? `${output} file generated privately`
        : `${output} preview before full export`,
    preview: local ? "Instant download" : provider ? "Preview first, full file after unlock" : "Free downloadable sample before payment",
    privacy: local ? "No upload needed" : "Private storage, tokened job access, short retention",
    limit: `${maxSizeMb} MB max${converter?.id === "bank" ? ", 500 pages max" : ""}`,
    state: provider ? (providerReady ? "Available now" : "Coming soon") : converter?.state || "Live"
  };
}

function pairForConverter(converter, pair) {
  return {
    converterId: converter.id,
    converterTitle: converter.title,
    state: converter.state,
    checks: converter.checks || [],
    ...pair
  };
}

function displayLabelForPair(converterId, input, output) {
  const request = TOP_CONVERSION_REQUESTS.find(
    (item) => item.converterId === converterId && item.input === input && item.output === output
  );
  return request?.label || `${input} to ${output}`;
}
