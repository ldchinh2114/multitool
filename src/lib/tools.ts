import {
  Coins,
  FileText,
  Languages,
  LayoutGrid,
  Ruler,
  Scissors,
  Wand2,
  type LucideIcon,
} from 'lucide-react';
import type { TranslationsKey } from './language-context';
import type { ToolType } from './types';

/**
 * A tool as it appears in navigation.
 *
 * The entry is static data: every user-visible string is a translation key so
 * the header can render it with `t()` without rebuilding the list on each
 * render (and so a missing translation is a type error, not a runtime surprise).
 */
export interface ToolNavItem {
  id: ToolType;
  path: string;
  icon: LucideIcon;
  /** Background color of the icon tile, used by the mobile menu. */
  color: string;
  nameKey: TranslationsKey;
  descriptionKey: TranslationsKey;
}

/**
 * Icon per tool. Keyed by `ToolType` so a tool without an icon is a compile
 * error rather than a silent fallback.
 */
export const TOOL_ICONS: Record<ToolType, LucideIcon> = {
  dashboard: LayoutGrid,
  currency: Coins,
  translate: Languages,
  unit: Ruler,
  'resume-builder': FileText,
  'remove-background': Wand2,
  'icon-slicer': Scissors,
};

/** The tool set, in navigation order. */
export const TOOLS: ToolNavItem[] = [
  {
    id: 'dashboard',
    path: '/',
    icon: TOOL_ICONS.dashboard,
    color: 'bg-blue-500',
    nameKey: 'dashboard',
    descriptionKey: 'toolDescDashboard',
  },
  {
    id: 'currency',
    path: '/tools/currency',
    icon: TOOL_ICONS.currency,
    color: 'bg-green-500',
    nameKey: 'currency',
    descriptionKey: 'toolDescCurrency',
  },
  {
    id: 'translate',
    path: '/tools/translate',
    icon: TOOL_ICONS.translate,
    color: 'bg-purple-500',
    nameKey: 'translate',
    descriptionKey: 'toolDescTranslate',
  },
  {
    id: 'unit',
    path: '/tools/unit',
    icon: TOOL_ICONS.unit,
    color: 'bg-orange-500',
    nameKey: 'unit',
    descriptionKey: 'toolDescUnit',
  },
  {
    id: 'resume-builder',
    path: '/tools/resume-builder',
    icon: TOOL_ICONS['resume-builder'],
    color: 'bg-indigo-500',
    nameKey: 'resumeBuilder',
    descriptionKey: 'toolDescResumeBuilder',
  },
  {
    id: 'remove-background',
    path: '/tools/remove-background',
    icon: TOOL_ICONS['remove-background'],
    color: 'bg-teal-500',
    nameKey: 'removeBackground',
    descriptionKey: 'toolDescRemoveBackground',
  },
  {
    id: 'icon-slicer',
    path: '/tools/icon-slicer',
    icon: TOOL_ICONS['icon-slicer'],
    color: 'bg-pink-500',
    nameKey: 'iconSlicer',
    descriptionKey: 'toolDescIconSlicer',
  },
];
