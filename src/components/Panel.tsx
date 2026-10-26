/**
 * Panel — the blade that grows out of the screen edge.
 *
 * Motion: when closed, a clip-path leaves only the thin edge bar visible.
 * When `open` flips true the clip springs out to the full blade, growing
 * outward and along the edge together, while a black veil over the content
 * fades away just behind it (see `.blade::after` in panel.css). Closing runs
 * the reverse: the content dims first and the shape draws back into the bar.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useStore } from '../store/appStore'
import { PANEL_LEAVE_EVENT, PANEL_ENTER_EVENT } from '../hooks/useEdgeHover'
import { Header } from './Header'
import { ShelfSearch } from './ShelfSearch'
import { ItemList } from './ItemList'
import { EmojiPicker } from './EmojiPicker'
import { Settings } from './Settings'
import { ToastStack } from './Toast'
import { ClearMenu } from './ClearMenu'
import { PreviewFlyout } from './PreviewFlyout'
import { IndicatorStyleFlyout } from './IndicatorStyleFlyout'
import { LanguageFlyout } from './LanguageFlyout'
import { CopyIndicatorCurve } from './CopyIndicatorCurve'
import { useFilteredItems } from '../hooks/useFilteredItems'
import { resolvePanelHeight, resolvePanelWidth, resolveTopCardWidth, resolveTopPanelHeight } from '../../shared/panelSize'

import { useTranslation } from '../i18n'

// Shelf open/close motion: real damped springs written out as CSS linear()
// easings, so the browser runs them with no per-frame JS.
// - Open: response 0.38s, damping 0.86, launched with a little initial
//   velocity so the very first frame already moves. It is cut where the
//   spring first reaches its target; the overshoot after that point would sit
//   outside the blade and be clipped away, so it would only cost frames.
// - Close: critically damped (no bounce), response 0.24s, cut once less than
//   a pixel of travel is left. Dismissal is quicker than presentation.
const SHELF_OPEN_MOTION =
  'clip-path 285ms linear(0, 0.055 3.5%, 0.149 8.5%, 0.414 21.8%, 0.524 27.8%, 0.614 33.3%, 0.693 38.8%, 0.759 44.3%, 0.817 50%, 0.866 56%, 0.907 62.5%, 0.941 69.8%, 0.969 78.3%, 0.989 88.5%, 1)'
const SHELF_CLOSE_MOTION =
  'clip-path 289ms linear(0, 0.021 1.8%, 0.058 3.8%, 0.116 6.3%, 0.23 10.5%, 0.402 16.8%, 0.503 20.8%, 0.586 24.5%, 0.659 28.2%, 0.725 32.3%, 0.782 36.5%, 0.832 41%, 0.874 46%, 0.911 51.7%, 0.941 58.5%, 0.965 66.8%, 0.982 77.5%, 0.994 93.8%, 1)'

export function Panel() {
  const open = useStore((s) => s.open)
  const { pinned, recent } = useFilteredItems()
  const filteredItems = useMemo(() => [...pinned, ...recent], [pinned, recent])
  const filteredCount = filteredItems.length
  const clear = useStore((s) => s.clear)
  const typeFilter = useStore((s) => s.typeFilter)
  const query = useStore((s) => s.query)

  const settings = useStore((s) => s.settings)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const setQuery = useStore((s) => s.setQuery)
  const emojiOpen = useStore((s) => s.emojiOpen)
  const setEmojiOpen = useStore((s) => s.setEmojiOpen)
  // Mount the picker on first open, then keep it. Tearing it (and ItemList)
  // down on every smile click is what made the switch hitch.
  const emojiMountedRef = useRef(false)
  if (emojiOpen) emojiMountedRef.current = true
  const emojiMounted = emojiMountedRef.current
  const edgeHintActive = useStore((s) => s.edgeHintActive)
  const edgeTransition = useStore((s) => s.edgeTransition)
  const [startupBeacon, setStartupBeacon] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Graceful startup fade-in intro for the trigger bar on launch
    const timer = window.setTimeout(() => {
      setStartupBeacon(false)
    }, 2200)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!open) {
      // Delay resetting view state until after the retraction spring finishes (~350ms),
      // so the blade smoothly retracts with the current view without flashing the main clipboard.
      const timer = window.setTimeout(() => {
        if (!useStore.getState().open) {
          setSettingsOpen(false)
          setQuery('')
          setEmojiOpen(false)
        }
      }, 400)
      return () => window.clearTimeout(timer)
    }
  }, [open, setSettingsOpen, setQuery, setEmojiOpen])

  const isRight = settings.stickPosition === 'right'
  const isTop = settings.stickPosition === 'top'
  const isHorizontal = isTop

  const screenW = typeof window !== 'undefined' ? window.innerWidth : 800
  const screenH = typeof window !== 'undefined' ? window.innerHeight : 800
  const panelWidth = resolvePanelWidth(settings)
  // The native window is exactly blade + 60px of flare gutters, so this is
  // the width the horizontal dock should occupy.
  const topPanelWidth = Math.min(Math.max(0, screenW - 60), 1080)
  const topH = isHorizontal ? resolveTopPanelHeight(settings) : 0
  // Settings stays inside the dock height the user chose. The native window
  // still reserves a little room below for flyouts, but the visible blade no
  // longer grows when Settings opens.
  const panelH = isHorizontal ? topH : resolvePanelHeight(settings, screenH)
  // Horizontal cards breathe with the dock height: 146px at the classic
  // 210px dock, 120px at the 180px compact floor. Keep roughly the 1.75:1
  // card proportion the compact dock was designed around (210x120), capped
  // at the classic 210px width.
  const horizontalCardH = isHorizontal ? Math.max(72, Math.min(146, panelH - 60)) : 146
  const horizontalCardW = isHorizontal ? resolveTopCardWidth(horizontalCardH) : 210
  const minY = panelH / 2
  const maxY = screenH - panelH / 2
  const vOffset = settings.verticalOffset ?? 0.5
  const midY = Math.round(minY + vOffset * (maxY - minY))
  const topOffset = `${midY}px`

  // The actual pixel height of the trigger zone on the left edge
  const triggerHeightPx = Math.round(window.innerHeight * settings.hotZoneHeight)
  const halfTrigger = Math.round(triggerHeightPx / 2)

  // While Settings is open, pin the blade's top edge so changing its height
  // doesn't slide the controls under the cursor between clicks.
  const [settingsAnchorTop, setSettingsAnchorTop] = useState<number | null>(null)
  useEffect(() => {
    if (!settingsOpen || isHorizontal) {
      setSettingsAnchorTop(null)
      return
    }
    setSettingsAnchorTop((prev) => prev ?? Math.max(0, Math.round(midY - panelH / 2)))
  }, [settingsOpen, isHorizontal, midY, panelH])

  // Expose the blade depth to flyouts and any CSS that positions itself
  // relative to the blade (`right: var(--panel-width)`).
  useEffect(() => {
    document.documentElement.style.setProperty('--panel-width', `${panelWidth}px`)
  }, [panelWidth])

  const setDragActive = useStore((s) => s.setDragActive)
  const setInternalDragReq = useStore((s) => s.setInternalDragReq)
  const internalDragReq = useStore((s) => s.internalDragReq)

  const bladeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const blade = bladeRef.current
    if (!blade) return

    const handleLeave = () => window.dispatchEvent(new Event(PANEL_LEAVE_EVENT))
    const handleEnter = () => window.dispatchEvent(new Event(PANEL_ENTER_EVENT))

    blade.addEventListener('mouseleave', handleLeave)
    blade.addEventListener('mouseenter', handleEnter)
    return () => {
      blade.removeEventListener('mouseleave', handleLeave)
      blade.removeEventListener('mouseenter', handleEnter)
    }
  }, [])

  useEffect(() => {
    const unsubDragEnd = window.edge.onDragEnd(() => {
      // Delay clearing to allow React's drop event to process first if they coincide
      setTimeout(() => {
        setInternalDragReq(null)
        setDragActive(false)
      }, 150)
    })

    const unsubInternalDrop = window.edge.onInternalDrop((pos) => {
      // The OS drag ended inside our window, but Electron/Windows swallowed the drop event.
      if (!internalDragReq) return
      
      const req = { ...internalDragReq }
      setInternalDragReq(null)
      setDragActive(false)
      
      const el = document.elementFromPoint(pos.x, pos.y)
      if (!el) return

      // Check if dropped inside the Preview Flyout
      const flyoutEl = el.closest('[data-preview-flyout]') || el.closest('.preview-flyout')
      if (flyoutEl) {
        const currentPreviewId = useStore.getState().previewItemId
        if (req.id === currentPreviewId) {
          // Dropped back onto its own preview flyout — DO NOTHING (keep in collection)
          console.log('[Panel] Dropped back onto own preview flyout, keeping in collection')
          return
        } else if (currentPreviewId) {
          // Dropped onto a different item's preview flyout — MERGE
          console.log('[Panel] Dropped onto another preview flyout, merging')
          window.edge.mergeItems(req.id, currentPreviewId)
          return
        }
      }

      const isTop = (settings.stickPosition === 'top')
      const isRight = (settings.stickPosition === 'right')
      
      const isInsideSplitZone = 
        !!el.closest('.split-dropzone') ||
        (isTop && pos.y <= 80) ||
        (!isTop && isRight && pos.x >= window.innerWidth - 100) ||
        (!isTop && !isRight && pos.x <= 100)

      if (isInsideSplitZone) {
        console.log('[Panel] Dropped in split dropzone, splitting')
        if (req.imageId || (req.paths && req.paths.length > 0)) {
          window.edge.splitItem(req)
        }
        return
      }

      const itemEl = el.closest('.item-main')
      if (itemEl) {
        const targetId = itemEl.getAttribute('data-id')
        if (targetId && targetId !== req.id) {
          // Dropped on a DIFFERENT item: merge
          window.edge.mergeItems(req.id, targetId)
        } else if (targetId === req.id) {
          // Dropped on the SAME item: do nothing, keep it in the collection
        }
      }
      // Dropping anywhere else (e.g. empty shelf / list space) is a clean return to shelf (no-op).
    })

    return () => {
      unsubDragEnd()
      unsubInternalDrop()
    }
  }, [internalDragReq, setInternalDragReq, setDragActive])

  const hasDragContent = (e: React.DragEvent) => {
    const types = Array.from(e.dataTransfer?.types || [])
    return (
      types.includes('Files') ||
      types.includes('text/uri-list') ||
      types.includes('text/plain') ||
      types.includes('text/html') ||
      types.includes('URL')
    )
  }

  const onDragEnter = (e: React.DragEvent) => {
    if (hasDragContent(e)) {
      e.preventDefault()
      setDragActive(true)
    }
  }

  const onDragOver = (e: React.DragEvent) => {
    if (hasDragContent(e)) {
      e.preventDefault()
    }
  }

  const onDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null
    if (related && e.currentTarget.contains(related)) return
    setDragActive(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (internalDragReq) {
      setInternalDragReq(null)
      window.edge?.setInternalDrag?.(false)
    }
    setDragActive(false)
  }

  const isTransitioning = !!edgeTransition?.active
  const isVisuallyOpen = isTransitioning
    ? edgeTransition.stage === 'expanding'
    : open

  let containerClass = 'blade-container'
  if (isRight) containerClass += ' blade-right'
  else if (isTop) containerClass += ' blade-top'
  else containerClass += ' blade-left'
  if (isHorizontal) containerClass += ' horizontal-dock'
  if (isHorizontal && panelH < 210) containerClass += ' blade-top-compact'
  if (isHorizontal && panelH < 180) containerClass += ' blade-top-ultra'
  if (!isHorizontal && panelWidth < 300) containerClass += ' blade-compact'
  if (!isHorizontal && panelWidth < 260) containerClass += ' blade-narrow'
  if (!isHorizontal && panelH < 380) containerClass += ' blade-short'
  if (!isHorizontal && panelH < 300) containerClass += ' blade-very-short'
  if (isVisuallyOpen) containerClass += ' is-open'
  if (isTransitioning) containerClass += ' is-transitioning'

  const reduceMotion = !!settings.reduceMotion
  if (reduceMotion) containerClass += ' reduce-motion'
  // The transition is read from the new style, so picking it by the target
  // state gives the open spring on open and the close spring on close.
  const clipTransition = reduceMotion
    ? 'clip-path 0.01s linear'
    : isVisuallyOpen ? SHELF_OPEN_MOTION : SHELF_CLOSE_MOTION

  let currentTransition = clipTransition
  let currentOpacity = 1

  if (isTransitioning && !reduceMotion) {
    if (edgeTransition.stage === 'retracting') {
      currentTransition = SHELF_CLOSE_MOTION
      currentOpacity = 1
    } else if (edgeTransition.stage === 'bar_fade_out') {
      currentTransition = 'opacity 0.10s ease-out'
      currentOpacity = 0
    } else if (edgeTransition.stage === 'bar_fade_in') {
      currentTransition = 'opacity 0.12s ease-out'
      currentOpacity = 1
    } else if (edgeTransition.stage === 'expanding') {
      currentTransition = SHELF_OPEN_MOTION
      currentOpacity = 1
    }
  }

  const containerStyle: Record<string, unknown> = {
    position: 'absolute',
    zIndex: 10,
    pointerEvents: isTransitioning ? 'none' : open ? 'auto' : 'none',
    transition: mounted ? currentTransition : 'none',
    opacity: currentOpacity
  }
  if (isTransitioning) {
    containerStyle.willChange = 'clip-path, opacity'
  }

  // Settings pins the top edge so height changes grow downward instead of
  // moving the size controls out from under the cursor.
  const anchoredTop = !isHorizontal && settingsOpen && settingsAnchorTop != null
    ? Math.min(Math.max(0, settingsAnchorTop), Math.max(0, screenH - panelH))
    : null

  // Static centering via plain CSS transform (framer x/y shorthands removed
  // with the bounce cleanup — same visual placement, no runtime needed).
  if (isRight) {
    if (anchoredTop != null) {
      containerStyle.top = `${anchoredTop}px`
      containerStyle.transform = 'none'
    } else {
      containerStyle.top = topOffset
      containerStyle.transform = 'translateY(-50%)'
    }
    containerStyle.right = 0
  } else if (isTop) {
    containerStyle.top = 0
    containerStyle.left = '50%'
    containerStyle.transform = 'translate(-50%, 0)'
  } else if (anchoredTop != null) {
    containerStyle.top = `${anchoredTop}px`
    containerStyle.transform = 'none'
    containerStyle.left = 0
  } else {
    containerStyle.top = topOffset
    containerStyle.transform = 'translateY(-50%)'
    containerStyle.left = 0
  }

  const alignment = settings.triggerAlignment || 'center'
  let insetTop = `calc(50% - ${halfTrigger}px)`
  let insetBottom = `calc(50% - ${halfTrigger}px)`

  if (alignment === 'top') {
    insetTop = '0px'
    insetBottom = `calc(100% - ${triggerHeightPx}px)`
  } else if (alignment === 'bottom') {
    insetTop = `calc(100% - ${triggerHeightPx}px)`
    insetBottom = '0px'
  }

  const triggerWidthPx = Math.round(
    settings.hotZoneHeight >= 0.55 ? 575 : settings.hotZoneHeight >= 0.35 ? 400 : 275
  )
  const halfTriggerW = triggerWidthPx / 2
  let insetLeft = `calc(50% - ${halfTriggerW}px)`
  let insetRight = `calc(50% - ${halfTriggerW}px)`

  if (alignment === 'top' || alignment === 'left') {
    insetLeft = '0px'
    insetRight = `calc(100% - ${triggerWidthPx}px)`
  } else if (alignment === 'bottom' || alignment === 'right') {
    insetLeft = `calc(100% - ${triggerWidthPx}px)`
    insetRight = '0px'
  }

  // Set clipPath via style (not animate) to avoid Framer Motion's broken
  // calc() interpolation — CSS transitions handle it correctly.
  // The open clip is the blade's own box plus the 30px reverse-curve flares,
  // nothing more (flyouts are portaled to <body>, and the blade clips its
  // own overflow). With no spare margin the shape grows outward and along
  // the edge together, instead of the outward edge snapping across in the
  // first frames. Every dock keeps the same 24px corners while it grows.
  let clipPath: string
  const hotWidth = settings.hotZoneWidth || 3
  if (isRight) {
    clipPath = isVisuallyOpen
      ? 'inset(-30px -44px -30px 0px round 24px 0px 0px 24px)'
      : `inset(${insetTop} 0px ${insetBottom} calc(100% - ${hotWidth}px) round 24px 0px 0px 24px)`
  } else if (isTop) {
    clipPath = isVisuallyOpen
      ? 'inset(0px -30px -44px -30px round 0px 0px 24px 24px)'
      : `inset(0px ${insetRight} calc(100% - ${hotWidth}px) ${insetLeft} round 0px 0px 24px 24px)`
  } else {
    clipPath = isVisuallyOpen
      ? 'inset(-30px 0px -30px -44px round 0px 24px 24px 0px)'
      : `inset(${insetTop} calc(100% - ${hotWidth}px) ${insetBottom} 0px round 0px 24px 24px 0px)`
  }
  containerStyle.clipPath = clipPath

  return (
    <div className="root">
      <CopyIndicatorCurve />
      <div
        className={containerClass}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={containerStyle}
      >

        {/* Edge Trigger Bar & Location Hint Beacon (Startup fade-in intro + pulse on wrong-position touch) */}
        <AnimatePresence>
          {!open && (startupBeacon || (edgeHintActive && (settings.showEdgeLocationHint ?? false))) && (
            <motion.div
              key="edge-location-beacon"
              initial={{ opacity: 0 }}
              animate={{ opacity: startupBeacon ? 0.8 : 0.5 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: reduceMotion ? 0.01 : startupBeacon ? 0.5 : 0.18,
                ease: [0.16, 1, 0.3, 1]
              }}
              style={
                isHorizontal
                  ? {
                      position: 'absolute',
                      left: insetLeft,
                      right: insetRight,
                      top: 0,
                      height: 2,
                      boxSizing: 'border-box',
                      background: 'linear-gradient(to right, transparent, rgba(10, 132, 255, 0.55) 20%, rgba(10, 132, 255, 0.9) 50%, rgba(10, 132, 255, 0.55) 80%, transparent)',
                      boxShadow: '0 0 10px rgba(10, 132, 255, 0.35)',
                      borderRadius: '999px',
                      pointerEvents: 'none',
                      zIndex: 99
                    }
                  : {
                      position: 'absolute',
                      top: insetTop,
                      bottom: insetBottom,
                      [isRight ? 'right' : 'left']: 0,
                      width: 2,
                      boxSizing: 'border-box',
                      background: 'linear-gradient(to bottom, transparent, rgba(10, 132, 255, 0.55) 20%, rgba(10, 132, 255, 0.9) 50%, rgba(10, 132, 255, 0.55) 80%, transparent)',
                      boxShadow: '0 0 10px rgba(10, 132, 255, 0.35)',
                      borderRadius: isRight ? '999px 0 0 999px' : '0 999px 999px 0',
                      pointerEvents: 'none',
                      zIndex: 99
                    }
              }
            />
          )}
        </AnimatePresence>
        {isTop && (
          <>
            <div className="flare-horizontal flare-top-left" style={{ opacity: isVisuallyOpen ? 1 : 0 }}>
              <svg width="32" height="30" viewBox="0 0 32 30" fill="none" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision">
                <path d="M 0 0 C 13.43 0 30 16.57 30 30 L 32 30 L 32 0 Z" fill="rgba(255, 255, 255, 0.78)" />
              </svg>
            </div>
            <div className="flare-horizontal flare-top-right" style={{ opacity: isVisuallyOpen ? 1 : 0 }}>
              <svg width="32" height="30" viewBox="0 0 32 30" fill="none" xmlns="http://www.w3.org/2000/svg" shapeRendering="geometricPrecision">
                <path d="M 2 30 C 2 16.57 18.57 0 32 0 L 0 0 L 0 30 Z" fill="rgba(255, 255, 255, 0.78)" />
              </svg>
            </div>
          </>
        )}
        {!isHorizontal && (isRight ? (
          <>
            <div className="flare-top flare-right" style={{ opacity: isVisuallyOpen ? 1 : 0 }}>
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 30 0 L 30 30 L 0 30 A 30 30 0 0 0 30 0 Z" fill="rgba(255, 255, 255, 0.78)" />
              </svg>
            </div>
            <div className="flare-bottom flare-right" style={{ opacity: isVisuallyOpen ? 1 : 0 }}>
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 30 30 L 30 0 L 0 0 A 30 30 0 0 1 30 30 Z" fill="rgba(255, 255, 255, 0.78)" />
              </svg>
            </div>
          </>
        ) : (
          <>
            <div className="flare-top" style={{ opacity: isVisuallyOpen ? 1 : 0 }}>
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 0 0 L 0 30 L 30 30 A 30 30 0 0 1 0 0 Z" fill="rgba(255, 255, 255, 0.78)" />
              </svg>
            </div>
            <div className="flare-bottom" style={{ opacity: isVisuallyOpen ? 1 : 0 }}>
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 0 30 L 0 0 L 30 0 A 30 30 0 0 0 0 30 Z" fill="rgba(255, 255, 255, 0.78)" />
              </svg>
            </div>
          </>
        ))}
        <div
          ref={bladeRef}
          className="blade"
          style={isHorizontal
            ? ({ width: topPanelWidth, height: panelH, '--hcard-h': `${horizontalCardH}px`, '--hcard-w': `${horizontalCardW}px` } as React.CSSProperties)
            : { width: panelWidth, height: panelH }}
        >
          <Header
            isHorizontal={isHorizontal}
            itemCount={filteredCount}
            clearProps={{
              items: filteredItems,
              disabled: recent.length === 0,
              panelOpen: open,
              onClear: (ids) => clear(ids),
              onClearAll: () => {
                if (typeFilter === 'all' && !query.trim()) {
                  clear()
                } else {
                  clear(recent.map((it) => it.id))
                }
              }
            }}
          />

          <ToastStack />
          {!isHorizontal && !emojiOpen && !settingsOpen && <ShelfSearch />}
          <div style={{ flex: 1, display: 'grid', gridTemplate: '1fr / 1fr', overflow: 'hidden', position: 'relative' }}>
            {/* Main clipboard / emoji view (persistent so ItemList is never torn down and doesn't jump on Y-axis) */}
            <div
              style={{
                gridArea: '1 / 1 / 2 / 2',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                opacity: settingsOpen ? 0 : 1,
                visibility: settingsOpen ? 'hidden' : 'visible',
                pointerEvents: settingsOpen ? 'none' : 'auto',
                transition: `opacity ${settings.reduceMotion ? '0.01s' : '0.16s'} ease, visibility ${settings.reduceMotion ? '0.01s' : '0.16s'} ease`
              }}
              aria-hidden={settingsOpen}
            >
              <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplate: '1fr / 1fr', overflow: 'hidden' }}>
                <div
                  style={{
                    gridArea: '1 / 1 / 2 / 2',
                    display: emojiOpen ? 'none' : 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    height: '100%',
                    overflow: 'hidden'
                  }}
                  aria-hidden={emojiOpen}
                >
                  <ItemList />
                </div>
                <div
                  style={{
                    gridArea: '1 / 1 / 2 / 2',
                    display: emojiOpen ? 'flex' : 'none',
                    flexDirection: 'column',
                    minHeight: 0,
                    height: '100%',
                    overflow: 'hidden'
                  }}
                  aria-hidden={!emojiOpen}
                >
                  {emojiMounted ? <EmojiPicker active={emojiOpen} isHorizontal={isHorizontal} /> : null}
                </div>
              </div>
              {!isHorizontal && !emojiOpen && (
                <div className="footer" style={{ position: 'relative', zIndex: 100 }}>
                  <div className="footer-capsule">
                    <span className="footer-capsule-count" title={`${filteredCount}`}>
                      {filteredCount}
                    </span>
                  </div>
                  <div className="spacer" />
                  <ClearMenu
                    items={filteredItems}
                    disabled={recent.length === 0}
                    panelOpen={open}
                    onClear={(ids) => clear(ids)}
                    onClearAll={() => {
                      if (typeFilter === 'all' && !query.trim()) {
                        clear()
                      } else {
                        clear(recent.map((it) => it.id))
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {/* Settings view */}
            <AnimatePresence>
              {settingsOpen && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, x: isHorizontal ? 0 : (isRight ? -8 : 8), y: isHorizontal ? (isTop ? -8 : 8) : 0 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: isHorizontal ? 0 : (isRight ? 8 : -8), y: isHorizontal ? (isTop ? -8 : 8) : 0 }}
                  transition={settings.reduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 500, damping: 32, mass: 0.5 }}
                  style={{ gridArea: '1 / 1 / 2 / 2', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}
                >
                  <Settings isHorizontal={isHorizontal} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <DropOverlay />
          <SplitDropZone stickPosition={settings.stickPosition || (isRight ? 'right' : 'left')} />
        </div>
        <PreviewFlyout isRight={isRight} />
        <IndicatorStyleFlyout isRight={isRight} />
        <LanguageFlyout isRight={isRight} />
      </div>
    </div>
  )
}

/*
function getTutorialText(step: number): string {
  switch (step) {
    case 1:
      return 'Click the trash icon on the pinned card below to delete it.'
    case 2:
      return 'Copy any text or image (Ctrl + C) from another application to capture it.'
    case 3:
      return 'Drag the image card below and drop it onto your desktop.'
    case 4:
      return 'Click the files card below to expand the stack and view its contents.'
    case 5:
      return 'Click the Clear button at the bottom of the panel to finish.'
    default:
      return ''
  }
}
*/

function DropOverlay() {
  const { t } = useTranslation()
  const dragActive = useStore((s) => s.dragActive)
  const internalDragReq = useStore((s) => s.internalDragReq)

  return (
    <AnimatePresence>
      {dragActive && !internalDragReq && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            pointerEvents: 'none',
            background: 'rgba(250, 250, 253, 0.94)',
            textAlign: 'center',
            padding: '24px'
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: 'rgba(255, 255, 255, 0.72)',
              border: '1px solid rgba(255, 255, 255, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(29, 29, 31, 0.8)'
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v13"></path>
              <path d="m8 12 4 4 4-4"></path>
              <path d="M4 20h16"></path>
            </svg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#1d1d1f', letterSpacing: '0.01em' }}>
              {t('item.dropToSave')}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(60, 60, 67, 0.6)', lineHeight: 1.4 }}>
              {t('item.dropToSaveDesc')}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SplitDropZone({ stickPosition = 'left' }: { stickPosition?: 'left' | 'right' | 'top' }) {
  const internalDragReq = useStore((s) => s.internalDragReq)
  const isSubitemDragging = !!(
    internalDragReq &&
    (internalDragReq.imageId || (internalDragReq.paths && internalDragReq.paths.length > 0))
  )

  const [isOver, setIsOver] = useState(false)

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    setIsOver(true)
  }

  const handleDragLeave = () => {
    setIsOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsOver(false)
    const req = useStore.getState().internalDragReq
    if (req && (req.imageId || (req.paths && req.paths.length > 0))) {
      window.edge.splitItem(req)
      useStore.getState().setInternalDragReq(null)
    }
  }

  const isTop = stickPosition === 'top'
  const isRight = stickPosition === 'right'

  // Orientation alignment:
  // When dock is on LEFT, drop zone is on the LEFT (-15px x-offset)
  // When dock is on RIGHT, drop zone is on the RIGHT (+15px x-offset)
  // When dock is on TOP, drop zone is at the TOP (-15px y-offset)
  const initialMotion = isTop
    ? { opacity: 0, y: -15 }
    : isRight
      ? { opacity: 0, x: 15 }
      : { opacity: 0, x: -15 }

  const exitMotion = initialMotion

  const styleByPos: React.CSSProperties = isTop
    ? {
        top: 0,
        left: 0,
        right: 0,
        height: isOver ? 72 : 56,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start'
      }
    : isRight
      ? {
          top: 0,
          bottom: 0,
          right: 0,
          width: isOver ? 100 : 80,
          justifyContent: 'flex-end',
          alignItems: 'center'
        }
      : {
          top: 0,
          bottom: 0,
          left: 0,
          width: isOver ? 100 : 80,
          justifyContent: 'flex-start',
          alignItems: 'center'
        }

  return (
    <AnimatePresence>
      {isSubitemDragging && (
        <motion.div
          className={`split-dropzone pos-${stickPosition}${isOver ? ' active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            if (!isOver) setIsOver(true)
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          initial={initialMotion}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={exitMotion}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          style={styleByPos}
        >
          <div className="glow-line" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
