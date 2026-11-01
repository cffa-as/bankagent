import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion'
import {NARRATION, NARRATION_DELAY} from '../scenes'
import {COLORS, FONTS} from '../theme'
import {clamp} from './brand'

type Cue = {text: string; start: number; end: number}

const MAX_CHARS = 22

function splitLong(sentence: Cue): Cue[] {
  const clean = sentence.text.replace(/[。；]$/, '')
  if (clean.length <= MAX_CHARS) return [{...sentence, text: clean}]
  const clauses = clean.split(/(?<=[，：；？！])/)
  const chunks: string[] = []
  let current = ''
  for (const clause of clauses) {
    if (current && (current + clause).length > MAX_CHARS) {
      chunks.push(current)
      current = clause
    } else {
      current += clause
    }
  }
  if (current) chunks.push(current)
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  let cursor = sentence.start
  return chunks.map((chunk) => {
    const length = ((sentence.end - sentence.start) * chunk.length) / total
    const cue = {text: chunk.replace(/[，：；]$/, ''), start: cursor, end: cursor + length}
    cursor += length
    return cue
  })
}

export function cuesFor(id: string): Cue[] {
  return (NARRATION[id]?.sentences ?? []).flatMap(splitLong)
}

export const Subtitles = ({id}: {id: string}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const seconds = frame / fps - NARRATION_DELAY
  const cue = cuesFor(id).find((item) => seconds >= item.start - 0.05 && seconds < item.end + 0.15)
  if (!cue) return null
  const local = seconds - cue.start
  const opacity = interpolate(local, [-0.05, 0.12], [0, 1], clamp) * interpolate(seconds, [cue.end, cue.end + 0.15], [1, 0], clamp)

  return (
    <div style={{bottom: 30, display: 'flex', justifyContent: 'center', left: 0, position: 'absolute', right: 0}}>
      <div
        style={{
          background: 'rgba(4, 10, 20, 0.78)',
          borderRadius: 12,
          color: COLORS.white,
          fontFamily: FONTS.sans,
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: '0.02em',
          lineHeight: 1.4,
          opacity,
          padding: '10px 26px 12px',
        }}
      >
        {cue.text}
      </div>
    </div>
  )
}
