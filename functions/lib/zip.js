const CRC_TABLE = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

export function createZip(entries) {
  const files = entries.map((entry) => ({
    name: safeZipName(entry.name),
    bytes: entry.bytes instanceof Uint8Array ? entry.bytes : new Uint8Array(entry.bytes || []),
    date: entry.date instanceof Date ? entry.date : new Date()
  }));

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encode(file.name);
    const crc = crc32(file.bytes);
    const timeDate = dosDateTime(file.date);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const local = writer(localHeader);
    local.u32(0x04034b50);
    local.u16(20);
    local.u16(0);
    local.u16(0);
    local.u16(timeDate.time);
    local.u16(timeDate.date);
    local.u32(crc);
    local.u32(file.bytes.length);
    local.u32(file.bytes.length);
    local.u16(nameBytes.length);
    local.u16(0);
    local.bytes(nameBytes);
    localParts.push(localHeader, file.bytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const central = writer(centralHeader);
    central.u32(0x02014b50);
    central.u16(20);
    central.u16(20);
    central.u16(0);
    central.u16(0);
    central.u16(timeDate.time);
    central.u16(timeDate.date);
    central.u32(crc);
    central.u32(file.bytes.length);
    central.u32(file.bytes.length);
    central.u16(nameBytes.length);
    central.u16(0);
    central.u16(0);
    central.u16(0);
    central.u16(0);
    central.u32(0);
    central.u32(offset);
    central.bytes(nameBytes);
    centralParts.push(centralHeader);

    offset += localHeader.length + file.bytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endWriter = writer(end);
  endWriter.u32(0x06054b50);
  endWriter.u16(0);
  endWriter.u16(0);
  endWriter.u16(files.length);
  endWriter.u16(files.length);
  endWriter.u32(centralSize);
  endWriter.u32(offset);
  endWriter.u16(0);

  return concat([...localParts, ...centralParts, end]);
}

export function textBytes(value) {
  return encode(String(value || ""));
}

function writer(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;
  return {
    u16(value) {
      view.setUint16(offset, value, true);
      offset += 2;
    },
    u32(value) {
      view.setUint32(offset, value >>> 0, true);
      offset += 4;
    },
    bytes(value) {
      buffer.set(value, offset);
      offset += value.length;
    }
  };
}

function encode(value) {
  return new TextEncoder().encode(value);
}

function concat(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function safeZipName(name) {
  return String(name || "file")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/")
    .replace(/[^a-zA-Z0-9._/ -]/g, "")
    .slice(0, 160) || "file";
}
