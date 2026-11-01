import narration from './narration-timing.json'

export type CameraKey = {at: number; zoom: number; x: number; y: number}

export type FilmScene =
  | {id: string; kind: 'intro' | 'problem' | 'agent' | 'principles' | 'outro'; minSeconds: number; subtitles: boolean}
  | {
      id: string
      kind: 'recording'
      chapter: string
      title: string
      minSeconds: number
      subtitles: true
      camera: CameraKey[]
    }

export const NARRATION_DELAY = 0.5
const TAIL = 2.6

export const SCENES: FilmScene[] = [
  {id: 'intro', kind: 'intro', minSeconds: 12, subtitles: false},
  {id: 'problem', kind: 'problem', minSeconds: 17, subtitles: true},
  {
    id: 'overview',
    kind: 'recording',
    chapter: '01',
    title: '一句话开始',
    minSeconds: 16,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1, x: 0.5, y: 0.5},
      {at: 3, zoom: 1.16, x: 0.58, y: 0.42},
      {at: 11, zoom: 1.2, x: 0.58, y: 0.66},
      {at: 16, zoom: 1.05, x: 0.55, y: 0.6},
    ],
  },
  {
    id: 'transactions',
    kind: 'recording',
    chapter: '02',
    title: '看清每一笔',
    minSeconds: 21,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.08, x: 0.56, y: 0.75},
      {at: 3.5, zoom: 1.24, x: 0.58, y: 0.4},
      {at: 9, zoom: 1.24, x: 0.58, y: 0.55},
      {at: 14, zoom: 1.28, x: 0.58, y: 0.52},
      {at: 21, zoom: 1.28, x: 0.58, y: 0.5},
    ],
  },
  {id: 'agent', kind: 'agent', minSeconds: 17, subtitles: true},
  {
    id: 'services',
    kind: 'recording',
    chapter: '03',
    title: '理财 · 卡片 · 订阅',
    minSeconds: 19,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.1, x: 0.58, y: 0.7},
      {at: 3, zoom: 1.22, x: 0.58, y: 0.56},
      {at: 19, zoom: 1.24, x: 0.58, y: 0.58},
    ],
  },
  {
    id: 'liquidity',
    kind: 'recording',
    chapter: '04',
    title: '看清未来 30 天',
    minSeconds: 18,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.04, x: 0.6, y: 0.6},
      {at: 2.6, zoom: 1.34, x: 0.79, y: 0.34},
      {at: 9, zoom: 1.36, x: 0.79, y: 0.5},
      {at: 18, zoom: 1.36, x: 0.79, y: 0.56},
    ],
  },
  {
    id: 'plan',
    kind: 'recording',
    chapter: '05',
    title: '一步一步来',
    minSeconds: 17,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.32, x: 0.79, y: 0.6},
      {at: 2.4, zoom: 1.32, x: 0.79, y: 0.62},
      {at: 4, zoom: 1.12, x: 0.5, y: 0.45},
      {at: 7, zoom: 1.3, x: 0.48, y: 0.36},
      {at: 17, zoom: 1.32, x: 0.5, y: 0.34},
    ],
  },
  {
    id: 'transfer-confirm',
    kind: 'recording',
    chapter: '06',
    title: '确认后才执行',
    minSeconds: 21,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.08, x: 0.55, y: 0.75},
      {at: 4.5, zoom: 1.08, x: 0.55, y: 0.7},
      {at: 6.5, zoom: 1.4, x: 0.82, y: 0.42},
      {at: 13, zoom: 1.4, x: 0.82, y: 0.62},
      {at: 21, zoom: 1.36, x: 0.82, y: 0.48},
    ],
  },
  {
    id: 'transfer-mfa',
    kind: 'recording',
    chapter: '07',
    title: '高风险，再验证',
    minSeconds: 17,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.08, x: 0.55, y: 0.75},
      {at: 4.2, zoom: 1.08, x: 0.55, y: 0.7},
      {at: 6, zoom: 1.4, x: 0.82, y: 0.45},
      {at: 10, zoom: 1.42, x: 0.82, y: 0.68},
      {at: 17, zoom: 1.38, x: 0.82, y: 0.5},
    ],
  },
  {
    id: 'security',
    kind: 'recording',
    chapter: '08',
    title: '越权指令，直接拦截',
    minSeconds: 14,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.1, x: 0.56, y: 0.78},
      {at: 5.5, zoom: 1.12, x: 0.56, y: 0.6},
      {at: 8, zoom: 1.55, x: 0.56, y: 0.16},
      {at: 14, zoom: 1.58, x: 0.55, y: 0.17},
    ],
  },
  {
    id: 'audit',
    kind: 'recording',
    chapter: '09',
    title: '每一笔都有记录',
    minSeconds: 14,
    subtitles: true,
    camera: [
      {at: 0, zoom: 1.12, x: 0.62, y: 0.5},
      {at: 2, zoom: 1.12, x: 0.4, y: 0.45},
      {at: 4, zoom: 1.42, x: 0.32, y: 0.42},
      {at: 14, zoom: 1.44, x: 0.32, y: 0.44},
    ],
  },
  {id: 'principles', kind: 'principles', minSeconds: 13, subtitles: false},
  {id: 'outro', kind: 'outro', minSeconds: 10, subtitles: false},
]

export type NarrationEntry = {duration: number; sentences: {text: string; start: number; end: number}[]}
export const NARRATION = narration as Record<string, NarrationEntry>

export function sceneSeconds(scene: FilmScene) {
  const spoken = NARRATION[scene.id]?.duration ?? 0
  return Math.max(scene.minSeconds, NARRATION_DELAY + spoken + TAIL)
}

export const FILM_SECONDS = SCENES.reduce((total, scene) => total + sceneSeconds(scene), 0)
