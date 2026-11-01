import narration from './narration-timing.json'

export type CameraKey = {at: number; zoom: number; x: number; y: number}
export type Tone = 'green' | 'amber' | 'red' | 'cobalt'
export type Note = {at: number; until: number; text: string; tone: Tone}

type RecordingScene = {
  id: string
  kind: 'recording'
  chapter: string
  title: string
  tier: {label: string; tone: Tone}
  /** Signature capability, badged as a highlight in the chapter card. */
  highlight?: true
  minSeconds: number
  subtitles: true
  /** Playback rate for long real-time captures, so every step fits the narration. */
  speed?: number
  camera: CameraKey[]
  notes: Note[]
}

export type FilmScene =
  | {id: string; kind: 'intro' | 'problem' | 'agent' | 'coverage' | 'principles' | 'outro'; minSeconds: number; subtitles: boolean}
  | RecordingScene

export const NARRATION_DELAY = 0.5
const TAIL = 2

const TIER = {
  green: {label: '自动 · 只读', tone: 'green'},
  forecast: {label: '只读 · 推演', tone: 'cobalt'},
  confirm: {label: '需确认', tone: 'amber'},
  mfa: {label: '需 MFA', tone: 'red'},
  plan: {label: '资金计划', tone: 'cobalt'},
  control: {label: '运行控制', tone: 'cobalt'},
  security: {label: '安全异常', tone: 'red'},
} as const satisfies Record<string, {label: string; tone: Tone}>

const PANEL = 0.83
const CHAT = 0.57

export const SCENES: FilmScene[] = [
  {id: 'intro', kind: 'intro', minSeconds: 8, subtitles: false},
  {id: 'problem', kind: 'problem', minSeconds: 14, subtitles: true},
  {
    id: 'overview',
    kind: 'recording',
    chapter: '01',
    title: '主动发现异常',
    tier: TIER.green,
    highlight: true,
    minSeconds: 24,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1, x: 0.5, y: 0.5},
      {at: 2.2, zoom: 1.12, x: CHAT, y: 0.62},
      {at: 6, zoom: 1.18, x: CHAT, y: 0.5},
    ],
    notes: [],
  },
  {
    id: 'cashflow',
    kind: 'recording',
    chapter: '02',
    title: '现金流推演',
    tier: TIER.forecast,
    highlight: true,
    minSeconds: 20,
    subtitles: true,
    speed: 1.15,
    camera: [
      {at: 0, zoom: 1.08, x: 0.55, y: 0.72},
      {at: 3.5, zoom: 1.08, x: 0.55, y: 0.62},
      {at: 5.6, zoom: 1.3, x: 0.79, y: 0.45},
      {at: 21, zoom: 1.3, x: 0.79, y: 0.55},
    ],
    notes: [
      {at: 7.6, until: 12.4, text: '四种情景推演 30 天余额，标出最低点', tone: 'cobalt'},
      {at: 16.8, until: 21, text: '只生成方案，不会立即动用资金', tone: 'green'},
    ],
  },
  {id: 'agent', kind: 'agent', minSeconds: 15, subtitles: true},
  {
    id: 'transfer-confirm',
    kind: 'recording',
    chapter: '03',
    title: '确认后才执行',
    tier: TIER.confirm,
    minSeconds: 14,
    subtitles: true,
    speed: 1.15,
    camera: [
      {at: 0.0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 3.7, zoom: 1.08, x: 0.55, y: 0.7},
      {at: 5.4, zoom: 1.38, x: PANEL, y: 0.42},
      {at: 10.4, zoom: 1.38, x: PANEL, y: 0.62},
      {at: 15.7, zoom: 1.34, x: PANEL, y: 0.5},
    ],
    notes: [
      {at: 5.7, until: 10.0, text: '收款人 · 金额 · 备注锁定为业务快照', tone: 'amber'},
      {at: 10.4, until: 14.8, text: '服务端裁决确认，重复点击只执行一次', tone: 'amber'},
    ],
  },
  {
    id: 'transfer-mfa',
    kind: 'recording',
    chapter: '04',
    title: '高风险，再验证',
    tier: TIER.mfa,
    minSeconds: 13,
    subtitles: true,
    speed: 1.2,
    camera: [
      {at: 0.0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 3.3, zoom: 1.08, x: 0.55, y: 0.7},
      {at: 4.8, zoom: 1.38, x: PANEL, y: 0.45},
      {at: 7.9, zoom: 1.4, x: PANEL, y: 0.68},
      {at: 12.5, zoom: 1.36, x: PANEL, y: 0.5},
    ],
    notes: [{at: 5.0, until: 10.4, text: '验证码与本笔业务绑定，一次有效', tone: 'red'}],
  },
  {
    id: 'scheduled',
    kind: 'recording',
    chapter: '05',
    title: '预约转账',
    tier: TIER.confirm,
    minSeconds: 13.5,
    subtitles: true,
    speed: 1.2,
    camera: [
      {at: 0.0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 3.3, zoom: 1.08, x: 0.55, y: 0.7},
      {at: 4.8, zoom: 1.36, x: PANEL, y: 0.42},
      {at: 8.3, zoom: 1.38, x: PANEL, y: 0.6},
      {at: 13.3, zoom: 1.36, x: PANEL, y: 0.62},
    ],
    notes: [{at: 5.0, until: 10.8, text: '执行日期写入快照，到期前可随时取消', tone: 'amber'}],
  },
  {
    id: 'aa',
    kind: 'recording',
    chapter: '06',
    title: 'AA 收款',
    tier: TIER.confirm,
    minSeconds: 12,
    subtitles: true,
    speed: 1.2,
    camera: [
      {at: 0.0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 3.8, zoom: 1.08, x: 0.55, y: 0.66},
      {at: 5.2, zoom: 1.34, x: PANEL, y: 0.45},
      {at: 10.8, zoom: 1.36, x: PANEL, y: 0.55},
    ],
    notes: [{at: 5.4, until: 9.6, text: '¥1,200 ÷ 4 人 = 每人 ¥300', tone: 'amber'}],
  },
  {
    id: 'invest',
    kind: 'recording',
    chapter: '07',
    title: '理财申购与赎回',
    tier: TIER.mfa,
    minSeconds: 15,
    subtitles: true,
    speed: 1.4,
    camera: [
      {at: 0.0, zoom: 1.08, x: 0.55, y: 0.75},
      {at: 2.1, zoom: 1.2, x: CHAT, y: 0.45},
      {at: 5.4, zoom: 1.12, x: 0.62, y: 0.6},
      {at: 7.1, zoom: 1.32, x: PANEL, y: 0.55},
      {at: 12.1, zoom: 1.34, x: PANEL, y: 0.5},
    ],
    notes: [
      {at: 2.5, until: 5.7, text: '业绩比较基准不代表收益承诺', tone: 'green'},
      {at: 7.5, until: 11.4, text: '申购 · 赎回均需 MFA，以服务端回执为准', tone: 'red'},
    ],
  },
  {
    id: 'card',
    kind: 'recording',
    chapter: '08',
    title: '卡片挂失',
    tier: TIER.mfa,
    minSeconds: 13,
    subtitles: true,
    speed: 1.4,
    camera: [
      {at: 0.0, zoom: 1.08, x: 0.55, y: 0.75},
      {at: 2.9, zoom: 1.2, x: CHAT, y: 0.4},
      {at: 6.8, zoom: 1.1, x: 0.6, y: 0.6},
      {at: 8.7, zoom: 1.36, x: PANEL, y: 0.55},
      {at: 14.5, zoom: 1.36, x: PANEL, y: 0.5},
    ],
    notes: [{at: 9.2, until: 13.5, text: '高风险操作，强制安全验证', tone: 'red'}],
  },
  {
    id: 'subscription',
    kind: 'recording',
    chapter: '09',
    title: '订阅取消',
    tier: TIER.confirm,
    minSeconds: 10,
    subtitles: true,
    speed: 1.5,
    camera: [
      {at: 0.0, zoom: 1.08, x: 0.55, y: 0.75},
      {at: 2.7, zoom: 1.22, x: CHAT, y: 0.35},
      {at: 6.3, zoom: 1.16, x: 0.62, y: 0.6},
      {at: 8.1, zoom: 1.32, x: PANEL, y: 0.45},
      {at: 11.7, zoom: 1.34, x: PANEL, y: 0.45},
    ],
    notes: [{at: 3.1, until: 7.2, text: '续费前提醒，扣款日期提前可见', tone: 'green'}],
  },
  {
    id: 'birthday-create',
    kind: 'recording',
    chapter: '10',
    title: '生日资金计划',
    tier: TIER.plan,
    highlight: true,
    minSeconds: 16,
    subtitles: true,
    camera: [
      {at: 0.0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 4.5, zoom: 1.18, x: CHAT, y: 0.4},
      {at: 8.0, zoom: 1.06, x: 0.55, y: 0.45},
      {at: 10.0, zoom: 1.24, x: 0.5, y: 0.5},
      {at: 18.0, zoom: 1.26, x: 0.52, y: 0.52},
    ],
    notes: [
      {at: 9.5, until: 14.0, text: '提醒 → 锁定预算 → 鲜花 / 蛋糕', tone: 'cobalt'},
      {at: 14.0, until: 18.0, text: '创建计划不会动用任何资金', tone: 'cobalt'},
    ],
  },
  {
    id: 'birthday-run',
    kind: 'recording',
    chapter: '11',
    title: '计划逐步执行',
    tier: TIER.plan,
    highlight: true,
    minSeconds: 24,
    subtitles: true,
    speed: 1.6,
    camera: [
      {at: 0, zoom: 1.1, x: 0.5, y: 0.45},
      {at: 4, zoom: 1.04, x: 0.52, y: 0.5},
      {at: 12, zoom: 1.08, x: 0.6, y: 0.5},
      {at: 23, zoom: 1.08, x: 0.58, y: 0.5},
      {at: 28, zoom: 1.2, x: 0.46, y: 0.56},
    ],
    notes: [
      {at: 3, until: 9, text: '跨场景联动：锁定前先推演现金流', tone: 'cobalt'},
      {at: 13, until: 21, text: '每个节点独立授权，各有服务端回执', tone: 'cobalt'},
      {at: 23.5, until: 27.5, text: '四个节点全部完成，计划结束', tone: 'green'},
    ],
  },
  {
    id: 'control',
    kind: 'recording',
    chapter: '12',
    title: '停止 · 转人工 · 撤销',
    tier: TIER.control,
    minSeconds: 13,
    subtitles: true,
    speed: 1.5,
    camera: [
      {at: 0.0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 2.3, zoom: 1.36, x: 0.6, y: 0.22},
      {at: 6.3, zoom: 1.2, x: 0.56, y: 0.45},
      {at: 9.9, zoom: 1.24, x: CHAT, y: 0.6},
      {at: 14.4, zoom: 1.26, x: CHAT, y: 0.62},
    ],
    notes: [
      {at: 2.7, until: 7.2, text: '转人工后，原有动作不再推进', tone: 'cobalt'},
      {at: 9.9, until: 14.0, text: '撤销成功：账户未发生变化', tone: 'green'},
    ],
  },
  {
    id: 'security',
    kind: 'recording',
    chapter: '13',
    title: '安全异常',
    tier: TIER.security,
    highlight: true,
    minSeconds: 14,
    subtitles: true,
    speed: 1.5,
    camera: [
      {at: 0.0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 4.0, zoom: 1.36, x: PANEL, y: 0.66},
      {at: 8.1, zoom: 1.12, x: 0.56, y: 0.7},
      {at: 11.7, zoom: 1.4, x: CHAT, y: 0.3},
      {at: 15.3, zoom: 1.42, x: CHAT, y: 0.3},
    ],
    notes: [
      {at: 4.5, until: 8.6, text: '验证失败：业务不执行，尝试次数受限', tone: 'red'},
      {at: 11.7, until: 15.3, text: '提示注入：权限不随一句话改变', tone: 'red'},
    ],
  },
  {
    id: 'audit',
    kind: 'recording',
    chapter: '14',
    title: '全程留痕',
    tier: TIER.green,
    minSeconds: 10,
    subtitles: true,
    camera: [
      {at: 0.0, zoom: 1.12, x: 0.62, y: 0.5},
      {at: 2.0, zoom: 1.12, x: 0.4, y: 0.45},
      {at: 4.0, zoom: 1.4, x: 0.32, y: 0.42},
      {at: 12.0, zoom: 1.42, x: 0.32, y: 0.44},
    ],
    notes: [{at: 4.0, until: 10.5, text: '发起 → 确认 → 验证 → 回执，全链路可追溯', tone: 'green'}],
  },
  {id: 'coverage', kind: 'coverage', minSeconds: 10, subtitles: false},
  {id: 'principles', kind: 'principles', minSeconds: 9, subtitles: false},
  {id: 'outro', kind: 'outro', minSeconds: 8, subtitles: false},
]

export const CHAPTERS = SCENES.filter((scene): scene is RecordingScene => scene.kind === 'recording')

export type NarrationEntry = {duration: number; sentences: {text: string; start: number; end: number}[]}
export const NARRATION = narration as Record<string, NarrationEntry>

export function sceneSeconds(scene: FilmScene) {
  const spoken = NARRATION[scene.id]?.duration ?? 0
  return Math.max(scene.minSeconds, NARRATION_DELAY + spoken + TAIL)
}

export const FILM_SECONDS = SCENES.reduce((total, scene) => total + sceneSeconds(scene), 0)
