'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'
import { VaultlineSeal } from './seal'

type DemoVideoPlayerProps = {
  src: string | null
  poster: string | null
  showSetupHint: boolean
}

export function DemoVideoPlayer({ src, poster, showSetupHint }: DemoVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [started, setStarted] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-5 bg-card px-6 text-center">
        <VaultlineSeal className="size-12" />
        <div className="flex flex-col gap-2">
          <p className="text-xl font-semibold md:text-2xl">演示视频即将上线</p>
          <p className="text-sm leading-relaxed text-muted-foreground">在此之前，可以直接进入工作台体验完整流程。</p>
        </div>
        <Link
          href="/workspace"
          className="inline-flex h-10 items-center rounded-md border border-border bg-background px-4 text-sm font-medium transition-colors hover:border-line-strong"
        >
          进入工作台
        </Link>
        {showSetupHint && (
          <p className="font-mono text-xs text-muted-foreground">
            {failed ? '视频文件无法播放 · ' : ''}放置 public/demo/vaultline-preview.mp4 后自动启用
          </p>
        )}
      </div>
    )
  }

  function play() {
    const video = videoRef.current
    if (!video) return
    setStarted(true)
    void video.play()
  }

  return (
    <div className="relative aspect-video w-full bg-navy">
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        controls={started}
        playsInline
        preload="metadata"
        onPlay={() => setStarted(true)}
        onError={() => setFailed(true)}
        className="size-full object-contain"
      >
        你的浏览器不支持视频播放。
      </video>
      {!started && (
        <button
          type="button"
          onClick={play}
          className="group absolute inset-0 flex items-center justify-center bg-navy/40 transition-colors hover:bg-navy/25 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-card"
        >
          <span className="flex items-center gap-4 rounded-full bg-card py-3 pr-6 pl-3 text-foreground shadow-lg transition-transform group-hover:scale-105">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Play className="size-5 translate-x-0.5 fill-current" aria-hidden="true" />
            </span>
            <span className="text-base font-semibold">播放演示视频</span>
          </span>
        </button>
      )}
    </div>
  )
}
