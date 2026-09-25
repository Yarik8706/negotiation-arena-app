import type { Metadata } from "next";
import { WorkspaceNav } from "@/components/WorkspaceNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Штаб Переговоров",
  description: "Симулятор переговоров с ИИ-оппонентом и внутренним советником",
  icons: { icon: "/brand-mark.png", apple: "/brand-mark.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <header className="site-header sticky top-0 z-20 border-b">
          <WorkspaceNav />
        </header>
        <div className="workspace-shell">
          <main className="page-main mx-auto max-w-6xl px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
