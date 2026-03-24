'use client';

import { useState, useEffect, useMemo } from 'react';
import { Coins, ArrowRightLeft, TrendingUp, AlertCircle } from 'lucide-react';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useLanguage } from '@/lib/language-context';
import {
  CURRENCIES,
  CurrencyCode,
  CurrencyResponse,
} from '@/lib/types';
import { formatCurrency, formatTimestamp } from '@/lib/utils';

// API URL - Using free exchangerate-api.com
const API_BASE_URL = 'https://api.exchangerate-api.com/v4/latest';

/**
 * Currency Converter - Công cụ chuyển đổi tiền tệ
 * Sử dụng API để lấy tỷ giá hối đoái thời gian thực
 */
function CurrencyConverterContent() {
  const { t } = useLanguage();
  // State management
  const [amount, setAmount] = useState<string>('1');
  const [fromCurrency, setFromCurrency] = useState<CurrencyCode>('USD');
  const [toCurrency, setToCurrency] = useState<CurrencyCode>('VND');
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Fetch exchange rates khi component mount hoặc currency thay đổi
  useEffect(() => {
    const fetchRates = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/USD`);
        if (!response.ok) {
          throw new Error('Failed to fetch exchange rates');
        }
        const data = await response.json();
        setRates(data.rates);
        setLastUpdated(new Date().toISOString());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, []);

  // Tính toán kết quả chuyển đổi
  const result = useMemo(() => {
    if (!rates || !amount) return null;
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return null;

    // Convert từ currency nguồn sang USD trước, rồi sang currency đích
    const fromRate = rates[fromCurrency];
    const toRate = rates[toCurrency];
    const converted = (numAmount / fromRate) * toRate;

    return {
      converted,
      rate: toRate / fromRate,
    };
  }, [rates, amount, fromCurrency, toCurrency]);

  // Handle swap currencies
  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold dark:text-gray-100">{t('currencyTitle')}</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {t('loadingRates')}
          </p>
        </div>
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-4 text-lg font-semibold text-red-800 dark:text-red-400">
            {t('errorLoadingRates')}
          </h3>
          <p className="mt-2 text-red-600 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 dark:bg-gray-950">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
            <Coins className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {t('currencyTitle')}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t('currencySubtitle')}
          </p>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {/* Amount Input */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('amount')}
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-lg font-medium focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              placeholder={t('enterAmount')}
              min="0"
              step="0.01"
            />
          </div>

          {/* Currency Selectors */}
          <div className="mb-6 flex items-center gap-4">
            {/* From Currency */}
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('fromCurrency')}
              </label>
              <select
                value={fromCurrency}
                onChange={(e) => setFromCurrency(e.target.value as CurrencyCode)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <div className="pt-8">
              <button
                onClick={handleSwap}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                aria-label="Swap currencies"
              >
                <ArrowRightLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* To Currency */}
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('toCurrency')}
              </label>
              <select
                value={toCurrency}
                onChange={(e) => setToCurrency(e.target.value as CurrencyCode)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code} - {currency.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Result Card */}
          {result && (
            <div className="rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white shadow-lg">
              <div className="flex items-center gap-2 text-green-100">
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm font-medium">{t('exchangeRate')}</span>
              </div>
              <div className="mt-2">
                <span className="text-4xl font-bold">
                  {result.rate.toFixed(6)}
                </span>
                <span className="ml-2 text-green-100">
                  {fromCurrency} = 1 {toCurrency}
                </span>
              </div>
              <div className="mt-4 border-t border-green-400/30 pt-4">
                <div className="text-sm text-green-100">{t('result')}</div>
                <div className="text-3xl font-bold">
                  {formatCurrency(result.converted, toCurrency)}
                </div>
              </div>
              {lastUpdated && (
                <div className="mt-4 text-xs text-green-200">
                  {t('lastUpdated')}: {formatTimestamp(lastUpdated)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Reference */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('quickReference')}
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {CURRENCIES.filter((c) => c.code !== 'USD').map((currency) => {
              const rate = rates?.[currency.code];
              return (
                <div
                  key={currency.code}
                  className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800"
                >
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {currency.code}
                  </div>
                  <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {rate ? rate.toFixed(2) : '-'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Currency Converter với Error Boundary
 */
export function CurrencyConverter() {
  return (
    <ErrorBoundary>
      <CurrencyConverterContent />
    </ErrorBoundary>
  );
}

export default CurrencyConverter;
