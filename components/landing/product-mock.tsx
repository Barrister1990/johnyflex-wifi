export function ProductMock({ dark = false }: { dark?: boolean }) {
  const shell = dark
    ? "border-white/10 bg-[#141414] text-white"
    : "border-border bg-canvas text-primary";
  const muted = dark ? "text-white/50" : "text-muted";
  const inset = dark ? "bg-white/5" : "bg-surface";
  const line = dark ? "bg-white/10" : "bg-border";

  return (
    <div
      className={`overflow-hidden rounded-xl border shadow-[var(--shadow-soft)] md:rounded-2xl ${shell}`}
    >
      <div className={`flex items-center gap-1.5 border-b px-2.5 py-1.5 md:px-3 md:py-2 ${dark ? "border-white/10" : "border-border"}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-danger/80 md:h-2 md:w-2" />
        <span className="h-1.5 w-1.5 rounded-full bg-land-glow/80 md:h-2 md:w-2" />
        <span className="h-1.5 w-1.5 rounded-full bg-success/80 md:h-2 md:w-2" />
        <span className={`ml-2 text-2xs ${muted}`}>dashboard · JohnnyFlex</span>
      </div>
      <div className="grid grid-cols-[56px_1fr] md:grid-cols-[88px_1fr]">
        <aside className={`space-y-1.5 border-r p-2 md:space-y-2 md:p-3 ${dark ? "border-white/10" : "border-border"}`}>
          {["Overview", "Packages", "Hotspots", "Payments"].map((item, i) => (
            <div
              key={item}
              className={`truncate rounded-md px-1.5 py-1 text-2xs md:rounded-lg md:px-2 md:py-1.5 md:text-xs-tight ${
                i === 0 ? inset + " font-medium" : muted
              }`}
            >
              {item}
            </div>
          ))}
        </aside>
        <div className="space-y-2 p-2 md:space-y-3 md:p-4">
          <div className="grid grid-cols-3 gap-1.5 md:gap-2">
            {[
              { label: "Revenue", value: "GHS 248" },
              { label: "Sessions", value: "36" },
              { label: "Hotspots", value: "4" },
            ].map((m) => (
              <div key={m.label} className={`rounded-lg p-1.5 md:rounded-xl md:p-3 ${inset}`}>
                <p className={`text-2xs uppercase tracking-wide ${muted}`}>
                  {m.label}
                </p>
                <p className="mt-0.5 text-xs-tight font-semibold md:mt-1 md:text-title">
                  {m.value}
                </p>
              </div>
            ))}
          </div>
          <div className={`h-16 rounded-lg md:h-28 md:rounded-xl ${inset} relative overflow-hidden`}>
            <div className="absolute inset-x-2 bottom-2 flex items-end gap-1 md:inset-x-3 md:bottom-3 md:gap-1.5">
              {[40, 65, 48, 80, 55, 72, 90].map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${dark ? "bg-white/25" : "bg-accent/20"}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            {[1, 2].map((i) => (
              <div key={i} className={`h-2 rounded-full md:h-2.5 ${line}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
