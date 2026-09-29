const lessons = [
  { id: "interests-options", title: "Интересы и варианты (Гарвардский метод)", body: "Отделяйте позиции от интересов. Сначала выясните, зачем стороне нужно условие, затем предложите несколько вариантов, которые учитывают обе стороны." },
  { id: "batna", title: "BATNA и границы соглашения", body: "BATNA — лучшая доступная альтернатива соглашению. До уступки определите свою альтернативу и предел, ниже которого сделка хуже отказа." },
  { id: "spin", title: "Вопросы SPIN", body: "Последовательно уточняйте ситуацию, проблему, последствия и ценность решения. Используйте ответы собеседника, чтобы проверить, подходит ли ему ваше предложение." },
  { id: "commitments", title: "Фиксация договорённостей", body: "Суммируйте решение, ответственного, срок и ближайший шаг. Если согласия нет, запишите, что именно нужно проверить и когда вернуться к обсуждению." },
];
export default function LearnPage() {
  return <main className="mx-auto max-w-3xl space-y-5 p-6"><Link href="/" className="text-sm text-[var(--accent)]">← К сценариям</Link><h1 className="text-2xl font-semibold">Краткая теория переговоров</h1><p className="text-sm text-[var(--muted)]">Учебные заметки для разбора конкретных реплик, а не замена полноценного курса.</p>{lessons.map((lesson) => <section id={lesson.id} key={lesson.id} className="scroll-mt-6 rounded-2xl border border-[var(--card-border)] bg-[var(--card)] p-5"><h2 className="font-medium">{lesson.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{lesson.body}</p></section>)}</main>;
}
import Link from "next/link";
