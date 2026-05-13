"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

const links = [
  { href: "/", label: "Vue d'ensemble" },
  { href: "/cuisine", label: "Cuisine" },
  { href: "/salle", label: "Salle" },
  { href: "/tables", label: "Tables" },
  { href: "/menu", label: "Menu" },
  { href: "/simulation", label: "Simulation" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [autoSimActive, setAutoSimActive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkStatus() {
      try {
        const s = await api.simulation.status();
        if (!cancelled) setAutoSimActive(s.active);
      } catch {
        // ignore
      }
    }

    checkStatus();
    const id = setInterval(checkStatus, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-8 px-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Restoptim
        </p>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Jumeau numérique
        </h1>
      </div>

      <nav className="flex flex-col gap-1">
        {links.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {link.label}
              {link.href === "/simulation" && autoSimActive ? (
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {autoSimActive ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs dark:border-amber-800 dark:bg-amber-950">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-100">Simulation auto</p>
            <p className="text-amber-700 dark:text-amber-300">Mode automatique actif</p>
          </div>
        </div>
      ) : null}

      <div className="mt-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        <p className="font-semibold text-zinc-900 dark:text-zinc-100">Backend connecté</p>
        <p className="mt-1 font-mono leading-relaxed text-zinc-400">
          :8080
        </p>
      </div>
    </aside>
  );
}
