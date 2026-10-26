import { useStore } from '../store/appStore'
import { SegmentedControl, type SegmentedItem } from './SegmentedControl'
import { GearIcon, CloseIcon, ClockIcon, TypeIcon, LinkIcon, ImageIcon, FilesIcon, PaletteIcon, EmojiSmileIcon } from './icons'
import { playButtonClickSound } from '../lib/soundEffects'
import { loadEmojiCatalog } from '../lib/emoji/load'
import { ShelfSearch } from './ShelfSearch'
import { EmojiCategoryBar } from './EmojiCategoryBar'

import { useTranslation } from '../i18n'
import { ClearMenu } from './ClearMenu'
import type { ClipboardItemDto, TypeFilter } from '../../shared/types'

export interface HeaderProps {
  isHorizontal?: boolean
  itemCount?: number
  clearProps?: {
    items: ClipboardItemDto[]
    disabled: boolean
    panelOpen: boolean
    onClear: (ids: string[]) => void
    onClearAll: () => void
  }
}

export function Header({ isHorizontal = false, itemCount, clearProps }: HeaderProps = {}) {
  const isStoreBuild = useStore((s) => s.isStoreBuild)
  const { t } = useTranslation()
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const updateInfo = useStore((s) => s.updateInfo)
  const settings = useStore((s) => s.settings)
  const settingsTab = useStore((s) => s.settingsTab)
  const setSettingsTab = useStore((s) => s.setSettingsTab)

  const typeFilter = useStore((s) => s.typeFilter)
  const setTypeFilter = useStore((s) => s.setTypeFilter)
  const emojiOpen = useStore((s) => s.emojiOpen)
  const setEmojiOpen = useStore((s) => s.setEmojiOpen)

  const FILTERS: {
    id: TypeFilter
    label: string
    Icon: typeof ClockIcon
  }[] = [
    { id: 'all', label: t('filters.all'), Icon: ClockIcon },
    { id: 'text', label: t('filters.text'), Icon: TypeIcon },
    { id: 'links', label: t('filters.links'), Icon: LinkIcon },
    { id: 'images', label: t('filters.images'), Icon: ImageIcon },
    { id: 'files', label: t('filters.files'), Icon: FilesIcon },
    { id: 'colors', label: t('filters.colors') || 'Colors', Icon: PaletteIcon }
  ]

  const reduceMotion = !!settings.reduceMotion
  const headerFade = `opacity ${reduceMotion ? '0.01s' : '0.16s'} ease`

  // The emoji picker is a view, not a type filter, but it lives in the same
  // segmented control so the two read as one rounded selection box.
  type HeaderSegment = TypeFilter | 'emoji'
  const segments: SegmentedItem<HeaderSegment>[] = [
    ...FILTERS.map((f) => ({
      value: f.id as HeaderSegment,
      label: f.label,
      icon: <f.Icon width={14} height={14} />
    })),
    {
      value: 'emoji',
      label: t('emoji.open'),
      icon: <EmojiSmileIcon width={14} height={14} />
    }
  ]

  return (
    <div
      className={`header${isHorizontal ? ' header-horizontal' : ''}`}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        alignItems: 'center',
        height: isHorizontal ? 40 : 48,
        padding: isHorizontal ? '0 16px' : '12px var(--pad, 14px) 4px var(--pad, 14px)',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: isHorizontal ? 250 : 100
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplate: '1fr / 1fr',
          alignItems: 'center',
          minWidth: 0,
          flex: 1,
          height: 32,
          overflow: 'visible'
        }}
      >
        <div
          className="filter-segmented-track"
          aria-hidden={settingsOpen}
          style={{
            gridArea: '1 / 1 / 2 / 2',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            maxWidth: '100%',
            overflow: 'visible',
            opacity: settingsOpen ? 0 : 1,
            pointerEvents: settingsOpen ? 'none' : 'auto',
            transition: headerFade
          }}
        >
          {/* Type filters + the emoji view toggle, all in one rounded box.
              With the emoji picker open no filter is highlighted; picking a
              filter closes the picker (setTypeFilter), and re-clicking the
              emoji slot toggles it off. */}
          <SegmentedControl
            items={segments}
            value={emojiOpen ? 'emoji' : typeFilter}
            onChange={(val) => {
              playButtonClickSound()
              if (val === 'emoji') {
                setEmojiOpen(true)
                return
              }
              setTypeFilter(val)
            }}
            onReselect={(val) => {
              if (val === 'emoji') {
                playButtonClickSound()
                setEmojiOpen(false)
              }
            }}
            onHoverItem={(val) => {
              if (val === 'emoji') void loadEmojiCatalog()
            }}
            ariaLabel={t('filters.title') || 'Filters'}
            reduceMotion={reduceMotion}
            tabIndex={settingsOpen ? -1 : undefined}
          />
        </div>
        {isHorizontal ? (
          <div
            aria-hidden={!settingsOpen}
            style={{
              gridArea: '1 / 1 / 2 / 2',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: settingsOpen ? 1 : 0,
              pointerEvents: settingsOpen ? 'auto' : 'none',
              transition: headerFade
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#1d1d1f',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginRight: 2
              }}
            >
              {t('header.settings')}
            </span>
            <div className="settings-header-pills" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {[
                { id: 'behaviour' as const, label: t('tabs.behaviour') },
                { id: 'position' as const, label: t('tabs.position') },
                { id: 'appearance' as const, label: t('tabs.appearance') }
              ].map((tab) => {
                const active = settingsTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`settings-header-pill${active ? ' active' : ''}`}
                    onClick={() => {
                      playButtonClickSound()
                      setSettingsTab(tab.id)
                    }}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <span
            aria-hidden={!settingsOpen}
            style={{
              gridArea: '1 / 1 / 2 / 2',
              fontSize: 13,
              fontWeight: 600,
              color: 'rgba(60, 60, 67, 0.6)',
              letterSpacing: '0.01em',
              paddingLeft: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 170,
              lineHeight: '28px',
              opacity: settingsOpen ? 1 : 0,
              pointerEvents: 'none',
              transition: headerFade
            }}
          >
            {t('header.settings')}
          </span>
        )}
      </div>

      {isHorizontal && !settingsOpen && !emojiOpen && (
        <div className="header-search header-search-center">
          <ShelfSearch />
        </div>
      )}
      {isHorizontal && !settingsOpen && emojiOpen && (
        <div className="header-search header-search-center">
          <EmojiCategoryBar isHorizontal={true} />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingRight: 2, position: 'relative', zIndex: 260 }}>
        {isHorizontal && !settingsOpen && itemCount != null && (
          <div className="footer-capsule" style={{ marginRight: 2 }}>
            <span className="footer-capsule-count" title={`${itemCount}`}>
              {itemCount}
            </span>
          </div>
        )}
        {isHorizontal && clearProps && !settingsOpen && (
          <ClearMenu {...clearProps} menuDirection="down" />
        )}
        <button
          type="button"
          className={`icon-btn${settingsOpen ? ' active' : ''}`}
          title={settingsOpen ? t('header.close') : t('header.settings')}
          onClick={() => {
            playButtonClickSound()
            if (settingsOpen) {
              setSettingsOpen(false)
              return
            }
            const state = useStore.getState()
            const hasActiveFlyout = !!(state.previewItemId || state.styleFlyoutOpen)
            if (hasActiveFlyout) {
              state.setPreviewItemId(null)
              state.setStyleFlyoutOpen(false)
              setTimeout(() => {
                useStore.getState().setSettingsOpen(true)
              }, 220)
            } else {
              setSettingsOpen(true)
            }
          }}
          style={{
            color: '#1d1d1f',
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            flexShrink: 0,
            cursor: 'pointer',
            width: 32,
            height: 32,
            display: 'grid',
            placeItems: 'center',
            position: 'relative'
          }}
        >
          <span
            aria-hidden={settingsOpen}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              opacity: settingsOpen ? 0 : 1,
              transition: headerFade,
              pointerEvents: 'none'
            }}
          >
            <GearIcon />
          </span>
          <span
            aria-hidden={!settingsOpen}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              opacity: settingsOpen ? 1 : 0,
              transition: headerFade,
              pointerEvents: 'none'
            }}
          >
            <CloseIcon />
          </span>
          {!settingsOpen && !isStoreBuild && (updateInfo?.downloaded || updateInfo?.hasUpdate) && (
            <span
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: '#30d158',
                border: '1.5px solid rgba(255, 255, 255, 0.9)',
                boxShadow: '0 0 8px rgba(48, 209, 88, 0.45)',
                pointerEvents: 'none'
              }}
            />
          )}
        </button>
      </div>
    </div>
  )
}
