import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["farm.server.trysalesense.online"],
};

export default nextConfig;
