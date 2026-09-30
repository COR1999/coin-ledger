import type { ForecastPoint } from "@/lib/finance/dashboard";
import { formatEurosDisplay } from "@/lib/money";

const WIDTH = 720;
const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 16 };

/**
 * 30-day projected-balance line, rendered as a static, accessible SVG (no chart
 * dependency). Shows the conservative drawdown as obligations fall due, with a
 * dashed reference line for the minimum reserve. The series is also exposed as a
 * visually-hidden table for screen readers.
 */
export function ForecastChart({
  series,
  minimumReserveCents,
}: {
  series: ForecastPoint[];
  minimumReserveCents: number;
}) {
  if (series.length < 2) return null;

  const values = series.map((p) => p.balanceCents);
  const dataMax = Math.max(...values, minimumReserveCents);
  const dataMin = Math.min(...values, minimumReserveCents);
  const span = Math.max(dataMax - dataMin, 1);
  // Pad the range by 8% so the line and reserve marker never touch the edges.
  const yMax = dataMax + span * 0.08;
  const yMin = dataMin - span * 0.08;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (i / (series.length - 1)) * plotW;
  const y = (cents: number) =>
    PAD.top + (1 - (cents - yMin) / (yMax - yMin)) * plotH;

  const linePath = series
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.balanceCents).toFixed(1)}`,
    )
    .join(" ");
  const areaPath =
    `${linePath} L${x(series.length - 1).toFixed(1)},${(PAD.top + plotH).toFixed(1)}` +
    ` L${x(0).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;

  const reserveY = y(minimumReserveCents);
  const first = series[0];
  const last = series[series.length - 1];

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-56 w-full"
        role="img"
        aria-label={`30-day cash forecast: projected balance falls from ${formatEurosDisplay(
          first.balanceCents,
        )} on ${first.date} to ${formatEurosDisplay(last.balanceCents)} on ${
          last.date
        } as obligations are paid. Minimum reserve is ${formatEurosDisplay(
          minimumReserveCents,
        )}.`}
      >
        <defs>
          <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-primary)"
              stopOpacity="0.18"
            />
            <stop
              offset="100%"
              stopColor="var(--color-primary)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {/* Minimum reserve reference line. */}
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={reserveY}
          y2={reserveY}
          stroke="var(--color-destructive)"
          strokeWidth={1}
          strokeDasharray="4 4"
          opacity={0.7}
        />
        <text
          x={WIDTH - PAD.right}
          y={reserveY - 4}
          textAnchor="end"
          className="fill-destructive text-[10px]"
        >
          Reserve {formatEurosDisplay(minimumReserveCents)}
        </text>

        <path d={areaPath} fill="url(#forecastFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* End points. */}
        <circle
          cx={x(0)}
          cy={y(first.balanceCents)}
          r={3}
          fill="var(--color-primary)"
        />
        <circle
          cx={x(series.length - 1)}
          cy={y(last.balanceCents)}
          r={3}
          fill="var(--color-primary)"
        />

        {/* X-axis endpoint labels. */}
        <text
          x={PAD.left}
          y={HEIGHT - 8}
          className="fill-muted-foreground text-[10px]"
        >
          {first.date}
        </text>
        <text
          x={WIDTH - PAD.right}
          y={HEIGHT - 8}
          textAnchor="end"
          className="fill-muted-foreground text-[10px]"
        >
          {last.date}
        </text>
      </svg>

      <figcaption className="sr-only">
        <table>
          <caption>Projected daily balance over the next 30 days</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Projected balance</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.date}>
                <td>{p.date}</td>
                <td>{formatEurosDisplay(p.balanceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
