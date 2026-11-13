import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "nodemailer", "pdf-lib", "mammoth", "xlsx"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

