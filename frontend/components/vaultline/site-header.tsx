import Link from 'next/link'
import { VaultlineLockup } from './seal'

const LINKS = [
  { href: '#path', label: '受控路径' },
  { href: '#liquidity', label: '流动性预检' },
  { href: '#principles', label: '安全原则' },
  { href: '#demo', label: '演示视频' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:text-foreground"
      >
        跳到主要内容
      </a>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 md:px-8">
        <Link href="/" aria-label="Vaultline 首页" className="rounded-md">
          <VaultlineLockup descriptor="银行智能" />
        </Link>
        <nav aria-label="主导航" className="flex items-center gap-1">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:inline-block"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/workspace"
            className="ml-2 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-cobalt-ink"
          >
            进入工作台
          </Link>
        </nav>
      </div>
    </header>
  )
}
