import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Loader } from '@/components/ui/Loader';
import { fetchCDR } from '@/services/api';
import { formatDateTimeForApi } from '@/utils/helpers';

interface AnalyticsData {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  averageDuration: number;
  totalDuration: number;
  answerRate: number;
  callTrend: 'up' | 'down' | 'stable';
}

export function SimplifiedAnalytics() {
  const [data, setData] = useState<AnalyticsData>({
    totalCalls: 0,
    answeredCalls: 0,
    missedCalls: 0,
    averageDuration: 0,
    totalDuration: 0,
    answerRate: 0,
    callTrend: 'stable',
  });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startTime: Date;

      switch (timeRange) {
        case 'today':
          startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startTime = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      const result = await fetchCDR(1, 1000, {
        startTime: formatDateTimeForApi(startTime),
        endTime: formatDateTimeForApi(now),
      });

      const calls = result.data;
      const answered = calls.filter((c) => c.disposition === 'ANSWERED').length;
      const missed = calls.filter(
        (c) => c.disposition !== 'ANSWERED' && c.disposition !== 'NO ANSWER'
      ).length;
      const totalDuration = calls.reduce((sum, c) => sum + (c.talk_duration || 0), 0);
      const avgDuration = calls.length > 0 ? Math.round(totalDuration / calls.length) : 0;
      const answerRate = calls.length > 0 ? (answered / calls.length) * 100 : 0;

      // Simple trend calculation (comparing to half the period)
      const midPoint = new Date(
        startTime.getTime() + (now.getTime() - startTime.getTime()) / 2
      );
      const firstHalfCalls = calls.filter((c) => new Date(c.time) < midPoint).length;
      const secondHalfCalls = calls.length - firstHalfCalls;
      const trend =
        secondHalfCalls > firstHalfCalls * 1.1
          ? 'up'
          : secondHalfCalls < firstHalfCalls * 0.9
          ? 'down'
          : 'stable';

      setData({
        totalCalls: calls.length,
        answeredCalls: answered,
        missedCalls: missed,
        averageDuration: avgDuration,
        totalDuration: totalDuration,
        answerRate: Math.round(answerRate),
        callTrend: trend,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Card>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Analytics Overview
        </h2>
        <Loader text="Loading analytics..." />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Analytics Overview
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Call performance insights
          </p>
        </div>

        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <BarChart3 size={24} className="text-blue-600 dark:text-blue-400" />
            {data.callTrend === 'up' ? (
              <TrendingUp size={20} className="text-green-600" />
            ) : data.callTrend === 'down' ? (
              <TrendingDown size={20} className="text-red-600" />
            ) : null}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Calls</p>
          <p className="text-3xl font-bold text-blue-700 dark:text-blue-400 mt-1">
            {data.totalCalls}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <CheckCircle size={24} className="text-green-600 dark:text-green-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Answered</p>
          <p className="text-3xl font-bold text-green-700 dark:text-green-400 mt-1">
            {data.answeredCalls}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-4 rounded-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <XCircle size={24} className="text-red-600 dark:text-red-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Missed</p>
          <p className="text-3xl font-bold text-red-700 dark:text-red-400 mt-1">
            {data.missedCalls}
          </p>
        </motion.div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Answer Rate
            </p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {data.answerRate}%
          </p>
          <div className="mt-2 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${data.answerRate}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-gray-600 dark:text-gray-400" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Avg Duration
            </p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatSeconds(data.averageDuration)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">per call</p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-gray-600 dark:text-gray-400" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Total Duration
            </p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatDuration(data.totalDuration)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {data.totalCalls} calls
          </p>
        </div>
      </div>
    </Card>
  );
}
