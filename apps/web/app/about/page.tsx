const PRINCIPLES = [
  "Local API-first architecture so the browser never talks directly to OpenF1.",
  "Database-backed history so live dashboards and season analysis share one source of truth.",
  "Worker-driven sync orchestration with explicit freshness windows and cache invalidation."
];

const ROADMAP = [
  "Historic replay with timeline scrubbing across position, intervals, laps, pit, and stints.",
  "Deeper strategy surfaces such as stint timelines, incident overlays, and weather context.",
  "Operational observability for worker lag, cache behavior, and sync reliability."
];

export default function AboutPage() {
  return (
    <main className="page-shell">
      <header className="hero hero--compact">
        <p className="eyebrow">Project</p>
        <h1>About</h1>
        <p className="hero-subtitle">
          F1 Live Control is a DB-first motorsport platform that pulls OpenF1 data into a local stack for repeatable live views,
          historical browsing, and deeper strategy analysis.
        </p>
      </header>

      <section className="content-grid">
        <article className="panel content-card">
          <div className="panel-head">
            <h2>What It Is</h2>
          </div>
          <p>
            The project combines a Fastify API, PostgreSQL storage, Redis caching, a Python sync worker, and a Next.js frontend.
            The goal is to make live session data and historical race data available through one controlled pipeline.
          </p>
        </article>

        <article className="panel content-card">
          <div className="panel-head">
            <h2>Why It Exists</h2>
          </div>
          <p>
            Public motorsport data is useful, but raw endpoint access is not enough for a serious dashboard. This platform keeps the
            ingestion logic, normalization, cache strategy, and UI composition inside one system so views stay consistent and fast.
          </p>
        </article>
      </section>

      <section className="panel content-card">
        <div className="panel-head">
          <h2>Architecture Principles</h2>
        </div>
        <ul className="content-list">
          {PRINCIPLES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="content-grid content-grid--wide">
        <article className="panel content-card">
          <div className="panel-head">
            <h2>Current Surface Area</h2>
          </div>
          <ul className="content-list">
            <li>Dashboard for live session selection and leaderboard interval visualization.</li>
            <li>Races directory and per-session detail view.</li>
            <li>Driver and team standings derived from synced results.</li>
            <li>Driver directory and profile pages with recent race history.</li>
            <li>Circuit directory and venue session drill-down pages.</li>
          </ul>
        </article>

        <article className="panel content-card">
          <div className="panel-head">
            <h2>Roadmap</h2>
          </div>
          <ul className="content-list">
            {ROADMAP.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
