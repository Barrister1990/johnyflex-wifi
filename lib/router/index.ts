import { MikroTikRouterAdapter } from "@/lib/router/mikrotik";
import { MockRouterAdapter } from "@/lib/router/mock";
import type { RouterAdapter } from "@/lib/router/types";

let instance: RouterAdapter | null = null;

/** Single-company deployments default to mock until ROUTER_ADAPTER=mikrotik. */
export function getRouterAdapterMode(): "mock" | "mikrotik" {
  const mode = (process.env.ROUTER_ADAPTER ?? "mock").toLowerCase();
  return mode === "mikrotik" ? "mikrotik" : "mock";
}

export function getRouterAdapter(): RouterAdapter {
  if (!instance) {
    instance =
      getRouterAdapterMode() === "mikrotik"
        ? new MikroTikRouterAdapter()
        : new MockRouterAdapter();
  }
  return instance;
}

export function resetRouterAdapter(): void {
  instance = null;
}

export { testMikroTikConnection } from "@/lib/router/mikrotik";
