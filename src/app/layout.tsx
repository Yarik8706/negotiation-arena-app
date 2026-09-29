import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

export const metadata: Metadata = {
  title: "Переговорный штаб · Arena",
  description: "Симулятор переговоров с ИИ-оппонентом и внутренним советником",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        <header className="site-header sticky top-0 z-20 border-b border-[var(--card-border)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="brand-link shrink-0 font-semibold tracking-tight">
              <span className="brand-mark" aria-hidden="true">⌂</span>
              <span>Арена переговоров</span>
            </Link>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <nav className="site-nav flex min-w-0 flex-wrap justify-end gap-x-3 gap-y-1 text-sm text-[var(--muted)]" aria-label="Основная навигация">
              <Link href="/" className="transition hover:text-white" aria-label="Сценарии">
                <span className="hidden sm:inline">Сценарии</span><span className="sm:hidden">Играть</span>
              </Link>
              <Link href="/learn" className="transition hover:text-white">Теория</Link>
              <Link href="/group" className="transition hover:text-white"><span className="hidden sm:inline">Вместе</span><span className="sm:hidden">2×2</span></Link>
              <Link href="/progress" className="transition hover:text-white"><span className="hidden sm:inline">Прогресс</span><span className="sm:hidden">Я</span></Link>
              <Link href="/diagnostic" className="transition hover:text-white"><span className="hidden sm:inline">Диагностика</span><span className="sm:hidden">Старт</span></Link>
              <Link href="/admin" className="transition hover:text-white">
                <span className="hidden sm:inline">Конструктор</span><span className="sm:hidden">Админ</span>
              </Link>
            </nav>
            <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="page-main mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
