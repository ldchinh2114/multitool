'use client';

import { useLanguage } from '@/lib/language-context';
import { cn } from '@/lib/cn';

/**
 * Language Toggle - Segmented control for switching between English and Vietnamese
 */
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center rounded-full bg-gray-100 p-1 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
      <button
        onClick={() => setLanguage('vi')}
        className={cn(
          'flex h-7 px-3 items-center justify-center rounded-full text-[10px] font-bold tracking-wider transition-all duration-200',
          language === 'vi'
            ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-400'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        )}
        title="Tiếng Việt"
      >
        VI
      </button>
      <button
        onClick={() => setLanguage('en')}
        className={cn(
          'flex h-7 px-3 items-center justify-center rounded-full text-[10px] font-bold tracking-wider transition-all duration-200',
          language === 'en'
            ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-700 dark:text-blue-400'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
        )}
        title="English"
      >
        EN
      </button>
    </div>
  );
}

export default LanguageToggle;
