/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const backendOrigin = process.env.BANKAGENT_API_PROXY_TARGET ?? 'http://localhost:8080'
    return [{ source: '/backend/:path*', destination: `${backendOrigin}/:path*` }]
  },
}

export default nextConfig
