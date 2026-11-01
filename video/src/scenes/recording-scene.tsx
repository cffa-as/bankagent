import {Video} from '@remotion/media'
import {AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion'
import {Canvas, Mark, clamp} from '../components/brand'
import {Subtitles} from '../components/subtitles'
import {CHAPTERS, type CameraKey, type Note, type Tone} from '../film-plan'
import {COLORS, FONTS} from '../theme'
import timeline from '../timeline.json'

const CONTENT_W = 1536
const CONTENT_H = 864
const CHROME_H = 34

function useCamera(keys: CameraKey[]) {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const seconds = frame / fps
  if (keys.length === 1) return keys[0]
  const times = keys.map((key) => key.at)
  const ease = {...clamp, easing: Easing.inOut(Easing.cubic)}
  return {
    zoom: interpolate(seconds, times, keys.map((key) => key.zoom), ease),
    x: interpolate(seconds, times, keys.map((key) => key.x), ease),
    y: interpolate(seconds, times, keys.map((key) => key.y), ease),
  }
}

const TONE: Record<Tone, string> = {green: COLORS.teal, amber: COLORS.amber, red: COLORS.red, cobalt: COLORS.cobalt}

type Spot = {at: number; until: number; tone: Tone; x: number; y: number; w: number; h: number}
type Box = Pick<Spot, 'x' | 'y' | 'w' | 'h'>

const BRIDGE_GAP = 1.5
const FADE_IN = 0.5
const FADE_OUT = 0.45
const MAX_SPOT_ZOOM = 1.6

const lerpBox = (a: Box, b: Box, p: number): Box => ({
  x: a.x + (b.x - a.x) * p,
  y: a.y + (b.y - a.y) * p,
  w: a.w + (b.w - a.w) * p,
  h: a.h + (b.h - a.h) * p,
})

/** Where the spotlight sits at a moment, and how strongly it is applied (0–1). */
function spotFocus(spots: Spot[], seconds: number): {box: Box; tone: Tone; strength: number; key: number} | null {
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i]
    const previous = spots[i - 1]
    const next = spots[i + 1]
    const bridgedIn = previous !== undefined && spot.at - previous.until < BRIDGE_GAP
    const bridgedOut = next !== undefined && next.at - spot.until < BRIDGE_GAP
    if (seconds >= spot.at - (bridgedIn ? 0 : 0.01) && seconds <= spot.until) {
      const fadeIn = bridgedIn ? 1 : interpolate(seconds, [spot.at, spot.at + FADE_IN], [0, 1], clamp)
      const fadeOut = bridgedOut ? 1 : interpolate(seconds, [spot.until - FADE_OUT, spot.until], [1, 0], clamp)
      return {box: spot, tone: spot.tone, strength: Math.min(fadeIn, fadeOut), key: i}
    }
    if (bridgedOut && next && seconds > spot.until && seconds < next.at) {
      const p = interpolate(seconds, [spot.until, next.at], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)})
      return {box: lerpBox(spot, next, p), tone: p < 0.5 ? spot.tone : next.tone, strength: 1, key: i}
    }
  }
  return null
}

function spotCamera(box: Box) {
  const zoom = Math.min(MAX_SPOT_ZOOM, Math.max(1, Math.min((CONTENT_W * 0.6) / box.w, (CONTENT_H * 0.62) / box.h)))
  const half = 0.5 / zoom
  return {
    zoom,
    x: Math.min(1 - half, Math.max(half, (box.x + box.w / 2) / CONTENT_W)),
    y: Math.min(1 - half, Math.max(half, (box.y + box.h / 2) / CONTENT_H)),
  }
}

const Spotlight = ({box, tone, strength}: {box: Box; tone: Tone; strength: number}) => {
  const color = TONE[tone]
  const ring = interpolate(strength, [0, 1], [1.035, 1], clamp)
  return (
    <div
      style={{
        border: `2px solid ${color}`,
        borderRadius: 12,
        boxShadow: `0 0 0 4000px rgba(7, 17, 31, ${0.52 * strength}), 0 0 0 6px ${color}2e, 0 0 48px ${color}66`,
        height: box.h,
        left: box.x,
        opacity: strength,
        pointerEvents: 'none',
        position: 'absolute',
        top: CHROME_H + box.y,
        transform: `scale(${ring})`,
        width: box.w,
      }}
    />
  )
}

const ChapterRail = ({chapter}: {chapter: string}) => {
  const frame = useCurrentFrame()
  const fill = interpolate(frame, [10, 34], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)})
  const current = Number(chapter)
  return (
    <div style={{display: 'flex', gap: 5, paddingLeft: 46}}>
      {CHAPTERS.map((item) => {
        const index = Number(item.chapter)
        const done = index < current
        const active = index === current
        return (
          <div key={item.id} style={{background: 'rgba(183, 201, 226, 0.18)', borderRadius: 99, flex: 1, height: 4, minWidth: 14, overflow: 'hidden'}}>
            <div
              style={{
                background: active ? TONE[item.tier.tone] : COLORS.steel,
                borderRadius: 99,
                height: '100%',
                opacity: done ? 0.55 : 1,
                width: done ? '100%' : active ? `${fill * 100}%` : '0%',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

const Callout = ({note, side}: {note: Note; side: 'left' | 'right'}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const seconds = frame / fps
  const p = interpolate(seconds, [note.at, note.at + 0.45, note.until - 0.35, note.until], [0, 1, 1, 0], {...clamp, easing: Easing.out(Easing.cubic)})
  if (p <= 0) return null
  const color = TONE[note.tone]
  return (
    <div
      style={{
        [side]: 64,
        alignItems: 'center',
        backdropFilter: 'blur(14px)',
        background: 'rgba(7, 17, 31, 0.9)',
        border: `1px solid ${color}66`,
        borderRadius: 16,
        boxShadow: `0 18px 50px rgba(0, 0, 0, 0.4), 0 0 0 4px ${color}14`,
        display: 'flex',
        gap: 16,
        maxWidth: 560,
        opacity: p,
        padding: '18px 26px 18px 20px',
        position: 'absolute',
        top: 150,
        transform: `translateX(${(1 - p) * (side === 'left' ? -24 : 24)}px)`,
      }}
    >
      <span style={{background: color, borderRadius: 99, boxShadow: `0 0 0 6px ${color}2e`, flexShrink: 0, height: 12, width: 12}} />
      <span style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 28, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.35}}>{note.text}</span>
    </div>
  )
}

export const RecordingScene = ({
  id,
  chapter,
  title,
  tier,
  highlight,
  speed,
  camera,
  notes,
  durationInFrames,
}: {
  id: string
  chapter: string
  title: string
  tier: {label: string; tone: Tone}
  highlight: boolean
  speed: number
  camera: CameraKey[]
  notes: Note[]
  durationInFrames: number
}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const clip = timeline.clips[id as keyof typeof timeline.clips] as {src: string; trimBeforeSeconds: number; spots?: Spot[]}
  const base = useCamera(camera)
  const seconds = frame / fps
  const spots = (clip.spots ?? []).map((spot) => ({...spot, at: spot.at / speed, until: spot.until / speed}))
  const focus = spotFocus(spots, seconds)
  const focusCamera = focus ? spotCamera(focus.box) : null
  const pull = focus ? Easing.inOut(Easing.cubic)(focus.strength) : 0
  const zoom = focusCamera ? base.zoom + (focusCamera.zoom - base.zoom) * pull : base.zoom
  const x = focusCamera ? base.x + (focusCamera.x - base.x) * pull : base.x
  const y = focusCamera ? base.y + (focusCamera.y - base.y) * pull : base.y
  const activeNote = notes.find((note) => seconds >= note.at && seconds < note.until)
  const noteSide = activeNote && interpolate(activeNote.at, camera.map((key) => key.at), camera.map((key) => key.x), clamp) > 0.62 ? 'left' : 'right'
  const enter = spring({fps, frame, config: {damping: 200}, durationInFrames: 22})
  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], clamp)
  const chapterIn = interpolate(frame, [8, 22, 105, 120], [0, 1, 1, 0], clamp)
  const chapterX = interpolate(frame, [8, 26], [-16, 0], {...clamp, easing: Easing.out(Easing.cubic)})

  const windowH = CONTENT_H + CHROME_H
  const tx = (0.5 - x) * CONTENT_W * (zoom - 1)
  const ty = (0.5 - (y * CONTENT_H + CHROME_H) / windowH) * windowH * (zoom - 1)

  return (
    <Canvas>
      <AbsoluteFill style={{opacity: exit}}>
        <div
          style={{
            borderRadius: 14,
            boxShadow: '0 40px 120px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(214, 226, 242, 0.14)',
            height: windowH,
            left: (1920 - CONTENT_W) / 2,
            overflow: 'hidden',
            position: 'absolute',
            top: 40,
            transform: `translate(${tx}px, ${ty + (1 - enter) * 26}px) scale(${zoom * (0.985 + enter * 0.015)})`,
            transformOrigin: '50% 50%',
            width: CONTENT_W,
            opacity: enter,
          }}
        >
          <div
            style={{
              alignItems: 'center',
              background: '#e6ecf5',
              borderBottom: '1px solid #d5ddea',
              display: 'flex',
              gap: 8,
              height: CHROME_H,
              padding: '0 14px',
            }}
          >
            {['#d9dfe9', '#d9dfe9', '#d9dfe9'].map((color, index) => (
              <span key={index} style={{background: color, borderRadius: 99, height: 11, width: 11}} />
            ))}
            <div style={{display: 'flex', flex: 1, justifyContent: 'center'}}>
              <div
                style={{
                  alignItems: 'center',
                  background: '#f5f8fc',
                  borderRadius: 7,
                  color: COLORS.muted,
                  display: 'flex',
                  fontFamily: FONTS.sans,
                  fontSize: 13,
                  gap: 8,
                  height: 22,
                  padding: '0 14px',
                }}
              >
                <Mark size={13} inverse />
                Vaultline 个人银行 · 智能助理
              </div>
            </div>
            <span style={{width: 49}} />
          </div>
          <Video
            src={staticFile(clip.src)}
            trimBefore={Math.round(clip.trimBeforeSeconds * fps)}
            playbackRate={speed}
            muted
            style={{display: 'block', height: CONTENT_H, width: CONTENT_W}}
          />
          {focus && <Spotlight box={focus.box} tone={focus.tone} strength={focus.strength} />}
        </div>

        <div
          style={{
            alignItems: 'stretch',
            background: 'rgba(7, 17, 31, 0.88)',
            borderRadius: 22,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            left: 64,
            opacity: chapterIn,
            padding: '12px 24px 14px 14px',
            position: 'absolute',
            top: 64,
            transform: `translateX(${chapterX}px)`,
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
            {Number(chapter)}
          </span>
          <span style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 26, fontWeight: 700, letterSpacing: '0.02em'}}>{title}</span>
          <span
            style={{
              alignItems: 'center',
              border: `1px solid ${TONE[tier.tone]}`,
              borderRadius: 999,
              color: TONE[tier.tone],
              display: 'flex',
              fontFamily: FONTS.sans,
              fontSize: 17,
              fontWeight: 700,
              gap: 8,
              letterSpacing: '0.04em',
              padding: '4px 12px',
            }}
          >
            <span style={{background: TONE[tier.tone], borderRadius: 99, height: 8, width: 8}} />
            {tier.label}
          </span>
          {highlight && (
            <span
              style={{
                background: COLORS.cobalt,
                borderRadius: 999,
                color: COLORS.white,
                fontFamily: FONTS.sans,
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: '0.1em',
                padding: '5px 12px',
              }}
            >
              核心亮点
            </span>
          )}
          </div>
          <ChapterRail chapter={chapter} />
        </div>

        {activeNote && noteSide && <Callout key={activeNote.text} note={activeNote} side={noteSide} />}
        <Subtitles id={id} />
      </AbsoluteFill>
    </Canvas>
  )
}
