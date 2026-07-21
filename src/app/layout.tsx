import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth-context";
import { NavProgress } from "@/components/nav-progress";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "우리마을 — 마을 공동체 플랫폼",
  description:
    "카카오톡처럼 쓰는 마을 공동체 디지털 플랫폼. 부녀회·청년회·노인회·동호회의 채팅·사진·행사가 실시간으로 마을 홈페이지에 모이고, AI가 자동으로 마을 아카이브를 만듭니다.",
  keywords: [
    "마을 공동체",
    "부녀회",
    "청년회",
    "노인회",
    "마을 홈페이지",
    "빈집",
    "제보",
    "AI 마을 신문",
  ],
  authors: [{ name: "우리마을" }],
  openGraph: {
    title: "우리마을 — 마을 공동체 플랫폼",
    description: "카카오톡처럼 쓰는 마을 공동체 디지털 플랫폼",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FEE500" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a17" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* 모든 화면 전환에 즉시 반응을 주는 전역 표시기 */}
          <Suspense fallback={null}>
            <NavProgress />
          </Suspense>
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster />
          <SonnerToaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
