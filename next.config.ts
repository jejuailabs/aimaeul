import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin", "jose", "jwks-rsa"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    // Firebase 인증 핸들러를 앱과 같은 출처에서 제공한다.
    // 이게 없으면 authDomain을 앱 도메인으로 바꿨을 때 핸들러를 찾지 못한다.
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    if (!authDomain) return []
    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${authDomain}/__/auth/:path*`,
      },
    ]
  },
};

export default nextConfig;
