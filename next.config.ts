import type { NextConfig } from "next";

const isStaticExport = process.env.BUILD_STATIC_EXPORT === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : "standalone",
  images: isStaticExport ? { unoptimized: true } : undefined,
  basePath,
  trailingSlash: isStaticExport,
};

if (!isStaticExport) {
  const upstream = "https://um-flood-edge-01.taila3d0cf.ts.net";
  const channel = ":channel(channel_0|channel_1)";
  nextConfig.rewrites = async () => [
    {
      source: `/um-stream/${channel}/index.m3u8`,
      destination: `${upstream}/:channel/index.m3u8?cookieCheck=1`,
    },
    {
      source: `/um-stream/${channel}/:file([a-zA-Z0-9_.-]+)`,
      destination: `${upstream}/:channel/:file`,
    },
  ];
}

export default nextConfig;
