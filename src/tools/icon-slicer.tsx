'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  FileArchive,
  Image as ImageIcon,
  Lasso,
  Loader2,
  Maximize,
  RotateCcw,
  Scissors,
  Square,
  Trash2,
  Undo2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLanguage } from '@/lib/language-context';
import {
  MAX_ZOOM,
  MIN_DRAG_DISTANCE,
  MIN_ZOOM,
  type ExportSettings,
  type Point,
  type ResizeHandle,
  type ShapeKind,
  type SliceBox,
  type SliceShape,
  boundsFromPoints,
  clampZoom,
  fitScale,
  isSupportedImageFile,
  makeFileName,
  makeRectFromDrag,
  normalizeRect,
  resizeBox,
  resolveExportLayout,
  scalePathToLayout,
  toNormalizedPath,
  translateBox,
} from '@/lib/icon-slicer';
import { createZip, type ZipEntry } from '@/lib/zip';

const MAX_HISTORY = 50;
const ZIP_FILE_NAME = 'icon-slices.zip';

/** Nền caro để thấy rõ vùng trong suốt của ảnh. */
const CHECKERBOARD_STYLE: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
};

type Interaction =
  | {
      kind: 'draw';
      tool: ShapeKind;
      start: Point;
      end: Point;
      points: Point[];
      pointerId: number;
      moved: boolean;
    }
  | {
      kind: 'move';
      id: string;
      start: Point;
      startBox: SliceBox;
      startSlices: SliceShape[];
      pointerId: number;
      moved: boolean;
    }
  | {
      kind: 'resize';
      id: string;
      handle: ResizeHandle;
      start: Point;
      startBox: SliceBox;
      startSlices: SliceShape[];
      pointerId: number;
      moved: boolean;
    };

interface DraftShape {
  kind: ShapeKind;
  start: Point;
  end: Point;
  points: Point[];
}

interface ExportedSlice {
  blob: Blob;
  name: string;
}

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Ảnh lấy từ object URL cục bộ nên canvas không bị "taint"; nếu có lỗi
    // (ví dụ nguồn ảnh khác origin) thì promise sẽ reject và UI báo lỗi.
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the canvas'))),
      'image/png'
    );
  });
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Áp dụng cùng logic cắt của bản xuất ra canvas, dùng cho cả thumbnail. */
function drawSlice(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  shape: SliceShape,
  destX: number,
  destY: number,
  destWidth: number,
  destHeight: number
) {
  let clipped = false;
  if (shape.kind === 'lasso' && shape.path && shape.path.length >= 3) {
    const points = scalePathToLayout(shape.path, {
      x: destX,
      y: destY,
      width: destWidth,
      height: destHeight,
    });
    const path = new Path2D();
    points.forEach((point, index) => {
      if (index === 0) path.moveTo(point.x, point.y);
      else path.lineTo(point.x, point.y);
    });
    path.closePath();
    ctx.save();
    ctx.clip(path);
    clipped = true;
  }

  ctx.drawImage(
    image,
    shape.box.x,
    shape.box.y,
    shape.box.w,
    shape.box.h,
    destX,
    destY,
    destWidth,
    destHeight
  );

  if (clipped) ctx.restore();
}

/**
 * Thumbnail của một vùng chọn. Vẽ lại mỗi khi hộp thay đổi (kéo/đổi kích
 * thước) để người dùng thấy đúng thứ sẽ được xuất ra.
 */
function SliceThumbnail({
  image,
  shape,
  size = 40,
}: {
  image: HTMLImageElement | null;
  shape: SliceShape;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { box, kind, path } = shape;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = 2;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(canvas.width / box.w, canvas.height / box.h);
    const drawWidth = box.w * scale;
    const drawHeight = box.h * scale;
    const destX = (canvas.width - drawWidth) / 2;
    const destY = (canvas.height - drawHeight) / 2;

    drawSlice(ctx, image, shape, destX, destY, drawWidth, drawHeight);
  }, [image, shape, box, kind, path, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, ...CHECKERBOARD_STYLE }}
      className="shrink-0 rounded-md border border-gray-200"
    />
  );
}

const HANDLE_POSITIONS: { handle: ResizeHandle; className: string; cursor: string }[] = [
  { handle: 'nw', className: 'left-0 top-0', cursor: 'cursor-nwse-resize' },
  { handle: 'n', className: 'left-1/2 top-0', cursor: 'cursor-ns-resize' },
  { handle: 'ne', className: 'left-full top-0', cursor: 'cursor-nesw-resize' },
  { handle: 'e', className: 'left-full top-1/2', cursor: 'cursor-ew-resize' },
  { handle: 'se', className: 'left-full top-full', cursor: 'cursor-nwse-resize' },
  { handle: 's', className: 'left-1/2 top-full', cursor: 'cursor-ns-resize' },
  { handle: 'sw', className: 'left-0 top-full', cursor: 'cursor-nesw-resize' },
  { handle: 'w', className: 'left-0 top-1/2', cursor: 'cursor-ew-resize' },
];

function IconSlicerContent() {
  const { t } = useLanguage();

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  // Giữ luôn phần tử <img> đã tải xong để vẽ canvas mà không phải đọc ref khi render
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [slices, setSlices] = useState<SliceShape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<ShapeKind>('rect');
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<SliceShape[][]>([]);
  const [draft, setDraft] = useState<DraftShape | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const [pattern, setPattern] = useState('{n}');
  const [startNumber, setStartNumber] = useState(1);
  const [padNumbers, setPadNumbers] = useState(false);
  const [pixelArt, setPixelArt] = useState(false);
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    mode: 'original',
    squareSize: 512,
    paddingPercent: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const sliceIdRef = useRef(0);
  // Giữ danh sách object URL để thu hồi, tránh rò rỉ bộ nhớ
  const objectUrls = useRef<string[]>([]);

  const trackUrl = (url: string) => {
    objectUrls.current.push(url);
    return url;
  };

  const revokeUrl = (url: string) => {
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrls.current = objectUrls.current.filter((u) => u !== url);
  };

  useEffect(() => {
    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current = [];
    };
  }, []);

  const resetEditor = () => {
    setSlices([]);
    setHistory([]);
    setSelectedId(null);
    setDraft(null);
    setExportError('');
    interactionRef.current = null;
  };

  const handleFile = (file: File) => {
    if (!isSupportedImageFile(file.type)) {
      setUploadError(t('unsupportedImage'));
      return;
    }
    // Dọn ảnh cũ trước khi nạp ảnh mới
    revokeUrl(imageUrl);
    resetEditor();
    setUploadError('');
    setImageSize({ width: 0, height: 0 });
    setZoom(1);
    setSourceFile(file);
    setImageUrl(trackUrl(URL.createObjectURL(file)));
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    // Cho phép chọn lại cùng một tệp
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleImageLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    setImageSize({ width, height });
    const stage = stageRef.current;
    setZoom(
      fitScale(width, height, stage ? stage.clientWidth - 32 : 0, stage ? stage.clientHeight - 32 : 0)
    );
  };

  const pushHistory = (snapshot: SliceShape[]) => {
    setHistory((previous) => [...previous, snapshot].slice(-MAX_HISTORY));
  };

  const undo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(history.slice(0, -1));
    setSlices(previous);
    setSelectedId((current) =>
      current && previous.some((shape) => shape.id === current) ? current : null
    );
  };

  const removeSlice = (id: string) => {
    pushHistory(slices);
    setSlices(slices.filter((shape) => shape.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  };

  const clearAll = () => {
    if (slices.length === 0) return;
    pushHistory(slices);
    setSlices([]);
    setSelectedId(null);
  };

  const moveSlice = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= slices.length) return;
    const next = [...slices];
    [next[index], next[target]] = [next[target], next[index]];
    pushHistory(slices);
    setSlices(next);
  };

  const toImagePoint = (clientX: number, clientY: number): Point => {
    const surface = surfaceRef.current;
    if (!surface) return { x: 0, y: 0 };
    const rect = surface.getBoundingClientRect();
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom };
  };

  const capturePointer = (pointerId: number) => {
    try {
      surfaceRef.current?.setPointerCapture(pointerId);
    } catch {
      // Trình duyệt có thể từ chối nếu pointer đã kết thúc — bỏ qua an toàn
    }
  };

  const handleSurfacePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (interactionRef.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (imageSize.width === 0 || imageSize.height === 0) return;

    const start = toImagePoint(event.clientX, event.clientY);
    interactionRef.current = {
      kind: 'draw',
      tool,
      start,
      end: start,
      points: [start],
      pointerId: event.pointerId,
      moved: false,
    };
    setDraft({ kind: tool, start, end: start, points: [start] });
    setSelectedId(null);
    capturePointer(event.pointerId);
  };

  const beginMove = (event: React.PointerEvent<HTMLDivElement>, shape: SliceShape) => {
    if (interactionRef.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    setSelectedId(shape.id);
    interactionRef.current = {
      kind: 'move',
      id: shape.id,
      start: toImagePoint(event.clientX, event.clientY),
      startBox: shape.box,
      startSlices: slices,
      pointerId: event.pointerId,
      moved: false,
    };
    capturePointer(event.pointerId);
  };

  const beginResize = (
    event: React.PointerEvent<HTMLDivElement>,
    shape: SliceShape,
    handle: ResizeHandle
  ) => {
    if (interactionRef.current) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    setSelectedId(shape.id);
    interactionRef.current = {
      kind: 'resize',
      id: shape.id,
      handle,
      start: toImagePoint(event.clientX, event.clientY),
      startBox: shape.box,
      startSlices: slices,
      pointerId: event.pointerId,
      moved: false,
    };
    capturePointer(event.pointerId);
  };

  const handleSurfacePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;

    const point = toImagePoint(event.clientX, event.clientY);

    if (interaction.kind === 'draw') {
      interaction.end = point;
      if (distance(point, interaction.start) >= MIN_DRAG_DISTANCE) {
        interaction.moved = true;
      }
      if (interaction.tool === 'rect') {
        setDraft({
          kind: 'rect',
          start: interaction.start,
          end: point,
          points: [interaction.start, point],
        });
      } else {
        const last = interaction.points[interaction.points.length - 1];
        if (distance(point, last) >= MIN_DRAG_DISTANCE) {
          interaction.points.push(point);
          setDraft({
            kind: 'lasso',
            start: interaction.start,
            end: point,
            points: [...interaction.points],
          });
        }
      }
      return;
    }

    const deltaX = point.x - interaction.start.x;
    const deltaY = point.y - interaction.start.y;

    if (!interaction.moved) {
      if (distance(point, interaction.start) < MIN_DRAG_DISTANCE) return;
      interaction.moved = true;
      pushHistory(interaction.startSlices);
    }

    const nextBox =
      interaction.kind === 'move'
        ? translateBox(
            interaction.startBox,
            deltaX,
            deltaY,
            imageSize.width,
            imageSize.height
          )
        : resizeBox(
            interaction.startBox,
            interaction.handle,
            deltaX,
            deltaY,
            imageSize.width,
            imageSize.height
          );

    const { id } = interaction;
    setSlices((previous) =>
      previous.map((shape) => (shape.id === id ? { ...shape, box: nextBox } : shape))
    );
  };

  const finishInteraction = (event: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    interactionRef.current = null;
    try {
      surfaceRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // pointer đã được giải phóng — bỏ qua
    }

    if (interaction.kind !== 'draw') {
      // Huỷ giữa chừng (pointercancel): trả vùng chọn về trạng thái trước khi kéo
      if (!commit) {
        const { id, startBox } = interaction;
        setSlices((previous) =>
          previous.map((shape) => (shape.id === id ? { ...shape, box: startBox } : shape))
        );
      }
      return;
    }

    setDraft(null);
    if (!commit || !interaction.moved) return;

    let box: SliceBox;
    let path: Point[] | undefined;

    if (interaction.tool === 'rect') {
      box = makeRectFromDrag(
        interaction.start,
        interaction.end,
        imageSize.width,
        imageSize.height
      );
    } else {
      if (interaction.points.length < 3) return;
      box = boundsFromPoints(interaction.points, imageSize.width, imageSize.height);
      path = toNormalizedPath(interaction.points, box);
    }

    if (box.w <= 1 && box.h <= 1) return;

    sliceIdRef.current += 1;
    const shape: SliceShape = { id: `slice-${sliceIdRef.current}`, kind: interaction.tool, box, path };
    pushHistory(slices);
    setSlices((previous) => [...previous, shape]);
    setSelectedId(shape.id);
  };

  const zoomBy = (factor: number) => setZoom((current) => clampZoom(current * factor));

  const zoomToFit = () => {
    const stage = stageRef.current;
    if (!stage || imageSize.width === 0) return;
    setZoom(
      fitScale(imageSize.width, imageSize.height, stage.clientWidth - 32, stage.clientHeight - 32)
    );
  };

  // Bàn phím: Esc bỏ chọn, Ctrl/Cmd+Z hoàn tác, Delete xoá, mũi tên dịch chuyển
  useEffect(() => {
    if (!imageUrl) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'Escape') {
        interactionRef.current = null;
        setDraft(null);
        setSelectedId(null);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        if (history.length === 0) return;
        event.preventDefault();
        const previous = history[history.length - 1];
        setHistory(history.slice(0, -1));
        setSlices(previous);
        setSelectedId((current) =>
          current && previous.some((shape) => shape.id === current) ? current : null
        );
        return;
      }

      if (!selectedId) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        setHistory((previous) => [...previous, slices].slice(-MAX_HISTORY));
        setSlices(slices.filter((shape) => shape.id !== selectedId));
        setSelectedId(null);
        return;
      }

      const step = event.shiftKey ? 10 : 1;
      const offsets: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      const offset = offsets[event.key];
      if (!offset) return;
      event.preventDefault();
      setHistory((previous) => [...previous, slices].slice(-MAX_HISTORY));
      setSlices(
        slices.map((shape) =>
          shape.id === selectedId
            ? {
                ...shape,
                box: translateBox(
                  shape.box,
                  offset[0],
                  offset[1],
                  imageSize.width,
                  imageSize.height
                ),
              }
            : shape
        )
      );
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageUrl, selectedId, slices, history, imageSize.width, imageSize.height]);

  const buildSlices = async (): Promise<ExportedSlice[]> => {
    const image = imageElement;
    if (!image) return [];

    const total = slices.length;
    const results: ExportedSlice[] = [];

    for (let index = 0; index < slices.length; index += 1) {
      const shape = slices[index];
      const layout = resolveExportLayout(shape.box, exportSettings);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(layout.canvasWidth));
      canvas.height = Math.max(1, Math.round(layout.canvasHeight));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      // Ảnh pixel-art cần nearest neighbour để không bị nhoè khi phóng to
      ctx.imageSmoothingEnabled = !pixelArt;

      drawSlice(
        ctx,
        image,
        shape,
        layout.destX,
        layout.destY,
        layout.destWidth,
        layout.destHeight
      );

      const blob = await canvasToBlob(canvas);
      results.push({
        blob,
        name: makeFileName(pattern, index, { start: startNumber, total, pad: padNumbers }),
      });
    }

    return results;
  };

  const downloadZip = async () => {
    if (slices.length === 0 || isExporting) return;
    setIsExporting(true);
    setExportError('');

    try {
      const results = await buildSlices();
      const entries: ZipEntry[] = [];
      for (const result of results) {
        entries.push({
          name: result.name,
          data: new Uint8Array(await result.blob.arrayBuffer()),
        });
      }
      downloadBlob(createZip(entries), ZIP_FILE_NAME);
    } catch (error) {
      console.error('Icon export failed:', error);
      setExportError(t('exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadSlice = async (index: number) => {
    if (isExporting) return;
    setIsExporting(true);
    setExportError('');
    try {
      const results = await buildSlices();
      const result = results[index];
      if (result) downloadBlob(result.blob, result.name);
    } catch (error) {
      console.error('Icon export failed:', error);
      setExportError(t('exportFailed'));
    } finally {
      setIsExporting(false);
    }
  };

  const resetAll = () => {
    revokeUrl(imageUrl);
    setImageUrl('');
    setSourceFile(null);
    setImageSize({ width: 0, height: 0 });
    setZoom(1);
    resetEditor();
  };

  const hasImage = Boolean(imageUrl) && imageSize.width > 0;
  const stageWidth = imageSize.width * zoom;
  const stageHeight = imageSize.height * zoom;
  const fileNamePreview = (index: number) =>
    makeFileName(pattern, index, { start: startNumber, total: slices.length, pad: padNumbers });

  const inputClassName =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20';

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg">
            <Scissors className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {t('iconSlicerTitle')}
          </h1>
          <p className="mt-2 text-gray-600">{t('iconSlicerSubtitle')}</p>
        </div>

        {/* Upload area */}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={handleDrop}
          className={cn(
            'rounded-2xl border-2 border-dashed bg-white p-8 text-center transition-colors',
            isDraggingFile ? 'border-pink-500 bg-pink-50' : 'border-gray-300'
          )}
        >
          {!sourceFile ? (
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-100">
                <Upload className="h-7 w-7 text-pink-600" />
              </div>
              <div>
                <p className="text-base font-medium text-gray-900">{t('dragDropImage')}</p>
                <p className="mt-1 text-sm text-gray-500">{t('supportedFormats')}</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pink-700"
              >
                <ImageIcon className="h-4 w-4" />
                {t('chooseImage')}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex items-center gap-3 text-left">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100">
                  <ImageIcon className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{sourceFile.name}</p>
                  <p className="text-xs text-gray-500">
                    {imageSize.width} × {imageSize.height} px
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <ImageIcon className="h-4 w-4" />
                {t('chooseImage')}
              </button>
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <RotateCcw className="h-4 w-4" />
                {t('startOver')}
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif"
            onChange={handleInputChange}
            className="hidden"
            aria-label={t('chooseImage')}
          />
        </div>

        {uploadError && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <p className="text-sm font-medium text-red-800">{uploadError}</p>
          </div>
        )}

        {/* Editor */}
        {sourceFile && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 rounded-t-2xl border border-gray-200 bg-white px-3 py-2">
                <ToolbarButton
                  active={tool === 'rect'}
                  onClick={() => setTool('rect')}
                  icon={<Square className="h-4 w-4" />}
                  label={t('toolRect')}
                />
                <ToolbarButton
                  active={tool === 'lasso'}
                  onClick={() => setTool('lasso')}
                  icon={<Lasso className="h-4 w-4" />}
                  label={t('toolLasso')}
                />
                <span className="mx-1 h-6 w-px bg-gray-200" />
                <button
                  type="button"
                  onClick={undo}
                  disabled={history.length === 0}
                  title={t('undoAction')}
                  aria-label={t('undoAction')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors',
                    history.length === 0 ? 'cursor-not-allowed opacity-40' : 'hover:bg-gray-100'
                  )}
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={slices.length === 0}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-gray-700 transition-colors',
                    slices.length === 0 ? 'cursor-not-allowed opacity-40' : 'hover:bg-gray-100'
                  )}
                >
                  <Trash2 className="h-4 w-4" />
                  {t('clearAll')}
                </button>
                <span className="mx-1 h-6 w-px bg-gray-200" />
                <button
                  type="button"
                  onClick={() => zoomBy(1 / 1.25)}
                  disabled={zoom <= MIN_ZOOM}
                  title={t('zoomOut')}
                  aria-label={t('zoomOut')}
                  className={cn(
                    'inline-flex items-center rounded-lg p-2 text-gray-700 transition-colors',
                    zoom <= MIN_ZOOM ? 'cursor-not-allowed opacity-40' : 'hover:bg-gray-100'
                  )}
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-xs font-medium text-gray-600">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => zoomBy(1.25)}
                  disabled={zoom >= MAX_ZOOM}
                  title={t('zoomIn')}
                  aria-label={t('zoomIn')}
                  className={cn(
                    'inline-flex items-center rounded-lg p-2 text-gray-700 transition-colors',
                    zoom >= MAX_ZOOM ? 'cursor-not-allowed opacity-40' : 'hover:bg-gray-100'
                  )}
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={zoomToFit}
                  title={t('zoomToFit')}
                  aria-label={t('zoomToFit')}
                  className="inline-flex items-center rounded-lg p-2 text-gray-700 transition-colors hover:bg-gray-100"
                >
                  <Maximize className="h-4 w-4" />
                </button>
                <span className="ml-auto hidden text-xs text-gray-500 sm:block">
                  {t('slicerDrawHint')}
                </span>
              </div>

              {/* Stage */}
              <div
                ref={stageRef}
                className="relative max-h-[70vh] min-h-[20rem] select-none overflow-auto rounded-b-2xl border border-t-0 border-gray-200 bg-gray-100 p-4"
              >
                {hasImage ? null : (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-pink-600" />
                    {t('loading')}
                  </div>
                )}

                <div
                  ref={surfaceRef}
                  data-testid="slicer-surface"
                  onPointerDown={handleSurfacePointerDown}
                  onPointerMove={handleSurfacePointerMove}
                  onPointerUp={(event) => finishInteraction(event, true)}
                  onPointerCancel={(event) => finishInteraction(event, false)}
                  style={{
                    width: stageWidth,
                    height: stageHeight,
                    touchAction: 'none',
                    ...CHECKERBOARD_STYLE,
                  }}
                  className="relative mx-auto shadow-sm"
                >
                  <img
                    ref={setImageElement}
                    src={imageUrl}
                    alt={sourceFile ? sourceFile.name : ''}
                    onLoad={handleImageLoad}
                    draggable={false}
                    className="pointer-events-none absolute inset-0 h-full w-full select-none"
                    style={{ imageRendering: pixelArt ? 'pixelated' : 'auto' }}
                  />

                  {slices.map((shape, index) => {
                    const isSelected = shape.id === selectedId;
                    return (
                      <div
                        key={shape.id}
                        onPointerDown={(event) => beginMove(event, shape)}
                        style={{
                          left: shape.box.x * zoom,
                          top: shape.box.y * zoom,
                          width: shape.box.w * zoom,
                          height: shape.box.h * zoom,
                        }}
                        className={cn(
                          'absolute cursor-move',
                          isSelected ? 'z-20' : 'z-10'
                        )}
                      >
                        {shape.kind === 'lasso' && shape.path && shape.path.length >= 3 ? (
                          <svg
                            viewBox="0 0 1 1"
                            preserveAspectRatio="none"
                            className="absolute inset-0 h-full w-full overflow-visible"
                          >
                            <polygon
                              points={shape.path.map((point) => `${point.x},${point.y}`).join(' ')}
                              fill="rgba(236, 72, 153, 0.15)"
                              stroke="#db2777"
                              strokeWidth={1.5}
                              vectorEffect="non-scaling-stroke"
                            />
                          </svg>
                        ) : (
                          <div
                            className={cn(
                              'absolute inset-0 border',
                              isSelected
                                ? 'border-2 border-pink-600 bg-pink-500/10'
                                : 'border-pink-500/70 bg-pink-500/5'
                            )}
                          />
                        )}

                        <span className="pointer-events-none absolute -left-0.5 -top-5 z-10 rounded bg-pink-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                          {index + 1}
                        </span>

                        {isSelected &&
                          HANDLE_POSITIONS.map((item) => (
                            <div
                              key={item.handle}
                              onPointerDown={(event) => beginResize(event, shape, item.handle)}
                              className={cn(
                                'absolute z-30 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white bg-pink-600 shadow',
                                item.className,
                                item.cursor
                              )}
                              aria-hidden="true"
                            />
                          ))}
                      </div>
                    );
                  })}

                  {draft && (
                    <div className="pointer-events-none absolute inset-0 z-40 overflow-visible">
                      {draft.kind === 'rect' ? (
                        (() => {
                          const rect = normalizeRect(
                            draft.start.x,
                            draft.start.y,
                            draft.end.x,
                            draft.end.y
                          );
                          return (
                            <div
                              style={{
                                left: rect.x * zoom,
                                top: rect.y * zoom,
                                width: rect.w * zoom,
                                height: rect.h * zoom,
                              }}
                              className="absolute border-2 border-dashed border-pink-600 bg-pink-500/10"
                            />
                          );
                        })()
                      ) : (
                        <svg className="absolute inset-0 h-full w-full overflow-visible">
                          <polygon
                            points={draft.points
                              .map((point) => `${point.x * zoom},${point.y * zoom}`)
                              .join(' ')}
                            fill="rgba(236, 72, 153, 0.15)"
                            stroke="#db2777"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                          />
                        </svg>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <aside className="min-w-0 space-y-4">
              {/* Slices */}
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">{t('slicesTitle')}</h2>
                  <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-700">
                    {slices.length}
                  </span>
                </div>

                {slices.length === 0 ? (
                  <p className="mt-3 text-sm text-gray-500">{t('noSlicesYet')}</p>
                ) : (
                  <ul className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
                    {slices.map((shape, index) => {
                      const isSelected = shape.id === selectedId;
                      return (
                        <li
                          key={shape.id}
                          className={cn(
                            'flex items-center gap-2 rounded-xl border px-2 py-1.5 transition-colors',
                            isSelected
                              ? 'border-pink-500 bg-pink-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedId(shape.id)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <SliceThumbnail image={imageElement} shape={shape} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-gray-900">
                                {fileNamePreview(index)}
                              </span>
                              <span className="block text-xs text-gray-500">
                                {shape.box.w} × {shape.box.h} px
                              </span>
                            </span>
                          </button>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => moveSlice(index, -1)}
                              disabled={index === 0}
                              title={t('moveSliceUp')}
                              aria-label={t('moveSliceUp')}
                              className={cn(
                                'rounded p-0.5 text-gray-500 transition-colors',
                                index === 0 ? 'cursor-not-allowed opacity-30' : 'hover:bg-gray-100'
                              )}
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSlice(index, 1)}
                              disabled={index === slices.length - 1}
                              title={t('moveSliceDown')}
                              aria-label={t('moveSliceDown')}
                              className={cn(
                                'rounded p-0.5 text-gray-500 transition-colors',
                                index === slices.length - 1
                                  ? 'cursor-not-allowed opacity-30'
                                  : 'hover:bg-gray-100'
                              )}
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDownloadSlice(index)}
                            disabled={isExporting}
                            title={t('downloadThisSlice')}
                            aria-label={t('downloadThisSlice')}
                            className={cn(
                              'rounded p-1 text-gray-500 transition-colors',
                              isExporting ? 'cursor-not-allowed opacity-40' : 'hover:bg-gray-100'
                            )}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSlice(shape.id)}
                            title={t('deleteSlice')}
                            aria-label={t('deleteSlice')}
                            className="rounded p-1 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Export settings */}
              <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900">{t('exportSettings')}</h2>

                <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                  {t('fileNamePattern')}
                  <input
                    type="text"
                    value={pattern}
                    onChange={(event) => setPattern(event.target.value)}
                    placeholder="{n}"
                    className={inputClassName}
                  />
                </label>
                <p className="-mt-2 text-xs text-gray-500">{t('fileNamePatternHint')}</p>

                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                    {t('startNumber')}
                    <input
                      type="number"
                      min={0}
                      value={startNumber}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        setStartNumber(Number.isNaN(parsed) ? 0 : Math.max(0, parsed));
                      }}
                      className={inputClassName}
                    />
                  </label>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={padNumbers}
                    onChange={(event) => setPadNumbers(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 accent-pink-600"
                  />
                  {t('zeroPadNumbers')}
                </label>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600">{t('outputSize')}</p>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="output-size"
                      checked={exportSettings.mode === 'original'}
                      onChange={() =>
                        setExportSettings((current) => ({ ...current, mode: 'original' }))
                      }
                      className="h-4 w-4 accent-pink-600"
                    />
                    {t('outputOriginalSize')}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="radio"
                      name="output-size"
                      checked={exportSettings.mode === 'square'}
                      onChange={() =>
                        setExportSettings((current) => ({ ...current, mode: 'square' }))
                      }
                      className="h-4 w-4 accent-pink-600"
                    />
                    {t('outputFixedSquare')}
                  </label>
                </div>

                {exportSettings.mode === 'square' && (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                      {t('squareSizeLabel')}
                      <input
                        type="number"
                        min={1}
                        max={4096}
                        value={exportSettings.squareSize}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10);
                          setExportSettings((current) => ({
                            ...current,
                            squareSize: Number.isNaN(parsed)
                              ? 1
                              : Math.min(Math.max(parsed, 1), 4096),
                          }));
                        }}
                        className={inputClassName}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-gray-600">
                      {t('paddingLabel')}
                      <input
                        type="number"
                        min={0}
                        max={45}
                        value={exportSettings.paddingPercent}
                        onChange={(event) => {
                          const parsed = Number.parseInt(event.target.value, 10);
                          setExportSettings((current) => ({
                            ...current,
                            paddingPercent: Number.isNaN(parsed)
                              ? 0
                              : Math.min(Math.max(parsed, 0), 45),
                          }));
                        }}
                        className={inputClassName}
                      />
                    </label>
                  </div>
                )}

                {exportSettings.mode === 'square' && (
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={pixelArt}
                      onChange={(event) => setPixelArt(event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-pink-600"
                    />
                    {t('pixelArtUpscale')}
                  </label>
                )}

                {exportError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <p className="text-xs font-medium text-red-800">{exportError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={downloadZip}
                  disabled={slices.length === 0 || isExporting}
                  className={cn(
                    'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-pink-600 px-5 py-2.5 text-sm font-medium text-white transition-colors',
                    slices.length === 0 || isExporting
                      ? 'cursor-not-allowed opacity-60'
                      : 'hover:bg-pink-700'
                  )}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileArchive className="h-4 w-4" />
                  )}
                  {t('downloadZip')}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-pink-600 text-white'
          : 'text-gray-700 hover:bg-gray-100'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * Icon Slicer với Error Boundary (fallback riêng cho công cụ này)
 */
export function IconSlicer() {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-lg">
            <div className="mb-4 text-5xl">⚠️</div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">Something went wrong</h2>
            <p className="text-sm text-gray-600">
              The icon slicer encountered an error. Please reload the page and try again.
            </p>
          </div>
        </div>
      }
    >
      <IconSlicerContent />
    </ErrorBoundary>
  );
}

export default IconSlicer;
