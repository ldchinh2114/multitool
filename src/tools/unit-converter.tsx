'use client';

import { useState, useMemo } from 'react';
import { Ruler, Scale, ArrowRightLeft, Calculator } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { UnitCategory, UnitDefinition } from '@/lib/types';

// Định nghĩa các đơn vị đo lường
// Tỷ lệ (ratio) là hệ số chuyển đổi sang đơn vị chuẩn (m cho length, g cho weight)
const LENGTH_UNITS: UnitDefinition[] = [
  { id: 'm', name: 'Meter', symbol: 'm', ratio: 1 },
  { id: 'km', name: 'Kilometer', symbol: 'km', ratio: 1000 },
  { id: 'mile', name: 'Mile', symbol: 'mi', ratio: 1609.344 },
  { id: 'ft', name: 'Foot', symbol: 'ft', ratio: 0.3048 },
];

const WEIGHT_UNITS: UnitDefinition[] = [
  { id: 'g', name: 'Gram', symbol: 'g', ratio: 1 },
  { id: 'kg', name: 'Kilogram', symbol: 'kg', ratio: 1000 },
  { id: 'lb', name: 'Pound', symbol: 'lb', ratio: 453.592 },
  { id: 'oz', name: 'Ounce', symbol: 'oz', ratio: 28.3495 },
];

const CATEGORIES: { id: UnitCategory; name: string; icon: React.ReactNode; units: UnitDefinition[] }[] = [
  { id: 'length', name: 'Length', icon: <Ruler className="h-5 w-5" />, units: LENGTH_UNITS },
  { id: 'weight', name: 'Weight', icon: <Scale className="h-5 w-5" />, units: WEIGHT_UNITS },
];

/**
 * Unit Converter - Công cụ chuyển đổi đơn vị
 * Hỗ trợ chuyển đổi độ dài (length) và khối lượng (weight)
 */
function UnitConverterContent() {
  const [category, setCategory] = useState<UnitCategory>('length');
  const [amount, setAmount] = useState<string>('1');
  const [fromUnit, setFromUnit] = useState<string>('m');
  const [toUnit, setToUnit] = useState<string>('km');

  // Lấy danh sách đơn vị theo category hiện tại
  const currentUnits = useMemo(() => {
    return CATEGORIES.find((c) => c.id === category)?.units || [];
  }, [category]);

  // Reset units khi đổi category
  useState(() => {
    if (currentUnits.length > 0) {
      setFromUnit(currentUnits[0].id);
      setToUnit(currentUnits[1]?.id || currentUnits[0].id);
    }
  });

  // Tính toán kết quả chuyển đổi
  const result = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return 0;

    const from = currentUnits.find((u) => u.id === fromUnit);
    const to = currentUnits.find((u) => u.id === toUnit);

    if (!from || !to) return 0;

    // Chuyển từ đơn vị nguồn sang đơn vị chuẩn, rồi sang đơn vị đích
    const valueInBase = numAmount * from.ratio;
    const converted = valueInBase / to.ratio;

    return converted;
  }, [amount, fromUnit, toUnit, currentUnits]);

  // Handle swap units
  const handleSwap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  // Handle category change
  const handleCategoryChange = (newCategory: UnitCategory) => {
    setCategory(newCategory);
    const newUnits = CATEGORIES.find((c) => c.id === newCategory)?.units || [];
    if (newUnits.length > 0) {
      setFromUnit(newUnits[0].id);
      setToUnit(newUnits[1]?.id || newUnits[0].id);
    }
  };

  // Format kết quả
  const formatResult = (value: number): string => {
    if (value === 0) return '0';
    if (value < 0.0001 || value > 1000000) {
      return value.toExponential(4);
    }
    return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 dark:bg-gray-950">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg">
            <Calculator className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Unit Converter
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Convert between different units of length and weight
          </p>
        </div>

        {/* Category Selector */}
        <div className="mb-6 flex gap-2 rounded-xl bg-gray-100 p-2 dark:bg-gray-800">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoryChange(cat.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-medium transition-all',
                category === cat.id
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              )}
            >
              {cat.icon}
              {cat.name}
            </button>
          ))}
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {/* Amount Input */}
          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Value
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-lg font-medium focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="Enter value"
              min="0"
              step="0.0001"
            />
          </div>

          {/* Unit Selectors */}
          <div className="mb-6 flex items-center gap-4">
            {/* From Unit */}
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                From
              </label>
              <select
                value={fromUnit}
                onChange={(e) => setFromUnit(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {currentUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.symbol} - {unit.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <div className="pt-8">
              <button
                onClick={handleSwap}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                aria-label="Swap units"
              >
                <ArrowRightLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* To Unit */}
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                To
              </label>
              <select
                value={toUnit}
                onChange={(e) => setToUnit(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              >
                {currentUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.symbol} - {unit.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Result Card */}
          <div className="rounded-xl bg-gradient-to-br from-orange-500 to-red-600 p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 text-orange-100">
              <Calculator className="h-5 w-5" />
              <span className="text-sm font-medium">Result</span>
            </div>
            <div className="mt-4">
              <div className="text-4xl font-bold">{formatResult(result)}</div>
              <div className="mt-1 text-orange-100">
                {currentUnits.find((u) => u.id === toUnit)?.symbol} ({currentUnits.find((u) => u.id === toUnit)?.name})
              </div>
            </div>
            <div className="mt-4 border-t border-orange-400/30 pt-4 text-sm text-orange-100">
              {amount} {currentUnits.find((u) => u.id === fromUnit)?.symbol} = {formatResult(result)}{' '}
              {currentUnits.find((u) => u.id === toUnit)?.symbol}
            </div>
          </div>
        </div>

        {/* Quick Reference */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Quick Reference - 1 {currentUnits.find((u) => u.id === fromUnit)?.name}
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {currentUnits
              .filter((u) => u.id !== fromUnit)
              .map((unit) => {
                const from = currentUnits.find((u) => u.id === fromUnit);
                if (!from) return null;
                const value = (1 * from.ratio) / unit.ratio;
                return (
                  <div
                    key={unit.id}
                    className="rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800"
                  >
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {unit.symbol}
                    </div>
                    <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {formatResult(value)}
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
 * Unit Converter với Error Boundary
 */
export function UnitConverter() {
  return (
    <ErrorBoundary>
      <UnitConverterContent />
    </ErrorBoundary>
  );
}

export default UnitConverter;
