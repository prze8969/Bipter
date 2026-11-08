import Link from "next/link";

/** Simple readable document layout for help / legal pages. */
export function Doc({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto grid max-w-3xl gap-10 py-6">
      <header className="grid gap-3">
        <Link href="/" className="text-sm text-muted hover:text-fg">
          ← Home
        </Link>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        {intro && <p className="text-lg">{intro}</p>}
      </header>
      {children}
    </article>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-24 gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="grid gap-3 text-base leading-relaxed">{children}</div>
    </section>
  );
}

export function Table({ rows, head }: { head: [string, string]; rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-4 border-b border-line px-4 py-3 text-sm font-semibold">
        <span>{head[0]}</span>
        <span>{head[1]}</span>
      </div>
      {rows.map(([a, b], i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-4 border-b border-line px-4 py-3 text-sm last:border-0">
          <span className="font-medium">{a}</span>
          <span className="break-words">{b}</span>
        </div>
      ))}
    </div>
  );
}
