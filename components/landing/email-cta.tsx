"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function EmailCta({
  buttonLabel = "Start for free",
  dark = false,
}: {
  buttonLabel?: string;
  dark?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    router.push("/login");
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`mx-auto flex w-full max-w-md items-center gap-1 rounded-full border p-1 shadow-[var(--shadow-soft)] ${
        dark
          ? "border-white/15 bg-white/5"
          : "border-border bg-canvas"
      }`}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Operator email"
        className={`min-w-0 flex-1 bg-transparent px-3 py-1.5 text-xs-tight outline-none placeholder:text-muted md:px-4 md:py-2 md:text-body ${
          dark ? "text-white placeholder:text-white/40" : "text-primary"
        }`}
      />
      <Button type="submit" size="sm" className="shrink-0 rounded-full px-3 md:px-4">
        {buttonLabel === "Start for free" ? "Sign in" : buttonLabel}
      </Button>
    </form>
  );
}
