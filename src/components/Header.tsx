'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { BRAND_NAME } from '@/lib/brand';
import { TOOLS } from '@/lib/tools';
import { useLanguage } from '@/lib/language-context';
import { LanguageToggle } from './LanguageToggle';

const MOBILE_MENU_ID = 'mobile-nav';

export function Header() {
  const { t, language } = useLanguage();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close the mobile menu on browser back/forward (link clicks close it too).
  useEffect(() => {
    const onPopState = () => setIsMobileMenuOpen(false);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Add a shadow once the page is scrolled, so the bar separates from content.
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Escape closes the mobile menu.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen]);

  // Move focus into the menu when it opens (mobile viewports only).
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    if (window.matchMedia('(min-width: 768px)').matches) return;
    mobileMenuRef.current?.focus();
  }, [isMobileMenuOpen]);

  /** A tool is active when the current path is it or a route below it. */
  const isActive = (path: string) =>
    pathname === path || (path !== '/' && pathname.startsWith(`${path}/`));

  const homeLabel = language === 'vi' ? 'Trang chủ' : 'Home';

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md print:hidden',
        isScrolled && 'shadow-sm'
      )}
    >
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4">
        {/* Logo */}
        <Link
          href="/"
          aria-label={`${BRAND_NAME} — ${homeLabel}`}
          className="flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
        >
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-xl font-extrabold tracking-tight text-transparent sm:text-2xl">
            {BRAND_NAME}
          </span>
        </Link>

        {/* Desktop Navigation: icons only on tablets, labels from xl up */}
        <nav aria-label={language === 'vi' ? 'Điều hướng chính' : 'Main navigation'} className="hidden items-center gap-1 md:flex">
          {TOOLS.map((tool) => {
            const active = isActive(tool.path);
            const label = t(tool.nameKey);
            const Icon = tool.icon;

            return (
              <Link
                key={tool.id}
                href={tool.path}
                title={label}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-10 w-10 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1',
                  'xl:w-auto xl:justify-start xl:px-3.5',
                  active
                    ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="hidden xl:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side: language toggle + mobile menu button */}
        <div className="flex shrink-0 items-center gap-2">
          <LanguageToggle />
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={language === 'vi' ? 'Mở menu' : 'Toggle menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls={MOBILE_MENU_ID}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 md:hidden"
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
        <div
          id={MOBILE_MENU_ID}
          ref={mobileMenuRef}
          tabIndex={-1}
          className="border-t border-gray-200 bg-white px-4 py-4 focus:outline-none md:hidden"
        >
          <nav className="flex flex-col gap-2">
            {TOOLS.map((tool) => {
              const active = isActive(tool.path);
              const Icon = tool.icon;

              return (
                <Link
                  key={tool.id}
                  href={tool.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white',
                      tool.color
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium">{t(tool.nameKey)}</div>
                    <div className="text-xs text-gray-500">{t(tool.descriptionKey)}</div>
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
