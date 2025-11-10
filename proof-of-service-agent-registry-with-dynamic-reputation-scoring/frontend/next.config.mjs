/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ipfs.io"
      },
      {
        protocol: "https",
        hostname: "gateway.pinata.cloud"
      }
    ]
  }
};

export default nextConfig;


