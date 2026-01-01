import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  PhoneOff,
  PhoneForwarded,
  ParkingCircle,
  Eye,
  MessageSquare,
  UserPlus,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { Modal } from '@/components/ui/Modal';
import {
  fetchActiveCalls,
  hangupCall,
  transferCall,
  parkCall,
  monitorCall,
} from '@/services/api';
import type { ActiveCall } from '@/types';
import toast from 'react-hot-toast';

export function ActiveCallControls() {
  const [calls, setCalls] = useState<ActiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedCall, setSelectedCall] = useState<ActiveCall | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDestination, setTransferDestination] = useState('');
  const [monitorExtension, setMonitorExtension] = useState('');

  useEffect(() => {
    loadActiveCalls();

    // Auto-refresh every 2 seconds if enabled
    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoRefresh) {
      interval = setInterval(loadActiveCalls, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const loadActiveCalls = async () => {
    try {
      const data = await fetchActiveCalls();
      setCalls(data);
    } catch (error: any) {
      console.error('Error loading active calls:', error);
      toast.error(error.message || 'Failed to load active calls');
    } finally {
      setLoading(false);
    }
  };

  const handleHangup = async (call: ActiveCall) => {
    if (!confirm(`Hangup call from ${call.call_from} to ${call.call_to}?`)) {
      return;
    }

    try {
      const success = await hangupCall(call.channel_id);
      if (success) {
        toast.success('Call ended successfully');
        loadActiveCalls();
      } else {
        toast.error('Failed to hangup call');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to hangup call');
    }
  };

  const handleTransfer = async () => {
    if (!selectedCall || !transferDestination.trim()) {
      toast.error('Please enter a transfer destination');
      return;
    }
    if (!monitorExtension.trim()) {
      toast.error('Please enter your extension number');
      return;
    }

    try {
      const success = await transferCall(
        selectedCall.channel_id,
        transferDestination,
        monitorExtension
      );
      if (success) {
        toast.success('Call transferred successfully');
        setShowTransferModal(false);
        setTransferDestination('');
        setSelectedCall(null);
        loadActiveCalls();
      } else {
        toast.error('Failed to transfer call');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to transfer call');
    }
  };

  const handlePark = async (call: ActiveCall) => {
    try {
      const success = await parkCall(call.channel_id);
      if (success) {
        toast.success('Call parked successfully');
        loadActiveCalls();
      } else {
        toast.error('Failed to park call');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to park call');
    }
  };

  const handleMonitor = async (call: ActiveCall, mode: 'listen' | 'whisper' | 'barge') => {
    if (!monitorExtension.trim()) {
      toast.error('Please enter your extension number');
      return;
    }

    try {
      const success = await monitorCall(monitorExtension, call.channel_id, mode);
      if (success) {
        toast.success(`Monitoring call in ${mode} mode`);
      } else {
        toast.error('Failed to monitor call');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to monitor call');
    }
  };

  const getCallTypeBadge = (type: string) => {
    switch (type) {
      case 'Inbound':
        return <Badge variant="info">Inbound</Badge>;
      case 'Outbound':
        return <Badge variant="default">Outbound</Badge>;
      case 'Internal':
        return <Badge variant="success">Internal</Badge>;
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ringing':
        return <Badge variant="warning">Ringing</Badge>;
      case 'talking':
        return <Badge variant="success">Active</Badge>;
      case 'hold':
        return <Badge variant="default">On Hold</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <Card>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Active Call Controls
        </h2>
        <Loader text="Loading active calls..." />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Active Call Controls
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage and monitor active calls
            </p>
          </div>
          <div className="flex items-center gap-3">
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
        </div>

        {/* Monitor Extension Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Your Extension (for monitoring / transfers)
          </label>
          <input
            type="text"
            value={monitorExtension}
            onChange={(e) => setMonitorExtension(e.target.value)}
            placeholder="e.g., 1001"
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Active Calls Summary */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Active Calls</p>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-400 mt-1">
                {calls.length}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-600 dark:text-gray-400">Ringing</p>
              <p className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                {calls.filter((c) => c.status === 'ringing').length}
              </p>
            </div>
          </div>
        </div>

        {/* Active Calls List */}
        {calls.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {calls.map((call, index) => (
              <motion.div
                key={call.call_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getCallTypeBadge(call.call_type)}
                      {getStatusBadge(call.status)}
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {call.call_from} → {call.call_to}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Duration: {formatDuration(call.duration)}
                    </p>
                  </div>
                </div>

                {/* Call Control Buttons */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleHangup(call)}
                  >
                    <PhoneOff size={16} className="mr-1" />
                    Hangup
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setSelectedCall(call);
                      setShowTransferModal(true);
                    }}
                  >
                    <PhoneForwarded size={16} className="mr-1" />
                    Transfer
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePark(call)}
                  >
                    <ParkingCircle size={16} className="mr-1" />
                    Park
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMonitor(call, 'listen')}
                    disabled={!monitorExtension}
                  >
                    <Eye size={16} className="mr-1" />
                    Listen
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMonitor(call, 'whisper')}
                    disabled={!monitorExtension}
                  >
                    <MessageSquare size={16} className="mr-1" />
                    Whisper
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMonitor(call, 'barge')}
                    disabled={!monitorExtension}
                  >
                    <UserPlus size={16} className="mr-1" />
                    Barge
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 dark:text-gray-400 py-8">
            No active calls
          </p>
        )}
      </Card>

      {/* Transfer Modal */}
      <Modal
        isOpen={showTransferModal}
        onClose={() => {
          setShowTransferModal(false);
          setTransferDestination('');
          setSelectedCall(null);
        }}
        title="Transfer Call"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Transfer to Extension/Number
            </label>
            <input
              type="text"
              value={transferDestination}
              onChange={(e) => setTransferDestination(e.target.value)}
              placeholder="e.g., 1002 or external number"
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowTransferModal(false);
                setTransferDestination('');
                setSelectedCall(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleTransfer}>
              Transfer
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
