// Backslashes are normalised to "/" by browsers ("/\evil.com" → "//evil.com"),
// and control characters can smuggle the same trick, so both are rejected.
const UNSAFE_REDIRECT_CHARS = /[\\\u0000-\u001f\u007f]/

export function getSafeRedirectPath(
  value: FormDataEntryValue | string | null | undefined,
  fallback = '/dashboard'
) {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  if (UNSAFE_REDIRECT_CHARS.test(value)) return fallback
  return value
}
