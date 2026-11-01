import Link from 'next/link'
import { VaultlineLockup } from './seal'

const LINKS = [
  { href: '#features', label: '能办什么' },
  { href: '#security', label: '安全保障' },
  { href: '#faq', label: '常见问题' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy text-rail-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:text-foreground"
      >
        跳到主要内容
      </a>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5 md:px-8">
        <Link href="/" aria-label="Vaultline 首页" className="rounded-md">
          <VaultlineLockup tone="reverse" descriptor="个人银行" />
        </Link>
        <nav aria-label="主导航" className="flex items-center gap-1">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hidden rounded-md px-3 py-2 text-sm text-rail-muted transition-colors hover:text-rail-foreground md:inline-block"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/workspace"
            className="ml-2 inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-medium text-navy transition-colors hover:bg-ice"
          >
            打开智能助理
          </Link>
        </nav>
      </div>
    </header>
  )
}
