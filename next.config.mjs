/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// Served from https://<user>.github.io/wireman-golf-league/ on GitHub Pages,
// so production builds need the repo name as the base path. Local `next dev`
// stays at the root.
const repoBasePath = "/wireman-golf-league";

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: isProd ? repoBasePath : "",
  assetPrefix: isProd ? repoBasePath : "",
};

export default nextConfig;
