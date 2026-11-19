import { useEffect, useRef, useMemo } from 'react'
import gsap from 'gsap'
import { useStore } from '../store/appStore'

import { OCTO_PATH } from '../lib/octoPath'
export { OCTO_PATH }

interface LiquidLoaderProps {
  fillColor?: string
  glowColor?: string
  speed?: number
  active?: boolean
}

export function LiquidOctopusLoader({
  fillColor = '#ffffff',
  glowColor = 'transparent',
  speed = 1.0,
  active = false
}: LiquidLoaderProps) {
  const octoRef = useRef<SVGPathElement | null>(null)

  const copyFlareActive = useStore((s) => s.copyFlareActive)

  const isAnimating = active ?? copyFlareActive

  // Octopus path dimensions & center coordinates
  const bounds = useMemo(() => {
    const coords = OCTO_PATH.match(/-?\d*\.?\d+/g) || []
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    for (let i = 0; i < coords.length; i += 2) {
      const x = parseFloat(coords[i])
      const y = parseFloat(coords[i + 1])
      if (!isNaN(x)) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
      }
      if (!isNaN(y)) {
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }
    return {
      cx: (minX + maxX) / 2 || 300,
      cy: (minY + maxY) / 2 || 168.75
    }
  }, [])

  useEffect(() => {
    if (!isAnimating) return

    // 1. Gentle logo pulse & breathing
    const mainTl = gsap.timeline({ repeat: -1 })
    mainTl.to(
      octoRef.current,
      {
        scale: 1.08,
        transformOrigin: `${bounds.cx}px ${bounds.cy}px`,
        duration: 1.6 / speed,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
      },
      0
    )

    // 2. Smooth Left-to-Right Pendulum Rotation (-14° to +14°)
    const rotTween = gsap.fromTo(
      octoRef.current,
      {
        rotation: -14,
        transformOrigin: `${bounds.cx}px ${bounds.cy}px`
      },
      {
        rotation: 14,
        transformOrigin: `${bounds.cx}px ${bounds.cy}px`,
        duration: 2.2 / speed,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
      }
    )

    return () => {
      mainTl.kill()
      rotTween.kill()
    }
  }, [speed, bounds, isAnimating])

  const iconFilter =
    glowColor && glowColor !== 'transparent'
      ? `drop-shadow(0 0 10px ${glowColor})`
      : 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35))'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
      <svg
        viewBox="140 10 320 310"
        style={{
          width: 41.1,
          height: 41.1,
          overflow: 'visible',
          filter: iconFilter
        }}
      >
        <path
          ref={octoRef}
          d={OCTO_PATH}
          fill={fillColor}
          fillRule="evenodd"
        />
      </svg>
    </div>
  )
}
