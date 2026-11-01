import narration from './narration-timing.json'
import timeline from './timeline.json'

export type CameraKey = {at: number; zoom: number; x: number; y: number}
export type Tone = 'green' | 'amber' | 'red' | 'cobalt'

/** A narration clip that starts at a recorder cue (seconds after the clip mark), never overlapping the previous one. */
export type Beat = {id: string; cue?: string; offset?: number}
/** An on-screen caption timed against a recorder cue. */
export type NoteSpec = {cue?: string; offset?: number; seconds: number; text: string; tone: Tone}
export type Note = {at: number; until: number; text: string; tone: Tone}

export type Chapter = {
  number: string
  title: string
  tier: {label: string; tone: Tone}
  /** Which of the four signature capabilities this chapter proves. */
  highlight?: string
}

type Base = {id: string; minSeconds: number; beats: Beat[]; chapter?: Chapter}

export type RecordingSpec = Base & {
  kind: 'recording'
  clip: string
  speed?: number
  camera?: CameraKey[]
  notes?: NoteSpec[]
  evidence?: 'replay'
}

export type FilmScene = (Base & {kind: 'intro' | 'problem' | 'passport' | 'coverage' | 'outro'}) | RecordingSpec

type Clip = {src: string; trimBeforeSeconds: number; seconds: number; spots: unknown[]; cues: Record<string, number>}
export const CLIPS = timeline.clips as unknown as Record<string, Clip>
export const EVIDENCE = (timeline as unknown as {evidence: Record<string, Record<string, unknown>>}).evidence

export type NarrationEntry = {duration: number; sentences: {text: string; start: number; end: number}[]}
export const NARRATION = narration as Record<string, NarrationEntry>

const LEAD_IN = 0.5
const BEAT_GAP = 0.3
const TAIL = 1.6

const TIER = {
  forecast: {label: '只读 · 推演', tone: 'cobalt'},
  mfa: {label: '红色 · 动作绑定 MFA', tone: 'red'},
  security: {label: '安全异常', tone: 'red'},
  server: {label: '服务端证据', tone: 'green'},
  coverage: {label: '六类场景', tone: 'cobalt'},
  audit: {label: '只读 · 审计', tone: 'green'},
} as const satisfies Record<string, {label: string; tone: Tone}>

export const SCENES: FilmScene[] = [
  {id: 'intro', kind: 'intro', minSeconds: 12, beats: [{id: 'intro', offset: 5.2}]},
  {id: 'problem', kind: 'problem', minSeconds: 27, beats: [{id: 'problem'}]},
  {
    id: 'request',
    kind: 'recording',
    clip: 'request',
    chapter: {number: '01', title: '一个真实的资金问题', tier: TIER.forecast},
    minSeconds: 20,
    beats: [{id: 'request-1'}, {id: 'request-2', cue: 'trace'}],
    camera: [
      {at: 0, zoom: 1.1, x: 0.52, y: 0.82},
      {at: 4.2, zoom: 1.1, x: 0.52, y: 0.8},
      {at: 5.4, zoom: 1.02, x: 0.6, y: 0.5},
    ],
    notes: [{cue: 'trace', offset: 0.6, seconds: 6.5, text: '结论来自服务端现金流工具，不是模型自述', tone: 'cobalt'}],
  },
  {
    id: 'sandbox',
    kind: 'recording',
    clip: 'sandbox',
    chapter: {number: '02', title: '交易前资金推演', tier: TIER.forecast, highlight: '亮点 01'},
    minSeconds: 40,
    beats: [
      {id: 'sandbox-1'},
      {id: 'sandbox-2', cue: 'chart'},
      {id: 'sandbox-3', cue: 'events'},
      {id: 'sandbox-4', cue: 'alternatives'},
      {id: 'sandbox-5', cue: 'note'},
    ],
    camera: [{at: 0, zoom: 1.04, x: 0.7, y: 0.5}],
    notes: [
      {cue: 'chart', offset: 2.2, seconds: 5.6, text: '收入延迟情景单独推演，不假设工资一定到账', tone: 'red'},
      {cue: 'alternatives', offset: 0.6, seconds: 7.5, text: '降额 · 工资到账后再办 · 分两笔', tone: 'green'},
    ],
  },
  {
    id: 'execute',
    kind: 'recording',
    clip: 'execute',
    chapter: {number: '03', title: '服务端控制的可执行动作', tier: TIER.mfa, highlight: '亮点 02'},
    minSeconds: 44,
    beats: [
      {id: 'execute-1'},
      {id: 'execute-2', cue: 'plan'},
      {id: 'execute-3', cue: 'precheck'},
      {id: 'execute-4', cue: 'snapshot'},
      {id: 'execute-5', cue: 'receipt'},
      {id: 'execute-6', cue: 'replay'},
    ],
    camera: [{at: 0, zoom: 1.04, x: 0.6, y: 0.5}],
    notes: [
      {cue: 'plan', offset: 1.2, seconds: 4.6, text: '第二笔未到期，服务端不会提前执行', tone: 'cobalt'},
      {cue: 'snapshot', offset: 0.4, seconds: 4.2, text: '金额 · 用途 · 节点写入不可变快照', tone: 'amber'},
    ],
    evidence: 'replay',
  },
  {
    id: 'security',
    kind: 'recording',
    clip: 'security',
    chapter: {number: '04', title: '安全回放', tier: TIER.security},
    minSeconds: 34,
    beats: [
      {id: 'security-1'},
      {id: 'security-2', cue: 'typing'},
      {id: 'security-3', cue: 'injection'},
      {id: 'security-4', cue: 'balance'},
      {id: 'security-5', cue: 'mfa'},
      {id: 'security-6', cue: 'locked'},
    ],
    camera: [{at: 0, zoom: 1.04, x: 0.5, y: 0.6}],
    notes: [
      {cue: 'injection', offset: 0.4, seconds: 4.2, text: '高置信注入：拒绝，且不创建任何动作', tone: 'red'},
      {cue: 'mfa', offset: 0.6, seconds: 6.5, text: '失败次数与锁定状态由服务端管理', tone: 'red'},
    ],
  },
  {
    id: 'passport',
    kind: 'passport',
    chapter: {number: '05', title: '可信执行凭证', tier: TIER.server, highlight: '亮点 03'},
    minSeconds: 26,
    beats: [{id: 'passport', offset: 0.6}],
  },
  {
    id: 'coverage',
    kind: 'coverage',
    chapter: {number: '06', title: '同一条边界，六类场景', tier: TIER.coverage},
    minSeconds: 21,
    beats: [{id: 'coverage', offset: 0.4}],
  },
  {
    id: 'audit',
    kind: 'recording',
    clip: 'audit',
    chapter: {number: '07', title: '银行回执与审计链', tier: TIER.audit, highlight: '亮点 04'},
    minSeconds: 16,
    beats: [{id: 'audit-1'}, {id: 'audit-2', cue: 'timeline'}],
    camera: [{at: 0, zoom: 1.04, x: 0.45, y: 0.4}],
  },
  {id: 'outro', kind: 'outro', minSeconds: 11, beats: [{id: 'outro', offset: 1.4}]},
]

export const CHAPTERS = SCENES.flatMap((scene) => (scene.chapter ? [{id: scene.id, ...scene.chapter}] : []))

export type PlacedBeat = {id: string; start: number; end: number}

/** Beat start times in scene seconds, honouring cues and never overlapping. */
export function placeBeats(scene: FilmScene): PlacedBeat[] {
  const speed = scene.kind === 'recording' ? scene.speed ?? 1 : 1
  const cues = scene.kind === 'recording' ? CLIPS[scene.clip]?.cues ?? {} : {}
  const placed: PlacedBeat[] = []
  for (const beat of scene.beats) {
    const cueAt = beat.cue ? (cues[beat.cue] ?? 0) / speed : 0
    const earliest = placed.length ? placed[placed.length - 1].end + BEAT_GAP : 0
    const start = Math.max(LEAD_IN + cueAt + (beat.offset ?? 0), earliest)
    placed.push({id: beat.id, start, end: start + (NARRATION[beat.id]?.duration ?? 0)})
  }
  return placed
}

export function placeNotes(scene: RecordingSpec): Note[] {
  const speed = scene.speed ?? 1
  const cues = CLIPS[scene.clip]?.cues ?? {}
  return (scene.notes ?? []).map((note) => {
    const at = LEAD_IN + (note.cue ? (cues[note.cue] ?? 0) / speed : 0) + (note.offset ?? 0)
    return {at, until: at + note.seconds, text: note.text, tone: note.tone}
  })
}

export function cueSeconds(scene: RecordingSpec, cue: string) {
  return LEAD_IN + (CLIPS[scene.clip]?.cues?.[cue] ?? 0) / (scene.speed ?? 1)
}

export function sceneSeconds(scene: FilmScene) {
  const beats = placeBeats(scene)
  const spoken = beats.length ? beats[beats.length - 1].end + TAIL : 0
  const wanted = Math.max(scene.minSeconds, spoken)
  if (scene.kind !== 'recording') return wanted
  const available = (CLIPS[scene.clip]?.seconds ?? wanted) / (scene.speed ?? 1)
  return Math.min(wanted, available)
}

export const LEAD_IN_SECONDS = LEAD_IN
