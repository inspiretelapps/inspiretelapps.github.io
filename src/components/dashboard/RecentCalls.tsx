import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { useStore } from '@/store/useStore';
import { fetchCDR } from '@/services/api';
import { formatDuration } from '@/utils/helpers';
import { escapeHtml } from '@/utils/security';
import toast from 'react-hot-toast';

export function RecentCalls() {
  const { recentCalls, setRecentCalls, loading, setLoading } = useStore();
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    loadCalls(1);
  }, []);

  const loadCalls = async (page: number) => {
    setLoading('calls', true);

    try {
      const result = await fetchCDR(page, 10);
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
      loadCalls(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (hasMore) {
      loadCalls(currentPage + 1);
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Recent Calls
        </h2>
        <motion.button
          whileHover={{ scale: 1.05, rotate: 180 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => loadCalls(currentPage)}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          disabled={loading.calls}
        >
          <RefreshCw size={20} />
        </motion.button>
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
                      {escapeHtml(call.call_from)} → {escapeHtml(call.call_to)}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {escapeHtml(call.time)} • {escapeHtml(call.disposition)} •{' '}
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
