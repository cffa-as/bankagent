import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion'
import {COLORS, FONTS} from '../theme'

export const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const

export const Mark = ({size, inverse = false}: {size: number; inverse?: boolean}) => {
  const id = `seal-${inverse ? 'i' : 'n'}`
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <circle cx="24" cy="24" r="24" />
        </clipPath>
      </defs>
      <circle cx="24" cy="24" r="24" fill={inverse ? COLORS.navy : COLORS.white} />
      <path
        d="M9.5 1 24 33.5 38.5 1"
        fill="none"
        stroke={inverse ? COLORS.white : COLORS.navy}
        strokeWidth="5.5"
        strokeLinejoin="miter"
        strokeMiterlimit="10"
        clipPath={`url(#${id})`}
      />
      <rect x="30" y="29" width="5" height="5" fill={COLORS.cobalt} />
    </svg>
  )
}

export const Lockup = ({size = 44, color = COLORS.white}: {size?: number; color?: string}) => (
  <div style={{alignItems: 'center', display: 'flex', gap: size * 0.32}}>
    <Mark size={size} inverse={color !== COLORS.white} />
    <div style={{color, fontFamily: FONTS.sans, fontSize: size * 0.56, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1}}>
      VAULTLINE
    </div>
  </div>
)

export const Canvas = ({children}: {children?: React.ReactNode}) => {
  const frame = useCurrentFrame()
  const drift = interpolate(frame, [0, 900], [0, 40])
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 700px at 50% ${38 + Math.sin(drift / 18) * 2}%, rgba(49, 91, 255, 0.16), transparent 70%), ${COLORS.navy}`,
        overflow: 'hidden',
      }}
    >
      {children}
    </AbsoluteFill>
  )
}

export const Shimmer = ({text, size, color = COLORS.steel, highlight = COLORS.white}: {text: string; size: number; color?: string; highlight?: string}) => {
  const frame = useCurrentFrame()
  const position = ((frame % 54) / 54) * 200
  return (
    <span
      style={{
        backgroundClip: 'text',
        backgroundImage: `linear-gradient(90deg, ${color} 20%, ${highlight} 50%, ${color} 80%)`,
        backgroundPosition: `${100 - position}% 0`,
        backgroundSize: '200% 100%',
        color: 'transparent',
        fontFamily: FONTS.sans,
        fontSize: size,
        fontWeight: 600,
        WebkitBackgroundClip: 'text',
      }}
    >
      {text}
    </span>
  )
}

export const Spinner = ({size, color = COLORS.cobalt}: {size: number; color?: string}) => {
  const frame = useCurrentFrame()
  return (
    <span
      style={{
        border: `${Math.max(2, size / 9)}px solid ${color}33`,
        borderRadius: 999,
        borderTopColor: color,
        display: 'inline-block',
        height: size,
        transform: `rotate(${frame * 14}deg)`,
        width: size,
      }}
    />
  )
}

export const Check = ({size, color}: {size: number; color: string}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export const ShieldIcon = ({size, color}: {size: number; color: string}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)
