import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/services/auth";
import { listHotspots } from "@/lib/services/hotspots";
import { getUnreadCount } from "@/lib/services/notifications";
import { getServerLocationId } from "@/lib/server-location";
import type { ReactNode } from "react";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  let unreadCount = 0;
  try {
    unreadCount = await getUnreadCount();
  } catch {
    unreadCount = 0;
  }

  const [hotspots, locationId] = await Promise.all([
    listHotspots().catch(() => []),
    getServerLocationId(),
  ]);

  return (
    <AppShell
      userName={user.name}
      unreadCount={unreadCount}
      hotspots={hotspots.map((h) => ({
        id: h.id,
        name: h.name,
        status: h.status,
      }))}
      initialLocationId={locationId}
    >
      {children}
    </AppShell>
  );
}
