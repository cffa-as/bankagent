import Link from 'next/link'
import { VaultlineLockup } from './seal'

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-navy text-rail-foreground">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-5 py-12 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <VaultlineLockup tone="reverse" descriptor="安全银行工作台" />
          <nav aria-label="页脚导航" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-rail-muted">
            <a href="#features" className="transition-colors hover:text-rail-foreground">
              能办什么
            </a>
            <a href="#security" className="transition-colors hover:text-rail-foreground">
              安全保障
            </a>
            <a href="#faq" className="transition-colors hover:text-rail-foreground">
              常见问题
            </a>
            <Link href="/workspace" className="transition-colors hover:text-rail-foreground">
              智能助理
            </Link>
          </nav>
        </div>
        <div className="flex flex-col gap-2 border-t border-white/10 pt-6 text-[12.5px] leading-relaxed text-rail-muted md:flex-row md:justify-between">
          <p>当前为预览环境，页面中的账户、交易与金额均为模拟数据。</p>
          <p>© 2026 Vaultline</p>
        </div>
      </div>
    </footer>
  )
}
