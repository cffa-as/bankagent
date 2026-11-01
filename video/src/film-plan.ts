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
const TAIL = 2.4

const TIER = {
  green: {label: '自动 · 只读', tone: 'green'},
  confirm: {label: '需确认', tone: 'amber'},
  mfa: {label: '需 MFA', tone: 'red'},
  plan: {label: '资金计划', tone: 'cobalt'},
  control: {label: '运行控制', tone: 'cobalt'},
  security: {label: '安全异常', tone: 'red'},
} as const satisfies Record<string, {label: string; tone: Tone}>

const PANEL = 0.83
const CHAT = 0.57

export const SCENES: FilmScene[] = [
  {id: 'intro', kind: 'intro', minSeconds: 10, subtitles: false},
  {id: 'problem', kind: 'problem', minSeconds: 14, subtitles: true},
  {
    id: 'overview',
    kind: 'recording',
    chapter: '01',
    title: '主动发现异常',
    tier: TIER.green,
    minSeconds: 24,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1, x: 0.5, y: 0.5},
      {at: 2.2, zoom: 1.12, x: CHAT, y: 0.62},
      {at: 6, zoom: 1.18, x: CHAT, y: 0.5},
    ],
    notes: [],
  },
  {id: 'agent', kind: 'agent', minSeconds: 16, subtitles: true},
  {
    id: 'transfer-confirm',
    kind: 'recording',
    chapter: '02',
    title: '确认后才执行',
    tier: TIER.confirm,
    minSeconds: 17,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 4.2, zoom: 1.08, x: 0.55, y: 0.7},
      {at: 6.2, zoom: 1.38, x: PANEL, y: 0.42},
      {at: 12, zoom: 1.38, x: PANEL, y: 0.62},
      {at: 18, zoom: 1.34, x: PANEL, y: 0.5},
    ],
    notes: [
      {at: 6.5, until: 11.5, text: '收款人 · 金额 · 备注已锁定为动作快照', tone: 'amber'},
      {at: 12, until: 17, text: '确认由服务端裁决，重复点击只执行一次', tone: 'amber'},
    ],
  },
  {
    id: 'transfer-mfa',
    kind: 'recording',
    chapter: '03',
    title: '高风险，再验证',
    tier: TIER.mfa,
    minSeconds: 14,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 4, zoom: 1.08, x: 0.55, y: 0.7},
      {at: 5.8, zoom: 1.38, x: PANEL, y: 0.45},
      {at: 9.5, zoom: 1.4, x: PANEL, y: 0.68},
      {at: 15, zoom: 1.36, x: PANEL, y: 0.5},
    ],
    notes: [{at: 6, until: 12.5, text: '验证码与这笔业务绑定，仅本笔有效', tone: 'red'}],
  },
  {
    id: 'scheduled',
    kind: 'recording',
    chapter: '04',
    title: '预约转账',
    tier: TIER.confirm,
    minSeconds: 15,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 4, zoom: 1.08, x: 0.55, y: 0.7},
      {at: 5.8, zoom: 1.36, x: PANEL, y: 0.42},
      {at: 10, zoom: 1.38, x: PANEL, y: 0.6},
      {at: 16, zoom: 1.36, x: PANEL, y: 0.62},
    ],
    notes: [{at: 6, until: 13, text: '预约时间写入动作快照，执行前可随时取消', tone: 'amber'}],
  },
  {
    id: 'aa',
    kind: 'recording',
    chapter: '05',
    title: 'AA 收款',
    tier: TIER.confirm,
    minSeconds: 13,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 4.6, zoom: 1.08, x: 0.55, y: 0.66},
      {at: 6.2, zoom: 1.34, x: PANEL, y: 0.45},
      {at: 13, zoom: 1.36, x: PANEL, y: 0.55},
    ],
    notes: [{at: 6.5, until: 11.5, text: '¥1,200 ÷ 4 人，每人待收 ¥300', tone: 'amber'}],
  },
  {
    id: 'invest',
    kind: 'recording',
    chapter: '06',
    title: '理财申购与赎回',
    tier: TIER.mfa,
    minSeconds: 17,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.08, x: 0.55, y: 0.75},
      {at: 3, zoom: 1.2, x: CHAT, y: 0.45},
      {at: 7.5, zoom: 1.12, x: 0.62, y: 0.6},
      {at: 10, zoom: 1.32, x: PANEL, y: 0.55},
      {at: 17, zoom: 1.34, x: PANEL, y: 0.5},
    ],
    notes: [
      {at: 3.5, until: 8, text: '业绩比较基准不代表收益承诺', tone: 'green'},
      {at: 10.5, until: 16, text: '申购、赎回均需 MFA，结果以账本回执为准', tone: 'red'},
    ],
  },
  {
    id: 'card',
    kind: 'recording',
    chapter: '07',
    title: '卡片挂失',
    tier: TIER.mfa,
    minSeconds: 14,
    subtitles: true,
    speed: 1.35,
    camera: [
      {at: 0, zoom: 1.08, x: 0.55, y: 0.75},
      {at: 3, zoom: 1.2, x: CHAT, y: 0.4},
      {at: 7, zoom: 1.1, x: 0.6, y: 0.6},
      {at: 9, zoom: 1.36, x: PANEL, y: 0.55},
      {at: 15, zoom: 1.36, x: PANEL, y: 0.5},
    ],
    notes: [{at: 9.5, until: 14, text: '挂失属于高风险操作，强制安全验证', tone: 'red'}],
  },
  {
    id: 'subscription',
    kind: 'recording',
    chapter: '08',
    title: '订阅取消',
    tier: TIER.confirm,
    minSeconds: 12,
    subtitles: true,
    speed: 1.35,
    camera: [
      {at: 0, zoom: 1.08, x: 0.55, y: 0.75},
      {at: 3, zoom: 1.22, x: CHAT, y: 0.35},
      {at: 7, zoom: 1.16, x: 0.62, y: 0.6},
      {at: 9, zoom: 1.32, x: PANEL, y: 0.45},
      {at: 13, zoom: 1.34, x: PANEL, y: 0.45},
    ],
    notes: [{at: 3.5, until: 8, text: '续费前提醒，扣款日期提前可见', tone: 'green'}],
  },
  {
    id: 'birthday-create',
    kind: 'recording',
    chapter: '09',
    title: '生日资金计划',
    tier: TIER.plan,
    minSeconds: 18,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 4.5, zoom: 1.18, x: CHAT, y: 0.4},
      {at: 8, zoom: 1.06, x: 0.55, y: 0.45},
      {at: 10, zoom: 1.24, x: 0.5, y: 0.5},
      {at: 18, zoom: 1.26, x: 0.52, y: 0.52},
    ],
    notes: [
      {at: 9.5, until: 14, text: '提醒 → 锁定预算 → 鲜花 / 蛋糕', tone: 'cobalt'},
      {at: 14, until: 18, text: '创建计划不会动用任何资金', tone: 'cobalt'},
    ],
  },
  {
    id: 'birthday-run',
    kind: 'recording',
    chapter: '10',
    title: '计划逐步执行',
    tier: TIER.plan,
    minSeconds: 28,
    subtitles: true,
    speed: 1.4,
    camera: [
      {at: 0, zoom: 1.1, x: 0.5, y: 0.45},
      {at: 4, zoom: 1.04, x: 0.52, y: 0.5},
      {at: 12, zoom: 1.08, x: 0.6, y: 0.5},
      {at: 23, zoom: 1.08, x: 0.58, y: 0.5},
      {at: 28, zoom: 1.2, x: 0.46, y: 0.56},
    ],
    notes: [
      {at: 3, until: 9, text: '跨场景联动：锁定前先做现金流推演', tone: 'cobalt'},
      {at: 13, until: 21, text: '每个节点独立授权，各有回执', tone: 'cobalt'},
      {at: 23.5, until: 27.5, text: '四个节点全部完成，计划结束', tone: 'green'},
    ],
  },
  {
    id: 'control',
    kind: 'recording',
    chapter: '11',
    title: '停止 · 转人工 · 撤销',
    tier: TIER.control,
    minSeconds: 15,
    subtitles: true,
    speed: 1.35,
    camera: [
      {at: 0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 2.6, zoom: 1.36, x: 0.6, y: 0.22},
      {at: 7, zoom: 1.2, x: 0.56, y: 0.45},
      {at: 11, zoom: 1.24, x: CHAT, y: 0.6},
      {at: 16, zoom: 1.26, x: CHAT, y: 0.62},
    ],
    notes: [
      {at: 3, until: 8, text: '转人工后，原有动作不再推进', tone: 'cobalt'},
      {at: 11, until: 15.5, text: '撤销成功：账户未发生变化', tone: 'green'},
    ],
  },
  {
    id: 'security',
    kind: 'recording',
    chapter: '12',
    title: '安全异常',
    tier: TIER.security,
    minSeconds: 16,
    subtitles: true,
    speed: 1.35,
    camera: [
      {at: 0, zoom: 1.08, x: 0.55, y: 0.78},
      {at: 4.5, zoom: 1.36, x: PANEL, y: 0.66},
      {at: 9, zoom: 1.12, x: 0.56, y: 0.7},
      {at: 13, zoom: 1.4, x: CHAT, y: 0.3},
      {at: 17, zoom: 1.42, x: CHAT, y: 0.3},
    ],
    notes: [
      {at: 5, until: 9.5, text: '验证失败：业务不执行，尝试次数受限', tone: 'red'},
      {at: 13, until: 17, text: '提示注入：权限不随一句话改变', tone: 'red'},
    ],
  },
  {
    id: 'audit',
    kind: 'recording',
    chapter: '13',
    title: '全程留痕',
    tier: TIER.green,
    minSeconds: 12,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.12, x: 0.62, y: 0.5},
      {at: 2, zoom: 1.12, x: 0.4, y: 0.45},
      {at: 4, zoom: 1.4, x: 0.32, y: 0.42},
      {at: 12, zoom: 1.42, x: 0.32, y: 0.44},
    ],
    notes: [{at: 4, until: 10.5, text: '发起 · 确认 · 验证 · 回执，一条链路可追溯', tone: 'green'}],
  },
  {id: 'coverage', kind: 'coverage', minSeconds: 9, subtitles: false},
  {id: 'principles', kind: 'principles', minSeconds: 11, subtitles: false},
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
