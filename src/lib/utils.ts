// Các hàm tiện ích chung cho toàn bộ ứng dụng

import { CurrencyCode } from './types';

/**
 * Gọi API với xử lý lỗi cơ bản
 */
export async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Not found');
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Format số tiền theo locale
 */
export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const localeMap: Record<CurrencyCode, string> = {
    USD: 'en-US',
    VND: 'vi-VN',
    EUR: 'de-DE',
    JPY: 'ja-JP',
    GBP: 'en-GB',
    CNY: 'zh-CN',
    KRW: 'ko-KR',
    HKD: 'zh-HK',
    TWD: 'zh-TW',
  };
  
  return new Intl.NumberFormat(localeMap[currency], {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

/**
 * Format timestamp thành ngày giờ dễ đọc
 */
export function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Debounce function - giới hạn tần suất gọi hàm
 */
export function debounce<T extends (...args: never[]) => unknown>(
  func: T,
  wait: number
): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return ((...args: never[]) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  }) as T;
}

/**
 * Kiểm tra xem từ có tồn tại không
 */
export function isValidWord(word: string): boolean {
  return /^[a-zA-Z]+$/.test(word.trim()) && word.trim().length > 0;
}
