import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [{ source: '/backend/:path*', destination: `${process.env.BANKAGENT_API_PROXY_TARGET ?? 'http://localhost:8080'}/:path*` }]
  },
}

export default nextConfig
