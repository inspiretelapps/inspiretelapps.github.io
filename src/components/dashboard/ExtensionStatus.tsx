import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Phone, PhoneIncoming, PhoneMissed, User } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { fetchExtensionStatus } from '@/services/api';
import type { ExtensionStatus } from '@/types';
import toast from 'react-hot-toast';

export function ExtensionStatusDashboard() {
  const [extensions, setExtensions] = useState<ExtensionStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadExtensionStatus();

    // Auto-refresh every 5 seconds if enabled
    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoRefresh) {
      interval = setInterval(loadExtensionStatus, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadExtensionStatus = async () => {
    try {
      const data = await fetchExtensionStatus();
      setExtensions(data);
    } catch (error: any) {
      console.error('Error loading extension status:', error);
      toast.error(error.message || 'Failed to load extension status');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'idle':
        return <Badge variant="success">Idle</Badge>;
      case 'ringing':
        return <Badge variant="warning">Ringing</Badge>;
      case 'busy':
        return <Badge variant="danger">Busy</Badge>;
      default:
        return <Badge variant="default">Unavailable</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'idle':
        return <Phone size={16} className="text-green-500" />;
      case 'ringing':
        return <PhoneIncoming size={16} className="text-yellow-500" />;
      case 'busy':
        return <PhoneMissed size={16} className="text-red-500" />;
      default:
        return <User size={16} className="text-gray-400" />;
    }
  };

  const statusCounts = {
    idle: extensions.filter((e) => e.status === 'idle').length,
    ringing: extensions.filter((e) => e.status === 'ringing').length,
    busy: extensions.filter((e) => e.status === 'busy').length,
    unavailable: extensions.filter((e) => e.status === 'unavailable').length,
  };

  if (loading) {
    return (
      <Card>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Extension Status
        </h2>
        <Loader text="Loading extension status..." />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Extension Status
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Real-time extension monitoring
          </p>
        </div>
        <button
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`px-3 py-1 text-xs rounded-md ${
            autoRefresh
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Idle</span>
            <Phone size={16} className="text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">
            {statusCounts.idle}
          </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Ringing</span>
            <PhoneIncoming size={16} className="text-yellow-500" />
          </div>
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mt-1">
            {statusCounts.ringing}
          </p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Busy</span>
            <PhoneMissed size={16} className="text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">
            {statusCounts.busy}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Offline</span>
            <User size={16} className="text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-700 dark:text-gray-400 mt-1">
            {statusCounts.unavailable}
          </p>
        </div>
      </div>

      {/* Extension List */}
      {extensions.length > 0 ? (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {extensions.map((ext, index) => (
            <motion.div
              key={ext.ext_id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                {getStatusIcon(ext.status)}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Ext {ext.ext_num}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    ID: {ext.ext_id}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Presence: {ext.presence_label || 'Unknown'}
                  </p>
                </div>
              </div>
              {getStatusBadge(ext.status)}
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          No extensions found
        </p>
      )}
    </Card>
  );
}
