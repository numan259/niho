import type { License, LicenseKind } from './types'

/**
 * Turns an Archive `licenseurl` into a License, or null when the item is not
 * clearly public domain / Creative Commons. Null means "never show this title".
 */
export function classifyLicense(raw: unknown): License | null {
  if (typeof raw !== 'string') return null
  const url = raw.trim()
  const lower = url.toLowerCase()
  if (!lower.includes('creativecommons.org/')) return null

  if (lower.includes('/publicdomain/') || lower.includes('/licenses/publicdomain')) {
    return { url, kind: 'public-domain', label: 'Public domain' }
  }

  const match = lower.match(/\/licenses\/([a-z-]+)\/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const [, code, version] = match
  const kind: LicenseKind = code === 'by' ? 'cc-by' : code === 'by-sa' ? 'cc-by-sa' : 'cc-other'
  return { url, kind, label: `CC ${code.toUpperCase()} ${version}` }
}

/** Lucene clause that restricts Archive searches to PD / CC items. */
export const LICENSE_QUERY = 'licenseurl:(*publicdomain* OR *creativecommons.org*)'

export function needsAttribution(license: License): boolean {
  return license.kind !== 'public-domain'
}
