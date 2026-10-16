// Trình tạo ZIP tối giản, chỉ dùng phương thức "store" (không nén).
// Dữ liệu PNG/JPEG vốn đã được nén sẵn nên không cần deflate — nhờ vậy
// không phải thêm thư viện (pako chỉ làm zlib/gzip, không tạo được container ZIP).

/** Một tệp trong archive. `data` là nội dung nhị phân thô. */
export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const SIG_LOCAL_HEADER = 0x04034b50;
const SIG_CENTRAL_HEADER = 0x02014b50;
const SIG_END_OF_CENTRAL = 0x06054b50;

const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_OF_CENTRAL_SIZE = 22;

// Bit 11 của "general purpose flag" báo rằng tên tệp mã hoá UTF-8
const FLAG_UTF8 = 0x0800;
// Phiên bản ZIP tối thiểu: 2.0 (hỗ trợ thư mục + nén)
const VERSION = 20;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[n] = value >>> 0;
  }
  return table;
})();

/** CRC-32 (IEEE) của một mảng byte, trả về số nguyên không dấu 32 bit. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Chuyển một mốc thời gian sang định dạng MS-DOS (giây chia đôi, năm tính
 * từ 1980) mà ZIP yêu cầu. Năm nhỏ hơn 1980 sẽ được kẹp về 1980.
 */
function toDosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dateField = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dateField };
}

/**
 * Đóng gói danh sách tệp thành một Blob ZIP hoàn chỉnh (store-only).
 *
 * Ghi lần lượt: local file header + dữ liệu của từng tệp, rồi central
 * directory, rồi bản ghi End Of Central Directory.
 */
export function createZip(entries: ZipEntry[], modifiedAt: Date = new Date()): Blob {
  const encoder = new TextEncoder();
  const { time: dosTime, date: dosDate } = toDosDateTime(modifiedAt);

  const prepared = entries.map((entry) => {
    const nameBytes = encoder.encode(entry.name);
    return {
      nameBytes,
      data: entry.data,
      crc: crc32(entry.data),
      offset: 0,
    };
  });

  let localSize = 0;
  let centralSize = 0;
  for (const entry of prepared) {
    localSize += LOCAL_HEADER_SIZE + entry.nameBytes.length + entry.data.length;
    centralSize += CENTRAL_HEADER_SIZE + entry.nameBytes.length;
  }

  const buffer = new Uint8Array(localSize + centralSize + END_OF_CENTRAL_SIZE);
  const view = new DataView(buffer.buffer);

  let localOffset = 0;
  let centralOffset = localSize;

  for (const entry of prepared) {
    entry.offset = localOffset;

    // --- Local file header ---
    view.setUint32(localOffset, SIG_LOCAL_HEADER, true);
    view.setUint16(localOffset + 4, VERSION, true);
    view.setUint16(localOffset + 6, FLAG_UTF8, true);
    view.setUint16(localOffset + 8, 0, true); // phương thức 0 = store
    view.setUint16(localOffset + 10, dosTime, true);
    view.setUint16(localOffset + 12, dosDate, true);
    view.setUint32(localOffset + 14, entry.crc, true);
    view.setUint32(localOffset + 18, entry.data.length, true);
    view.setUint32(localOffset + 22, entry.data.length, true);
    view.setUint16(localOffset + 26, entry.nameBytes.length, true);
    view.setUint16(localOffset + 28, 0, true); // độ dài phần mở rộng
    buffer.set(entry.nameBytes, localOffset + LOCAL_HEADER_SIZE);
    buffer.set(entry.data, localOffset + LOCAL_HEADER_SIZE + entry.nameBytes.length);

    localOffset += LOCAL_HEADER_SIZE + entry.nameBytes.length + entry.data.length;

    // --- Central directory header ---
    view.setUint32(centralOffset, SIG_CENTRAL_HEADER, true);
    view.setUint16(centralOffset + 4, VERSION, true); // phiên bản tạo ra
    view.setUint16(centralOffset + 6, VERSION, true); // phiên bản cần để đọc
    view.setUint16(centralOffset + 8, FLAG_UTF8, true);
    view.setUint16(centralOffset + 10, 0, true);
    view.setUint16(centralOffset + 12, dosTime, true);
    view.setUint16(centralOffset + 14, dosDate, true);
    view.setUint32(centralOffset + 16, entry.crc, true);
    view.setUint32(centralOffset + 20, entry.data.length, true);
    view.setUint32(centralOffset + 24, entry.data.length, true);
    view.setUint16(centralOffset + 28, entry.nameBytes.length, true);
    view.setUint16(centralOffset + 30, 0, true); // extra
    view.setUint16(centralOffset + 32, 0, true); // comment
    view.setUint16(centralOffset + 34, 0, true); // đĩa bắt đầu
    view.setUint16(centralOffset + 36, 0, true); // thuộc tính nội bộ
    view.setUint32(centralOffset + 38, 0, true); // thuộc tính ngoài
    view.setUint32(centralOffset + 42, entry.offset, true);
    buffer.set(entry.nameBytes, centralOffset + CENTRAL_HEADER_SIZE);

    centralOffset += CENTRAL_HEADER_SIZE + entry.nameBytes.length;
  }

  // --- End Of Central Directory ---
  const eocdOffset = localSize + centralSize;
  view.setUint32(eocdOffset, SIG_END_OF_CENTRAL, true);
  view.setUint16(eocdOffset + 4, 0, true); // số đĩa
  view.setUint16(eocdOffset + 6, 0, true); // đĩa chứa central directory
  view.setUint16(eocdOffset + 8, prepared.length, true);
  view.setUint16(eocdOffset + 10, prepared.length, true);
  view.setUint32(eocdOffset + 12, centralSize, true);
  view.setUint32(eocdOffset + 16, localSize, true);
  view.setUint16(eocdOffset + 20, 0, true); // độ dài comment

  return new Blob([buffer], { type: 'application/zip' });
}
