const ALLOWED_PROTOCOLS = ['http:', 'https:']

export function safeExternalUrl(url: string | undefined | null): string | null {
  if (!url || !url.trim()) return null
  try {
    const parsed = new URL(url.trim())
    if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return null
    return parsed.href
  } catch {
    return null
  }
}

export function sanitizeSocialLinks(
  raw: Record<string, string | undefined>
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(raw)) {
    const safe = safeExternalUrl(val)
    if (safe) result[key] = safe
  }
  return result
}
