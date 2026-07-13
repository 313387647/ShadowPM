import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShadowPM - AI Native Project Management Platform",
  description: "上传表格，生成可编辑项目管控表、资金账本、执行日历和可追溯项目活动。",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="font-sans">
      <body className="antialiased min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
