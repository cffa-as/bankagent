import type { Metadata, Viewport } from 'next'
import { WorkspaceShell } from '@/components/workspace/workspace-shell'

export const metadata: Metadata = {
  title: '工作台 · Vaultline',
  description: 'Vaultline 中文银行智能工作台：助理准备候选动作，风险、授权、MFA、执行与回执由银行服务端决定。',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f3f5f8',
}

export default function WorkspacePage() {
  return <WorkspaceShell />
}
