import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-provider";
import { AppProvider } from "@/lib/app-context";
import { AuthGate } from "./components/auth-gate";
import { PageViewTracker } from "./components/page-view-tracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "三国冰河时代 · 盟战功勋统计",
  description: "上传截图自动识别，盟战功勋排名工具",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--bg)] text-[var(--ink)]">
        <AuthProvider>
          <AppProvider>
            <AuthGate>
              <PageViewTracker />
              {children}
            </AuthGate>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
