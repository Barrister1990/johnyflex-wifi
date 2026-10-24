/** Format byte counts for UI (MB / GB). */
export function formatDataBytes(bytes: number | null | undefined): string {
  const n = Math.max(0, Number(bytes) || 0);
  if (n < 1024 * 1024) {
    const kb = n / 1024;
    if (kb < 10) return `${kb.toFixed(1)} KB`;
    return `${Math.round(kb)} KB`;
  }
  const mb = n / (1024 * 1024);
  if (mb < 1024) {
    return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
  }
  const gb = mb / 1024;
  return gb < 10 ? `${gb.toFixed(2)} GB` : `${gb.toFixed(1)} GB`;
}

export function bytesToGb(bytes: number | null | undefined): number {
  const n = Math.max(0, Number(bytes) || 0);
  return Math.round((n / (1024 * 1024 * 1024)) * 1000) / 1000;
}
