/**
 * Pure offline smart text transformations for the PreviewFlyout toolbar.
 * Zero external dependencies, zero network I/O, <1ms execution.
 */
import { parseUrlPreview } from './urlPreview'

export type TextTransformId =
  | 'unwrap-pdf'
  | 'format-json'
  | 'minify-json'
  | 'clean-url'
  | 'dedupe-lines'
  | 'toggle-case'

export interface TextTransformAction {
  id: TextTransformId
  labelKey: string
  apply: (text: string) => string
}

const CJK_CHAR = /[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/

/**
 * Remove unwanted hard line-breaks copied from PDFs / academic papers while
 * preserving real paragraph breaks (blank lines) and list items (-, *, 1., •).
 */
export function unwrapPdfLines(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const paragraphs = normalized.split(/\n[ \t]*\n+/)
  return paragraphs
    .map((para) => {
      const lines = para.split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length <= 1) return lines[0] ?? ''
      let out = lines[0]
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i]
        // Keep intentional list items or headings on their own line
        if (/^([-*•·]|(\d+[.)、]))\s+/.test(line)) {
          out += '\n' + line
          continue
        }
        // Hyphenated English word split across lines: "algo-\nrithm" -> "algorithm"
        if (/[A-Za-z]-$/.test(out) && /^[A-Za-z]/.test(line)) {
          out = out.slice(0, -1) + line
          continue
        }
        const prevEnd = out[out.length - 1] ?? ''
        const nextStart = line[0] ?? ''
        const joiner = CJK_CHAR.test(prevEnd) || CJK_CHAR.test(nextStart) ? '' : ' '
        out += joiner + line
      }
      return out.replace(/[ \t]{2,}/g, ' ')
    })
    .filter(Boolean)
    .join('\n\n')
}

/** Try parsing text as a JSON object or array (ignores bare numbers/strings). */
export function tryParseJsonStructure(text: string): unknown | null {
  const trimmed = text.trim()
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

export function formatJsonText(text: string): string {
  const parsed = tryParseJsonStructure(text)
  return parsed !== null ? JSON.stringify(parsed, null, 2) : text
}

export function minifyJsonText(text: string): string {
  const parsed = tryParseJsonStructure(text)
  return parsed !== null ? JSON.stringify(parsed) : text
}

/** Strip utm_* / spm / fbclid / vd_source tracking parameters from a URL. */
export function cleanTrackingUrl(text: string): string {
  const trimmed = text.trim()
  const info = parseUrlPreview(trimmed)
  if (!info || !info.cleanUrl) return text
  // parseUrlPreview strips protocol in some views; preserve full URL via URL API
  try {
    const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    const TRACKING_RE = /^(utm_|fbclid$|gclid$|spm|vd_source$|from$|isappinstalled$|igshid$|mc_cid$|mc_eid$|ref$|ref_src$|si$|feature$|_hsenc$|_hsmi$|yclid$|msclkid$)/i
    let changed = false
    for (const key of Array.from(u.searchParams.keys())) {
      if (TRACKING_RE.test(key)) {
        u.searchParams.delete(key)
        changed = true
      }
    }
    return changed ? u.toString() : text
  } catch {
    return text
  }
}

/** Remove duplicate lines while preserving first-seen order. */
export function dedupeLines(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    if (!seen.has(line)) {
      seen.add(line)
      out.push(line)
    }
  }
  return out.join('\n')
}

/** Toggle English letter casing: lowercase -> UPPERCASE -> lowercase. */
export function toggleTextCase(text: string): string {
  const letters = text.match(/[A-Za-z]/g)
  if (!letters || letters.length === 0) return text
  const upperCount = letters.filter((c) => c >= 'A' && c <= 'Z').length
  return upperCount > letters.length / 2 ? text.toLowerCase() : text.toUpperCase()
}

/**
 * Inspect `text` and return only the contextual smart-transform actions that
 * would genuinely produce a useful change — keeping the toolbar clutter-free.
 */
export function getAvailableTextTransforms(text: string, isUrl = false): TextTransformAction[] {
  const actions: TextTransformAction[] = []
  const trimmed = text.trim()
  if (!trimmed) return actions

  // 1. Clean tracking URL
  if (isUrl || /^https?:\/\/[^\s]+$/i.test(trimmed)) {
    const cleaned = cleanTrackingUrl(trimmed)
    if (cleaned !== trimmed) {
      actions.push({
        id: 'clean-url',
        labelKey: 'transform.cleanUrl',
        apply: cleanTrackingUrl
      })
    }
  }

  // 2. JSON format / minify
  const jsonObj = tryParseJsonStructure(trimmed)
  if (jsonObj !== null) {
    const pretty = JSON.stringify(jsonObj, null, 2)
    const mini = JSON.stringify(jsonObj)
    if (trimmed !== pretty) {
      actions.push({
        id: 'format-json',
        labelKey: 'transform.formatJson',
        apply: formatJsonText
      })
    }
    if (trimmed !== mini && trimmed.includes('\n')) {
      actions.push({
        id: 'minify-json',
        labelKey: 'transform.minifyJson',
        apply: minifyJsonText
      })
    }
  }

  // 3. Unwrap PDF hard line breaks (multi-line non-JSON text)
  if (jsonObj === null && /\n/.test(trimmed)) {
    const unwrapped = unwrapPdfLines(trimmed)
    if (unwrapped !== trimmed) {
      actions.push({
        id: 'unwrap-pdf',
        labelKey: 'transform.unwrapPdf',
        apply: unwrapPdfLines
      })
    }
  }

  // 4. Dedupe lines (when duplicate lines actually exist)
  if (/\n/.test(trimmed)) {
    const deduped = dedupeLines(trimmed)
    if (deduped !== trimmed) {
      actions.push({
        id: 'dedupe-lines',
        labelKey: 'transform.dedupeLines',
        apply: dedupeLines
      })
    }
  }

  // 5. Case toggle for short Latin strings (not URLs or JSON)
  if (!isUrl && jsonObj === null && trimmed.length <= 400 && /[A-Za-z]{2,}/.test(trimmed)) {
    actions.push({
      id: 'toggle-case',
      labelKey: 'transform.toggleCase',
      apply: toggleTextCase
    })
  }

  return actions
}
