import {continueRender, delayRender, staticFile} from 'remotion'

export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080

export const COLORS = {
  navy: '#07111f',
  navySoft: '#0b182a',
  panel: '#101e31',
  white: '#f6f8fc',
  ice: '#eef3fb',
  platinum: '#dce4ef',
  steel: '#8594aa',
  ink: '#0b1423',
  muted: '#586377',
  cobalt: '#315bff',
  teal: '#25b394',
  amber: '#d7a04a',
  red: '#d15b52',
  line: 'rgba(183, 201, 226, 0.18)',
} as const

export const FONTS = {
  sans: '"VL Latin", "VL Sans", "Noto Sans CJK SC", "PingFang SC", sans-serif',
  mono: '"VL Latin", "VL Sans", monospace',
} as const

const FACES: [family: string, file: string, weight: string][] = [
  ['VL Sans', 'NotoSansSC-500.woff', '400 600'],
  ['VL Sans', 'NotoSansSC-700.woff', '700 800'],
  ['VL Sans', 'NotoSansSC-900.woff', '900'],
  ['VL Latin', 'Inter-var.woff', '100 900'],
]

if (typeof document !== 'undefined') {
  const handle = delayRender('Loading film fonts')
  Promise.all(
    FACES.map(([family, file, weight]) =>
      new FontFace(family, `url(${staticFile(`fonts/${file}`)})`, {weight}).load().then((face) => {
        ;(document.fonts as unknown as Set<FontFace>).add(face)
      }),
    ),
  )
    .catch((error) => console.error('Font loading failed', error))
    .finally(() => continueRender(handle))
}
