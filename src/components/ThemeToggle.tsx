'use client';

import { Moon, Sun } from 'lucide-react';
import { useState, useLayoutEffect } from 'react';
import { cn } from '@/lib/cn';

/**
 * Get initial dark mode state from localStorage or system preference
 */
function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    localStorage.getItem('theme') === 'dark' ||
    (!localStorage.getItem('theme') &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

/**
 * Theme Toggle - Chuyển đổi giữa dark/light mode
 * Uses localStorage to persist user preference
 */
export function ThemeToggle() {
  // Initialize state from function to avoid hydration mismatch
  const [isDark, setIsDark] = useState(getInitialDarkMode);

  // Sync DOM class with state
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'relative inline-flex h-10 w-10 items-center justify-center',
        'rounded-full bg-gray-100 dark:bg-gray-800',
        'transition-all duration-300 ease-in-out',
        'hover:bg-gray-200 dark:hover:bg-gray-700',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
        'dark:focus:ring-offset-gray-900'
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="relative h-6 w-6">
        <Sun
          className={cn(
            'absolute inset-0 h-6 w-6 transition-all duration-300',
            'text-amber-500',
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
          )}
        />
        <Moon
          className={cn(
            'absolute inset-0 h-6 w-6 transition-all duration-300',
            'text-blue-400',
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'
          )}
        />
      </div>
    </button>
  );
}

export default ThemeToggle;
