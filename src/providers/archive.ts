import { classifyLicense, LICENSE_QUERY } from './license'
import type { Episode, SearchPage, Source, TitleDetail, TitleKind, TitleSummary } from './types'

const BASE = 'https://archive.org'

export const posterUrl = (id: string) => `${BASE}/services/img/${encodeURIComponent(id)}`
export const itemPageUrl = (id: string) => `${BASE}/details/${encodeURIComponent(id)}`
export const fileUrl = (id: string, name: string) =>
  `${BASE}/download/${encodeURIComponent(id)}/${name.split('/').map(encodeURIComponent).join('/')}`

// ---------------------------------------------------------------- search

export interface ArchiveSearchOptions {
  collections: string[]
  /** Free-text query typed by the user (optional) */
  text?: string
  page?: number
  rows?: number
  /** Hint used for rows we know are series (e.g. classic_tv) */
  kind?: TitleKind
}

const FIELDS = ['identifier', 'title', 'year', 'date', 'description', 'subject', 'licenseurl']

/** Removes Lucene syntax so user input can never change the query structure. */
export function sanitizeText(text: string): string[] {
  return text
    .replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !/^(and|or|not)$/i.test(t))
    .slice(0, 8)
}

export function buildSearchUrl({ collections, text, page = 1, rows = 24 }: ArchiveSearchOptions): string {
  const clauses = [
    `collection:(${collections.join(' OR ')})`,
    'mediatype:(movies)',
    LICENSE_QUERY,
  ]
  const terms = text ? sanitizeText(text) : []
  if (terms.length) clauses.unshift(`(${terms.join(' AND ')})`)

  const params = new URLSearchParams({ q: clauses.join(' AND '), rows: String(rows), page: String(page), output: 'json' })
  FIELDS.forEach((f) => params.append('fl[]', f))
  params.append('sort[]', 'downloads desc')
  return `${BASE}/advancedsearch.php?${params}`
}

interface SearchDoc {
  identifier: string
  title?: string | string[]
  year?: number | string
  date?: string
  description?: string | string[]
  subject?: string | string[]
  licenseurl?: string
}

export function mapSearchDoc(doc: SearchDoc, kind?: TitleKind): TitleSummary | null {
  const license = classifyLicense(doc.licenseurl)
  if (!license || !doc.identifier) return null
  return {
    key: `archive/${doc.identifier}`,
    provider: 'archive',
    id: doc.identifier,
    name: firstString(doc.title) ?? doc.identifier,
    kind,
    year: parseYear(doc.year ?? doc.date),
    synopsis: cleanText(firstString(doc.description)),
    tags: parseTags(doc.subject),
    poster: posterUrl(doc.identifier),
    license,
  }
}

export async function searchArchive(opts: ArchiveSearchOptions, signal?: AbortSignal): Promise<SearchPage> {
  const res = await fetch(buildSearchUrl(opts), { signal })
  if (!res.ok) throw new Error(`Internet Archive search failed (${res.status})`)
  const json = (await res.json()) as { response: { numFound: number; docs: SearchDoc[] } }
  const page = opts.page ?? 1
  const rows = opts.rows ?? 24
  const items = json.response.docs.map((d) => mapSearchDoc(d, opts.kind)).filter((t): t is TitleSummary => t !== null)
  return { items, total: json.response.numFound, page, hasMore: page * rows < json.response.numFound }
}

// -------------------------------------------------------------- metadata

interface ArchiveFile {
  name: string
  format?: string
  length?: string
  title?: string
}

interface ArchiveMetadata {
  metadata?: SearchDoc & { runtime?: string; creator?: string | string[] }
  files?: ArchiveFile[]
}

/** Browser-playable formats, best first. */
const FORMAT_RANK: Record<string, number> = {
  'h.264 HD': 5,
  'h.264': 4,
  'h.264 IA': 4,
  MPEG4: 3,
  '512Kb MPEG4': 1,
}

/** Words that mark alternate encodings of the same video rather than different episodes. */
const VARIANT_TOKENS = /[\s_.-]*(\d{3,4}p|\d{3,4}x\d{3,4}|2048|1024|hd|sd|stereo|surround|512kb|ia)(?=$|[\s_.-])/gi

export function variantKey(fileName: string): string {
  const base = fileName.replace(/\.mp4$/i, '')
  return base.replace(VARIANT_TOKENS, '').toLowerCase()
}

function qualityLabel(file: ArchiveFile): string {
  const res = file.name.match(/(\d{3,4})p/i)
  if (res) return `${res[1]}p`
  if (file.format === '512Kb MPEG4') return 'Low'
  if (/\bhd\b|_hd/i.test(file.name)) return 'HD'
  return 'Original'
}

/** Groups playable files into episodes; alternate encodings become quality options. */
export function buildEpisodes(id: string, files: ArchiveFile[]): Episode[] {
  const playable = files.filter((f) => /\.mp4$/i.test(f.name) && f.format !== undefined && f.format in FORMAT_RANK)
  const groups = new Map<string, ArchiveFile[]>()
  for (const f of playable) {
    const key = variantKey(f.name)
    groups.set(key, [...(groups.get(key) ?? []), f])
  }

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  const keys = [...groups.keys()].sort(collator.compare)

  return keys.map((key, index) => {
    const variants = groups.get(key)!.sort((a, b) => FORMAT_RANK[b.format!] - FORMAT_RANK[a.format!])
    const best = variants[0]
    const seen = new Set<string>()
    const sources: Source[] = []
    for (const v of variants) {
      const quality = qualityLabel(v)
      if (seen.has(quality)) continue
      seen.add(quality)
      sources.push({ url: fileUrl(id, v.name), type: 'mp4', quality })
    }
    const se = best.name.match(/s(\d{1,2})\s?e(\d{1,3})/i)
    return {
      index,
      name: best.title?.trim() || prettifyFileName(best.name),
      season: se ? Number(se[1]) : undefined,
      number: se ? Number(se[2]) : index + 1,
      durationSec: parseDuration(best.length),
      sources,
    }
  })
}

/**
 * Turns file-derived names like "Sherlock Holmes 01 The Case of…" into "The Case of…".
 * Drops the S01E02 code, then leading words from the series name, then leading
 * numbers / separators; falls back to "Episode N" when nothing meaningful is left.
 */
export function cleanEpisodeName(name: string, seriesName: string, number?: number): string {
  const seriesWords = new Set(seriesName.toLowerCase().match(/[a-z0-9']+/g) ?? [])
  const word = (t: string) => t.toLowerCase().replace(/[^a-z0-9']/g, '')
  const tokens = name.replace(/\bs\d{1,2}\s?e\d{1,3}\b/i, ' ').split(/\s+/).filter(Boolean)

  while (tokens.length && seriesWords.has(word(tokens[0]))) tokens.shift()
  while (tokens.length && /^[-–—:#.,()\d]+$/.test(tokens[0])) tokens.shift()

  const rest = tokens.join(' ').trim()
  return rest || (number ? `Episode ${number}` : name)
}

/** A frame from the middle of the film makes a good wide backdrop. */
function pickBackdrop(id: string, files: ArchiveFile[]): string | undefined {
  const thumbs = files.filter((f) => f.format === 'Thumbnail').map((f) => f.name)
  if (thumbs.length === 0) return undefined
  return fileUrl(id, thumbs[Math.floor(thumbs.length / 2)])
}

export function mapMetadata(json: ArchiveMetadata, kindHint?: TitleKind): TitleDetail | null {
  const md = json.metadata
  if (!md?.identifier) return null
  const summary = mapSearchDoc(md, kindHint)
  if (!summary) return null
  const files = json.files ?? []
  let episodes = buildEpisodes(md.identifier, files)
  if (episodes.length > 1) {
    episodes = episodes.map((ep) => ({ ...ep, name: cleanEpisodeName(ep.name, summary.name, ep.number) }))
  }
  return {
    ...summary,
    kind: episodes.length > 1 ? 'series' : 'movie',
    backdrop: pickBackdrop(md.identifier, files),
    episodes,
    sourcePage: itemPageUrl(md.identifier),
    credit: firstString(md.creator),
  }
}

export async function getArchiveTitle(id: string, signal?: AbortSignal): Promise<TitleDetail | null> {
  const res = await fetch(`${BASE}/metadata/${encodeURIComponent(id)}`, { signal })
  if (!res.ok) throw new Error(`Internet Archive metadata failed (${res.status})`)
  return mapMetadata((await res.json()) as ArchiveMetadata)
}

// --------------------------------------------------------------- helpers

function firstString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export function parseYear(v: unknown): number | undefined {
  const m = String(v ?? '').match(/\b(1[89]\d{2}|20\d{2})\b/)
  return m ? Number(m[1]) : undefined
}

export function parseTags(subject: string | string[] | undefined): string[] {
  const raw = Array.isArray(subject) ? subject : subject ? [subject] : []
  const out: string[] = []
  for (const part of raw.flatMap((s) => s.split(/[;,]/))) {
    const t = part.trim()
    if (!t || t.length > 24) continue
    const nice = t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
    if (!out.includes(nice)) out.push(nice)
  }
  return out.slice(0, 5)
}

/** Accepts seconds ("2896.11") or clock time ("1:31:44"). */
export function parseDuration(v: string | undefined): number | undefined {
  if (!v) return undefined
  if (v.includes(':')) {
    const secs = v.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0)
    return Number.isFinite(secs) && secs > 0 ? Math.round(secs) : undefined
  }
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }

export function cleanText(v: string | undefined): string | undefined {
  if (!v) return undefined
  const text = v
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text || undefined
}

function prettifyFileName(name: string): string {
  const base = name.split('/').pop()!.replace(/\.mp4$/i, '')
  return base.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim()
}
