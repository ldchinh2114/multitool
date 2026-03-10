// Định nghĩa các kiểu dữ liệu chung cho toàn bộ ứng dụng

// Các công cụ có sẵn trong hub
export type ToolType = 'dashboard' | 'currency' | 'dictionary' | 'unit';

// Thông tin công cụ cho navigation
export interface ToolInfo {
  id: ToolType;
  name: string;
  description: string;
  icon: string;
  path: string;
  color: string;
}

// Currency Converter types
export interface CurrencyRate {
  [key: string]: number;
}

export interface CurrencyResponse {
  result: string;
  time_last_update_utc: string;
  rates: CurrencyRate;
}

export type CurrencyCode = 'USD' | 'VND' | 'EUR' | 'JPY' | 'GBP';

export const CURRENCIES: { code: CurrencyCode; name: string; symbol: string }[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
];

// Dictionary types
export interface DictionaryPhonetic {
  text: string;
  audio?: string;
}

export interface DictionaryDefinition {
  partOfSpeech: string;
  definitions: {
    definition: string;
    example?: string;
  }[];
}

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: DictionaryPhonetic[];
  meanings: DictionaryDefinition[];
}

export interface DictionaryResponse {
  word: string;
  phonetic?: string;
  phonetics: DictionaryPhonetic[];
  meanings: {
    partOfSpeech: string;
    definitions: {
      definition: string;
      example?: string;
    }[];
  }[];
}

// Unit Converter types
export type UnitCategory = 'length' | 'weight';

export interface UnitDefinition {
  id: string;
  name: string;
  symbol: string;
  ratio: number; // Tỷ lệ chuyển đổi sang đơn vị chuẩn
}

export interface UnitCategoryDef {
  id: UnitCategory;
  name: string;
  units: UnitDefinition[];
}
