import { SiteHeader } from '@/components/vaultline/site-header'
import { Hero } from '@/components/vaultline/hero'
import { ControlledPath } from '@/components/vaultline/controlled-path'
import { LiquiditySection } from '@/components/vaultline/liquidity-section'
import { Principles } from '@/components/vaultline/principles'
import { DemoSection } from '@/components/vaultline/demo-section'
import { SiteFooter } from '@/components/vaultline/site-footer'

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <ControlledPath />
        <LiquiditySection />
        <Principles />
        <DemoSection />
      </main>
      <SiteFooter />
    </>
  )
}
