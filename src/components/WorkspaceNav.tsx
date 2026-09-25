"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Icon } from "@/components/Icon";

const destinations = [
  { href: "/", label: "Сценарии", shortLabel: "Кейсы", icon: "compass" as const },
  { href: "/learn", label: "Теория", shortLabel: "Теория", icon: "book-half" as const },
  { href: "/group", label: "Вместе", shortLabel: "Вместе", icon: "people" as const },
  { href: "/progress", label: "Прогресс", shortLabel: "Прогресс", icon: "bar-chart-line" as const },
  { href: "/diagnostic", label: "Диагностика", shortLabel: "Старт", icon: "stars" as const },
  { href: "/admin", label: "Конструктор", shortLabel: "Конструктор", icon: "sliders" as const },
];

function DestinationLinks() {
  const pathname = usePathname();
  return destinations.map(({ href, label, shortLabel, icon }) => {
    const active = href === "/" ? pathname === "/" || pathname === "/play" : pathname === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={active ? "is-active" : undefined}
      >
        <Icon name={icon} size={15} className="nav-icon" />
        <span className="nav-full-label">{label}</span>
        <span className="nav-short-label">{shortLabel}</span>
      </Link>
    );
  });
}

export function WorkspaceNav() {
  return (
    <div className="header-inner mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
      <Link href="/" className="brand-link shrink-0 font-semibold tracking-tight">
        <span className="brand-mark" aria-hidden="true"><img src="/brand-mark.png" alt="" width={40} height={40} /></span>
        <span className="brand-copy">
          <span>Штаб Переговоров</span>
          <small>ПРАКТИКА · ПЕРЕГОВОРЫ</small>
        </span>
      </Link>
      <nav className="desktop-nav" aria-label="Основная навигация">
        <DestinationLinks />
      </nav>
      <div className="header-actions">
        <details className="mobile-nav">
          <summary aria-label="Открыть разделы приложения">
            <span className="menu-glyph" aria-hidden="true"><i /><i /><i /></span>
            <span>Разделы</span>
          </summary>
          <nav aria-label="Основная навигация">
            <DestinationLinks />
          </nav>
        </details>
        <ThemeToggle />
      </div>
    </div>
  );
}
