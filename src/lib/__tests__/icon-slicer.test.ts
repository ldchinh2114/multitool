import { describe, it, expect } from 'vitest';
import { createZip, crc32, type ZipEntry } from '@/lib/zip';
import {
  MIN_SLICE_SIZE,
  MAX_ZOOM,
  MIN_ZOOM,
  boundsFromPoints,
  clampZoom,
  fitScale,
  isSupportedImageFile,
  makeFileName,
  makeRectFromDrag,
  normalizeRect,
  resolveExportLayout,
  resizeBox,
  sanitizeFileNameBase,
  scalePathToLayout,
  snapSliceBox,
  toNormalizedPath,
  translateBox,
} from '@/lib/icon-slicer';

async function readZipBytes(entries: ZipEntry[], modifiedAt = new Date(2026, 0, 2, 3, 4, 6)) {
  const blob = createZip(entries, modifiedAt);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { blob, bytes };
}

function readUint32(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function readUint16(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true);
}

describe('crc32', () => {
  it('matches the standard check value for "123456789"', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  })

  it('returns 0 for empty input', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('createZip', () => {
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

  it('starts with the local file header signature', async () => {
    const { bytes } = await readZipBytes([{ name: '1.png', data: png }]);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('stores entries uncompressed with a UTF-8 flag and a matching crc', async () => {
    const { bytes } = await readZipBytes([{ name: '1.png', data: png }]);

    expect(readUint16(bytes, 6)).toBe(0x0800);
    expect(readUint16(bytes, 8)).toBe(0);
    expect(readUint32(bytes, 14)).toBe(crc32(png));
    expect(readUint32(bytes, 18)).toBe(png.length);
    expect(readUint32(bytes, 22)).toBe(png.length);

    const nameLength = readUint16(bytes, 26);
    expect(readUint16(bytes, 28)).toBe(0);
    expect(new TextDecoder().decode(bytes.slice(30, 30 + nameLength))).toBe('1.png');

    const dataStart = 30 + nameLength;
    expect(Array.from(bytes.slice(dataStart, dataStart + png.length))).toEqual(Array.from(png));
  });

  it('writes one central directory record per entry and a valid EOCD', async () => {
    const entries: ZipEntry[] = [
      { name: '1.png', data: png },
      { name: '2.png', data: new Uint8Array([9, 9]) },
    ];
    const { bytes } = await readZipBytes(entries);

    // Local headers: 30 + name + data cho từng tệp
    const localSize =
      entries.reduce((sum, entry) => sum + 30 + entry.name.length + entry.data.length, 0);
    const centralOffset = localSize;

    expect(readUint32(bytes, centralOffset)).toBe(0x02014b50);
    expect(readUint16(bytes, centralOffset + 28)).toBe('1.png'.length);

    const secondCentralOffset = centralOffset + 46 + '1.png'.length;
    expect(readUint32(bytes, secondCentralOffset)).toBe(0x02014b50);

    const centralSize = 46 * 2 + '1.png'.length + '2.png'.length;
    const eocdOffset = localSize + centralSize;
    expect(readUint32(bytes, eocdOffset)).toBe(0x06054b50);
    expect(readUint16(bytes, eocdOffset + 8)).toBe(2);
    expect(readUint16(bytes, eocdOffset + 10)).toBe(2);
    expect(readUint32(bytes, eocdOffset + 12)).toBe(centralSize);
    expect(readUint32(bytes, eocdOffset + 16)).toBe(localSize);
    expect(bytes.length).toBe(eocdOffset + 22);
  });

  it('produces an empty archive when there are no entries', async () => {
    const { bytes } = await readZipBytes([]);
    expect(bytes.length).toBe(22);
    expect(readUint32(bytes, 0)).toBe(0x06054b50);
    expect(readUint16(bytes, 8)).toBe(0);
  });
});

describe('isSupportedImageFile', () => {
  it('accepts common raster formats', () => {
    expect(isSupportedImageFile('image/png')).toBe(true);
    expect(isSupportedImageFile('IMAGE/JPEG')).toBe(true);
    expect(isSupportedImageFile('image/webp')).toBe(true);
  });

  it('rejects svg and non-images', () => {
    expect(isSupportedImageFile('image/svg+xml')).toBe(false);
    expect(isSupportedImageFile('application/pdf')).toBe(false);
  });
});

describe('normalizeRect', () => {
  it('handles a top-left to bottom-right drag', () => {
    expect(normalizeRect(10, 20, 40, 60)).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });

  it('handles a reversed drag', () => {
    expect(normalizeRect(40, 60, 10, 20)).toEqual({ x: 10, y: 20, w: 30, h: 40 });
  });
});

describe('makeRectFromDrag', () => {
  it('rounds to whole pixels and keeps a minimum size', () => {
    expect(makeRectFromDrag({ x: 10.4, y: 10.6 }, { x: 20.2, y: 20.9 }, 100, 100)).toEqual({
      x: 10,
      y: 11,
      w: 10,
      h: 10,
    });
  });

  it('never produces a zero-sized box', () => {
    const box = makeRectFromDrag({ x: 5, y: 5 }, { x: 5, y: 5 }, 100, 100);
    expect(box.w).toBe(MIN_SLICE_SIZE);
    expect(box.h).toBe(MIN_SLICE_SIZE);
  });

  it('pulls an out-of-bounds drag back inside the image', () => {
    const box = makeRectFromDrag({ x: -50, y: -50 }, { x: 500, y: 500 }, 200, 150);
    expect(box).toEqual({ x: 0, y: 0, w: 200, h: 150 });
  });

  it('shrinks a box larger than the image down to the image', () => {
    expect(snapSliceBox({ x: 0, y: 0, w: 500, h: 500 }, 120, 90)).toEqual({
      x: 0,
      y: 0,
      w: 120,
      h: 90,
    });
  });
});

describe('translateBox', () => {
  it('moves the box by the delta', () => {
    expect(translateBox({ x: 10, y: 10, w: 20, h: 20 }, 5, -3, 100, 100)).toEqual({
      x: 15,
      y: 7,
      w: 20,
      h: 20,
    });
  });

  it('stops at the right and bottom edges without resizing', () => {
    expect(translateBox({ x: 10, y: 10, w: 20, h: 20 }, 500, 500, 100, 100)).toEqual({
      x: 80,
      y: 80,
      w: 20,
      h: 20,
    });
  });

  it('stops at the left and top edges', () => {
    expect(translateBox({ x: 10, y: 10, w: 20, h: 20 }, -500, -500, 100, 100)).toEqual({
      x: 0,
      y: 0,
      w: 20,
      h: 20,
    });
  });
});

describe('resizeBox', () => {
  const box = { x: 40, y: 40, w: 40, h: 40 };

  it('grows from the south-east handle', () => {
    expect(resizeBox(box, 'se', 10, 20, 200, 200)).toEqual({ x: 40, y: 40, w: 50, h: 60 });
  });

  it('moves the origin when dragging the north-west handle', () => {
    expect(resizeBox(box, 'nw', -10, -10, 200, 200)).toEqual({ x: 30, y: 30, w: 50, h: 50 });
  });

  it('only changes one axis for an edge handle', () => {
    expect(resizeBox(box, 'e', 15, 99, 200, 200)).toEqual({ x: 40, y: 40, w: 55, h: 40 });
  });

  it('keeps a minimum size when dragging past the opposite edge', () => {
    const result = resizeBox(box, 'e', -500, 0, 200, 200);
    expect(result.w).toBe(MIN_SLICE_SIZE);
    expect(result.x).toBe(40);
  });

  it('is idempotent for the same start box and delta', () => {
    expect(resizeBox(box, 'se', 12, 8, 200, 200)).toEqual(resizeBox(box, 'se', 12, 8, 200, 200));
  });

  it('does not let the box leave the image', () => {
    const result = resizeBox({ x: 80, y: 80, w: 10, h: 10 }, 'se', 100, 100, 100, 100);
    expect(result.x + result.w).toBe(100);
    expect(result.y + result.h).toBe(100);
  });
});

describe('zoom helpers', () => {
  it('clamps zoom into the allowed range', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(99)).toBe(MAX_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it('fits a large image down without upscaling a small one', () => {
    expect(fitScale(2000, 1000, 1000, 800)).toBeCloseTo(0.5);
    expect(fitScale(100, 100, 1000, 1000)).toBe(1);
  });

  it('degrades gracefully for empty dimensions', () => {
    expect(fitScale(0, 0, 500, 500)).toBe(1);
    expect(fitScale(100, 100, 0, 0)).toBe(1);
  });
});

describe('lasso path helpers', () => {
  it('derives a clamped bounding box from traced points', () => {
    const box = boundsFromPoints(
      [
        { x: 30, y: 30 },
        { x: 10, y: 50 },
        { x: 45, y: 20 },
      ],
      100,
      100
    );
    expect(box).toEqual({ x: 10, y: 20, w: 35, h: 30 });
  });

  it('clamps traced points that fall outside the image', () => {
    const box = boundsFromPoints([{ x: -20, y: -20 }, { x: 300, y: 300 }], 100, 100);
    expect(box).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it('normalizes points into the box so resizing scales the path', () => {
    const path = toNormalizedPath(
      [
        { x: 20, y: 30 },
        { x: 60, y: 30 },
        { x: 60, y: 80 },
      ],
      { x: 20, y: 30, w: 40, h: 50 }
    );
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
    ]);
  });

  it('clamps normalized points to 0..1', () => {
    const path = toNormalizedPath([{ x: -100, y: 999 }], { x: 10, y: 10, w: 10, h: 10 });
    expect(path).toEqual([{ x: 0, y: 1 }]);
  });
});

describe('resolveExportLayout', () => {
  const box = { x: 0, y: 0, w: 100, h: 50 };

  it('keeps the slice size in original mode', () => {
    expect(resolveExportLayout(box, { mode: 'original', squareSize: 512, paddingPercent: 0 })).toEqual(
      {
        canvasWidth: 100,
        canvasHeight: 50,
        destX: 0,
        destY: 0,
        destWidth: 100,
        destHeight: 50,
      }
    );
  });

  it('letterboxes a wide slice inside a square canvas, centred', () => {
    const layout = resolveExportLayout(box, { mode: 'square', squareSize: 512, paddingPercent: 0 });
    expect(layout.canvasWidth).toBe(512);
    expect(layout.canvasHeight).toBe(512);
    expect(layout.destWidth).toBe(512);
    expect(layout.destHeight).toBe(256);
    expect(layout.destX).toBe(0);
    expect(layout.destY).toBe(128);
  });

  it('applies padding as a percentage of the square', () => {
    const layout = resolveExportLayout(box, { mode: 'square', squareSize: 200, paddingPercent: 10 });
    expect(layout.destWidth).toBe(160);
    expect(layout.destHeight).toBe(80);
    expect(layout.destX).toBe(20);
    expect(layout.destY).toBe(60);
  });

  it('caps excessive padding so the slice never disappears', () => {
    const layout = resolveExportLayout(box, { mode: 'square', squareSize: 200, paddingPercent: 90 });
    expect(layout.destWidth).toBeGreaterThan(0);
    expect(layout.destHeight).toBeGreaterThan(0);
  });

  it('scales lasso points into the destination rectangle', () => {
    const layout = resolveExportLayout(
      { x: 0, y: 0, w: 10, h: 10 },
      { mode: 'square', squareSize: 100, paddingPercent: 0 }
    );
    expect(
      scalePathToLayout([{ x: 0, y: 0 }, { x: 1, y: 1 }], {
        x: layout.destX,
        y: layout.destY,
        width: layout.destWidth,
        height: layout.destHeight,
      })
    ).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]);
  });
});

describe('makeFileName', () => {
  it('numbers files from 1 by default', () => {
    expect(makeFileName('{n}', 0, { total: 3 })).toBe('1.png');
    expect(makeFileName('{n}', 1, { total: 3 })).toBe('2.png');
    expect(makeFileName('{n}', 2, { total: 3 })).toBe('3.png');
  });

  it('honours a prefix pattern', () => {
    expect(makeFileName('icon-{n}', 4, { total: 10 })).toBe('icon-5.png');
  });

  it('appends the number when the pattern has no token', () => {
    expect(makeFileName('icon', 0, { total: 1 })).toBe('icon1.png');
  });

  it('falls back to plain numbering for a blank pattern', () => {
    expect(makeFileName('   ', 0, { total: 1 })).toBe('1.png');
  });

  it('supports a custom start number', () => {
    expect(makeFileName('{n}', 0, { start: 10, total: 2 })).toBe('10.png');
    expect(makeFileName('{n}', 1, { start: 10, total: 2 })).toBe('11.png');
  });

  it('zero-pads to the width of the highest number', () => {
    expect(makeFileName('{n}', 0, { total: 12, pad: true })).toBe('01.png');
    expect(makeFileName('{n}', 11, { total: 12, pad: true })).toBe('12.png');
    expect(makeFileName('{n}', 0, { total: 120, pad: true })).toBe('001.png');
  });

  it('does not pad when there are fewer than ten files', () => {
    expect(makeFileName('{n}', 0, { total: 3, pad: true })).toBe('1.png');
  });

  it('accepts a custom extension', () => {
    expect(makeFileName('{n}', 0, { total: 1, extension: 'webp' })).toBe('1.webp');
  });

  it('strips characters that are illegal in file names', () => {
    expect(makeFileName('a/b:c*{n}', 0, { total: 1 })).toBe('a-b-c-1.png');
  });
});

describe('sanitizeFileNameBase', () => {
  it('replaces separators and reserved characters', () => {
    expect(sanitizeFileNameBase('a<b>c:d"e|f?g*h/i\\j')).toBe('a-b-c-d-e-f-g-h-i-j');
  });

  it('collapses runs of whitespace but keeps a single space', () => {
    expect(sanitizeFileNameBase('  icon   set  ')).toBe('icon set');
  });
});
