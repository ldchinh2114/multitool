'use client';

import Link from 'next/link';
import { Coins, Languages, ArrowRight, Zap, Scale, FileText, Wand2, Scissors, NotebookPen } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLanguage } from '@/lib/language-context';

interface ToolCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  gradient: string;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Tool Card - Card hiển thị công cụ trong Dashboard
 * Supports multiple sizes for bento grid layout
 */
function ToolCard({
  title,
  description,
  icon,
  href,
  color,
  gradient,
  className,
  size = 'medium',
}: ToolCardProps) {
  const sizeClasses = {
    small: 'row-span-1',
    medium: 'row-span-2 md:row-span-2',
    large: 'row-span-2 md:col-span-2 md:row-span-2',
  };

  return (
    <Link
      href={href}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300',
        'hover:shadow-xl hover:scale-[1.02]',
        sizeClasses[size],
        className
      )}
    >
      {/* Background gradient effect */}
      <div
        className={cn(
          'absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-10 blur-2xl transition-all duration-500',
          'group-hover:opacity-20 group-hover:scale-150',
          gradient
        )}
      />

      <div className="relative z-10 flex h-full flex-col">
        {/* Icon */}
        <div
          className={cn(
            'mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl shadow-md',
            color
          )}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-xl font-bold tracking-tight text-gray-900">
            {title}
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            {description}
          </p>
        </div>

        {/* CTA */}
        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-600">
          <span>Open Tool</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}

/**
 * Dashboard - Bento Grid Layout
 * Landing page với grid layout hiển thị tất cả công cụ
 */
export function Dashboard() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="border-b border-gray-200 bg-white py-16">
        <div className="container mx-auto max-w-7xl px-4 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700">
            <Zap className="h-4 w-4" />
            {t('welcomeMessage')}
          </div>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            {t('heroTitlePart1')}{' '}
            <span className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              {t('heroTitlePart2')}
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            {t('heroSubtitle')}
          </p>
        </div>
      </section>

      {/* Bento Grid */}
      <section className="py-12">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
            {/* Currency Converter - Large card */}
            <ToolCard
              title={t('currency')}
              description={t('currencyDesc')}
              icon={<Coins className="h-6 w-6 text-white" />}
              href="/tools/currency"
              color="bg-gradient-to-br from-green-500 to-emerald-600"
              gradient="from-green-400 to-emerald-500"
              size="large"
            />

            {/* Translate - Medium card */}
            <ToolCard
              title={t('translate')}
              description={t('translateDesc')}
              icon={<Languages className="h-6 w-6 text-white" />}
              href="/tools/translate"
              color="bg-gradient-to-br from-purple-500 to-pink-600"
              gradient="from-purple-400 to-pink-500"
              size="medium"
            />

            {/* Unit Converter - Medium card */}
            <ToolCard
              title={t('unit')}
              description={t('unitDesc')}
              icon={<Scale className="h-6 w-6 text-white" />}
              href="/tools/unit"
              color="bg-gradient-to-br from-orange-500 to-red-600"
              gradient="from-orange-400 to-red-500"
              size="medium"
            />

            {/* Resume Builder - Medium card */}
            <ToolCard
              title={t('resumeBuilder')}
              description={t('resumeBuilderDesc')}
              icon={<FileText className="h-6 w-6 text-white" />}
              href="/tools/resume-builder"
              color="bg-gradient-to-br from-blue-500 to-indigo-600"
              gradient="from-blue-400 to-indigo-500"
              size="medium"
            />

            {/* Remove Background - Medium card */}
            <ToolCard
              title={t('removeBackground')}
              description={t('removeBackgroundDesc')}
              icon={<Wand2 className="h-6 w-6 text-white" />}
              href="/tools/remove-background"
              color="bg-gradient-to-br from-teal-500 to-cyan-600"
              gradient="from-teal-400 to-cyan-500"
              size="medium"
            />

            {/* Icon Slicer - Medium card */}
            <ToolCard
              title={t('iconSlicer')}
              description={t('iconSlicerDesc')}
              icon={<Scissors className="h-6 w-6 text-white" />}
              href="/tools/icon-slicer"
              color="bg-gradient-to-br from-pink-500 to-rose-600"
              gradient="from-pink-400 to-rose-500"
              size="medium"
            />

            {/* Memex - Medium card */}
            <ToolCard
              title={t('memex')}
              description={t('memexDesc')}
              icon={<NotebookPen className="h-6 w-6 text-white" />}
              href="/tools/memex"
              color="bg-gradient-to-br from-cyan-500 to-sky-600"
              gradient="from-cyan-400 to-sky-500"
              size="medium"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-t border-gray-200 py-16">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('lightningFast')}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {t('lightningFastDesc')}
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('privacyFirst')}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {t('privacyFirstDesc')}
              </p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
                <Smartphone className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('mobileFriendly')}
              </h3>
              <p className="mt-2 text-sm text-gray-600">
                {t('mobileFriendlyDesc')}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// Icons cho features section
function Shield({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function Smartphone({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  );
}

export default Dashboard;
