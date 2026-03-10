import { cn } from '@/lib/cn';

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'list' | 'circular';
  count?: number;
}

/**
 * Loading Skeleton - Hiển thị trạng thái loading
 * Provides visual feedback during data fetching
 */
export function LoadingSkeleton({
  className,
  variant = 'text',
  count = 1,
}: LoadingSkeletonProps) {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  const baseClasses = 'animate-pulse bg-gray-200 dark:bg-gray-700 rounded';

  const variantClasses = {
    text: 'h-4 w-full',
    card: 'h-32 w-full rounded-lg',
    list: 'h-12 w-full rounded-md',
    circular: 'h-12 w-12 rounded-full',
  };

  return (
    <div className={cn('space-y-3', className)}>
      {skeletons.map((i) => (
        <div
          key={i}
          className={cn(baseClasses, variantClasses[variant])}
        />
      ))}
    </div>
  );
}

/**
 * Card Skeleton - Skeleton cho card layout
 */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <LoadingSkeleton variant="circular" className="mb-4" />
      <LoadingSkeleton variant="text" count={2} />
    </div>
  );
}

export default LoadingSkeleton;
