import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return [
      { source: "/operations/purchase-filled-cylinder", destination: "/purchases/filled-cylinder", permanent: true },
      { source: "/operations/purchase-filled-cylinder/:path*", destination: "/purchases/filled-cylinder/:path*", permanent: true },
      { source: "/sale-purchase/purchase-empty-cylinder", destination: "/purchases/empty-cylinder", permanent: true },
      { source: "/sale-purchase/purchase-empty-cylinder/:path*", destination: "/purchases/empty-cylinder/:path*", permanent: true },
      { source: "/sale-purchase/purchase-other", destination: "/purchases/other", permanent: true },
      { source: "/sale-purchase/purchase-other/:path*", destination: "/purchases/other/:path*", permanent: true },
      { source: "/returns/purchase-return-cylinder", destination: "/purchases/return-cylinder", permanent: true },
      { source: "/returns/purchase-return-cylinder/:path*", destination: "/purchases/return-cylinder/:path*", permanent: true },
      { source: "/returns/purchase-return-other", destination: "/purchases/return-other", permanent: true },
      { source: "/returns/purchase-return-other/:path*", destination: "/purchases/return-other/:path*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
