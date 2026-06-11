import { ResumeData, initialResumeData, Draft } from './resume-types';

/**
 * Deep merge partial data with initialResumeData defaults.
 * This ensures that any fields missing from old localStorage data
 * (e.g. avatarTransform, certifications, hobbies, etc.) are filled in
 * so the app doesn't crash when accessing nested properties.
 */
function deepMerge<T extends Record<string, unknown>>(defaults: T, partial: Partial<T> | null | undefined): T {
  const result = { ...defaults } as Record<string, unknown>;

  if (!partial || typeof partial !== 'object') {
    return result as T;
  }

  for (const key of Object.keys(defaults)) {
    const defaultValue = defaults[key];
    const partialValue = (partial as Record<string, unknown>)[key];

    if (partialValue === undefined || partialValue === null) {
      // Keep the default
      continue;
    }

    if (Array.isArray(defaultValue) && Array.isArray(partialValue)) {
      result[key] = partialValue;
    } else if (
      typeof defaultValue === 'object' &&
      defaultValue !== null &&
      !Array.isArray(defaultValue) &&
      typeof partialValue === 'object' &&
      partialValue !== null &&
      !Array.isArray(partialValue)
    ) {
      // Recursively merge nested objects
      result[key] = deepMerge(
        defaultValue as Record<string, unknown>,
        partialValue as Record<string, unknown>
      );
    } else {
      result[key] = partialValue;
    }
  }

  return result as T;
}

/**
 * Sanitize resume data loaded from localStorage, filling in any missing fields
 * with defaults from initialResumeData.
 */
export function sanitizeResumeData(data: unknown): ResumeData {
  if (!data || typeof data !== 'object') {
    return { ...initialResumeData };
  }

  try {
    // Deep clone initialResumeData and merge partial data into it
    const defaults = JSON.parse(JSON.stringify(initialResumeData));
    return deepMerge(defaults, data as Record<string, unknown>);
  } catch {
    return { ...initialResumeData };
  }
}

/**
 * Sanitize draft data loaded from localStorage, ensuring all nested resumeData
 * fields are complete with defaults.
 */
export function sanitizeDraft(draft: Partial<Draft>): Draft {
  const now = Date.now();

  return {
    id: draft.id || now.toString(),
    title: draft.title || 'Untitled Draft',
    createdAt: draft.createdAt || now,
    updatedAt: draft.updatedAt || now,
    expiresAt: draft.expiresAt || (now + 7 * 24 * 60 * 60 * 1000),
    resumeData: sanitizeResumeData(draft.resumeData),
    strengths: typeof draft.strengths === 'string' ? draft.strengths : 'Type your strength 1, Type your strength 2, Type your strength 3, Type your strength 4',
    hobbies: typeof draft.hobbies === 'string' ? draft.hobbies : '',
  };
}