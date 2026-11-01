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

const ChapterRail = ({chapter}: {chapter: string}) => {
  const frame = useCurrentFrame()
  const fill = interpolate(frame, [10, 34], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)})
  const current = Number(chapter)
  return (
    <div style={{display: 'flex', gap: 6, left: (1920 - CONTENT_W) / 2, position: 'absolute', top: 16, width: CONTENT_W}}>
      {CHAPTERS.map((item) => {
        const index = Number(item.chapter)
        const done = index < current
        const active = index === current
        return (
          <div key={item.id} style={{background: 'rgba(183, 201, 226, 0.14)', borderRadius: 99, flex: 1, height: 4, overflow: 'hidden'}}>
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
  camera,
  notes,
  durationInFrames,
}: {
  id: string
  chapter: string
  title: string
  tier: {label: string; tone: Tone}
  camera: CameraKey[]
  notes: Note[]
  durationInFrames: number
}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const clip = timeline.clips[id as keyof typeof timeline.clips]
  const {zoom, x, y} = useCamera(camera)
  const seconds = frame / fps
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
            muted
            style={{display: 'block', height: CONTENT_H, width: CONTENT_W}}
          />
        </div>

        <div
          style={{
            alignItems: 'center',
            background: 'rgba(7, 17, 31, 0.86)',
            borderRadius: 999,
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            gap: 14,
            left: 64,
            opacity: chapterIn,
            padding: '12px 24px 12px 14px',
            position: 'absolute',
            top: 64,
            transform: `translateX(${chapterX}px)`,
          }}
        >
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
        </div>

        {activeNote && noteSide && <Callout key={activeNote.text} note={activeNote} side={noteSide} />}
        <ChapterRail chapter={chapter} />
        <Subtitles id={id} />
      </AbsoluteFill>
    </Canvas>
  )
}
