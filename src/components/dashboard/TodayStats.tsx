import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, PhoneMissed, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { useStore } from '@/store/useStore';
import { fetchCallStats, fetchExtensions } from '@/services/api';
import { formatDuration, getTodayRange } from '@/utils/helpers';
import { escapeHtml } from '@/utils/security';
import toast from 'react-hot-toast';

export function TodayStats() {
  const { callStats, setCallStats, setExtensions, loading, setLoading } =
    useStore();
  const [totals, setTotals] = useState({
    totalCalls: 0,
    totalMissed: 0,
    totalDuration: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    // Calculate totals
    const totalCalls = callStats.reduce((sum, stat) => {
      return (
        sum +
        (stat.total_call_count ||
          (stat.answered_calls || 0) +
            (stat.no_answer_calls || 0) +
            (stat.busy_calls || 0) +
            (stat.failed_calls || 0))
      );
    }, 0);

    const totalMissed = callStats.reduce(
      (sum, stat) =>
        sum + (stat.no_answer_calls || 0) + (stat.busy_calls || 0) + (stat.failed_calls || 0),
      0
    );

    const totalDuration = callStats.reduce(
      (sum, stat) => sum + (stat.total_talking_time || 0),
      0
    );

    setTotals({ totalCalls, totalMissed, totalDuration });
  }, [callStats]);

  const loadStats = async () => {
    setLoading('stats', true);

    try {
      // Fetch extensions first
      const exts = await fetchExtensions();
      setExtensions(exts);

      if (exts.length === 0) {
        toast.error('No extensions found');
        setLoading('stats', false);
        return;
      }

      // Fetch stats
      const { startTime, endTime } = getTodayRange();
      const extensionIds = exts.map((ext) => ext.id);
      const stats = await fetchCallStats(extensionIds, startTime, endTime);

      setCallStats(stats);
    } catch (error: any) {
      console.error('Error loading stats:', error);
      toast.error(error.message || 'Failed to load statistics');
    } finally {
      setLoading('stats', false);
    }
  };

  if (loading.stats) {
    return (
      <Card>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Today's Stats
        </h2>
        <Loader text="Loading statistics..." />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Today's Stats
        </h2>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={loadStats}
          className="text-primary-600 dark:text-primary-400 hover:underline text-sm"
        >
          Refresh
        </motion.button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 p-6 rounded-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">
                Total Calls
              </p>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                {totals.totalCalls}
              </p>
            </div>
            <Phone className="text-blue-500" size={40} />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 p-6 rounded-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-1">
                Missed Calls
              </p>
              <p className="text-3xl font-bold text-red-700 dark:text-red-300">
                {totals.totalMissed}
              </p>
            </div>
            <PhoneMissed className="text-red-500" size={40} />
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 p-6 rounded-xl"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">
                Total Duration
              </p>
              <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                {formatDuration(totals.totalDuration)}
              </p>
            </div>
            <Clock className="text-green-500" size={40} />
          </div>
        </motion.div>
      </div>

      {/* Per Extension Stats */}
      {callStats.length > 0 ? (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Per Extension
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Extension
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Total Calls
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Missed
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {callStats.map((stat, index) => {
                  const totalCalls =
                    stat.total_call_count ||
                    (stat.answered_calls || 0) +
                      (stat.no_answer_calls || 0) +
                      (stat.busy_calls || 0) +
                      (stat.failed_calls || 0);
                  const missedCalls =
                    (stat.no_answer_calls || 0) +
                    (stat.busy_calls || 0) +
                    (stat.failed_calls || 0);

                  return (
                    <motion.tr
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {escapeHtml(stat.ext_name)} ({escapeHtml(stat.ext_num)})
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900 dark:text-white">
                        {totalCalls}
                      </td>
                      <td className="px-4 py-3 text-center text-sm font-semibold text-red-600 dark:text-red-400">
                        {missedCalls}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white">
                        {formatDuration(stat.total_talking_time || 0)}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          No call statistics available for today
        </p>
      )}
    </Card>
  );
}
