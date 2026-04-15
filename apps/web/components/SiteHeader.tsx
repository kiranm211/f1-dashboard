import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/races", label: "Races" },
  { href: "/standings", label: "Standings" },
  { href: "/drivers", label: "Drivers" },
  { href: "/circuits", label: "Circuits" },
  { href: "/admin", label: "Admin" },
  { href: "/compare", label: "Compare" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" }
] as const;

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/dashboard" className="site-header__brand">
          F1 Live Control
        </Link>
        <nav aria-label="Primary" className="site-header__nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="site-header__link">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
