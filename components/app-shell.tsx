"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
  type SVGProps,
} from "react";
import {
  IconAnalytics,
  IconBell,
  IconCollapse,
  IconDevices,
  IconExpand,
  IconHotspots,
  IconLogout,
  IconOverview,
  IconPackages,
  IconPayments,
  IconPortal,
  IconReports,
  IconRevenue,
  IconRouter,
  IconSessions,
  IconSettings,
  IconVendors,
  IconVouchers,
} from "@/components/icons";
import {
  LocationProvider,
  type LocationOption,
} from "@/components/location-provider";
import { LocationSwitcher } from "@/components/location-switcher";
import { ToastProvider } from "@/components/ui/toast";
import { LOCATION_ALL, type LocationFilterId } from "@/lib/location-filter";

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

const nav: {
  href: string;
  label: string;
  icon: IconComp;
  badgeKey?: "unread";
}[] = [
  { href: "/dashboard", label: "Overview", icon: IconOverview },
  { href: "/analytics", label: "Analytics", icon: IconAnalytics },
  { href: "/packages", label: "Packages", icon: IconPackages },
  { href: "/vouchers", label: "Vouchers", icon: IconVouchers },
  { href: "/hotspots", label: "Hotspots", icon: IconHotspots },
  { href: "/vendors", label: "Vendors", icon: IconVendors },
  { href: "/portal-builder", label: "Portal", icon: IconPortal },
  { href: "/devices", label: "Devices", icon: IconDevices },
  { href: "/router", label: "Routers", icon: IconRouter },
  { href: "/sessions", label: "Sessions", icon: IconSessions },
  { href: "/payments", label: "Payments", icon: IconPayments },
  { href: "/revenue", label: "Revenue", icon: IconRevenue },
  { href: "/reports", label: "Reports", icon: IconReports },
  {
    href: "/notifications",
    label: "Alerts",
    icon: IconBell,
    badgeKey: "unread",
  },
  { href: "/settings", label: "Settings", icon: IconSettings },
];

const STORAGE_KEY = "johnnyflex_sidebar_collapsed";

type AppShellProps = {
  children: ReactNode;
  userName?: string;
  unreadCount?: number;
  hotspots?: LocationOption[];
  initialLocationId?: LocationFilterId;
};

export function AppShell({
  children,
  userName,
  unreadCount = 0,
  hotspots = [],
  initialLocationId = LOCATION_ALL,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
    setReady(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <ToastProvider>
    <LocationProvider
      hotspots={hotspots}
      initialLocationId={initialLocationId}
    >
    <div className="min-h-screen bg-surface">
      <div className="flex min-h-screen">
        {/* Desktop collapsible sidebar */}
        <aside
          className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-canvas transition-[width] duration-200 ease-out print:hidden md:flex ${
            ready ? "" : "opacity-0"
          } ${collapsed ? "w-[68px]" : "w-[220px]"}`}
        >
          <div
            className={`flex h-14 items-center border-b border-border ${
              collapsed ? "justify-center px-2" : "justify-between px-3"
            }`}
          >
            <Link
              href="/dashboard"
              className={`flex items-center gap-2 font-display font-bold tracking-[-0.03em] text-primary ${
                collapsed ? "justify-center text-xs-tight" : "text-sm"
              }`}
            >
              {collapsed ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-[10px] font-extrabold text-brand-ink">
                  JF
                </span>
              ) : (
                <>
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-[10px] font-extrabold text-brand-ink">
                    JF
                  </span>
                  JohnnyFlex
                </>
              )}
            </Link>
            {!collapsed ? (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="rounded-lg p-1.5 text-secondary transition-colors hover:bg-surface hover:text-primary"
                aria-label="Collapse sidebar"
                title="Collapse"
              >
                <IconCollapse />
              </button>
            ) : null}
          </div>

          {hotspots.length > 0 ? (
            <div
              className={`border-b border-border ${
                collapsed ? "flex justify-center p-2" : "px-2 py-2"
              }`}
            >
              <LocationSwitcher collapsed={collapsed} />
            </div>
          ) : null}

          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
            {collapsed ? (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="mb-1 flex items-center justify-center rounded-xl p-2.5 text-secondary transition-colors hover:bg-surface hover:text-primary"
                aria-label="Expand sidebar"
                title="Expand"
              >
                <IconExpand />
              </button>
            ) : null}

            {nav.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const badge =
                item.badgeKey === "unread" && unreadCount > 0
                  ? unreadCount
                  : 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex items-center gap-2.5 rounded-xl transition-colors ${
                    collapsed ? "justify-center p-2.5" : "px-2.5 py-2"
                  } ${
                    active
                      ? "bg-inset text-primary"
                      : "text-secondary hover:bg-surface hover:text-primary"
                  }`}
                >
                  <Icon />
                  {!collapsed ? (
                    <span className="text-xs-tight font-medium md:text-sm">
                      {item.label}
                    </span>
                  ) : null}
                  {badge > 0 ? (
                    <span
                      className={`absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-white ${
                        collapsed ? "right-1 top-1" : "right-2"
                      }`}
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div
            className={`border-t border-border p-2 ${
              collapsed ? "flex flex-col items-center gap-1" : ""
            }`}
          >
            {!collapsed ? (
              <>
                <p className="truncate px-2.5 pb-0.5 text-2xs text-muted">
                  {userName}
                </p>
                <p
                  className="truncate px-2.5 pb-1 font-mono text-[10px] text-muted"
                  title={
                    process.env.NEXT_PUBLIC_BUILD_AT
                      ? `Built ${process.env.NEXT_PUBLIC_BUILD_AT}`
                      : "Build stamp"
                  }
                >
                  build {process.env.NEXT_PUBLIC_BUILD_NUMBER ?? "—"}
                </p>
              </>
            ) : (
              <p
                className="pb-1 font-mono text-[9px] text-muted"
                title={`build ${process.env.NEXT_PUBLIC_BUILD_NUMBER ?? "—"}`}
              >
                b{process.env.NEXT_PUBLIC_BUILD_NUMBER ?? "—"}
              </p>
            )}
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              className={`flex items-center gap-2.5 rounded-xl text-secondary transition-colors hover:bg-surface hover:text-primary ${
                collapsed
                  ? "justify-center p-2.5"
                  : "w-full px-2.5 py-2 text-xs-tight md:text-sm"
              }`}
            >
              <IconLogout />
              {!collapsed ? <span>Sign out</span> : null}
            </button>
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col pb-16 print:pb-0 md:pb-0">
          <header className="sticky top-0 z-20 flex flex-col gap-2 border-b border-border bg-canvas/95 px-3 py-2.5 backdrop-blur print:hidden md:hidden">
            <div className="flex items-center justify-between">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 font-display text-sm font-bold tracking-[-0.03em]"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-[10px] font-extrabold text-brand-ink">
                  JF
                </span>
                JohnnyFlex
              </Link>
              <div className="flex items-center gap-1">
                <Link
                  href="/notifications"
                  className="relative rounded-lg p-2 text-secondary"
                  aria-label="Notifications"
                >
                  <IconBell />
                  {unreadCount > 0 ? (
                    <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-success" />
                  ) : null}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg p-2 text-secondary"
                  aria-label="Sign out"
                >
                  <IconLogout />
                </button>
              </div>
            </div>
            {hotspots.length > 0 ? <LocationSwitcher /> : null}
          </header>

          <main className="mx-auto w-full max-w-[1280px] flex-1 px-3 py-4 print:max-w-none print:p-0 md:px-6 md:py-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom icon rail */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-border bg-canvas/95 px-1 py-1 backdrop-blur print:hidden md:hidden">
        {nav.slice(0, 5).map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 ${
                active ? "text-primary" : "text-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-full truncate text-[9px] font-medium leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
    </LocationProvider>
    </ToastProvider>
  );
}
