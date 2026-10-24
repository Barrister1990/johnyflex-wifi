import { createServiceSupabaseClient } from "@/lib/supabase/admin";
import type { UsageLog, UsageLogEvent } from "@/lib/types";

type UsageLogRow = {
  id: string;
  session_id: string;
  hotspot_id: string;
  event: UsageLogEvent;
  created_at: string;
};

function mapUsageLog(row: UsageLogRow): UsageLog {
  return {
    id: row.id,
    sessionId: row.session_id,
    hotspotId: row.hotspot_id,
    event: row.event,
    createdAt: row.created_at,
  };
}

export async function addUsageLog(input: {
  sessionId: string;
  hotspotId: string;
  event: UsageLogEvent;
}): Promise<UsageLog> {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("usage_logs")
    .insert({
      session_id: input.sessionId,
      hotspot_id: input.hotspotId,
      event: input.event,
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapUsageLog(data as UsageLogRow);
}
