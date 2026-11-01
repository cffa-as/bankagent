import { SiteHeader } from '@/components/vaultline/site-header'
import { Hero } from '@/components/vaultline/hero'
import { Features } from '@/components/vaultline/features'
import { Security } from '@/components/vaultline/security'
import { Faq } from '@/components/vaultline/faq'
import { SiteFooter } from '@/components/vaultline/site-footer'

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Features />
        <Security />
        <Faq />
      </main>
      <SiteFooter />
    </>
  )
}
