'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Wand2,
  Upload,
  Image as ImageIcon,
  Download,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLanguage } from '@/lib/language-context';
import type { Config } from '@imgly/background-removal';

type Phase = 'idle' | 'working' | 'done' | 'error';

/**
 * The segmentation model and the ONNX runtime are downloaded from IMG.LY's CDN
 * on first use - roughly 95MB in total. The same settings are used for the
 * background preload and for the actual run, so the run finds everything in the
 * browser cache.
 */
const MODEL_CONFIG: Config = {
  device: 'cpu',
  model: 'isnet_fp16',
  output: { format: 'image/png', quality: 1 },
};

interface ProgressState {
  key: string;
  current: number;
  total: number;
}

// Các lựa chọn màu nền sau khi tách nền (transparent = giữ nguyên PNG trong suốt)
const BACKGROUND_OPTIONS: { id: string; labelKey: 'backgroundTransparent' | 'backgroundWhite' | 'backgroundBlack'; value: string }[] = [
  { id: 'transparent', labelKey: 'backgroundTransparent', value: 'transparent' },
  { id: 'white', labelKey: 'backgroundWhite', value: '#ffffff' },
  { id: 'black', labelKey: 'backgroundBlack', value: '#000000' },
];

/**
 * Ghép ảnh PNG trong suốt lên một màu nền (dùng Canvas, chạy hoàn toàn client-side).
 */
async function compositeOnColor(pngBlob: Blob, color: string): Promise<Blob> {
  const bitmap = await createImageBitmap(pngBlob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return pngBlob;
  }
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? pngBlob), 'image/png');
  });
}

function RemoveBackgroundContent() {
  const { t } = useLanguage();
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [resultUrl, setResultUrl] = useState<string>('');
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [bgColor, setBgColor] = useState<string>('transparent');

  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Thu hồi toàn bộ object URL khi unmount
  useEffect(() => {
    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current = [];
    };
  }, []);

  // Tải sẵn model (~95MB) ngay khi người dùng chọn ảnh, để việc tải chạy
  // song song với thao tác của họ và lần xử lý sau gần như tức thì.
  useEffect(() => {
    if (!sourceFile) return;

    let cancelled = false;
    const warmUp = async () => {
      try {
        const { preload } = await import('@imgly/background-removal');
        if (cancelled) return;
        await preload(MODEL_CONFIG);
      } catch {
        // Tải sẵn là tối ưu, lỗi ở đây không ảnh hưởng tới lần chạy thật
      }
    };

    warmUp();
    return () => {
      cancelled = true;
    };
  }, [sourceFile]);

  const resetResult = () => {
    revokeUrl(resultUrl);
    setResultUrl('');
    setResultBlob(null);
    setPhase('idle');
    setProgress(null);
    setErrorMessage('');
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setPhase('error');
      setErrorMessage(t('onlyImagesSupported'));
      return;
    }
    // Dọn kết quả cũ và URL cũ trước khi nạp ảnh mới
    revokeUrl(originalUrl);
    revokeUrl(resultUrl);
    setResultUrl('');
    setResultBlob(null);
    setProgress(null);
    setErrorMessage('');
    setBgColor('transparent');
    setSourceFile(file);
    setOriginalUrl(trackUrl(URL.createObjectURL(file)));
    setPhase('idle');
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
    // Cho phép chọn lại cùng một tệp
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemoveBackground = async () => {
    if (!sourceFile) return;
    resetResult();
    setPhase('working');

    try {
      // Nạp thư viện theo nhu cầu để không làm nặng bundle ban đầu
      const { removeBackground } = await import('@imgly/background-removal');

      const config: Config = {
        ...MODEL_CONFIG,
        progress: (key, current, total) => {
          setProgress({ key, current, total });
        },
      };

      const blob = await removeBackground(sourceFile, config);
      setResultBlob(blob);
      setResultUrl(trackUrl(URL.createObjectURL(blob)));
      setProgress(null);
      setPhase('done');
    } catch (error) {
      console.error('Background removal failed:', error);
      setProgress(null);
      setErrorMessage(t('bgRemovalFailed'));
      setPhase('error');
    }
  };

  const handleDownload = async () => {
    if (!resultBlob) return;
    const needsComposite = bgColor !== 'transparent';
    const outputBlob = needsComposite
      ? await compositeOnColor(resultBlob, bgColor)
      : resultBlob;
    const url = URL.createObjectURL(outputBlob);
    const link = document.createElement('a');
    link.href = url;
    const baseName = sourceFile?.name.replace(/\.[^.]+$/, '') || 'image';
    link.download = `${baseName}-no-bg.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const progressPercent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : null;

  const isWorking = phase === 'working';
  const checkerboardStyle: React.CSSProperties = {
    backgroundImage:
      'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
    backgroundSize: '20px 20px',
    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 shadow-lg">
            <Wand2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {t('removeBackgroundTitle')}
          </h1>
          <p className="mt-2 text-gray-600">{t('removeBackgroundSubtitle')}</p>
        </div>

        {/* Upload area */}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'rounded-2xl border-2 border-dashed bg-white p-8 text-center transition-colors',
            isDragging ? 'border-teal-500 bg-teal-50' : 'border-gray-300'
          )}
        >
          {!sourceFile ? (
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
                <Upload className="h-7 w-7 text-teal-600" />
              </div>
              <div>
                <p className="text-base font-medium text-gray-900">
                  {t('dragDropImage')}
                </p>
                <p className="mt-1 text-sm text-gray-500">{t('supportedFormats')}</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
              >
                <ImageIcon className="h-4 w-4" />
                {t('chooseImage')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <img
                src={originalUrl}
                alt={t('originalImage')}
                className="max-h-64 w-auto rounded-lg border border-gray-200 object-contain"
              />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleRemoveBackground}
                  disabled={isWorking}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-colors',
                    isWorking ? 'cursor-not-allowed opacity-70' : 'hover:bg-teal-700'
                  )}
                >
                  {isWorking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  {isWorking ? t('processing') : t('removeBackgroundBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isWorking}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <ImageIcon className="h-4 w-4" />
                  {t('chooseImage')}
                </button>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
            aria-label={t('chooseImage')}
          />
        </div>

        {/* Progress */}
        {isWorking && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
              {progressPercent === null
                ? t('removingBackground')
                : t('downloadingModel')}
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={cn(
                  'h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-600 transition-all duration-300',
                  progressPercent === null && 'w-1/3 animate-pulse'
                )}
                style={progressPercent === null ? undefined : { width: `${progressPercent}%` }}
              />
            </div>
            {progressPercent !== null && (
              <p className="mt-2 text-right text-xs text-gray-500">{progressPercent}%</p>
            )}
            <p className="mt-3 text-xs text-gray-500">{t('processingOnDevice')}</p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">{errorMessage}</p>
              <button
                type="button"
                onClick={() => {
                  setPhase('idle');
                  setErrorMessage('');
                }}
                className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-900"
              >
                {t('tryAgain')}
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {phase === 'done' && resultUrl && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('result')}</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">{t('originalImage')}</p>
                <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-100 p-2">
                  <img
                    src={originalUrl}
                    alt={t('originalImage')}
                    className="max-h-72 w-auto rounded-lg object-contain"
                  />
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">{t('result')}</p>
                <div
                  className="flex items-center justify-center rounded-xl border border-gray-200 p-2"
                  style={
                    bgColor === 'transparent'
                      ? checkerboardStyle
                      : { backgroundColor: bgColor }
                  }
                >
                  <img
                    src={resultUrl}
                    alt={t('result')}
                    className="max-h-72 w-auto rounded-lg object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Background color options */}
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium text-gray-700">{t('backgroundColor')}</p>
              <div className="flex flex-wrap items-center gap-3">
                {BACKGROUND_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBgColor(option.value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                      bgColor === option.value
                        ? 'border-teal-500 ring-2 ring-teal-500/30'
                        : 'border-gray-300 hover:border-gray-400'
                    )}
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-gray-300"
                      style={
                        option.value === 'transparent'
                          ? checkerboardStyle
                          : { backgroundColor: option.value }
                      }
                    />
                    {t(option.labelKey)}
                  </button>
                ))}
                <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium">
                  <input
                    type="color"
                    value={bgColor === 'transparent' ? '#ffffff' : bgColor}
                    onChange={(event) => setBgColor(event.target.value)}
                    className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                    aria-label={t('backgroundColor')}
                  />
                  {t('customColor')}
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-700"
              >
                <Download className="h-4 w-4" />
                {t('downloadResult')}
              </button>
              <button
                type="button"
                onClick={resetResult}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <RotateCcw className="h-4 w-4" />
                {t('startOver')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Remove Background với Error Boundary (fallback riêng cho công cụ này)
 */
export function RemoveBackground() {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md rounded-xl bg-white p-8 text-center shadow-lg">
            <div className="mb-4 text-5xl">⚠️</div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">
              Something went wrong
            </h2>
            <p className="text-sm text-gray-600">
              The background removal tool encountered an error. Please reload the
              page and try again.
            </p>
          </div>
        </div>
      }
    >
      <RemoveBackgroundContent />
    </ErrorBoundary>
  );
}

export default RemoveBackground;
