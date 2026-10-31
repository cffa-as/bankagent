import { existsSync } from 'node:fs'
import path from 'node:path'
import { DemoVideoPlayer } from './demo-video-player'

const VIDEO_PATH = '/demo/vaultline-preview.mp4'
const POSTER_PATH = '/demo/vaultline-preview-poster.png'

function publicFileExists(publicPath: string) {
  return existsSync(path.join(process.cwd(), 'public', publicPath))
}

export function DemoVideo() {
  return (
    <figure id="demo" aria-label="Vaultline 演示视频" className="scroll-mt-24 overflow-hidden rounded-xl border border-border">
      <DemoVideoPlayer
        src={publicFileExists(VIDEO_PATH) ? VIDEO_PATH : null}
        poster={publicFileExists(POSTER_PATH) ? POSTER_PATH : null}
        showSetupHint={process.env.NODE_ENV !== 'production'}
      />
    </figure>
  )
}
