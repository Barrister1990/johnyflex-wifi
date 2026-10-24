"use client";

import type { Package, VoucherListItem } from "@/lib/types";

/** 4 vertical cut columns × 10 rows = 40 small tickets per A4 sheet. */
const COLS = 4;
const ROWS = 10;
const PER_PAGE = COLS * ROWS;

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

type Props = {
  vouchers: VoucherListItem[];
  packages: Package[];
  businessName?: string;
};

export function VoucherPrintSheet({
  vouchers,
  packages,
  businessName = "JohnnyFlex",
}: Props) {
  const pkgMap = new Map(packages.map((p) => [p.id, p]));
  const pages = chunk(vouchers, PER_PAGE);

  if (!vouchers.length) return null;

  return (
    <div className="voucher-print-root hidden print:block">
      {pages.map((page, pageIndex) => (
        <section key={pageIndex} className="voucher-print-page">
          <div className="voucher-print-grid">
            {page.map((v) => {
              const pkg = pkgMap.get(v.packageId);
              const price = pkg
                ? `${pkg.currency} ${Number(pkg.price).toFixed(0)}`
                : "";
              const duration = pkg ? formatDuration(pkg.durationMinutes) : "";
              const meta = [v.packageName, duration, price]
                .filter(Boolean)
                .join(" · ");

              return (
                <article key={v.id} className="voucher-print-card">
                  <p className="voucher-print-brand">{businessName}</p>
                  <p className="voucher-print-code">{v.code}</p>
                  <p className="voucher-print-meta">{meta}</p>
                  <p className="voucher-print-hint">
                    {v.expiresAt
                      ? `Exp ${v.expiresAt.slice(0, 10)}`
                      : "Redeem on Wi‑Fi portal"}
                  </p>
                </article>
              );
            })}
            {Array.from({ length: Math.max(0, PER_PAGE - page.length) }).map(
              (_, i) => (
                <div
                  key={`empty-${pageIndex}-${i}`}
                  className="voucher-print-card voucher-print-empty"
                  aria-hidden
                />
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
