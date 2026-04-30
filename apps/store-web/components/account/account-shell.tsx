"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
};

const links = [
  { href: "/account", label: "نظرة عامة" },
  { href: "/account/profile", label: "الملف الشخصي" },
  { href: "/account/orders", label: "طلباتي" },
  { href: "/account/addresses", label: "العناوين" },
];

export default function AccountShell({ children, title, subtitle }: Props) {
  const pathname = usePathname();

  return (
    <div className="container-royal py-8 md:py-12">
      {(title || subtitle) ? (
        <div className="mb-6 md:mb-8">
          {title ? (
            <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">{title}</h1>
          ) : null}
          {subtitle ? (
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-[#eadfcb] bg-white p-4 shadow-soft">
          <h2 className="mb-4 text-lg font-bold text-royal-navy">حسابي</h2>

          <nav className="space-y-2">
            {links.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/account" && pathname.startsWith(link.href));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "block rounded-2xl px-4 py-3 text-sm font-medium transition",
                    active
                      ? "bg-royal-navy text-white"
                      : "bg-slate-50 text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 rounded-[28px] border border-[#eadfcb] bg-white p-4 shadow-soft md:p-6">
          {children}
        </section>
      </div>
    </div>
  );
}
