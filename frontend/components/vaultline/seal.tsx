import { useId } from 'react'
import { cn } from '@/lib/utils'

/** light = navy seal for light surfaces · reverse = white seal for dark surfaces */
export type SealTone = 'light' | 'reverse'

const BRAND_NAVY = '#0B1423'
const BRAND_COBALT = '#315BFF'

const SEAL_COLORS: Record<SealTone, { disc: string; channel: string }> = {
  light: { disc: BRAND_NAVY, channel: '#FFFFFF' },
  reverse: { disc: '#FFFFFF', channel: BRAND_NAVY },
}

/** Reserve geometry on a 48 grid. The V starts outside the disc so the clip makes it cut cleanly through the edge. */
const V_CHANNEL = 'M9.5 1 24 33.5 38.5 1'

function useClipId() {
  return `vl-reserve-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
}

function ReserveMark({ tone, clipId }: { tone: SealTone; clipId: string }) {
  const colors = SEAL_COLORS[tone]
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <circle cx="24" cy="24" r="24" />
        </clipPath>
      </defs>
      <circle cx="24" cy="24" r="24" fill={colors.disc} />
      <path
        d={V_CHANNEL}
        fill="none"
        stroke={colors.channel}
        strokeWidth="5.5"
        strokeLinejoin="miter"
        strokeMiterlimit={10}
        clipPath={`url(#${clipId})`}
      />
      <rect x="30" y="29" width="5" height="5" fill={BRAND_COBALT} />
    </>
  )
}

export function VaultlineSeal({ className, title, tone = 'light' }: { className?: string; title?: string; tone?: SealTone }) {
  const clipId = useClipId()
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('size-8 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <ReserveMark tone={tone} clipId={clipId} />
    </svg>
  )
}

const WORDMARK_COLOR: Record<SealTone, string> = {
  light: 'text-brand-navy',
  reverse: 'text-rail-foreground',
}

export function VaultlineWordmark({ tone = 'light', className }: { tone?: SealTone; className?: string }) {
  return (
    <span className={cn('font-wordmark text-[17px] font-bold uppercase leading-none tracking-[-0.035em]', WORDMARK_COLOR[tone], className)}>
      Vaultline
    </span>
  )
}

export function VaultlineLockup({
  tone = 'light',
  descriptor,
  className,
  sealClassName,
  wordmarkClassName,
}: {
  tone?: SealTone
  descriptor?: string
  className?: string
  sealClassName?: string
  wordmarkClassName?: string
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <VaultlineSeal tone={tone} className={cn('size-7', sealClassName)} />
      <VaultlineWordmark tone={tone} className={wordmarkClassName} />
      {descriptor && (
        <span className={cn('hidden pl-1 text-xs tracking-[0.18em] sm:inline', tone === 'reverse' ? 'text-steel' : 'text-muted-foreground')}>
          {descriptor}
        </span>
      )}
    </span>
  )
}

const TICKS = Array.from({ length: 72 }, (_, i) => i)

export function BrandSeal({ className }: { className?: string }) {
  const clipId = useClipId()
  return (
    <svg viewBox="0 0 400 400" className={cn('text-rail-foreground', className)} role="img" aria-label="Vaultline Reserve 印章" fill="none">
      <defs>
        <path id="vl-seal-ring" d="M200 200 m-150 0 a150 150 0 1 1 300 0 a150 150 0 1 1 -300 0" />
        <radialGradient id="vl-seal-light" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--cobalt)" stopOpacity="0.24" />
          <stop offset="70%" stopColor="var(--cobalt)" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="200" cy="200" r="190" fill="url(#vl-seal-light)" />

      <g className="vl-spin">
        {TICKS.map((i) => {
          const a = (i / TICKS.length) * Math.PI * 2
          const r1 = 176
          const r2 = i % 6 === 0 ? 164 : 170
          return (
            <line
              key={i}
              x1={200 + Math.cos(a) * r1}
              y1={200 + Math.sin(a) * r1}
              x2={200 + Math.cos(a) * r2}
              y2={200 + Math.sin(a) * r2}
              stroke="currentColor"
              strokeOpacity={i % 6 === 0 ? 0.6 : 0.22}
              strokeWidth="1"
            />
          )
        })}
        <text fill="var(--steel)" fontSize="10.5" letterSpacing="5.2" className="font-mono">
          <textPath href="#vl-seal-ring">
            VAULTLINE · SERVER-CONTROLLED · RISK · AUTHORIZATION · MFA · AUDIT · RECEIPT ·
          </textPath>
        </text>
      </g>

      <circle cx="200" cy="200" r="132" stroke="currentColor" strokeOpacity="0.14" />

      <svg x="108" y="108" width="184" height="184" viewBox="0 0 48 48">
        <ReserveMark tone="reverse" clipId={clipId} />
      </svg>
    </svg>
  )
}
