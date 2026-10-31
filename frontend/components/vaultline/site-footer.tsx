import Link from 'next/link'
import { VaultlineLockup } from './seal'

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#07111f] text-rail-foreground">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
        <VaultlineLockup tone="reverse" descriptor="银行智能" />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-rail-muted">
          <Link href="/workspace" className="transition-colors hover:text-rail-foreground">
            进入工作台
          </Link>
          <span>© 2026 Vaultline</span>
        </div>
      </div>
    </footer>
  )
}
