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
  /** Marks the brief's required capabilities apart from the extra highlights. */
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

export type FilmScene = (Base & {kind: 'intro' | 'tiers' | 'mechanisms' | 'passport' | 'coverage' | 'outro'}) | RecordingSpec

type Clip = {src: string; trimBeforeSeconds: number; seconds: number; spots: unknown[]; cues: Record<string, number>}
export const CLIPS = timeline.clips as unknown as Record<string, Clip>
export const EVIDENCE = (timeline as unknown as {evidence: Record<string, Record<string, unknown>>}).evidence

export type NarrationEntry = {duration: number; sentences: {text: string; start: number; end: number}[]}
export const NARRATION = narration as Record<string, NarrationEntry>

function snapshotNote() {
  const hash = (EVIDENCE.yellow?.snapshotHash as string | undefined) ?? ''
  return hash ? `快照 SHA-256 ${hash.slice(0, 12)}… 收款人与金额已锁定` : '收款人 · 金额 · 备注写入不可变快照'
}

const LEAD_IN = 0.5
const BEAT_GAP = 0.3
const TAIL = 1.4

const CORE = '核心要求'
const EXTRA = '附加亮点'

const TIER = {
  rules: {label: '服务端规则', tone: 'cobalt'},
  green: {label: '绿色 · 自动执行', tone: 'green'},
  yellow: {label: '黄色 · 用户确认', tone: 'amber'},
  red: {label: '红色 · 动作绑定 MFA', tone: 'red'},
  guard: {label: '安全异常', tone: 'red'},
  audit: {label: '只读 · 审计', tone: 'green'},
  forecast: {label: '只读 · 推演', tone: 'cobalt'},
  plan: {label: '分步授权', tone: 'amber'},
  coverage: {label: '六类场景', tone: 'cobalt'},
  server: {label: '服务端证据', tone: 'green'},
} as const satisfies Record<string, {label: string; tone: Tone}>

const tiers = (tier: Chapter['tier']): Chapter => ({number: '01', title: '权限分级', tier, highlight: CORE})
const security = (title: string, tier: Chapter['tier']): Chapter => ({number: '02', title, tier, highlight: CORE})
const planning = (tier: Chapter['tier']): Chapter => ({number: '04', title: '复杂任务 DAG', tier, highlight: CORE})

export const SCENES: FilmScene[] = [
  {id: 'intro', kind: 'intro', minSeconds: 11, beats: [{id: 'intro', offset: 2.4}]},
  {id: 'tiers', kind: 'tiers', chapter: tiers(TIER.rules), minSeconds: 15, beats: [{id: 'tiers', offset: 0.6}]},
  {
    id: 'green',
    kind: 'recording',
    clip: 'green',
    chapter: tiers(TIER.green),
    minSeconds: 7,
    beats: [{id: 'green-1', offset: 0.4}],
    notes: [{cue: 'result', offset: 0.3, seconds: 4.4, text: '绿色查询：无需确认，直接返回服务端数据', tone: 'green'}],
  },
  {
    id: 'yellow',
    kind: 'recording',
    clip: 'yellow',
    speed: 1.1,
    chapter: tiers(TIER.yellow),
    minSeconds: 18,
    beats: [{id: 'yellow-1'}, {id: 'yellow-2', cue: 'snapshot'}, {id: 'yellow-3', cue: 'receipt', offset: -1.2}, {id: 'yellow-4', cue: 'replay'}],
    notes: [{cue: 'snapshot', offset: 0.4, seconds: 4.4, text: snapshotNote(), tone: 'amber'}],
    evidence: 'replay',
  },
  {
    id: 'red',
    kind: 'recording',
    clip: 'red',
    speed: 1.15,
    chapter: tiers(TIER.red),
    minSeconds: 16,
    beats: [{id: 'red-1'}, {id: 'red-2', cue: 'wrong', offset: 0.6}, {id: 'red-3', cue: 'locked'}],
    notes: [{cue: 'wrong', offset: 1.2, seconds: 5, text: '失败次数与锁定状态由服务端管理', tone: 'red'}],
  },
  {
    id: 'injection',
    kind: 'recording',
    clip: 'injection',
    speed: 1.15,
    chapter: security('注入防御', TIER.guard),
    minSeconds: 15,
    beats: [{id: 'injection-1'}, {id: 'injection-2', cue: 'injection'}, {id: 'injection-3', cue: 'balance'}],
    notes: [{cue: 'injection', offset: 0.4, seconds: 4.2, text: '高置信注入：拒绝，且不创建任何动作', tone: 'red'}],
  },
  {
    id: 'breaker',
    kind: 'recording',
    clip: 'breaker',
    speed: 1.1,
    chapter: security('异常熔断', TIER.guard),
    minSeconds: 10,
    beats: [{id: 'breaker-1'}, {id: 'breaker-2', cue: 'locked', offset: -1.5}],
    notes: [{cue: 'locked', offset: 0.3, seconds: 5, text: '10 分钟内 6 次异常 → 写操作锁定 15 分钟', tone: 'red'}],
  },
  {
    id: 'audit',
    kind: 'recording',
    clip: 'audit',
    chapter: security('操作审计', TIER.audit),
    minSeconds: 12,
    beats: [{id: 'audit-1'}, {id: 'audit-2', cue: 'timeline'}],
    camera: [{at: 0, zoom: 1.04, x: 0.45, y: 0.4}],
  },
  {id: 'mechanisms', kind: 'mechanisms', chapter: security('安全机制', TIER.server), minSeconds: 11, beats: [{id: 'mechanisms', offset: 0.5}]},
  {
    id: 'twin',
    kind: 'recording',
    clip: 'twin',
    chapter: {number: '03', title: '交易前资金推演', tier: TIER.forecast, highlight: EXTRA},
    minSeconds: 24,
    beats: [{id: 'twin-1'}, {id: 'twin-2', cue: 'drawer'}, {id: 'twin-3', cue: 'chart'}, {id: 'twin-4', cue: 'alternatives'}],
    camera: [{at: 0, zoom: 1.04, x: 0.6, y: 0.5}],
    notes: [{cue: 'chart', offset: 1.2, seconds: 5, text: '收入延迟情景单独推演，不假设工资一定到账', tone: 'red'}],
  },
  {
    id: 'dag-create',
    kind: 'recording',
    clip: 'dag-create',
    chapter: planning(TIER.plan),
    minSeconds: 14,
    beats: [{id: 'dag-1'}, {id: 'dag-2', cue: 'dag', offset: -2}],
  },
  {
    id: 'dag-run',
    kind: 'recording',
    clip: 'dag-run',
    speed: 1.2,
    chapter: planning(TIER.plan),
    minSeconds: 34,
    beats: [{id: 'dag-3', cue: 'reminder', offset: -0.6}, {id: 'dag-4', cue: 'budget'}, {id: 'dag-5', cue: 'flowers'}, {id: 'dag-6', cue: 'cake'}],
    notes: [
      {cue: 'budget-ok', offset: 0.2, seconds: 3.6, text: '预算锁定：现金流预检 + 动作绑定 MFA + 银行回执', tone: 'red'},
      {cue: 'cancel', offset: 0.4, seconds: 5.4, text: '中途取消：待执行动作作废，已执行节点保留回执', tone: 'amber'},
    ],
  },
  {
    id: 'coverage',
    kind: 'coverage',
    chapter: {number: '05', title: '同一条边界，六类场景', tier: TIER.coverage},
    minSeconds: 28,
    beats: [{id: 'coverage', offset: 0.6}],
  },
  {
    id: 'passport',
    kind: 'passport',
    chapter: {number: '06', title: '可信执行凭证', tier: TIER.server, highlight: EXTRA},
    minSeconds: 20,
    beats: [{id: 'passport', offset: 0.6}],
  },
  {id: 'outro', kind: 'outro', minSeconds: 10, beats: [{id: 'outro', offset: 1.0}]},
]

/** One entry per chapter number, in film order; several scenes may share a chapter. */
export const CHAPTERS = SCENES.flatMap((scene) => (scene.chapter ? [{id: scene.id, ...scene.chapter}] : [])).filter(
  (chapter, index, all) => all.findIndex((other) => other.number === chapter.number) === index,
)

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
