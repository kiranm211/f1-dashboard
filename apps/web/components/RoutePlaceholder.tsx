type RoutePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  plannedBlocks: string[];
};

export function RoutePlaceholder({ eyebrow, title, description, plannedBlocks }: RoutePlaceholderProps) {
  return (
    <main className="page-shell">
      <header className="hero hero--compact">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="hero-subtitle">{description}</p>
      </header>

      <section className="panel route-placeholder">
        <div className="panel-head">
          <h2>Planned Modules</h2>
        </div>
        <ul>
          {plannedBlocks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
