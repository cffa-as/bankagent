import {Easing, interpolate, useCurrentFrame} from 'remotion'
import {CHAPTERS, type Chapter, type Tone} from '../film-plan'
import {COLORS, FONTS} from '../theme'
import {clamp} from './brand'

export const TONE: Record<Tone, string> = {green: COLORS.teal, amber: COLORS.amber, red: COLORS.red, cobalt: COLORS.cobalt}

const Rail = ({number}: {number: string}) => {
  const frame = useCurrentFrame()
  const fill = interpolate(frame, [10, 34], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)})
  const current = Number(number)
  return (
    <div style={{display: 'flex', gap: 5, paddingLeft: 46}}>
      {CHAPTERS.map((item) => {
        const index = Number(item.number)
        const active = index === current
        return (
          <div key={item.id} style={{background: 'rgba(183, 201, 226, 0.18)', borderRadius: 99, flex: 1, height: 4, minWidth: 18, overflow: 'hidden'}}>
            <div
              style={{
                background: active ? TONE[item.tier.tone] : COLORS.steel,
                height: '100%',
                opacity: index < current ? 0.55 : 1,
                width: index < current ? '100%' : active ? `${fill * 100}%` : '0%',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

/** Chapter card shown in the top-left corner; it settles into a compact chip after the intro beat. */
export const ChapterChip = ({chapter, persistent = false}: {chapter: Chapter; persistent?: boolean}) => {
  const frame = useCurrentFrame()
  const visible = persistent ? interpolate(frame, [8, 22], [0, 1], clamp) : interpolate(frame, [8, 22, 150, 166], [0, 1, 1, 0], clamp)
  const slide = interpolate(frame, [8, 26], [-16, 0], {...clamp, easing: Easing.out(Easing.cubic)})
  const tone = TONE[chapter.tier.tone]
  return (
    <div
      style={{
        background: 'rgba(7, 17, 31, 0.9)',
        borderRadius: 22,
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        left: 64,
        opacity: visible,
        padding: '12px 24px 14px 14px',
        position: 'absolute',
        top: 64,
        transform: `translateX(${slide}px)`,
      }}
    >
      <div style={{alignItems: 'center', display: 'flex', gap: 14}}>
        <span
          style={{
            alignItems: 'center',
            background: COLORS.cobalt,
            borderRadius: 999,
            color: COLORS.white,
            display: 'flex',
            fontFamily: FONTS.sans,
            fontSize: 16,
            fontWeight: 700,
            height: 32,
            justifyContent: 'center',
            width: 32,
          }}
        >
          {Number(chapter.number)}
        </span>
        <span style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 26, fontWeight: 700, letterSpacing: '0.02em'}}>{chapter.title}</span>
        <span
          style={{
            alignItems: 'center',
            border: `1px solid ${tone}`,
            borderRadius: 999,
            color: tone,
            display: 'flex',
            fontFamily: FONTS.sans,
            fontSize: 17,
            fontWeight: 700,
            gap: 8,
            letterSpacing: '0.04em',
            padding: '4px 12px',
          }}
        >
          <span style={{background: tone, borderRadius: 99, height: 8, width: 8}} />
          {chapter.tier.label}
        </span>
        {chapter.highlight && (
          <span
            style={{
              background: COLORS.white,
              borderRadius: 999,
              color: COLORS.navy,
              fontFamily: FONTS.sans,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: '0.1em',
              padding: '5px 12px',
            }}
          >
            {chapter.highlight}
          </span>
        )}
      </div>
      <Rail number={chapter.number} />
    </div>
  )
}

/** Discloses that the film runs on a synthetic ledger with a test MFA code. */
export const DemoDisclosure = () => (
  <div
    style={{
      background: 'rgba(7, 17, 31, 0.78)',
      borderRadius: 10,
      bottom: 40,
      color: COLORS.platinum,
      fontFamily: FONTS.sans,
      fontSize: 15,
      fontWeight: 600,
      letterSpacing: '0.06em',
      padding: '7px 14px',
      position: 'absolute',
      right: 48,
    }}
  >
    真实前端 · 真实 Go API · 合成账本 · 演示 MFA
  </div>
)
