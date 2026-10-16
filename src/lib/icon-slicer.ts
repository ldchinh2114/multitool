// Logic thuần cho công cụ Icon Slicer: chuẩn hoá vùng chọn, toạ độ lasso,
// tính toán kích thước xuất và đặt tên tệp. Tách khỏi component để test được
// bằng Vitest mà không cần DOM/canvas.

/** Hình chữ nhật trong hệ toạ độ pixel gốc của ảnh. */
export interface SliceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point {
  x: number;
  y: number;
}

export type ShapeKind = 'rect' | 'lasso';

/**
 * Một vùng đã chọn. Với lasso, `path` lưu các điểm đã chuẩn hoá về 0..1
 * *bên trong* `box`, nên khi di chuyển/đổi kích thước chỉ cần sửa `box`
 * là đường vẽ co giãn theo.
 */
export interface SliceShape {
  id: string;
  kind: ShapeKind;
  box: SliceBox;
  path?: Point[];
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';

export const MIN_SLICE_SIZE = 1;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4;
/** Khoảng cách tối thiểu (px trong ảnh gốc) để coi một thao tác kéo là "có vẽ". */
export const MIN_DRAG_DISTANCE = 2;

const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/avif',
];

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** PNG/JPEG/WebP/GIF/BMP/AVIF vẽ được lên canvas; SVG bị loại vì thiếu kích thước. */
export function isSupportedImageFile(type: string): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(type.toLowerCase());
}

/** Dựng hình chữ nhật dương từ hai điểm kéo bất kỳ (kéo ngược hướng vẫn đúng). */
export function normalizeRect(ax: number, ay: number, bx: number, by: number): SliceBox {
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    w: Math.abs(bx - ax),
    h: Math.abs(by - ay),
  };
}

/**
 * Làm tròn về pixel nguyên, ép kích thước tối thiểu và giữ vùng chọn nằm
 * trọn trong ảnh. Đây là cửa ngõ duy nhất để ghi toạ độ vào state.
 */
export function snapSliceBox(rect: SliceBox, imageWidth: number, imageHeight: number): SliceBox {
  const maxW = Math.max(MIN_SLICE_SIZE, Math.round(imageWidth));
  const maxH = Math.max(MIN_SLICE_SIZE, Math.round(imageHeight));
  const w = clampValue(Math.round(rect.w), MIN_SLICE_SIZE, maxW);
  const h = clampValue(Math.round(rect.h), MIN_SLICE_SIZE, maxH);
  const x = clampValue(Math.round(rect.x), 0, Math.max(0, maxW - w));
  const y = clampValue(Math.round(rect.y), 0, Math.max(0, maxH - h));
  return { x, y, w, h };
}

/** Vùng chọn hoàn chỉnh sau khi người dùng kéo từ `start` tới `end`. */
export function makeRectFromDrag(
  start: Point,
  end: Point,
  imageWidth: number,
  imageHeight: number
): SliceBox {
  const rect = normalizeRect(start.x, start.y, end.x, end.y);
  return snapSliceBox(rect, imageWidth, imageHeight);
}

/** Di chuyển vùng chọn theo delta, không cho vượt ra ngoài ảnh. */
export function translateBox(
  box: SliceBox,
  dx: number,
  dy: number,
  imageWidth: number,
  imageHeight: number
): SliceBox {
  const x = clampValue(Math.round(box.x + dx), 0, Math.max(0, imageWidth - box.w));
  const y = clampValue(Math.round(box.y + dy), 0, Math.max(0, imageHeight - box.h));
  return { ...box, x, y };
}

/**
 * Đổi kích thước theo một trong 8 tay cầm. Delta được tính từ vị trí bắt đầu
 * kéo, nên gọi liên tục vẫn ổn định (không bị trôi).
 */
export function resizeBox(
  box: SliceBox,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  imageWidth: number,
  imageHeight: number
): SliceBox {
  const deltaX = Math.round(dx);
  const deltaY = Math.round(dy);
  let left = box.x;
  let top = box.y;
  let right = box.x + box.w;
  let bottom = box.y + box.h;

  if (handle.includes('w')) {
    left = clampValue(box.x + deltaX, 0, right - MIN_SLICE_SIZE);
  }
  if (handle.includes('e')) {
    right = clampValue(box.x + box.w + deltaX, left + MIN_SLICE_SIZE, imageWidth);
  }
  if (handle.includes('n')) {
    top = clampValue(box.y + deltaY, 0, bottom - MIN_SLICE_SIZE);
  }
  if (handle.includes('s')) {
    bottom = clampValue(box.y + box.h + deltaY, top + MIN_SLICE_SIZE, imageHeight);
  }

  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Chỉnh zoom nhưng luôn nằm trong khoảng cho phép. */
export function clampZoom(zoom: number): number {
  return clampValue(zoom, MIN_ZOOM, MAX_ZOOM);
}

/** Tỉ lệ hiển thị để ảnh vừa khung nhìn (không phóng to quá 100%). */
export function fitScale(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number
): number {
  if (imageWidth <= 0 || imageHeight <= 0) return 1;
  if (viewportWidth <= 0 || viewportHeight <= 0) return 1;
  const scale = Math.min(viewportWidth / imageWidth, viewportHeight / imageHeight);
  return clampZoom(Math.min(1, scale));
}

/** Bounding box của một đường lasso, đã kẹp trong ảnh. */
export function boundsFromPoints(
  points: Point[],
  imageWidth: number,
  imageHeight: number
): SliceBox {
  if (points.length === 0) {
    return { x: 0, y: 0, w: MIN_SLICE_SIZE, h: MIN_SLICE_SIZE };
  }
  let minX = points[0].x;
  let minY = points[0].y;
  let maxX = points[0].x;
  let maxY = points[0].y;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return makeRectFromDrag({ x: minX, y: minY }, { x: maxX, y: maxY }, imageWidth, imageHeight);
}

/**
 * Chuẩn hoá các điểm lasso (toạ độ ảnh gốc) về 0..1 bên trong `box`,
 * để `box` là nguồn sự thật duy nhất khi di chuyển/đổi kích thước.
 */
export function toNormalizedPath(points: Point[], box: SliceBox): Point[] {
  const width = Math.max(MIN_SLICE_SIZE, box.w);
  const height = Math.max(MIN_SLICE_SIZE, box.h);
  return points.map((point) => ({
    x: clampValue((point.x - box.x) / width, 0, 1),
    y: clampValue((point.y - box.y) / height, 0, 1),
  }));
}

export type OutputMode = 'original' | 'square';

export interface ExportSettings {
  mode: OutputMode;
  /** Cạnh của khung vuông khi `mode === 'square'`. */
  squareSize: number;
  /** Lề tính theo % cạnh khung, 0..45. */
  paddingPercent: number;
}

/** Vị trí đặt vùng cắt trên canvas xuất ra. */
export interface ExportLayout {
  canvasWidth: number;
  canvasHeight: number;
  destX: number;
  destY: number;
  destWidth: number;
  destHeight: number;
}

const MAX_PADDING_PERCENT = 45;

/**
 * Tính khung canvas và vị trí vẽ cho một vùng chọn.
 * - `original`: giữ đúng kích thước vùng chọn.
 * - `square`: đưa vùng chọn vào giữa khung vuông, giữ nguyên tỉ lệ.
 */
export function resolveExportLayout(box: SliceBox, settings: ExportSettings): ExportLayout {
  if (settings.mode === 'original') {
    return {
      canvasWidth: box.w,
      canvasHeight: box.h,
      destX: 0,
      destY: 0,
      destWidth: box.w,
      destHeight: box.h,
    };
  }

  const size = Math.max(MIN_SLICE_SIZE, Math.round(settings.squareSize));
  const padding = size * (clampValue(settings.paddingPercent, 0, MAX_PADDING_PERCENT) / 100);
  const available = Math.max(1, size - padding * 2);
  const scale = Math.min(available / box.w, available / box.h);
  const destWidth = box.w * scale;
  const destHeight = box.h * scale;

  return {
    canvasWidth: size,
    canvasHeight: size,
    destX: (size - destWidth) / 2,
    destY: (size - destHeight) / 2,
    destWidth,
    destHeight,
  };
}

/** Hình chữ nhật đích để ánh xạ đường lasso (dùng cho cả canvas xuất và thumbnail). */
export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Ánh xạ các điểm lasso (0..1) sang toạ độ trong hình chữ nhật đích. */
export function scalePathToLayout(path: Point[], rect: TargetRect): Point[] {
  return path.map((point) => ({
    x: rect.x + point.x * rect.width,
    y: rect.y + point.y * rect.height,
  }));
}

/** Loại bỏ ký tự không hợp lệ trong tên tệp trên Windows/macOS/Linux. */
export function sanitizeFileNameBase(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface FileNameOptions {
  /** Số bắt đầu, mặc định 1. */
  start?: number;
  /** Tổng số tệp, dùng để tính độ rộng khi bật zero-pad. */
  total?: number;
  pad?: boolean;
  extension?: string;
}

/**
 * Sinh tên tệp từ mẫu. `{n}` là chỗ đặt số thứ tự; nếu mẫu không có `{n}`
 * thì số được nối vào cuối. Mặc định: mẫu `{n}` -> `1.png`, `2.png`, ...
 */
export function makeFileName(
  pattern: string,
  index: number,
  options: FileNameOptions = {}
): string {
  const start = options.start ?? 1;
  const number = start + index;
  let digits = String(number);

  if (options.pad) {
    const lastNumber = start + Math.max(0, (options.total ?? 1) - 1);
    digits = digits.padStart(String(lastNumber).length, '0');
  }

  const trimmed = pattern.trim();
  const base = trimmed.length > 0 ? sanitizeFileNameBase(trimmed) : '{n}';
  const name = base.indexOf('{n}') >= 0 ? base.split('{n}').join(digits) : `${base}${digits}`;

  const extension = (options.extension ?? 'png').replace(/^\./, '');
  return `${name}.${extension}`;
}
