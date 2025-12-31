import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Clock, Phone, UserCheck, UserX, Pause } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { fetchQueueStatus } from '@/services/api';
import type { QueueStatus } from '@/types';
import toast from 'react-hot-toast';

export function QueueMonitor() {
  const [queues, setQueues] = useState<QueueStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);

  useEffect(() => {
    loadQueueStatus();

    // Auto-refresh every 3 seconds if enabled
    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoRefresh) {
      interval = setInterval(loadQueueStatus, 3000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadQueueStatus = async () => {
    try {
      const data = await fetchQueueStatus();
      setQueues(data);
    } catch (error: any) {
      console.error('Error loading queue status:', error);
      toast.error(error.message || 'Failed to load queue status');
    } finally {
      setLoading(false);
    }
  };

  const getAgentStatusBadge = (status: string, paused: boolean) => {
    if (paused) {
      return <Badge variant="warning">Paused</Badge>;
    }
    switch (status) {
      case 'idle':
        return <Badge variant="success">Available</Badge>;
      case 'busy':
        return <Badge variant="danger">On Call</Badge>;
      case 'ringing':
        return <Badge variant="warning">Ringing</Badge>;
      default:
        return <Badge variant="default">Unavailable</Badge>;
    }
  };

  const totalWaiting = queues.reduce((sum, q) => sum + q.waiting_count, 0);
  const totalActive = queues.reduce((sum, q) => sum + q.active_count, 0);
  const totalAgents = queues.reduce((sum, q) => sum + q.agents.length, 0);

  if (loading) {
    return (
      <Card>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Queue Monitor
        </h2>
        <Loader text="Loading queue status..." />
      </Card>
    );
  }

  const activeQueue = selectedQueue
    ? queues.find((q) => q.queue_id === selectedQueue)
    : null;

  return (
    <Card>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Queue Monitor
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Real-time call queue monitoring
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

      {/* Overall Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Waiting</p>
              <p className="text-3xl font-bold text-yellow-700 dark:text-yellow-400 mt-1">
                {totalWaiting}
              </p>
            </div>
            <Clock size={24} className="text-yellow-500" />
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-400 mt-1">
                {totalActive}
              </p>
            </div>
            <Phone size={24} className="text-blue-500" />
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Agents</p>
              <p className="text-3xl font-bold text-green-700 dark:text-green-400 mt-1">
                {totalAgents}
              </p>
            </div>
            <Users size={24} className="text-green-500" />
          </div>
        </div>
      </div>

      {/* Queue Selection */}
      {queues.length > 0 && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Queue
          </label>
          <select
            value={selectedQueue || ''}
            onChange={(e) => setSelectedQueue(e.target.value || null)}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Queues Overview</option>
            {queues.map((queue) => (
              <option key={queue.queue_id} value={queue.queue_id}>
                {queue.queue_name} ({queue.waiting_count} waiting, {queue.active_count}{' '}
                active)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Queue Details or Overview */}
      {activeQueue ? (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-3">
              {activeQueue.queue_name}
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Waiting Calls</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {activeQueue.waiting_count}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Active Calls</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {activeQueue.active_count}
                </p>
              </div>
            </div>

            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Agents</h4>
            <div className="space-y-2">
              {activeQueue.agents.map((agent, index) => (
                <motion.div
                  key={agent.agent_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded"
                >
                  <div className="flex items-center space-x-2">
                    {agent.paused ? (
                      <Pause size={16} className="text-yellow-500" />
                    ) : agent.status === 'idle' ? (
                      <UserCheck size={16} className="text-green-500" />
                    ) : (
                      <UserX size={16} className="text-gray-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {agent.agent_name || `Agent ${agent.agent_num}`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Ext {agent.agent_num}
                      </p>
                    </div>
                  </div>
                  {getAgentStatusBadge(agent.status, agent.paused)}
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      ) : queues.length > 0 ? (
        <div className="space-y-3">
          {queues.map((queue, index) => (
            <motion.div
              key={queue.queue_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              onClick={() => setSelectedQueue(queue.queue_id)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {queue.queue_name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {queue.agents.length} agents
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Waiting</p>
                    <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                      {queue.waiting_count}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Active</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {queue.active_count}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          No queues found
        </p>
      )}
    </Card>
  );
}
