import {Audio} from '@remotion/media'
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion'
import timeline from '../public/timeline.json'

const FPS = 30
const INTRO_SECONDS = 2.4
const CLIP_SECONDS = timeline.durationSeconds
const CLIP_START = Math.round(INTRO_SECONDS * FPS)
const CLIP_FRAMES = Math.round(CLIP_SECONDS * FPS)
const OUTRO_START = CLIP_START + CLIP_FRAMES
const ACCENT = '#5d7cff'

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
}

const fade = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, start + 12, end - 12, end], [0, 1, 1, 0], clamp)

const VaultlineMark = ({size = 72}: {size?: number}) => (
  <svg width={size} height={size} viewBox="0 0 116 116" fill="none" aria-hidden="true">
    <path d="M34 15H15V101H34M82 15H101V101H82" stroke="currentColor" strokeWidth="4" />
    <path d="M0 58H51" stroke="currentColor" strokeWidth="4" />
    <path d="M57 58H73" stroke={ACCENT} strokeWidth="4" />
    <rect x="43" y="43" width="30" height="30" stroke="currentColor" strokeWidth="3" />
  </svg>
)

const Lockup = ({small = false}: {small?: boolean}) => (
  <div
    style={{
      alignItems: 'center',
      color: '#f2f5fa',
      display: 'flex',
      gap: small ? 15 : 26,
      whiteSpace: 'nowrap',
    }}
  >
    <VaultlineMark size={small ? 42 : 76} />
    <div
      style={{
        fontFamily: '"Avenir Next Condensed", "Arial Narrow", sans-serif',
        fontSize: small ? 31 : 66,
        fontWeight: 700,
        letterSpacing: '-.015em',
        lineHeight: 1,
      }}
    >
      VAULT
      <span
        style={{
          background: ACCENT,
          display: 'inline-block',
          height: small ? 25 : 53,
          margin: `0 ${small ? 5 : 9}px`,
          transform: `translateY(${small ? 3 : 5}px)`,
          width: small ? 1 : 2,
        }}
      />
      LINE
    </div>
  </div>
)

const AmbientGrid = () => (
  <AbsoluteFill
    style={{
      background:
        'linear-gradient(rgba(134,158,196,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(134,158,196,.07) 1px, transparent 1px), #07101d',
      backgroundSize: '72px 72px',
    }}
  />
)

const Chapter = ({
  index,
  label,
  end,
  start,
}: {
  index: string
  label: string
  start: number
  end: number
}) => {
  const frame = useCurrentFrame()
  const opacity = fade(frame, start, end)
  const y = interpolate(frame, [start, start + 18], [20, 0], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  })

  return (
    <div style={{opacity, transform: `translateY(${y}px)`}}>
      <div
        style={{
          color: ACCENT,
          fontFamily: '"SFMono-Regular", Menlo, monospace',
          fontSize: 18,
          letterSpacing: '.16em',
          marginBottom: 14,
        }}
      >
        {index}
      </div>
      <div
        style={{
          color: '#f4f6fa',
          fontFamily: '"PingFang SC", "Helvetica Neue", sans-serif',
          fontSize: 42,
          fontWeight: 500,
          letterSpacing: '-.04em',
          lineHeight: 1.16,
          maxWidth: 770,
        }}
      >
        {label}
      </div>
    </div>
  )
}

const Intro = () => {
  const frame = useCurrentFrame()
  const lineWidth = interpolate(frame, [8, 48], [0, 760], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  })
  const opacity = interpolate(frame, [56, 70], [0, 1], clamp)

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <AmbientGrid />
      <div style={{position: 'relative', zIndex: 2}}>
        <div style={{transform: 'scale(1.15)', transformOrigin: 'center'}}>
          <Lockup />
        </div>
        <div
          style={{
            background: ACCENT,
            height: 2,
            margin: '32px auto 24px',
            width: lineWidth,
          }}
        />
        <div
          style={{
            color: '#8e9db1',
            fontFamily: '"SFMono-Regular", Menlo, monospace',
            fontSize: 16,
            letterSpacing: '.18em',
            opacity,
            textAlign: 'center',
          }}
        >
          PRODUCT PREVIEW / SERVER-CONTROLLED BANKING
        </div>
      </div>
    </AbsoluteFill>
  )
}

const RecordedWalkthrough = () => {
  const frame = useCurrentFrame()
  const actionFrame = Math.round(timeline.events.action * FPS)
  const receiptFrame = Math.round(timeline.events.receipt * FPS)
  const zoom = interpolate(
    frame,
    [0, actionFrame - 8, actionFrame + 24, receiptFrame + 24, CLIP_FRAMES],
    [1.02, 1.02, 1.52, 1.48, 1.44],
    {...clamp, easing: Easing.inOut(Easing.cubic)},
  )
  const focusX = interpolate(frame, [actionFrame - 8, actionFrame + 24], [50, 80], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  })
  const progress = interpolate(frame, [0, CLIP_FRAMES], [0, 1], clamp)
  const stageOpacity = interpolate(frame, [0, 12], [0, 1], clamp)

  return (
    <AbsoluteFill style={{backgroundColor: '#050a12'}}>
      <AmbientGrid />
      <div
        style={{
          height: 1080,
          left: 96,
          overflow: 'hidden',
          position: 'absolute',
          top: 0,
          width: 1728,
          clipPath: 'inset(0 0 0 524px)',
          zIndex: 10,
        }}
      >
        <OffthreadVideo
          src={staticFile(timeline.clip)}
          style={{
            height: 1080,
            objectFit: 'cover',
            transform: `scale(${zoom})`,
            transformOrigin: `${focusX}% 50%`,
            width: 1728,
          }}
        />
      </div>
      <div
        style={{
          background: 'linear-gradient(180deg, rgba(4,9,17,.9), transparent 22%)',
          inset: 0,
          position: 'absolute',
          zIndex: 20,
        }}
      />
      <div
        style={{
          background: 'linear-gradient(0deg, rgba(4,9,17,.98), rgba(4,9,17,.76) 52%, transparent)',
          bottom: 0,
          height: 360,
          left: 0,
          position: 'absolute',
          right: 0,
          zIndex: 20,
        }}
      />
      <div
        style={{
          background: '#050a12',
          borderRight: '1px solid rgba(111,139,192,.32)',
          bottom: 0,
          left: 0,
          position: 'absolute',
          top: 0,
          width: 620,
          zIndex: 30,
        }}
      />

      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-between',
          left: 92,
          position: 'absolute',
          right: 92,
          top: 58,
          zIndex: 40,
        }}
      >
        <Lockup small />
        <div
          style={{
            color: '#93a2b7',
            fontFamily: '"SFMono-Regular", Menlo, monospace',
            fontSize: 15,
            letterSpacing: '.14em',
          }}
        >
          SYNTHETIC DEMO · NO REAL FUNDS
        </div>
      </div>

      <div
        style={{
          bottom: 110,
          left: 92,
          opacity: stageOpacity,
          position: 'absolute',
          width: 980,
          zIndex: 40,
        }}
      >
        {frame < actionFrame && (
          <Chapter start={0} end={actionFrame} index="01 / INTENT" label="一句话发起转账 / Intent-led transfer" />
        )}
        {frame >= actionFrame && frame < receiptFrame && (
          <Chapter
            start={actionFrame}
            end={receiptFrame}
            index="02 / SERVER REVIEW"
            label="服务端锁定动作 / Server-owned action snapshot"
          />
        )}
        {frame >= receiptFrame && (
          <Chapter
            start={receiptFrame}
            end={CLIP_FRAMES}
            index="03 / BUSINESS RECEIPT"
            label="成功只认业务回执 / Receipt-backed outcome"
          />
        )}
      </div>

      <div
        style={{
          bottom: 56,
          left: 92,
          position: 'absolute',
          right: 92,
          zIndex: 40,
        }}
      >
        <div style={{background: '#243247', height: 2, position: 'relative'}}>
          <div style={{background: ACCENT, height: 2, width: `${progress * 100}%`}} />
        </div>
        <div
          style={{
            color: '#718198',
            display: 'flex',
            fontFamily: '"SFMono-Regular", Menlo, monospace',
            fontSize: 13,
            justifyContent: 'space-between',
            letterSpacing: '.12em',
            marginTop: 15,
          }}
        >
          <span>REAL UI · LOCAL MOCK LEDGER</span>
          <span>MODEL PROPOSES / BANK SERVER DECIDES</span>
        </div>
      </div>
    </AbsoluteFill>
  )
}

const Outro = () => {
  const frame = useCurrentFrame()
  const first = interpolate(frame, [0, 22], [0, 1], clamp)
  const second = interpolate(frame, [30, 52], [0, 1], clamp)

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <AmbientGrid />
      <div style={{position: 'relative', textAlign: 'center', zIndex: 2}}>
        <div style={{transform: 'scale(1.1)', transformOrigin: 'center'}}>
          <Lockup />
        </div>
        <div
          style={{
            color: '#e7edf5',
            fontSize: 40,
            fontWeight: 400,
            letterSpacing: '-.035em',
            marginTop: 60,
            opacity: first,
          }}
        >
          模型提出计划，银行服务端决定结果。
        </div>
        <div
          style={{
            color: '#7f8ea4',
            fontFamily: '"SFMono-Regular", Menlo, monospace',
            fontSize: 15,
            letterSpacing: '.16em',
            marginTop: 22,
            opacity: second,
          }}
        >
          UNDERSTAND INTENT · GOVERN EXECUTION · PROVE THE OUTCOME
        </div>
      </div>
    </AbsoluteFill>
  )
}

export const ProductFilm = () => (
  <AbsoluteFill style={{backgroundColor: '#07101d', color: '#f4f6fa'}}>
    <Audio src={staticFile('audio/preview-minimax-executive.mp3')} />
    <Sequence durationInFrames={CLIP_START}>
      <Intro />
    </Sequence>
    <Sequence from={CLIP_START} durationInFrames={CLIP_FRAMES}>
      <RecordedWalkthrough />
    </Sequence>
    <Sequence from={OUTRO_START}>
      <Outro />
    </Sequence>
  </AbsoluteFill>
)
