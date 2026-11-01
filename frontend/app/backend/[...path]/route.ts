import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Context = { params: Promise<{ path: string[] }> }

const HOP_BY_HOP = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

async function proxy(request: Request, context: Context) {
  const target = (process.env.BANKAGENT_API_PROXY_TARGET ?? 'http://localhost:8080').replace(/\/+$/, '')
  const authToken = process.env.BANKAGENT_AUTH_TOKEN?.trim() || 'demo-user-1'
  const { path } = await context.params
  const source = new URL(request.url)
  const destination = new URL(`${target}/${path.map(encodeURIComponent).join('/')}${source.search}`)

  const headers = new Headers()
  for (const [name, value] of request.headers) {
    if (!HOP_BY_HOP.has(name.toLowerCase()) && name.toLowerCase() !== 'authorization') {
      headers.set(name, value)
    }
  }
  headers.set('Authorization', `Bearer ${authToken}`)

  try {
    const upstream = await fetch(destination, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      cache: 'no-store',
      redirect: 'manual',
      signal: request.signal,
      ...(request.method === 'GET' || request.method === 'HEAD' ? {} : { duplex: 'half' }),
    } as RequestInit & { duplex?: 'half' })

    const responseHeaders = new Headers()
    for (const [name, value] of upstream.headers) {
      if (!HOP_BY_HOP.has(name.toLowerCase())) responseHeaders.set(name, value)
    }
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch {
    return NextResponse.json(
      { error: { code: 'SERVICE_UNAVAILABLE', message: '银行服务暂时不可用' }, trace_id: 'tr_proxy' },
      { status: 503 },
    )
  }
}

export {
  proxy as GET,
  proxy as HEAD,
  proxy as POST,
  proxy as PATCH,
  proxy as PUT,
  proxy as DELETE,
  proxy as OPTIONS,
}
