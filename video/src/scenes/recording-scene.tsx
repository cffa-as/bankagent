import {Video} from '@remotion/media'
import {AbsoluteFill, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion'
import {Canvas, Mark, clamp} from '../components/brand'
import {Subtitles} from '../components/subtitles'
import type {CameraKey} from '../film-plan'
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

export const RecordingScene = ({
  id,
  chapter,
  title,
  camera,
  durationInFrames,
}: {
  id: string
  chapter: string
  title: string
  camera: CameraKey[]
  durationInFrames: number
}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const clip = timeline.clips[id as keyof typeof timeline.clips]
  const {zoom, x, y} = useCamera(camera)
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
        </div>

        <Subtitles id={id} />
      </AbsoluteFill>
    </Canvas>
  )
}
