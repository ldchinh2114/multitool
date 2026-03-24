'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { ToolInfo } from '@/lib/types';
import { LayoutGrid, Coins, BookOpen, Ruler, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/lib/language-context';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';

// Map icon names to components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutGrid,
  Coins,
  BookOpen,
  Ruler,
};

export function Header() {
  const { t, language } = useLanguage();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Định nghĩa danh sách công cụ trong component để dùng t()
  const TOOLS: ToolInfo[] = [
    {
      id: 'dashboard',
      name: t('dashboard'),
      description: language === 'vi' ? 'Trang chủ Multi-Tool' : 'Multi-Tool Hub Home',
      icon: 'LayoutGrid',
      path: '/',
      color: 'bg-blue-500',
    },
    {
      id: 'currency',
      name: t('currency'),
      description: language === 'vi' ? 'Tỷ giá hối đoái thời gian thực' : 'Real-time exchange rates',
      icon: 'Coins',
      path: '/tools/currency',
      color: 'bg-green-500',
    },
    {
      id: 'dictionary',
      name: t('dictionary'),
      description: language === 'vi' ? 'Từ điển Anh-Anh' : 'English-English Dictionary',
      icon: 'BookOpen',
      path: '/tools/dictionary',
      color: 'bg-purple-500',
    },
    {
      id: 'unit',
      name: t('unit'),
      description: language === 'vi' ? 'Chuyển đổi chiều dài và cân nặng' : 'Length & Weight conversion',
      icon: 'Ruler',
      path: '/tools/unit',
      color: 'bg-orange-500',
    },
  ];

  const getIcon = (iconName: string) => {
    const IconComponent = ICON_MAP[iconName] || LayoutGrid;
    return <IconComponent className="h-5 w-5" />;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
            <LayoutGrid className="h-6 w-6 text-white" />
          </div>
          <span className="hidden text-xl font-bold tracking-tight sm:inline-block">
            Multi-Tool Hub
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {TOOLS.map((tool) => {
            const isActive = pathname === tool.path;
            return (
              <Link
                key={tool.id}
                href={tool.path}
                className={cn(
                  'relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                  'hover:bg-gray-100',
                  isActive
                    ? 'text-gray-900'
                    : 'text-gray-600'
                )}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-lg bg-gray-100" />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {getIcon(tool.icon)}
                  {tool.name}
                </span>
                {isActive && (
                  <div className="absolute -bottom-px left-0 h-0.5 w-full bg-blue-500" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side: Mobile menu */}
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg md:hidden hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMobileMenuOpen && (
        <div className="border-t border-gray-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-2">
            {TOOLS.map((tool) => {
              const isActive = pathname === tool.path;
              return (
                <Link
                  key={tool.id}
                  href={tool.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md',
                      tool.color
                    )}
                  >
                    {getIcon(tool.icon)}
                  </div>
                  <div>
                    <div className="font-medium">{tool.name}</div>
                    <div className="text-xs text-gray-500">
                      {tool.description}
                    </div>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}

export default Header;
