import { type ClassValue, clsx } from 'clsx';

/**
 * Utility function to merge class names conditionally
 * Similar to classnames library but lighter
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
