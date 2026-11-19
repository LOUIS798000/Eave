/**
 * useFilteredItems — derives the visible, grouped item list from raw state.
 *
 * Split into Pinned (favorites) and Recent (everything else), then apply the
 * search query (combining instant local matching with main-process full-text
 * matching for >300-char payloads, plus image filenames & file paths).
 */
import { useMemo } from 'react'
import { useStore } from '../store/appStore'
import type { ClipboardItemDto, TypeFilter } from '../../shared/types'
import { basename, isImagePath } from '../lib/format'
import { parseColor } from '../lib/colorUtils'

function matches(it: ClipboardItemDto, q: string, fullTextMatchSet: Set<string> | null): boolean {
  if (!q) return true
  if (fullTextMatchSet && fullTextMatchSet.has(it.id)) return true
  const needle = q.toLowerCase()
  switch (it.data.kind) {
    case 'text':
      return it.data.text.toLowerCase().includes(needle)
    case 'files':
      return it.data.paths.some((p) => basename(p).toLowerCase().includes(needle) || p.toLowerCase().includes(needle))
    case 'image':
      return Boolean(it.data.fileName && it.data.fileName.toLowerCase().includes(needle))
    case 'image-collection':
      return it.data.images.some((img) => Boolean(img.fileName && img.fileName.toLowerCase().includes(needle)))
  }
}

/**
 * Explorer-copied photos are stored as `files` but belong in Images, not Files.
 * Mixed stacks (photo + PDF) stay in Files only.
 */
export function isImageOnlyFileItem(it: ClipboardItemDto): boolean {
  if (it.data.kind !== 'files') return false
  const paths = it.data.paths
  if (paths.length === 0) return false
  if (it.data.entries?.some((en) => en.isDirectory)) return false
  return paths.every((p) => isImagePath(p))
}

export function itemMatchesTypeFilter(it: ClipboardItemDto, filter: TypeFilter): boolean {
  if (filter === 'all') return true
  switch (filter) {
    case 'text':
      return it.data.kind === 'text' && !it.data.isUrl && !it.data.isColor && !parseColor(it.data.text)
    case 'links':
      return it.data.kind === 'text' && !!it.data.isUrl
    case 'images':
      if (it.data.kind === 'image' || it.data.kind === 'image-collection') return true
      return isImageOnlyFileItem(it)
    case 'files':
      return it.data.kind === 'files' && !isImageOnlyFileItem(it)
    case 'colors':
      return it.data.kind === 'text' && (!!it.data.isColor || !!parseColor(it.data.text))
  }
}

export interface GroupedItems {
  pinned: ClipboardItemDto[]
  recent: ClipboardItemDto[]
}

export function useFilteredItems(): GroupedItems {
  const items = useStore((s) => s.items)
  const query = useStore((s) => s.query)
  const searchMatchIds = useStore((s) => s.searchMatchIds)
  const typeFilter = useStore((s) => s.typeFilter)
  const tutorialStep = useStore((s) => s.tutorialStep)

  return useMemo(() => {
    const pinned: ClipboardItemDto[] = []
    const recent: ClipboardItemDto[] = []
    const trimmed = query.trim()
    const fullTextMatchSet = trimmed && searchMatchIds ? new Set(searchMatchIds) : null

    const filteredByTutorial = items.filter((it) => {
      if (tutorialStep <= 0) return true
      switch (tutorialStep) {
        case 1:
          return it.id === 'onboarding-welcome'
        case 2:
          return false
        case 3:
          return it.id === 'onboarding-image' || !it.id.startsWith('onboarding-')
        case 4:
          return it.id === 'onboarding-files'
        case 5:
          return true
        default:
          return true
      }
    })

    for (const it of filteredByTutorial) {
      if (!matches(it, trimmed, fullTextMatchSet)) continue
      if (!itemMatchesTypeFilter(it, typeFilter)) continue
      ;(it.pinned ? pinned : recent).push(it)
    }
    return { pinned, recent }
  }, [items, query, searchMatchIds, typeFilter, tutorialStep])
}
