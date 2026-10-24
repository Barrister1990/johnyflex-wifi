"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Login failed");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-brand-ink text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[18%] -top-[12%] h-[52vmin] w-[52vmin] animate-login-drift rounded-full bg-brand/25 blur-[2px]" />
        <div className="absolute -right-[10%] top-[8%] h-[42vmin] w-[42vmin] animate-login-drift-slow rounded-full bg-brand-mid/80" />
        <div className="absolute bottom-[-8%] left-[28%] h-[36vmin] w-[36vmin] animate-login-drift-slower rounded-full bg-brand/15" />
        <div
          className="absolute inset-0 opacity-[0.25]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(200,245,66,0.18) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
      </div>

      <header className="relative z-10 flex items-center justify-between px-4 py-4 md:px-8 md:py-6">
        <Link href="/login" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand font-display text-[11px] font-extrabold tracking-tight text-brand-ink">
            JF
          </span>
          <span className="font-display text-[16px] font-bold tracking-[-0.03em] text-white sm:text-[17px]">
            JohnnyFlex
          </span>
        </Link>
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-brand/70 md:text-xs-tight">
          Wi‑Fi
        </p>
      </header>

      <main className="relative z-10 flex flex-1 flex-col justify-center px-4 pb-10 pt-2 md:px-8 md:pb-16 lg:px-12">
        <div className="mx-auto grid w-full max-w-6xl items-end gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:items-center">
          <div className="animate-fade-up">
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-brand/70 md:text-xs-tight">
              Operator console
            </p>
            <h1
              className="mt-3 font-display text-[clamp(2.75rem,8vw,5.5rem)] font-extrabold leading-[0.92] tracking-[-0.04em]"
              style={{ color: "var(--brand)" }}
            >
              JohnnyFlex
            </h1>
            <p className="mt-4 max-w-md text-body-lg text-white/70 md:mt-5 md:text-lg md:leading-relaxed">
              Run every hotspot from one login — packages, vouchers, live
              sessions, and Paystack sales.
            </p>
          </div>

          <div className="animate-fade-up-delay">
            <div className="rounded-[1rem] border border-white/10 bg-[#f3f6f3] p-5 text-brand-ink shadow-[0_24px_60px_-28px_rgba(4,26,18,0.65)] md:p-7">
              <div className="mb-5 md:mb-6">
                <h2 className="font-display text-h2 font-bold tracking-tight text-brand-ink">
                  Sign in
                </h2>
                <p className="mt-1 text-xs-tight text-secondary md:text-sm">
                  Use your operator email and password.
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-3.5 md:space-y-4">
                <Input
                  label="Email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@business.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="min-h-11 bg-white md:min-h-12"
                />
                <Input
                  label="Password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="min-h-11 bg-white md:min-h-12"
                />

                {error ? (
                  <p
                    role="alert"
                    className="rounded-xl bg-danger/10 px-3 py-2 text-xs-tight text-danger md:text-sm"
                  >
                    {error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  className="mt-1 min-h-11 w-full border-0 bg-brand font-semibold text-brand-ink hover:bg-brand/90 md:min-h-12"
                  disabled={loading}
                >
                  {loading ? "Signing in…" : "Sign in to dashboard"}
                </Button>
              </form>

              <p className="mt-5 text-center text-2xs text-muted md:text-xs-tight">
                Hotspot guests use the café QR — this page is for operators
                only.
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 px-4 pb-5 text-center text-[10px] text-brand/55 md:px-8 md:pb-6 md:text-2xs">
        JohnnyFlex · affordable Wi‑Fi for every hotspot
      </footer>
    </div>
  );
}
