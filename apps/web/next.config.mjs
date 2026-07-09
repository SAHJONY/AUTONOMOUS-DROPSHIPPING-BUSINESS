import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Monorepo lives two levels up; pin the trace root to this repo.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
