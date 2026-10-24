import { Card } from "./card";

type MetricTileProps = {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
};

export function MetricTile({
  label,
  value,
  delta,
  deltaPositive = true,
}: MetricTileProps) {
  return (
    <Card>
      <p className="text-2xs font-semibold uppercase tracking-wide text-muted md:text-xs">
        {label}
      </p>
      <p className="mt-1 text-metric font-bold tracking-tight text-primary md:mt-2">
        {value}
      </p>
      {delta ? (
        <p
          className={`mt-1 text-2xs font-medium md:mt-2 md:text-xs ${deltaPositive ? "text-success" : "text-danger"}`}
        >
          {delta}
        </p>
      ) : null}
    </Card>
  );
}
