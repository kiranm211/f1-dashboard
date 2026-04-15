const CONTACT_CARDS = [
  {
    title: "Bug Reports",
    description: "Use GitHub Issues when session state, standings, sync freshness, or UI behavior looks wrong.",
    href: "https://github.com/kiranm211/f1-dashboard/issues/new",
    action: "Open Issue"
  },
  {
    title: "Feature Requests",
    description: "Request replay controls, telemetry overlays, comparison tools, or additional dashboards.",
    href: "https://github.com/kiranm211/f1-dashboard/issues/new",
    action: "Request Feature"
  },
  {
    title: "Project Repository",
    description: "Review source, current implementation direction, and open work in the repository itself.",
    href: "https://github.com/kiranm211/f1-dashboard",
    action: "View Repository"
  }
] as const;

export default function ContactPage() {
  return (
    <main className="page-shell">
      <header className="hero hero--compact">
        <p className="eyebrow">Feedback</p>
        <h1>Contact</h1>
        <p className="hero-subtitle">
          The fastest path for feedback right now is the repository. Report bugs with the affected route, season, session key, and what
          data looked incorrect.
        </p>
      </header>

      <section className="contact-grid">
        {CONTACT_CARDS.map((card) => (
          <article key={card.title} className="panel content-card">
            <div className="panel-head">
              <h2>{card.title}</h2>
            </div>
            <p>{card.description}</p>
            <a href={card.href} target="_blank" rel="noreferrer" className="site-header__link contact-link">
              {card.action}
            </a>
          </article>
        ))}
      </section>

      <section className="panel content-card">
        <div className="panel-head">
          <h2>What Helps In A Report</h2>
        </div>
        <ul className="content-list">
          <li>The page you were on and the season or session key involved.</li>
          <li>Whether the issue is missing data, stale data, incorrect ranking, or a visual bug.</li>
          <li>What you expected to see versus what the dashboard actually showed.</li>
          <li>A screenshot or a short reproduction path when the issue is UI-related.</li>
        </ul>
      </section>
    </main>
  );
}
