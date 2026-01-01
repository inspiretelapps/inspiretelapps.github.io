import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { useStore } from '@/store/useStore';
import {
  fetchInboundRoutes,
  fetchExtensions,
  fetchIVRs,
  fetchQueues,
  updateInboundRoute,
} from '@/services/api';
import type { InboundRoute } from '@/types';
import toast from 'react-hot-toast';

const DESTINATION_OPTIONS = [
  { value: 'extension', label: 'Extension' },
  { value: 'queue', label: 'Queue' },
  { value: 'ivr', label: 'IVR' },
  { value: 'end_call', label: 'End Call' },
];

function getRouteDestination(route: InboundRoute): { dest: string; value: string } {
  const dest =
    route.def_dest ||
    route.default_destination ||
    route.destination ||
    route.time_condition ||
    '';

  const value =
    route.def_dest_value ||
    route.default_destination_value ||
    route.default_desination_value ||
    route.destination_value ||
    '';

  return { dest, value };
}

export function InboundRoutingManager() {
  const {
    inboundRoutes,
    setInboundRoutes,
    extensions,
    setExtensions,
    ivrs,
    setIVRs,
    queues,
    setQueues,
    loading,
    setLoading,
  } = useStore();

  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [destinationType, setDestinationType] = useState<string>('');
  const [destinationValue, setDestinationValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!selectedRouteId && inboundRoutes.length > 0) {
      setSelectedRouteId(String(inboundRoutes[0].id));
    }
  }, [inboundRoutes, selectedRouteId]);

  useEffect(() => {
    if (!selectedRouteId) return;
    const route = inboundRoutes.find((r) => String(r.id) === selectedRouteId);
    if (!route) return;

    const { dest, value } = getRouteDestination(route);
    setDestinationType(dest);
    setDestinationValue(value);
  }, [selectedRouteId, inboundRoutes]);

  const loadData = async () => {
    setLoading('routes', true);

    try {
      const [routes, exts, ivrsData, queuesData] = await Promise.all([
        fetchInboundRoutes(),
        fetchExtensions(),
        fetchIVRs(),
        fetchQueues(),
      ]);

      setInboundRoutes(routes);
      setExtensions(exts);
      setIVRs(ivrsData);
      setQueues(queuesData);
    } catch (error: any) {
      console.error('Error loading inbound routing data:', error);
      toast.error(error.message || 'Failed to load inbound routes');
    } finally {
      setLoading('routes', false);
    }
  };

  const selectedRoute = inboundRoutes.find(
    (route) => String(route.id) === selectedRouteId
  );

  const destinationOptions = useMemo(() => {
    switch (destinationType) {
      case 'extension':
        return extensions.map((ext) => ({
          value: ext.id,
          label: `Ext ${ext.number} ${ext.display_name ? `(${ext.display_name})` : ''}`.trim(),
        }));
      case 'queue':
        return queues.map((queue) => ({
          value: queue.id,
          label: queue.name,
        }));
      case 'ivr':
        return ivrs.map((ivr) => ({
          value: ivr.id,
          label: ivr.name,
        }));
      default:
        return [];
    }
  }, [destinationType, extensions, queues, ivrs]);

  const currentDestinationLabel = useMemo(() => {
    if (!selectedRoute) return '—';
    const { dest, value } = getRouteDestination(selectedRoute);
    if (!dest) return 'Not configured';

    switch (dest) {
      case 'extension': {
        const ext = extensions.find((extItem) => extItem.id === value);
        return ext
          ? `Extension ${ext.number} ${ext.display_name ? `(${ext.display_name})` : ''}`.trim()
          : `Extension ${value}`;
      }
      case 'queue': {
        const queue = queues.find((queueItem) => queueItem.id === value);
        return queue ? `Queue ${queue.name}` : `Queue ${value}`;
      }
      case 'ivr': {
        const ivr = ivrs.find((ivrItem) => ivrItem.id === value);
        return ivr ? `IVR ${ivr.name}` : `IVR ${value}`;
      }
      case 'end_call':
        return 'End Call';
      default:
        return `${dest} ${value}`.trim();
    }
  }, [selectedRoute, extensions, queues, ivrs]);

  const handleSave = async () => {
    if (!selectedRoute) {
      toast.error('Please select a route to update');
      return;
    }

    if (!destinationType) {
      toast.error('Please choose a destination type');
      return;
    }

    if (destinationType !== 'end_call' && !destinationValue) {
      toast.error('Please choose a destination');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        id: selectedRoute.id,
        def_dest: destinationType,
        def_dest_value: destinationType === 'end_call' ? '' : destinationValue,
      };

      const success = await updateInboundRoute(payload);

      if (success) {
        toast.success('Inbound route updated');
        await loadData();
      } else {
        toast.error('Failed to update inbound route');
      }
    } catch (error: any) {
      console.error('Error updating inbound route:', error);
      toast.error(error.message || 'Failed to update inbound route');
    } finally {
      setSaving(false);
    }
  };

  if (loading.routes && inboundRoutes.length === 0) {
    return (
      <Card>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Inbound Routing
        </h2>
        <Loader text="Loading inbound routes..." />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Inbound Routing
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Update inbound route destinations in real time
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadData}
          isLoading={loading.routes}
        >
          <RefreshCw size={16} className="mr-2" />
          Refresh
        </Button>
      </div>

      {inboundRoutes.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          No inbound routes found
        </p>
      ) : (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Select Route
            </label>
            <select
              value={selectedRouteId}
              onChange={(event) => setSelectedRouteId(event.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              {inboundRoutes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.name || `Route ${route.id}`}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Current Destination</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
              {currentDestinationLabel}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Destination Type
              </label>
              <select
                value={destinationType}
                onChange={(event) => {
                  setDestinationType(event.target.value);
                  setDestinationValue('');
                }}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select destination type</option>
                {DESTINATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Destination
              </label>
              {destinationType === 'end_call' ? (
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400">
                  End Call (no destination required)
                </div>
              ) : (
                <select
                  value={destinationValue}
                  onChange={(event) => setDestinationValue(event.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select destination</option>
                  {destinationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="primary"
                size="md"
                onClick={handleSave}
                isLoading={saving}
                disabled={!selectedRouteId || !destinationType}
              >
                <Save size={16} className="mr-2" />
                Update Route
              </Button>
            </motion.div>
          </div>
        </div>
      )}
    </Card>
  );
}
