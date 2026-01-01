import { useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { fetchCDR, fetchExtensions } from '@/services/api';
import { formatDateTimeForApi } from '@/utils/helpers';
import { useStore } from '@/store/useStore';
import type { CallRecord, Extension } from '@/types';

const RANGE_CONFIG = {
  today: {
    label: 'Today',
    compareLabel: 'Yesterday',
    bucket: 'hour',
    bucketCount: 24,
    spanDays: 1,
  },
  week: {
    label: 'Last 7 Days',
    compareLabel: 'Previous 7 Days',
    bucket: 'day',
    bucketCount: 7,
    spanDays: 7,
  },
  month: {
    label: 'Last 30 Days',
    compareLabel: 'Previous 30 Days',
    bucket: 'day',
    bucketCount: 30,
    spanDays: 30,
  },
} as const;

type RangeKey = keyof typeof RANGE_CONFIG;

type ActivitySeries = {
  labels: string[];
  current: number[];
  previous: number[];
  currentTotal: number;
  previousTotal: number;
};

type ExtensionStats = {
  id: string;
  number: string;
  label: string;
  received: number;
  made: number;
  missed: number;
};

const MAX_PAGES = 8;
const PAGE_SIZE = 300;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseCallTime(value: string): Date | null {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const normalized = value.replace(/-/g, '/');
  const normalizedDate = new Date(normalized);
  if (!Number.isNaN(normalizedDate.getTime())) return normalizedDate;

  const match = value.match(
    /(\d{4})[\/\-](\d{2})[\/\-](\d{2})\s+(\d{2}):(\d{2}):(\d{2})/
  );
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
}

function normalizeExtensionNumber(value?: string): string {
  if (!value) return '';
  const digits = value.replace(/\D+/g, '');
  return digits || value.trim();
}

async function fetchCdrRange(
  start: Date,
  end: Date
): Promise<{ records: CallRecord[]; truncated: boolean }> {
  const records: CallRecord[] = [];
  let page = 1;
  let hasMore = true;
  let truncated = false;

  while (hasMore && page <= MAX_PAGES) {
    const result = await fetchCDR(page, PAGE_SIZE, {
      startTime: formatDateTimeForApi(start),
      endTime: formatDateTimeForApi(end),
    });
    records.push(...result.data);
    hasMore = result.hasMore;
    page += 1;
  }

  if (hasMore) {
    truncated = true;
  }

  return { records, truncated };
}

function buildActivitySeries(
  calls: CallRecord[],
  start: Date,
  bucketCount: number,
  bucketMs: number
): { series: number[]; total: number } {
  const series = Array.from({ length: bucketCount }, () => 0);

  calls.forEach((call) => {
    const timestamp = parseCallTime(call.time);
    if (!timestamp) return;
    const diff = timestamp.getTime() - start.getTime();
    const bucketIndex = Math.floor(diff / bucketMs);
    if (bucketIndex >= 0 && bucketIndex < bucketCount) {
      series[bucketIndex] += 1;
    }
  });

  const total = series.reduce((sum, value) => sum + value, 0);
  return { series, total };
}

function buildExtensionStats(
  extensions: Extension[],
  calls: CallRecord[]
): ExtensionStats[] {
  const entries = extensions.map((ext) => ({
    id: ext.id,
    number: ext.number,
    label: ext.display_name ? `Ext ${ext.number} (${ext.display_name})` : `Ext ${ext.number}`,
    received: 0,
    made: 0,
    missed: 0,
  }));

  const byNumber = new Map<string, ExtensionStats>();
  entries.forEach((entry) => {
    byNumber.set(normalizeExtensionNumber(entry.number), entry);
  });

  calls.forEach((call) => {
    const callType = call.call_type?.toLowerCase() || '';
    const disposition = call.disposition?.toUpperCase() || '';
    const fromNumber = normalizeExtensionNumber(call.call_from);
    const toNumber = normalizeExtensionNumber(call.call_to);

    const fromEntry = byNumber.get(fromNumber);
    const toEntry = byNumber.get(toNumber);

    if (callType === 'inbound') {
      if (toEntry) {
        toEntry.received += 1;
        if (disposition !== 'ANSWERED') {
          toEntry.missed += 1;
        }
      }
      return;
    }

    if (callType === 'outbound') {
      if (fromEntry) {
        fromEntry.made += 1;
      }
      return;
    }

    // Fallback mapping when call_type is missing
    if (toEntry) {
      toEntry.received += 1;
      if (disposition !== 'ANSWERED') {
        toEntry.missed += 1;
      }
    }
    if (fromEntry) {
      fromEntry.made += 1;
    }
  });

  return entries;
}

function ActivityChart({
  labels,
  current,
  previous,
  currentLabel,
  previousLabel,
}: {
  labels: string[];
  current: number[];
  previous: number[];
  currentLabel: string;
  previousLabel: string;
}) {
  const max = Math.max(1, ...current, ...previous);
  const width = 100;
  const height = 40;
  const padding = 6;

  const buildPoints = (series: number[]) =>
    series
      .map((value, index) => {
        const x = (index / Math.max(series.length - 1, 1)) * (width - padding * 2) + padding;
        const y =
          height -
          padding -
          (value / max) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');

  const currentPoints = buildPoints(current);
  const previousPoints = buildPoints(previous);

  const firstLabel = labels[0] || '';
  const midLabel = labels[Math.floor(labels.length / 2)] || '';
  const lastLabel = labels[labels.length - 1] || '';

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
          {currentLabel}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600" />
          {previousLabel}
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32">
        <polyline
          fill="none"
          stroke="#D1D5DB"
          strokeWidth="1.5"
          points={previousPoints}
        />
        <polyline
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2"
          points={currentPoints}
        />
      </svg>

      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-2">
        <span>{firstLabel}</span>
        <span>{midLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}

export function SimplifiedAnalytics() {
  const [timeRange, setTimeRange] = useState<RangeKey>('today');
  const [activity, setActivity] = useState<ActivitySeries | null>(null);
  const [extensionStats, setExtensionStats] = useState<ExtensionStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { extensions, setExtensions } = useStore();

  const rangeConfig = RANGE_CONFIG[timeRange];

  const labels = useMemo(() => {
    if (rangeConfig.bucket === 'hour') {
      return Array.from({ length: rangeConfig.bucketCount }, (_, index) =>
        `${String(index).padStart(2, '0')}:00`
      );
    }

    const start = startOfDay(addDays(new Date(), -(rangeConfig.spanDays - 1)));
    return Array.from({ length: rangeConfig.bucketCount }, (_, index) => {
      const date = addDays(start, index);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    });
  }, [rangeConfig]);

  const loadAnalytics = async () => {
    setLoading(true);

    try {
      const now = new Date();
      const currentStart = startOfDay(addDays(now, -(rangeConfig.spanDays - 1)));
      const previousStart = startOfDay(addDays(currentStart, -rangeConfig.spanDays));
      const previousEnd = new Date(currentStart.getTime() - 1000);

      const [currentCdr, previousCdr, extensionData] = await Promise.all([
        fetchCdrRange(currentStart, now),
        fetchCdrRange(previousStart, previousEnd),
        extensions.length > 0 ? Promise.resolve(extensions) : fetchExtensions(),
      ]);

      if (extensions.length === 0) {
        setExtensions(extensionData);
      }

      const bucketMs =
        rangeConfig.bucket === 'hour'
          ? 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;

      const currentSeries = buildActivitySeries(
        currentCdr.records,
        currentStart,
        rangeConfig.bucketCount,
        bucketMs
      );

      const previousSeries = buildActivitySeries(
        previousCdr.records,
        previousStart,
        rangeConfig.bucketCount,
        bucketMs
      );

      setActivity({
        labels,
        current: currentSeries.series,
        previous: previousSeries.series,
        currentTotal: currentSeries.total,
        previousTotal: previousSeries.total,
      });

      setExtensionStats(buildExtensionStats(extensionData, currentCdr.records));
      setTruncated(currentCdr.truncated || previousCdr.truncated);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  if (loading && !activity) {
    return (
      <Card>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Analytics Overview
        </h2>
        <Loader text="Loading analytics..." />
      </Card>
    );
  }

  const maxExtensionTotal = Math.max(
    1,
    ...extensionStats.map((stat) => stat.received + stat.made + stat.missed)
  );

  return (
    <Card>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Analytics Overview
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Call activity trends and per-extension breakdowns
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(Object.keys(RANGE_CONFIG) as RangeKey[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {RANGE_CONFIG[range].label}
            </button>
          ))}
          <button
            onClick={loadAnalytics}
            className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            aria-label="Refresh analytics"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {loading ? (
        <Loader text="Refreshing analytics..." />
      ) : (
        <div className="space-y-8">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <BarChart3 size={18} className="text-blue-500" />
                  Call Activity
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {rangeConfig.label} compared to {rangeConfig.compareLabel}
                </p>
              </div>
              {activity && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <span className="mr-4">Current: {activity.currentTotal}</span>
                  <span>Previous: {activity.previousTotal}</span>
                </div>
              )}
            </div>

            {activity && (
              <ActivityChart
                labels={activity.labels}
                current={activity.current}
                previous={activity.previous}
                currentLabel={rangeConfig.label}
                previousLabel={rangeConfig.compareLabel}
              />
            )}

            {truncated && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                Showing a sample of calls. Narrow the date range for full accuracy.
              </p>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Extension Call Activity
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Received, made, and missed calls for {rangeConfig.label.toLowerCase()}
                </p>
              </div>
              {lastUpdated && (
                <span className="text-xs text-gray-400">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>

            {extensionStats.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No extension data available.
              </p>
            ) : (
              <div className="space-y-4">
                {extensionStats.map((stat) => {
                  const receivedWidth = (stat.received / maxExtensionTotal) * 100;
                  const madeWidth = (stat.made / maxExtensionTotal) * 100;
                  const missedWidth = (stat.missed / maxExtensionTotal) * 100;

                  return (
                    <div key={stat.id} className="space-y-2">
                      <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                        <span>{stat.label}</span>
                        <span>
                          R {stat.received} · M {stat.made} · Missed {stat.missed}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-green-100 dark:bg-green-900/30 rounded">
                            <div
                              className="h-2 bg-green-500 rounded"
                              style={{ width: `${receivedWidth}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Received
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-blue-100 dark:bg-blue-900/30 rounded">
                            <div
                              className="h-2 bg-blue-500 rounded"
                              style={{ width: `${madeWidth}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Made
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-red-100 dark:bg-red-900/30 rounded">
                            <div
                              className="h-2 bg-red-500 rounded"
                              style={{ width: `${missedWidth}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Missed
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
