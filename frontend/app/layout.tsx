import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Instrument_Sans, JetBrains_Mono, Noto_Sans_SC, Noto_Serif_SC } from 'next/font/google'
import './globals.css'

const jetbrainsMono = JetBrains_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

const instrumentSans = Instrument_Sans({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
})

const notoSans = Noto_Sans_SC({
  weight: ['400', '500', '600', '700'],
  variable: '--font-noto-sans',
  display: 'swap',
  preload: false,
})

const notoSerif = Noto_Serif_SC({
  weight: ['500', '600', '700'],
  variable: '--font-noto-serif',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: 'Vaultline · 银行智能工作台',
  description:
    'Vaultline 智能银行助理：一句话查询余额、分析账单、转账汇款与规划现金流。每一笔资金操作都需要你亲自确认。',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f7f9fc',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${notoSans.variable} ${notoSerif.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} bg-background`}
    >
      <body className="antialiased">
        {children}
        {process.env.VERCEL === '1' && <Analytics />}
      </body>
    </html>
  )
}
