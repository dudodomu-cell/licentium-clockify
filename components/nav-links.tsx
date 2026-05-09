"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/history", label: "History" },
  { href: "/projects", label: "Projects" },
  { href: "/payments", label: "Payments" },
  { href: "/invoices", label: "Invoices" },
  { href: "/export", label: "Export" },
  { href: "/profile", label: "Profile" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <>
      {links.map(({ href, label }) => (
        <Link key={href} href={href} className={isActive(href) ? "active" : ""}>
          {label}
        </Link>
      ))}
    </>
  );
}
