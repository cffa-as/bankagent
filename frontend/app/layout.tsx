import type { Metadata } from 'next'
import './globals.css'
import './liquidity-sandbox.css'

export const metadata: Metadata = {
  title: 'Vaultline — Secure banking intelligence',
  description: 'A secure banking agent where the server remains in control.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
