"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  AnalyticsRange,
  BandwidthDay,
  NamedRevenue,
  PeakHourBucket,
  RevenueDay,
} from "@/lib/types";

const CHART = {
  ink: "#0F1115",
  muted: "#8A8F98",
  grid: "#E4E5E9",
  accent: "#111827",
  blue: "#5B8DEF",
  teal: "#2DD4BF",
  amber: "#F59E0B",
  rose: "#F43F5E",
  violet: "#8B5CF6",
  mint: "#34D399",
};

const PIE_COLORS = [
  CHART.blue,
  CHART.violet,
  CHART.teal,
  CHART.amber,
  CHART.rose,
  CHART.mint,
];

function shortDay(iso: string, range: AnalyticsRange, dayCount: number) {
  const d = new Date(`${iso}T12:00:00`);
  if (range === "7d" && dayCount <= 7) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function tickInterval(dayCount: number): number {
  if (dayCount <= 8) return 0;
  if (dayCount <= 16) return 1;
  if (dayCount <= 31) return 3;
  if (dayCount <= 90) return 6;
  return Math.floor(dayCount / 12);
}

type TipProps = {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  currency?: string;
};

function ChartTooltip({ active, payload, label, currency = "GHS" }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-canvas px-3 py-2 shadow-[var(--shadow-soft)]">
      <p className="text-2xs font-medium text-muted md:text-xs-tight">{label}</p>
      <div className="mt-1 space-y-0.5">
        {payload.map((entry) => (
          <p
            key={String(entry.dataKey)}
            className="text-xs-tight font-semibold text-primary"
            style={{ color: entry.color }}
          >
            {entry.name}:{" "}
            {entry.dataKey === "revenue" || entry.name?.includes("Revenue")
              ? `${currency} ${Number(entry.value).toFixed(2)}`
              : entry.value}
          </p>
        ))}
      </div>
    </div>
  );
}

export function RevenueAreaChart({
  days,
  currency,
  range,
}: {
  days: RevenueDay[];
  currency: string;
  range: AnalyticsRange;
}) {
  const data = days.map((d) => ({
    ...d,
    label: shortDay(d.date, range, days.length),
  }));
  const interval = tickInterval(days.length);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART.blue} stopOpacity={0.35} />
            <stop offset="100%" stopColor={CHART.blue} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: CHART.muted, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval={interval}
        />
        <YAxis
          tick={{ fill: CHART.muted, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip content={<ChartTooltip currency={currency} />} />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke={CHART.blue}
          strokeWidth={2.25}
          fill="url(#revFill)"
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ActivityComboChart({
  days,
  currency,
  range,
}: {
  days: RevenueDay[];
  currency: string;
  range: AnalyticsRange;
}) {
  const data = days.map((d) => ({
    ...d,
    label: shortDay(d.date, range, days.length),
  }));
  const interval = tickInterval(days.length);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: CHART.muted, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval={interval}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: CHART.muted, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={28}
          allowDecimals={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: CHART.muted, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={28}
          allowDecimals={false}
        />
        <Tooltip content={<ChartTooltip currency={currency} />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        <Bar
          yAxisId="left"
          dataKey="payments"
          name="Payments"
          fill={CHART.violet}
          radius={[4, 4, 0, 0]}
          maxBarSize={days.length > 20 ? 10 : 22}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="sessions"
          name="Sessions"
          stroke={CHART.teal}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PackageDonutChart({
  packages,
  currency,
}: {
  packages: NamedRevenue[];
  currency: string;
}) {
  const data = packages.map((p) => ({
    name: p.name,
    value: p.revenue,
    count: p.count,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-2xs text-muted md:text-xs-tight">
        No package sales in this range
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={3}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [
            `${currency} ${Number(value).toFixed(2)}`,
            name,
          ]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #E4E5E9",
            fontSize: 11,
          }}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11, lineHeight: "18px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function HotspotBarChart({
  hotspots,
  currency,
}: {
  hotspots: NamedRevenue[];
  currency: string;
}) {
  const data = hotspots.slice(0, 6).map((h) => ({
    name: h.name.length > 14 ? `${h.name.slice(0, 14)}…` : h.name,
    fullName: h.name,
    revenue: h.revenue,
    count: h.count,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-2xs text-muted md:text-xs-tight">
        No hotspot revenue in this range
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 12, left: 4, bottom: 0 }}
      >
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: CHART.muted, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={72}
          tick={{ fill: CHART.ink, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${currency} ${Number(value).toFixed(2)}`, "Revenue"]}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(_: any, payload: any) =>
            payload?.[0]?.payload?.fullName ?? ""
          }
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #E4E5E9",
            fontSize: 11,
          }}
        />
        <Bar dataKey="revenue" radius={[0, 6, 6, 0]} maxBarSize={18}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MiniSparkline({
  values,
  color = CHART.blue,
}: {
  values: number[];
  color?: string;
}) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#spark-${color.replace("#", "")})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PeakHoursChart({ hours }: { hours: PeakHourBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={hours} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: CHART.muted, fontSize: 10 }}
          interval={2}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: CHART.muted, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #E4E5E9",
            fontSize: 11,
          }}
        />
        <Bar dataKey="sessions" name="Sessions" fill={CHART.blue} radius={[4, 4, 0, 0]} />
        <Bar dataKey="payments" name="Payments" fill={CHART.amber} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BandwidthChart({
  days,
  range,
}: {
  days: BandwidthDay[];
  range: AnalyticsRange;
}) {
  const data = days.map((d) => ({
    ...d,
    label: shortDay(d.date, range, days.length),
  }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: CHART.muted, fontSize: 10 }}
          interval={tickInterval(days.length)}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: CHART.muted, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          unit=" GB"
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #E4E5E9",
            fontSize: 11,
          }}
        />
        <Area
          type="monotone"
          dataKey="downGb"
          name="Download"
          stroke={CHART.teal}
          fill={CHART.teal}
          fillOpacity={0.15}
        />
        <Area
          type="monotone"
          dataKey="upGb"
          name="Upload"
          stroke={CHART.violet}
          fill={CHART.violet}
          fillOpacity={0.1}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
