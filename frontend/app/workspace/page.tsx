import type { Metadata, Viewport } from 'next'
import { WorkspaceShell } from '@/components/workspace/workspace-shell'

export const metadata: Metadata = {
  title: '工作台 · Vaultline',
  description: 'Vaultline 智能银行助理工作台：用一句话办理银行业务，资金操作均需你亲自确认。',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f3f5f8',
}

export default function WorkspacePage() {
  return <WorkspaceShell />
}
