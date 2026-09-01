/** @type {import('next').NextConfig} */
const devApiBaseUrl = process.env.NEXT_PUBLIC_DEV_API_BASE_URL || 'http://192.168.10.168:26039'

const nextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ['@file-viewer/pptx', '@file-viewer/doc'],
  allowedDevOrigins: ['192.168.*.*', 'localhost'],
  images: {
    unoptimized: true,
  },
}

// 开发模式下：前端 /api/* 请求直连本地 Flask 后端 :5000，不依赖 nginx
if (process.env.NODE_ENV !== 'production') {
  nextConfig.rewrites = async () => [
    {
      source: '/api/:path*',
      destination: `${devApiBaseUrl}/:path*`,
    },
    {
      source: '/v1/:path*',
      destination: `${devApiBaseUrl}/v1/:path*`,
    },
  ]
}

export default nextConfig
