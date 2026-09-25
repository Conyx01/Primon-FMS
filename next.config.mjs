/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the Neon WebSocket driver out of the Next bundle so `ws` stays a
  // Node builtin/external and DATABASE_URL is read in the real Node process.
  experimental: {
    serverComponentsExternalPackages: [
      "ws",
      "@neondatabase/serverless",
      "@prisma/adapter-neon",
    ],
  },
  async rewrites() {
    return [{ source: "/fcc/:certificateId", destination: "/verify/:certificateId" }];
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
