import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { fetchExtensionStatus, fetchActiveCalls, fetchQueueStatus } from '@/services/api';

interface WidgetData {
  totalExtensions: number;
  idleExtensions: number;
  busyExtensions: number;
  activeCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  waitingCalls: number;
  totalQueues: number;
}

export function LiveDashboardWidgets() {
  const [data, setData] = useState<WidgetData>({
    totalExtensions: 0,
    idleExtensions: 0,
    busyExtensions: 0,
    activeCalls: 0,
    inboundCalls: 0,
    outboundCalls: 0,
    waitingCalls: 0,
    totalQueues: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();

    // Auto-refresh every 5 seconds
    const interval = setInterval(loadData, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [extensions, calls, queues] = await Promise.all([
        fetchExtensionStatus(),
        fetchActiveCalls(),
        fetchQueueStatus(),
      ]);

      const idleCount = extensions.filter((e) => e.status === 'idle').length;
      const busyCount = extensions.filter(
        (e) => e.status === 'busy' || e.status === 'ringing'
      ).length;
      const inboundCount = calls.filter((c) => c.call_type === 'Inbound').length;
      const outboundCount = calls.filter((c) => c.call_type === 'Outbound').length;
      const waitingCount = queues.reduce((sum, q) => sum + q.waiting_count, 0);

      setData({
        totalExtensions: extensions.length,
        idleExtensions: idleCount,
        busyExtensions: busyCount,
        activeCalls: calls.length,
        inboundCalls: inboundCount,
        outboundCalls: outboundCount,
        waitingCalls: waitingCount,
        totalQueues: queues.length,
      });
    } catch (error) {
      console.error('Error loading widget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const widgets = [
    {
      title: 'Active Calls',
      value: data.activeCalls,
      icon: Phone,
      color: 'bg-blue-500',
      lightBg: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-700 dark:text-blue-400',
    },
    {
      title: 'Inbound',
      value: data.inboundCalls,
      icon: PhoneIncoming,
      color: 'bg-green-500',
      lightBg: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-700 dark:text-green-400',
    },
    {
      title: 'Outbound',
      value: data.outboundCalls,
      icon: PhoneOutgoing,
      color: 'bg-purple-500',
      lightBg: 'bg-purple-50 dark:bg-purple-900/20',
      textColor: 'text-purple-700 dark:text-purple-400',
    },
    {
      title: 'Waiting in Queue',
      value: data.waitingCalls,
      icon: Clock,
      color: 'bg-yellow-500',
      lightBg: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-700 dark:text-yellow-400',
    },
    {
      title: 'Idle Extensions',
      value: data.idleExtensions,
      icon: TrendingUp,
      color: 'bg-teal-500',
      lightBg: 'bg-teal-50 dark:bg-teal-900/20',
      textColor: 'text-teal-700 dark:text-teal-400',
    },
    {
      title: 'Busy Extensions',
      value: data.busyExtensions,
      icon: Activity,
      color: 'bg-red-500',
      lightBg: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-700 dark:text-red-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {widgets.map((widget, index) => {
        const Icon = widget.icon;

        return (
          <motion.div
            key={widget.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`${widget.lightBg} p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg ${widget.color}`}>
                <Icon size={20} className="text-white" />
              </div>
              {loading && (
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              {widget.title}
            </p>
            <p className={`text-3xl font-bold ${widget.textColor}`}>
              {widget.value}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
