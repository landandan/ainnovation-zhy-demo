/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
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
      destination: 'http://192.168.11.95:6039/:path*',//'http://192.168.10.66:6039/:path*',//'http://localhost:5000/api/:path*',
    },
    {
      source: '/v1/:path*',
      destination: 'http://192.168.10.66:6039/v1/:path*',//'http://192.168.10.66:6039/v1/:path*',//'http://localhost/v1/:path*',
    },
  ]
}

export default nextConfig
