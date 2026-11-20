export interface ZipArchiveEntry {
  /** Path inside archive, using forward slashes (e.g. "fotky/P01_Orlovska.jpg") */
  name: string;
  data: Buffer | Uint8Array | string;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32Buffer(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

/**
 * Builds a valid standard ZIP (and KMZ) archive buffer using STORE (method 0)
 * with UTF-8 filename flags (bit 11 = 0x0800) and DOS timestamps.
 */
export function buildZipArchive(
  files: ZipArchiveEntry[],
  modifiedAt: Date = new Date()
): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  const usedNames = new Set<string>();
  const { dosTime, dosDate } = toDosDateTime(modifiedAt);
  let offset = 0;
  let entryCount = 0;

  for (const f of files) {
    let cleanName = f.name.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleanName) continue;

    // Ensure unique filenames inside the archive
    if (usedNames.has(cleanName)) {
      const dotIdx = cleanName.lastIndexOf('.');
      const base = dotIdx > 0 ? cleanName.slice(0, dotIdx) : cleanName;
      const ext = dotIdx > 0 ? cleanName.slice(dotIdx) : '';
      let counter = 2;
      while (usedNames.has(`${base}_${counter}${ext}`)) {
        counter++;
      }
      cleanName = `${base}_${counter}${ext}`;
    }
    usedNames.add(cleanName);

    const nameBuf = Buffer.from(cleanName, 'utf8');
    const dataBuf =
      typeof f.data === 'string'
        ? Buffer.from(f.data, 'utf8')
        : Buffer.isBuffer(f.data)
          ? f.data
          : Buffer.from(f.data);
    const crc = crc32Buffer(dataBuf);
    const len = dataBuf.length;

    // Local file header (30 bytes + filename length)
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); // local file header signature
    h.writeUInt16LE(20, 4); // version needed to extract (2.0)
    h.writeUInt16LE(0x0800, 6); // general purpose bit flag: UTF-8 filename
    h.writeUInt16LE(0, 8); // compression method: 0 = STORE
    h.writeUInt16LE(dosTime, 10);
    h.writeUInt16LE(dosDate, 12);
    h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(len, 18); // compressed size
    h.writeUInt32LE(len, 22); // uncompressed size
    h.writeUInt16LE(nameBuf.length, 26);
    h.writeUInt16LE(0, 28); // extra field length

    parts.push(h, nameBuf, dataBuf);

    // Central directory file header (46 bytes + filename length)
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); // central file header signature
    c.writeUInt16LE(20, 4); // version made by
    c.writeUInt16LE(20, 6); // version needed
    c.writeUInt16LE(0x0800, 8); // general purpose bit flag: UTF-8 filename
    c.writeUInt16LE(0, 10); // compression method: 0 = STORE
    c.writeUInt16LE(dosTime, 12);
    c.writeUInt16LE(dosDate, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(len, 20); // compressed size
    c.writeUInt32LE(len, 24); // uncompressed size
    c.writeUInt16LE(nameBuf.length, 28);
    c.writeUInt16LE(0, 30); // extra field length
    c.writeUInt16LE(0, 32); // file comment length
    c.writeUInt16LE(0, 34); // disk number start
    c.writeUInt16LE(0, 36); // internal file attributes
    c.writeUInt32LE(0, 38); // external file attributes
    c.writeUInt32LE(offset, 42); // relative offset of local header

    central.push(c, nameBuf);

    offset += h.length + nameBuf.length + dataBuf.length;
    entryCount++;
  }

  const centralOffset = offset;
  let centralSize = 0;
  for (const c of central) centralSize += c.length;

  // End of central directory record (22 bytes)
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // EOCD signature
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // start disk
  end.writeUInt16LE(entryCount, 8); // entries on this disk
  end.writeUInt16LE(entryCount, 10); // total entries
  end.writeUInt32LE(centralSize, 12); // size of central directory
  end.writeUInt32LE(centralOffset, 16); // offset of central directory
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...parts, ...central, end]);
}
