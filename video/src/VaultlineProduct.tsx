import {Audio} from '@remotion/media'
import {
  AbsoluteFill,
  Easing,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion'
import {INTRO_SECONDS, OUTRO_SECONDS, SCENES, type FilmScene} from './scenes'
import {COLORS, FONTS} from './theme'
import timeline from './timeline.json'

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
}

export const PRODUCT_FILM_SECONDS =
  INTRO_SECONDS + SCENES.reduce((total, scene) => total + scene.durationSeconds, 0) + OUTRO_SECONDS

const Mark = ({size}: {size: number}) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="24" fill={COLORS.white} />
    <path
      d="M9.5 1 24 33.5 38.5 1"
      fill="none"
      stroke={COLORS.navy}
      strokeWidth="5.5"
      strokeLinejoin="miter"
      strokeMiterlimit="10"
      clipPath="url(#film-seal-clip)"
    />
    <defs>
      <clipPath id="film-seal-clip">
        <circle cx="24" cy="24" r="24" />
      </clipPath>
    </defs>
    <rect x="30" y="29" width="5" height="5" fill={COLORS.cobalt} />
  </svg>
)

const Lockup = ({size = 46}: {size?: number}) => (
  <div style={{alignItems: 'center', display: 'flex', gap: 14}}>
    <Mark size={size} />
    <div
      style={{
        color: COLORS.white,
        fontFamily: FONTS.sans,
        fontSize: size * 0.59,
        fontWeight: 700,
        letterSpacing: '-0.04em',
        lineHeight: 1,
      }}
    >
      VAULTLINE
    </div>
  </div>
)

const Ambient = () => {
  const frame = useCurrentFrame()
  const drift = interpolate(frame, [0, 300], [0, 32], clamp)
  return (
    <AbsoluteFill
      style={{
        background: `
          linear-gradient(rgba(122, 149, 185, .055) 1px, transparent 1px),
          linear-gradient(90deg, rgba(122, 149, 185, .055) 1px, transparent 1px),
          radial-gradient(circle at 72% 36%, rgba(49, 91, 255, .13), transparent 36%),
          ${COLORS.navy}`,
        backgroundPosition: `${drift}px ${drift}px, ${drift}px ${drift}px, center, center`,
        backgroundSize: '84px 84px, 84px 84px, auto, auto',
      }}
    />
  )
}

const Intro = () => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const markIn = spring({fps, frame: frame - 10, config: {damping: 20, stiffness: 110}})
  const rule = interpolate(frame, [20, 92], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)})
  const titleY = interpolate(frame, [38, 84], [32, 0], {...clamp, easing: Easing.out(Easing.cubic)})
  const titleOpacity = interpolate(frame, [38, 78], [0, 1], clamp)
  const metaOpacity = interpolate(frame, [96, 124], [0, 1], clamp)
  const exit = interpolate(frame, [INTRO_SECONDS * fps - 16, INTRO_SECONDS * fps], [1, 0], clamp)

  return (
    <AbsoluteFill style={{opacity: exit}}>
      <Ambient />
      <div style={{left: 150, position: 'absolute', top: 94}}>
        <Lockup size={45} />
      </div>
      <div style={{color: COLORS.steel, fontFamily: FONTS.mono, fontSize: 16, letterSpacing: '.14em', position: 'absolute', right: 150, top: 108}}>
        PRODUCT FILM / 2026
      </div>

      <div style={{left: 150, position: 'absolute', top: 290}}>
        <div style={{opacity: markIn, transform: `scale(${markIn})`, transformOrigin: 'left center'}}>
          <Mark size={112} />
        </div>
        <div
          style={{
            background: COLORS.cobalt,
            height: 3,
            margin: '36px 0 38px',
            transform: `scaleX(${rule})`,
            transformOrigin: 'left center',
            width: 840,
          }}
        />
        <div
          style={{
            color: COLORS.white,
            fontFamily: FONTS.display,
            fontSize: 94,
            fontWeight: 600,
            letterSpacing: '-.055em',
            lineHeight: 1.18,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          一句话开始
          <br />
          每一步可控
        </div>
        <div
          style={{
            color: COLORS.steel,
            fontFamily: FONTS.sans,
            fontSize: 25,
            letterSpacing: '.06em',
            marginTop: 34,
            opacity: metaOpacity,
          }}
        >
          理解意图 · 治理执行 · 证明结果
        </div>
      </div>

      <ControlRail />
    </AbsoluteFill>
  )
}

const ControlRail = () => {
  const frame = useCurrentFrame()
  const draw = interpolate(frame, [36, 130], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)})
  const steps = [
    ['意图', COLORS.teal],
    ['候选动作', COLORS.amber],
    ['授权', COLORS.red],
    ['业务回执', COLORS.cobalt],
  ] as const

  return (
    <div style={{bottom: 92, position: 'absolute', right: 150, width: 570}}>
      <div style={{background: COLORS.line, height: 2, position: 'relative'}}>
        <div style={{background: COLORS.white, height: 2, transform: `scaleX(${draw})`, transformOrigin: 'left center'}} />
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 20}}>
        {steps.map(([label, color], index) => {
          const stepOpacity = interpolate(frame, [54 + index * 18, 72 + index * 18], [0, 1], clamp)
          return (
            <div key={label} style={{alignItems: 'center', display: 'flex', gap: 9, opacity: stepOpacity}}>
              <span style={{background: color, borderRadius: 99, height: 9, width: 9}} />
              <span style={{color: COLORS.platinum, fontFamily: FONTS.sans, fontSize: 16}}>{label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const RecordedScene = ({scene}: {scene: FilmScene}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const duration = scene.durationSeconds * fps
  const clip = timeline.clips[scene.id as keyof typeof timeline.clips]
  const enter = interpolate(frame, [0, 14], [0, 1], clamp)
  const exit = interpolate(frame, [duration - 14, duration], [1, 0], clamp)
  const camera = interpolate(frame, [0, 72], [1.01, scene.zoom], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  })
  const push = interpolate(frame, [72, duration], [0, 0.025], {...clamp, easing: Easing.inOut(Easing.cubic)})
  const chapterOpacity = interpolate(frame, [10, 30, 82, 100], [0, 1, 1, 0], clamp)
  const chapterY = interpolate(frame, [10, 34], [24, 0], {...clamp, easing: Easing.out(Easing.cubic)})
  const captionIn = spring({fps, frame: frame - 18, config: {damping: 22, stiffness: 120}})
  const captionOpacity = interpolate(frame, [18, 38], [0, 1], clamp)
  const progress = interpolate(frame, [0, duration], [0, 1], clamp)
  const zoom = camera + push

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.navy, opacity: enter * exit}}>
      <AbsoluteFill style={{overflow: 'hidden'}}>
        <OffthreadVideo
          src={staticFile(clip.src)}
          trimBefore={Math.round(clip.trimBeforeSeconds * fps)}
          muted
          style={{
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${zoom})`,
            transformOrigin: `${scene.focusX}% ${scene.focusY}%`,
            width: '100%',
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background: `
            linear-gradient(180deg, rgba(4, 10, 20, .78), transparent 22%),
            linear-gradient(0deg, rgba(4, 10, 20, .94), rgba(4, 10, 20, .4) 26%, transparent 52%)
          `,
        }}
      />

      <div style={{left: 54, position: 'absolute', top: 36}}>
        <Lockup size={34} />
      </div>
      <div
        style={{
          color: COLORS.steel,
          fontFamily: FONTS.mono,
          fontSize: 13,
          letterSpacing: '.13em',
          position: 'absolute',
          right: 54,
          top: 48,
        }}
      >
        REAL UI / SYNTHETIC DATA
      </div>

      <div
        style={{
          background: 'rgba(7, 17, 31, .9)',
          borderLeft: `3px solid ${scene.accent}`,
          left: 64,
          opacity: chapterOpacity,
          padding: '22px 28px 24px',
          position: 'absolute',
          top: 112,
          transform: `translateY(${chapterY}px)`,
          width: 760,
        }}
      >
        <div style={{alignItems: 'center', display: 'flex', gap: 15, marginBottom: 18}}>
          <span style={{background: scene.accent, height: 2, width: 54}} />
          <span style={{color: scene.accent, fontFamily: FONTS.mono, fontSize: 16, letterSpacing: '.13em'}}>
            {scene.number} / {scene.label}
          </span>
        </div>
        <div
          style={{
            color: COLORS.white,
            fontFamily: FONTS.display,
            fontSize: 54,
            fontWeight: 600,
            letterSpacing: '-.045em',
            lineHeight: 1.18,
          }}
        >
          {scene.title}
        </div>
      </div>

      <div
        style={{
          background: 'rgba(4, 10, 20, .72)',
          bottom: 52,
          left: 72,
          opacity: captionOpacity,
          padding: '20px 24px 18px',
          position: 'absolute',
          transform: `translateY(${(1 - captionIn) * 24}px)`,
          width: 1260,
        }}
      >
        <div style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 27, lineHeight: 1.55}}>
          {scene.caption}
        </div>
        <div style={{display: 'flex', gap: 10, marginTop: 17}}>
          {scene.evidence.map((item) => (
            <div
              key={item}
              style={{
                border: `1px solid ${scene.accent}66`,
                borderRadius: 4,
                color: COLORS.platinum,
                fontFamily: FONTS.mono,
                fontSize: 13,
                letterSpacing: '.02em',
                padding: '7px 10px',
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div style={{background: 'rgba(214, 226, 242, .2)', bottom: 0, height: 2, left: 0, position: 'absolute', right: 0}}>
        <div style={{background: scene.accent, height: 2, width: `${progress * 100}%`}} />
      </div>
    </AbsoluteFill>
  )
}

const Outro = () => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 24], [0, 1], clamp)
  const line = interpolate(frame, [12, 80], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)})
  const meta = interpolate(frame, [54, 84], [0, 1], clamp)

  return (
    <AbsoluteFill style={{opacity}}>
      <Ambient />
      <div style={{left: '50%', position: 'absolute', top: 190, transform: 'translateX(-50%)'}}>
        <Mark size={104} />
      </div>
      <div
        style={{
          color: COLORS.white,
          fontFamily: FONTS.display,
          fontSize: 72,
          fontWeight: 600,
          left: '50%',
          letterSpacing: '-.05em',
          lineHeight: 1.3,
          position: 'absolute',
          textAlign: 'center',
          top: 350,
          transform: 'translateX(-50%)',
          width: 1100,
        }}
      >
        模型提出计划
        <br />
        银行服务端决定结果
      </div>
      <div
        style={{
          background: COLORS.cobalt,
          height: 3,
          left: '50%',
          marginTop: 36,
          transform: `translateX(-50%) scaleX(${line})`,
          width: 640,
        }}
      />
      <div
        style={{
          color: COLORS.steel,
          fontFamily: FONTS.mono,
          fontSize: 15,
          letterSpacing: '.13em',
          marginTop: 42,
          opacity: meta,
          textAlign: 'center',
        }}
      >
        VAULTLINE / UNDERSTAND INTENT / GOVERN EXECUTION / PROVE THE OUTCOME
      </div>
      <div
        style={{
          bottom: 54,
          color: '#697a91',
          fontFamily: FONTS.sans,
          fontSize: 15,
          left: 0,
          letterSpacing: '.06em',
          opacity: meta,
          position: 'absolute',
          textAlign: 'center',
          width: '100%',
        }}
      >
        所有账户、金额、动作与回执均为合成演示数据
      </div>
    </AbsoluteFill>
  )
}

export const VaultlineProduct = () => {
  const {fps} = useVideoConfig()
  const introFrames = Math.round(INTRO_SECONDS * fps)
  let offset = introFrames

  return (
    <AbsoluteFill style={{backgroundColor: COLORS.navy, color: COLORS.white}}>
      <Sequence durationInFrames={introFrames}>
        <Intro />
        <Sequence from={12}>
          <Audio src={staticFile('audio/intro.mp3')} volume={0.92} />
        </Sequence>
      </Sequence>

      {SCENES.map((scene) => {
        const durationInFrames = Math.round(scene.durationSeconds * fps)
        const from = offset
        offset += durationInFrames
        return (
          <Sequence key={scene.id} from={from} durationInFrames={durationInFrames}>
            <RecordedScene scene={scene} />
            <Sequence from={12}>
              <Audio src={staticFile(`audio/${scene.id}.mp3`)} volume={0.92} />
            </Sequence>
          </Sequence>
        )
      })}

      <Sequence from={offset} durationInFrames={Math.round(OUTRO_SECONDS * fps)}>
        <Outro />
        <Sequence from={10}>
          <Audio src={staticFile('audio/outro.mp3')} volume={0.92} />
        </Sequence>
      </Sequence>
    </AbsoluteFill>
  )
}
