"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  FileUp,
  FolderOpen,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Radio,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuEmpty, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { LiveLogAlert } from "@/lib/server/live-logs/store";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Investigate", icon: Sparkles },
  { href: "/live-logs", label: "Live signals", icon: Radio },
  { href: "/upload", label: "Ingest", icon: FileUp },
  { href: "/library", label: "Evidence", icon: FolderOpen },
  { href: "/ai-ops", label: "Command metrics", icon: Gauge },
  { href: "/fde", label: "Solution desk", icon: Bot },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="signal-field relative min-h-screen">
      <div className="relative min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="app-rail hidden min-h-screen border-r px-4 py-5 lg:flex lg:flex-col">
          <BrandMark />
          <NavList pathname={pathname} />
          <SystemStatus />
          <LogoutForm />
        </aside>

        <Sheet onOpenChange={setMobileNavOpen} open={mobileNavOpen} side="left">
          <div className="flex h-full flex-col">
            <BrandMark />
            <NavList onNavigate={() => setMobileNavOpen(false)} pathname={pathname} />
            <SystemStatus />
            <LogoutForm />
          </div>
        </Sheet>

        <div className="min-w-0">
          <header className="command-header sticky top-0 z-30 border-b backdrop-blur-md">
            <div className="flex items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <button
                  aria-label="Open navigation"
                  className="grid h-9 w-9 place-items-center border border-line text-ink-soft transition hover:text-ink lg:hidden"
                  onClick={() => setMobileNavOpen(true)}
                  type="button"
                >
                  <Menu className="h-4 w-4" aria-hidden="true" />
                </button>
                <div>
                  <p className="font-display text-sm font-semibold text-ink">Production workspace</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-soft">Incident response / evidence-grounded</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden rounded-full border border-forest/30 bg-forest/10 px-3 py-1.5 text-xs font-semibold text-forest sm:inline">
                  All systems operational
                </span>
                <AlertsBell />
                <span className="grid h-8 w-8 place-items-center rounded-full bg-paper-3 text-xs font-bold text-ink">AD</span>
              </div>
            </div>
          </header>
          <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function BrandMark() {
  return (
    <Link className="flex items-center gap-3 px-2" href="/dashboard">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#5f50f8] font-display text-sm font-bold text-white">WC</span>
      <span>
        <span className="block font-display text-base font-semibold text-ink">WebLogic Copilot</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-soft">Operations console</span>
      </span>
    </Link>
  );
}

function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <>
      <Link
        className="mt-8 inline-flex items-center justify-center gap-2 rounded-lg bg-[#5f50f8] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#7366ff]"
        href="/chat"
        onClick={onNavigate}
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        New investigation
      </Link>
      <nav className="mt-7 grid gap-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              className="app-rail__link nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-ink-soft transition"
              data-active={active ? "true" : "false"}
              href={item.href}
              key={item.href}
              onClick={onNavigate}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function SystemStatus() {
  return (
    <div className="mt-auto rounded-xl border border-forest/25 bg-forest/10 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Activity className="h-4 w-4 text-forest" aria-hidden="true" />
        System status
      </div>
      <p className="mt-2 text-xs text-ink-soft">Vector store healthy · Local inference online</p>
    </div>
  );
}

function LogoutForm() {
  return (
    <form action="/api/auth/logout" className="mt-4" method="post">
      <button className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-ink-soft transition hover:text-ink" type="submit">
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        Logout
      </button>
    </form>
  );
}

function AlertsBell() {
  const [alerts, setAlerts] = useState<LiveLogAlert[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadAlerts() {
      try {
        const response = await fetch("/api/live-logs/streams", { signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json();
        setAlerts((payload.alerts || []).slice(0, 6));
      } catch {
        // Notifications are best-effort; ignore transient failures.
      }
    }

    loadAlerts();
    const interval = setInterval(loadAlerts, 30_000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative grid h-8 w-8 place-items-center text-ink-soft transition hover:text-ink" aria-label="Alerts">
        <Bell className="h-4 w-4" aria-hidden="true" />
        {alerts.length ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-danger" /> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Live log alerts</DropdownMenuLabel>
        {alerts.length ? (
          alerts.map((alert) => (
            <DropdownMenuItem key={alert.id}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-copper" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{alert.title}</p>
                  <Badge variant={alert.severity === "critical" ? "danger" : alert.severity === "warn" ? "warning" : "outline"}>
                    {alert.severity}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-ink-soft">{alert.server} · {alert.env}</p>
              </div>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuEmpty>No alerts yet. Alerts appear once a live-log stream matches a severity rule.</DropdownMenuEmpty>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
