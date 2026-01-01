import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { useStore } from '@/store/useStore';
import { fetchCDR } from '@/services/api';
import { formatDateTimeForApi, formatDuration } from '@/utils/helpers';
import toast from 'react-hot-toast';

const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'Last 7 Days' },
] as const;

type RangeKey = (typeof RANGE_OPTIONS)[number]['value'];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getRangeDates(range: RangeKey): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case 'yesterday': {
      const start = startOfDay(addDays(now, -1));
      const end = endOfDay(addDays(now, -1));
      return { start, end };
    }
    case 'week': {
      const start = startOfDay(addDays(now, -6));
      const end = endOfDay(now);
      return { start, end };
    }
    case 'today':
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

export function RecentCalls() {
  const { recentCalls, setRecentCalls, loading, setLoading } = useStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [timeRange, setTimeRange] = useState<RangeKey>('today');

  useEffect(() => {
    loadCalls(1, timeRange);
  }, [timeRange]);

  const loadCalls = async (page: number, range: RangeKey) => {
    setLoading('calls', true);

    try {
      const { start, end } = getRangeDates(range);
      const result = await fetchCDR(page, 7, {
        startTime: formatDateTimeForApi(start),
        endTime: formatDateTimeForApi(end),
      });
      setRecentCalls(result.data);
      setHasMore(result.hasMore);
      setCurrentPage(page);
    } catch (error: any) {
      console.error('Error loading calls:', error);
      toast.error(error.message || 'Failed to load recent calls');
    } finally {
      setLoading('calls', false);
    }
  };

  const handlePrevious = () => {
    if (currentPage > 1) {
      loadCalls(currentPage - 1, timeRange);
    }
  };

  const handleNext = () => {
    if (hasMore) {
      loadCalls(currentPage + 1, timeRange);
    }
  };

  const getCallTypeBadge = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'inbound':
        return 'success';
      case 'outbound':
        return 'info';
      case 'internal':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (loading.calls && recentCalls.length === 0) {
    return (
      <Card>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Recent Calls
        </h2>
        <Loader text="Loading call history..." />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Recent Calls
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Showing {RANGE_OPTIONS.find((option) => option.value === timeRange)?.label}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setCurrentPage(1);
                setTimeRange(option.value);
              }}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                timeRange === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {option.label}
            </button>
          ))}
          <motion.button
            whileHover={{ scale: 1.05, rotate: 180 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => loadCalls(currentPage, timeRange)}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            disabled={loading.calls}
          >
            <RefreshCw size={20} />
          </motion.button>
        </div>
      </div>

      {recentCalls.length > 0 ? (
        <>
          <div className="space-y-3">
            {recentCalls.map((call, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                      {call.call_from} → {call.call_to}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {call.time} • {call.disposition} •{' '}
                      {formatDuration(call.talk_duration)}
                    </p>
                  </div>
                  <Badge variant={getCallTypeBadge(call.call_type)}>
                    {call.call_type}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center items-center gap-4 mt-6">
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePrevious}
              disabled={currentPage === 1 || loading.calls}
            >
              <ChevronLeft size={16} className="mr-1" />
              Previous
            </Button>

            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage}
            </span>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleNext}
              disabled={!hasMore || loading.calls}
            >
              Next
              <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        </>
      ) : (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          No recent calls found
        </p>
      )}
    </Card>
  );
}
