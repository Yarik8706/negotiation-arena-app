export type IconName =
  | "arrow-left"
  | "arrow-right"
  | "arrow-up-right"
  | "book-half"
  | "bar-chart-line"
  | "compass"
  | "moon"
  | "sliders"
  | "stars"
  | "sun"
  | "people";

export function Icon({ name, size = 18, className = "" }: { name: IconName; size?: number; className?: string }) {
  return <i aria-hidden="true" className={`icon bi bi-${name} ${className}`} style={{ fontSize: size }} />;
}
