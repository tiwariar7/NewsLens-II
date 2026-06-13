// next.config.mjs
/** @type {import('next').NextConfig} */

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // Allows all https domains
      },
      {
        protocol: "http", // Also allow http, just in case some sources are old
        hostname: "**",
      },
    ],
  },
};
export default nextConfig;