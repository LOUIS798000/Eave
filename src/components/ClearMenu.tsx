import { motion, AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { TrashIcon } from './icons'
import { playButtonClickSound } from '../lib/soundEffects'
import { useTranslation } from '../i18n'
import { useStore } from '../store/appStore'
import type { ClipboardItemDto } from '../../shared/types'

interface ClearMenuProps {
  /** Full item list (pinned + recent) to compute time-window ids from. */
  items: ClipboardItemDto[]
  disabled: boolean
  /** Panel's own open/closed state — closes this menu whenever the panel closes. */
  panelOpen: boolean
  /** Clear a specific set of ids (used for the time-window options via deleteBatch). */
  onClear: (ids: string[]) => void
  /** Clear all unpinned history. */
  onClearAll: () => void
  /** Direction menu flies out. Defaults to 'up' for bottom footer, 'down' for header. */
  menuDirection?: 'up' | 'down'
}

const WINDOWS: { key: '1h' | '6h' | '24h'; hours: number }[] = [
  { key: '1h', hours: 1 },
  { key: '6h', hours: 6 },
  { key: '24h', hours: 24 }
]

const MENU_WIDTH = 190
const MENU_GAP = 6

const menuItemStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  padding: '7px 10px',
  borderRadius: 7,
  background: 'transparent',
  color: 'rgba(29, 29, 31, 0.85)',
  fontSize: 12,
  fontWeight: 400,
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.12s ease'
}

export function ClearMenu({
  items,
  disabled,
  panelOpen,
  onClear,
  onClearAll,
  menuDirection = 'up'
}: ClearMenuProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const setClearMenuRect = useStore((s) => s.setClearMenuRect)

  const isMenuDown = menuDirection === 'down'

  // Anchor the dropdown to the button. The menu is portalled to <body> so it is
  // not clipped by the blade: with a short top dock (e.g. 150px) the lower rows
  // — including "clear all" — used to fall outside the panel and could never be
  // clicked.
  const measure = useCallback(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return
    const r = el.getBoundingClientRect()
    const width = window.innerWidth
    const height = window.innerHeight
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, width - MENU_WIDTH - 8))
    // menuDirection 'down' hangs from the button; 'up' rises above it. Either
    // way stay inside the window so the OS surface can't clip the menu.
    const top = isMenuDown ? r.bottom + MENU_GAP : Math.max(8, r.top - MENU_GAP - 190)
    setAnchor({ top: Math.min(top, height - 12), left })
  }, [isMenuDown])

  useEffect(() => {
    if (!panelOpen) {
      setOpen(false)
      setConfirmAll(false)
    }
  }, [panelOpen])

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null)
      return
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, measure])

  // Keep the hover-retention test aware of the dropdown while it is open: the
  // pointer has to sit below the blade to reach the lower rows, and without
  // this the panel would close under it.
  useEffect(() => {
    if (!open) {
      setClearMenuRect(null)
      return
    }
    const el = menuRef.current
    if (!el) return
    const publish = () => {
      const r = el.getBoundingClientRect()
      setClearMenuRect({ top: r.top, bottom: r.bottom, left: r.left, right: r.right })
    }
    publish()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null
    ro?.observe(el)
    return () => {
      ro?.disconnect()
      setClearMenuRect(null)
    }
  }, [open, anchor, setClearMenuRect])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (ref.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    if (open) window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Re-arm "Clear all" confirmation whenever menu closes
  useEffect(() => {
    if (!open) setConfirmAll(false)
  }, [open])

  const clearWindow = (hours: number) => {
    const cutoff = Date.now() - hours * 3600 * 1000
    // Pinned items are never included in a bulk clear
    const ids = items.filter((it) => !it.pinned && it.capturedAt >= cutoff).map((it) => it.id)
    playButtonClickSound()
    setOpen(false)
    if (ids.length > 0) onClear(ids)
  }

  const handleAllClick = () => {
    if (!confirmAll) {
      playButtonClickSound()
      setConfirmAll(true)
      return
    }
    playButtonClickSound()
    setOpen(false)
    onClearAll()
  }

  return (
    <div ref={ref} style={{ position: 'relative', zIndex: open ? 350 : 'auto' }}>
      <button
        className={`text-btn${open ? ' active' : ''}`}
        onClick={() => {
          if (disabled) return
          playButtonClickSound()
          setOpen((v) => !v)
        }}
        disabled={disabled}
        title={t('item.clear')}
        style={{ display: 'flex', alignItems: 'center', gap: 5 }}
      >
        <TrashIcon width={13} height={13} className="clear-btn-icon" />
        <span>{t('item.clear')}</span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && anchor && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, y: isMenuDown ? -6 : 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: isMenuDown ? -6 : 6, scale: 0.98 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: anchor.top,
                left: anchor.left,
                minWidth: MENU_WIDTH,
                background: 'rgba(255, 255, 255, 0.97)',
                border: '1px solid rgba(255, 255, 255, 0.8)',
                borderRadius: 16,
                padding: 4,
                boxShadow: '0 0 0 1px rgba(20, 22, 40, 0.05), 0 16px 40px rgba(20, 22, 40, 0.14), inset 0 1px 0 rgba(255, 255, 255, 1)',
                zIndex: 4000
              }}
            >
              {WINDOWS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => clearWindow(w.hours)}
                  style={menuItemStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(120, 120, 128, 0.14)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  {t(`item.clearLast${w.key}` as any)}
                </button>
              ))}

              <div style={{ height: 1, background: 'rgba(60, 60, 67, 0.12)', margin: '4px 2px' }} />

              <button
                type="button"
                onClick={handleAllClick}
                style={{
                  ...menuItemStyle,
                  color: confirmAll ? '#ff3b30' : 'rgba(29, 29, 31, 0.85)',
                  fontWeight: confirmAll ? 600 : 400
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(120, 120, 128, 0.14)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                {confirmAll ? t('item.clearAllConfirm') : t('item.clearAll')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
