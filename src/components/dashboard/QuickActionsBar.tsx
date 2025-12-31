import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  Phone,
  Users,
  Activity,
  MapPin,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface QuickActionsBarProps {
  onRefreshExtensions?: () => void;
  onRefreshQueues?: () => void;
  onRefreshCalls?: () => void;
  onRefreshAll?: () => void;
}

export function QuickActionsBar({
  onRefreshExtensions,
  onRefreshQueues,
  onRefreshCalls,
  onRefreshAll,
}: QuickActionsBarProps) {
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const handleRefresh = async (
    type: string,
    action?: () => void
  ) => {
    setRefreshing(type);
    try {
      if (action) {
        await action();
      }
      toast.success(`${type} refreshed`);
    } catch (error) {
      toast.error(`Failed to refresh ${type}`);
    } finally {
      setTimeout(() => setRefreshing(null), 500);
    }
  };

  const quickActions = [
    {
      id: 'all',
      label: 'Refresh All',
      icon: RefreshCw,
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
      hoverColor: 'hover:bg-blue-200 dark:hover:bg-blue-900/50',
      action: onRefreshAll,
    },
    {
      id: 'extensions',
      label: 'Extensions',
      icon: Phone,
      color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
      hoverColor: 'hover:bg-green-200 dark:hover:bg-green-900/50',
      action: onRefreshExtensions,
    },
    {
      id: 'queues',
      label: 'Queues',
      icon: Users,
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
      hoverColor: 'hover:bg-purple-200 dark:hover:bg-purple-900/50',
      action: onRefreshQueues,
    },
    {
      id: 'calls',
      label: 'Active Calls',
      icon: Activity,
      color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
      hoverColor: 'hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
      action: onRefreshCalls,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 mb-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={20} className="text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Quick Actions
          </h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            const isRefreshing = refreshing === action.id;

            return (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleRefresh(action.label, action.action)}
                disabled={isRefreshing}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                  transition-all duration-200 transform
                  ${action.color} ${action.hoverColor}
                  ${isRefreshing ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                `}
              >
                <Icon
                  size={16}
                  className={isRefreshing ? 'animate-spin' : ''}
                />
                <span className="hidden sm:inline">{action.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
