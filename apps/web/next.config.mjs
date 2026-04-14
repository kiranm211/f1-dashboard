/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/v1/:path*",
        destination: "http://127.0.0.1:4000/v1/:path*"
      },
      {
        source: "/health",
        destination: "http://127.0.0.1:4000/health"
      }
    ];
  }
};

export default nextConfig;