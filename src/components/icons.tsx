/**
 * UI icons: Phosphor (https://phosphoricons.com, MIT), one family for the
 * whole app. Paths are vendored in phosphorPaths.ts (Bold weight, plus Fill
 * for "on" states) so only what the app draws is shipped.
 *
 * Line weight: Phosphor Bold draws its lines 24/256 of the icon wide, which
 * is only ~1.1px at the 11-12px the action pills use and read as thin and
 * small next to the old Lucide set. So each outline gets a matching stroke
 * that brings the line to exactly what Lucide drew: 1.55px up to 14px, 1.7px
 * above (computed from the icon's size prop, as Lucide's absolute stroke
 * was). Filled "on" icons (weight="fill": pin, star) are left as drawn.
 *
 * Size: Phosphor leaves more empty margin inside its grid than Lucide did,
 * so glyphs looked a little small. The view box trims 10 units from each
 * side (glyphs ~8.5% larger in the same box); overflow stays visible so the
 * few icons that reach the grid edge (coffee, users) are never clipped.
 */
import type { SVGProps } from 'react'
import { PHOSPHOR_BOLD, PHOSPHOR_FILL, type PhosphorName } from './phosphorPaths'

type P = SVGProps<SVGSVGElement> & { weight?: 'bold' | 'fill' }

/** Line thickness in px the icon should read at (matches the old Lucide set). */
const linePx = (size: number) => (size <= 14 ? 1.55 : 1.7)
/** Phosphor Bold's own line width on its 256 grid. */
const BOLD_LINE = 24
/** Margin trimmed from each side of the 256 grid, and the resulting view box. */
const TRIM = 10
const VIEW = 256 - TRIM * 2

function uiIcon(name: PhosphorName, fallback = 16) {
  return (p: P) => {
    const size = Number(p.width ?? p.height ?? fallback)
    const { weight, ...rest } = p
    const fillPath = weight === 'fill' ? (PHOSPHOR_FILL as Record<string, string>)[name] : undefined
    // Extra outline (in grid units) so Bold's 24-unit line becomes linePx on screen.
    const extra = fillPath ? 0 : Math.max(0, (linePx(size) * VIEW) / size - BOLD_LINE)
    const color = (rest as { fill?: string }).fill ?? 'currentColor'
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`${TRIM} ${TRIM} ${VIEW} ${VIEW}`}
        width={size}
        height={size}
        fill="currentColor"
        overflow="visible"
        aria-hidden="true"
        focusable="false"
        {...(rest as any)}
      >
        <path
          d={fillPath ?? PHOSPHOR_BOLD[name]}
          {...(extra > 0 ? { stroke: color, strokeWidth: +extra.toFixed(2), strokeLinejoin: 'round' as const } : {})}
        />
      </svg>
    )
  }
}

export const RotateCcwIcon = uiIcon('arrowCounterClockwise')
export const CoffeeIcon = uiIcon('coffee')
export const HeartIcon = uiIcon('heart')
export const StarIcon = uiIcon('star')
export const GlobeIcon = uiIcon('globe')
export const LogOutIcon = uiIcon('signOut')
export const InfoIcon = uiIcon('info')
export const SparklesIcon = uiIcon('sparkle')
export const WhatsNewIcon = InfoIcon
export const ChevronLeftIcon = uiIcon('caretLeft')
export const ChevronRightIcon = uiIcon('caretRight')
export const ChevronUpIcon = uiIcon('caretUp')
export const ChevronDownIcon = uiIcon('caretDown')
export const ExternalLinkIcon = uiIcon('arrowSquareOut')
export const SearchIcon = uiIcon('magnifyingGlass')
export const PinIcon = uiIcon('pushPin')
const PinBase = uiIcon('pushPin')
export const PinFillIcon = (p: P) => <PinBase {...p} weight="fill" />
export const TrashIcon = uiIcon('trash')
export const CopyIcon = uiIcon('copy')
export const GearIcon = uiIcon('gearSix')
export const GripIcon = uiIcon('dotsSixVertical')
export const ImageIcon = uiIcon('image')
export const LinkIcon = uiIcon('link')
export const CloseIcon = uiIcon('x')
export const MinusIcon = uiIcon('minus')
export const DropIcon = uiIcon('arrowLineDown')
export const BundleIcon = uiIcon('stack')
export const ExpandIcon = uiIcon('arrowsOutSimple')
export const ContractIcon = uiIcon('arrowsInSimple')
export const FolderOpenIcon = uiIcon('folderOpen')
export const CheckIcon = uiIcon('check')
export const ClipboardIcon = uiIcon('clipboard')
export const ClockIcon = uiIcon('clockCounterClockwise')
export const RecentIcon = ClockIcon
export const TypeIcon = uiIcon('textT')
export const FilesIcon = uiIcon('files')
export const PaletteIcon = uiIcon('palette')

export const EmojiSmileIcon = uiIcon('smiley', 18)
export const EmojiClockIcon = (p: P) => <ClockIcon width={p.width ?? 18} height={p.height ?? 18} {...(p as any)} />
export const EmojiUserIcon = uiIcon('users', 18)
export const EmojiPawIcon = uiIcon('pawPrint', 18)
export const EmojiFoodIcon = uiIcon('forkKnife', 18)
export const EmojiPlaneIcon = uiIcon('globe', 18)
export const EmojiTrophyIcon = uiIcon('trophy', 18)
export const EmojiBulbIcon = uiIcon('lightbulb', 18)
export const EmojiShapesIcon = uiIcon('shapes', 18)
export const EmojiFlagIcon = uiIcon('flag', 18)
import { CustomFileIcon, FileStackPhoto } from './CustomFileIcon'
export { CustomFileIcon, CustomFileIcon as FileKindIcon, FileStackPhoto }

export const FileIcon = (p: P) => <CustomFileIcon width={p.width ?? 16} height={p.height ?? 16} {...(p as any)} />
export const FileIconGlyph = FileIcon