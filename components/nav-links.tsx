"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Link = { href: string; label: string; admin?: boolean };

const LINKS: Link[] = [
  { href: "/", label: "Dashboard" },
  { href: "/history", label: "History" },
  { href: "/projects", label: "Projects" },
  { href: "/payments", label: "Payments" },
  { href: "/invoices", label: "Invoices", admin: true },
  { href: "/team", label: "Team", admin: true },
  { href: "/export", label: "Export", admin: true },
  { href: "/profile", label: "Profile" },
];

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const visible = LINKS.filter((l) => !l.admin || isAdmin);
  return (
    <>
      {visible.map(({ href, label }) => (
        <Link key={href} href={href} className={isActive(href) ? "active" : ""}>
          {label}
        </Link>
      ))}
    </>
  );
}
