import {Video} from '@remotion/media'
import {AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion'
import {Canvas, Mark, clamp} from '../components/brand'
import {ChapterChip, DemoDisclosure, TONE} from '../components/chapter'
import {Subtitles} from '../components/subtitles'
import {CLIPS, EVIDENCE, cueSeconds, placeBeats, placeNotes, type CameraKey, type Note, type RecordingSpec, type Tone} from '../film-plan'
import {COLORS, FONTS} from '../theme'

const CONTENT_W = 1536
const CONTENT_H = 864
const CHROME_H = 34
const DEFAULT_CAMERA: CameraKey[] = [{at: 0, zoom: 1.04, x: 0.5, y: 0.5}]

function useCamera(keys: CameraKey[]) {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const seconds = frame / fps
  if (keys.length === 1) return keys[0]
  const ease = {...clamp, easing: Easing.inOut(Easing.cubic)}
  const times = keys.map((key) => key.at)
  return {
    zoom: interpolate(seconds, times, keys.map((key) => key.zoom), ease),
    x: interpolate(seconds, times, keys.map((key) => key.x), ease),
    y: interpolate(seconds, times, keys.map((key) => key.y), ease),
  }
}

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
function spotFocus(spots: Spot[], seconds: number): {box: Box; tone: Tone; strength: number} | null {
  for (let i = 0; i < spots.length; i++) {
    const spot = spots[i]
    const previous = spots[i - 1]
    const next = spots[i + 1]
    const bridgedIn = previous !== undefined && spot.at - previous.until < BRIDGE_GAP
    const bridgedOut = next !== undefined && next.at - spot.until < BRIDGE_GAP
    if (seconds >= spot.at - (bridgedIn ? 0 : 0.01) && seconds <= spot.until) {
      const fadeIn = bridgedIn ? 1 : interpolate(seconds, [spot.at, spot.at + FADE_IN], [0, 1], clamp)
      const fadeOut = bridgedOut ? 1 : interpolate(seconds, [spot.until - FADE_OUT, spot.until], [1, 0], clamp)
      return {box: spot, tone: spot.tone, strength: Math.min(fadeIn, fadeOut)}
    }
    if (bridgedOut && next && seconds > spot.until && seconds < next.at) {
      const p = interpolate(seconds, [spot.until, next.at], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)})
      return {box: lerpBox(spot, next, p), tone: p < 0.5 ? spot.tone : next.tone, strength: 1}
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
  return (
    <div
      style={{
        border: `2px solid ${color}`,
        borderRadius: 12,
        boxShadow: `0 0 0 4000px rgba(7, 17, 31, ${0.5 * strength}), 0 0 0 6px ${color}2e, 0 0 48px ${color}66`,
        height: box.h,
        left: box.x,
        opacity: strength,
        pointerEvents: 'none',
        position: 'absolute',
        top: CHROME_H + box.y,
        transform: `scale(${interpolate(strength, [0, 1], [1.035, 1], clamp)})`,
        width: box.w,
      }}
    />
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
        background: 'rgba(7, 17, 31, 0.92)',
        border: `1px solid ${color}66`,
        borderRadius: 16,
        boxShadow: `0 18px 50px rgba(0, 0, 0, 0.4), 0 0 0 4px ${color}14`,
        display: 'flex',
        gap: 16,
        maxWidth: 780,
        opacity: p,
        padding: '18px 26px 18px 20px',
        position: 'absolute',
        top: 170,
        transform: `translateX(${(1 - p) * (side === 'left' ? -24 : 24)}px)`,
      }}
    >
      <span style={{background: color, borderRadius: 99, boxShadow: `0 0 0 6px ${color}2e`, flexShrink: 0, height: 12, width: 12}} />
      <span style={{color: COLORS.white, fontFamily: FONTS.sans, fontSize: 28, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.35}}>{note.text}</span>
    </div>
  )
}

type Replay = {replay: {method: string; path: string; status: number; code: string | null; message: string | null}}

/** Shows the response the recorder got when it re-sent the same confirmation during the take. */
const ReplayEvidence = ({at}: {at: number}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const evidence = EVIDENCE.yellow as unknown as Replay | undefined
  if (!evidence) return null
  const seconds = frame / fps
  const p = interpolate(seconds, [at, at + 0.5], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)})
  const code = interpolate(seconds, [at + 1.1, at + 1.5], [0, 1], clamp)
  if (p <= 0) return null
  const mono = {fontFamily: FONTS.mono, fontVariantNumeric: 'tabular-nums' as const}
  return (
    <div
      style={{
        background: 'rgba(7, 17, 31, 0.95)',
        border: `1px solid ${COLORS.red}66`,
        borderRadius: 18,
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        left: 64,
        opacity: p,
        padding: '24px 28px',
        position: 'absolute',
        top: 190,
        transform: `translateY(${(1 - p) * 18}px)`,
        width: 640,
      }}
    >
      <div style={{color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 18, fontWeight: 700, letterSpacing: '0.14em'}}>重放同一确认请求</div>
      <div style={{...mono, color: COLORS.platinum, fontSize: 21, lineHeight: 1.5, wordBreak: 'break-all'}}>
        {evidence.replay.method} {evidence.replay.path}
      </div>
      <div style={{alignItems: 'baseline', display: 'flex', gap: 16, opacity: code}}>
        <span style={{...mono, color: COLORS.red, fontSize: 44, fontWeight: 800}}>{evidence.replay.status}</span>
        <span style={{...mono, color: COLORS.white, fontSize: 26, fontWeight: 700}}>{evidence.replay.code}</span>
      </div>
      <div style={{color: COLORS.platinum, fontFamily: FONTS.sans, fontSize: 22, fontWeight: 600, opacity: code}}>{evidence.replay.message} · 未产生第二次副作用</div>
      <div style={{borderTop: `1px solid ${COLORS.line}`, color: COLORS.steel, fontFamily: FONTS.sans, fontSize: 16, paddingTop: 12}}>
        录制时由 Playwright 实际发出，以上为服务端原始响应
      </div>
    </div>
  )
}

export const RecordingScene = ({spec, durationInFrames}: {spec: RecordingSpec; durationInFrames: number}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const clip = CLIPS[spec.clip]
  const speed = spec.speed ?? 1
  const camera = spec.camera ?? DEFAULT_CAMERA
  const base = useCamera(camera)
  const seconds = frame / fps
  const spots = ((clip.spots ?? []) as Spot[]).map((spot) => ({...spot, at: spot.at / speed, until: spot.until / speed}))
  const focus = spotFocus(spots, seconds)
  const focusCamera = focus ? spotCamera(focus.box) : null
  const pull = focus ? Easing.inOut(Easing.cubic)(focus.strength) : 0
  const zoom = focusCamera ? base.zoom + (focusCamera.zoom - base.zoom) * pull : base.zoom
  const x = focusCamera ? base.x + (focusCamera.x - base.x) * pull : base.x
  const y = focusCamera ? base.y + (focusCamera.y - base.y) * pull : base.y
  const notes = placeNotes(spec)
  const activeNote = notes.find((note) => seconds >= note.at && seconds < note.until)
  const noteSide = x > 0.58 ? 'left' : 'right'
  const enter = spring({fps, frame, config: {damping: 200}, durationInFrames: 22})
  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], clamp)

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
            opacity: enter,
            overflow: 'hidden',
            position: 'absolute',
            top: 40,
            transform: `translate(${tx}px, ${ty + (1 - enter) * 26}px) scale(${zoom * (0.985 + enter * 0.015)})`,
            transformOrigin: '50% 50%',
            width: CONTENT_W,
          }}
        >
          <div style={{alignItems: 'center', background: '#e6ecf5', borderBottom: '1px solid #d5ddea', display: 'flex', gap: 8, height: CHROME_H, padding: '0 14px'}}>
            {[0, 1, 2].map((index) => (
              <span key={index} style={{background: '#d9dfe9', borderRadius: 99, height: 11, width: 11}} />
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
                VAULTLINE · 安全银行工作台
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

        {spec.chapter && <ChapterChip chapter={spec.chapter} />}
        {activeNote && <Callout key={activeNote.text} note={activeNote} side={noteSide} />}
        {spec.evidence === 'replay' && <ReplayEvidence at={cueSeconds(spec, 'replay')} />}
        <DemoDisclosure />
        <Subtitles beats={placeBeats(spec)} />
      </AbsoluteFill>
    </Canvas>
  )
}
