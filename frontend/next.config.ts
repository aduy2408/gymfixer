import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const webRoot = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(webRoot, "..", ".env") });

const nextConfig: NextConfig = {
  turbopack: {
    root: webRoot,
  },
};

export default nextConfig;
