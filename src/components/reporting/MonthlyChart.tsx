import type { MonthlyCallData } from '@/types';

interface MonthlyChartProps {
  data: MonthlyCallData[];
}

export function MonthlyChart({ data }: MonthlyChartProps) {
  if (data.length === 0) return null;

  const maxCalls = Math.max(
    ...data.map((d) => Math.max(d.inboundTotal, d.outboundTotal))
  );
  const chartHeight = 200;
  const chartWidth = 800;
  const padding = { top: 20, right: 20, bottom: 60, left: 50 };
  const barWidth = Math.min(
    (chartWidth - padding.left - padding.right) / data.length / 3,
    35
  );
  const groupWidth = barWidth * 2 + 15;

  const scale = maxCalls > 0 ? (chartHeight - padding.top - padding.bottom) / maxCalls : 0;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + 20}`}
        className="w-full min-w-[600px]"
        style={{ maxHeight: '300px' }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + (chartHeight - padding.top - padding.bottom) * (1 - tick);
          const value = Math.round(maxCalls * tick);
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.1}
                className="text-gray-400"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-current text-gray-500 dark:text-gray-400"
                fontSize="12"
              >
                {value}
              </text>
            </g>
          );
        })}

        {data.map((month, index) => {
          const x = padding.left + index * groupWidth + groupWidth / 2 - (barWidth + 2.5);
          const baseY = chartHeight - padding.bottom;

          return (
            <g key={month.monthKey}>
              <rect
                x={x}
                y={baseY - month.inboundTotal * scale}
                width={barWidth}
                height={month.inboundTotal * scale || 1}
                fill="#22c55e"
                rx={2}
              />
              <rect
                x={x + barWidth + 5}
                y={baseY - month.outboundTotal * scale}
                width={barWidth}
                height={month.outboundTotal * scale || 1}
                fill="#3b82f6"
                rx={2}
              />
              <text
                x={x + barWidth + 2.5}
                y={baseY + 20}
                textAnchor="middle"
                className="fill-current text-gray-600 dark:text-gray-400"
                fontSize="11"
              >
                {month.month}
              </text>
            </g>
          );
        })}

        <g transform={`translate(${chartWidth - 150}, ${chartHeight - 10})`}>
          <rect x={0} y={0} width={12} height={12} fill="#22c55e" rx={2} />
          <text x={16} y={10} className="fill-current text-gray-600 dark:text-gray-400" fontSize="11">
            Inbound
          </text>
          <rect x={70} y={0} width={12} height={12} fill="#3b82f6" rx={2} />
          <text x={86} y={10} className="fill-current text-gray-600 dark:text-gray-400" fontSize="11">
            Outbound
          </text>
        </g>
      </svg>
    </div>
  );
}
