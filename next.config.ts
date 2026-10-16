import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: '/tools/dictionary',
        destination: '/tools/translate',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
