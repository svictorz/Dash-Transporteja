/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',

  // Compressão gzip/br no servidor Node (em Vercel já é tratado, mas inofensivo).
  compress: true,

  // Remove o header "x-powered-by: Next.js" — dica de stack pra atacantes.
  poweredByHeader: false,

  // Tree-shake automático de barrel imports. Cada nome importado de
  // lucide-react / framer-motion vira um import direto do arquivo
  // específico, eliminando código morto. Ganho típico em mobile.
  // https://nextjs.org/docs/app/api-reference/next-config-js/optimizePackageImports
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },

  images: {
    // Formatos modernos. Next serve AVIF/WebP automaticamente quando o
    // navegador aceitar, com fallback pra JPEG/PNG.
    formats: ['image/avif', 'image/webp'],

    // Permite next/image em URLs do Supabase Storage (fotos de check-in,
    // documentos de fretes, etc.). Permissivo no host porque o domínio
    // depende do projeto Supabase configurado via env.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
}

module.exports = nextConfig
