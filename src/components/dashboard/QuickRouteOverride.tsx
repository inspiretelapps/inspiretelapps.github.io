import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { useStore } from '@/store/useStore';
import {
  fetchInboundRoutes,
  fetchExtensions,
  fetchIVRs,
  fetchQueues,
  getInboundRoute,
  updateInboundRoute,
} from '@/services/api';
import toast from 'react-hot-toast';
import type { InboundRoute, QuickButtonConfig } from '@/types';

export function QuickRouteOverride() {
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
  const [buttonConfigs, setButtonConfigs] = useState<Map<number, QuickButtonConfig>>(
    new Map()
  );

  useEffect(() => {
    loadData();
  }, []);

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

      // Load saved button configs
      routes.forEach((route) => {
        const saved = localStorage.getItem(`quickButtons_${route.id}`);
        if (saved) {
          try {
            const config = JSON.parse(saved);
            setButtonConfigs((prev) => new Map(prev).set(route.id, config));
          } catch (e) {
            console.error('Failed to load button config for route', route.id);
          }
        }
      });
    } catch (error: any) {
      console.error('Error loading routes:', error);
      toast.error(error.message || 'Failed to load routes');
    } finally {
      setLoading('routes', false);
    }
  };

  const getCurrentDestinationName = (route: InboundRoute): string => {
    const dest = route.def_dest || route.default_destination;
    const destValue =
      route.def_dest_value ||
      route.default_destination_value ||
      route.default_desination_value;

    if (!dest) return 'No destination';

    switch (dest) {
      case 'extension': {
        const ext = extensions.find((e) => e.id === destValue);
        return ext
          ? `Extension ${ext.number} (${ext.display_name || ext.username || 'Unnamed'})`
          : `Extension ${destValue}`;
      }
      case 'ivr': {
        const ivr = ivrs.find((i) => i.id === destValue);
        return ivr ? `IVR: ${ivr.name}` : `IVR ${destValue}`;
      }
      case 'queue': {
        const queue = queues.find((q) => q.id === destValue);
        return queue ? `Queue: ${queue.name}` : `Queue ${destValue}`;
      }
      case 'end_call':
        return 'End Call';
      default:
        return `${dest} ${destValue}`;
    }
  };

  const executeQuickButton = async (routeId: number, buttonNumber: 1 | 2) => {
    const config = buttonConfigs.get(routeId);
    if (!config) {
      toast.error('Button not configured');
      return;
    }

    const buttonConfig = buttonNumber === 1 ? config.button1 : config.button2;

    try {
      const routeDetails = await getInboundRoute(routeId);
      if (!routeDetails) {
        throw new Error('Failed to fetch route details');
      }

      const payload = {
        ...routeDetails,
        id: routeId,
        def_dest: buttonConfig.dest,
        def_dest_value: buttonConfig.destValue,
      };

      const success = await updateInboundRoute(payload);

      if (success) {
        toast.success(`Route changed to: ${buttonConfig.label}`);
        loadData();
      } else {
        toast.error('Failed to update route');
      }
    } catch (error: any) {
      console.error('Quick button error:', error);
      toast.error(error.message || 'Failed to change route');
    }
  };

  const getDefaultConfig = (): QuickButtonConfig => {
    const mainExt = extensions[0];
    const mainIVR = ivrs[0];

    return {
      button1: {
        label: mainExt ? `Ext ${mainExt.number}` : 'Extension',
        dest: 'extension',
        destValue: mainExt?.id || '1',
      },
      button2: {
        label: mainIVR ? mainIVR.name : 'End Call',
        dest: mainIVR ? 'ivr' : 'end_call',
        destValue: mainIVR?.id || '',
      },
    };
  };

  const getButtonLabel = (routeId: number, buttonNumber: 1 | 2): string => {
    const config = buttonConfigs.get(routeId) || getDefaultConfig();
    return buttonNumber === 1 ? config.button1.label : config.button2.label;
  };

  if (loading.routes) {
    return (
      <Card>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Quick Route Override
        </h2>
        <Loader text="Loading routes..." />
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Quick Route Override
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
        Quickly change where calls go with preset options
      </p>

      {inboundRoutes.length > 0 ? (
        <div className="space-y-4">
          {inboundRoutes.map((route, index) => (
            <motion.div
              key={route.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg"
            >
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {route.name}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Currently: {getCurrentDestinationName(route)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    // TODO: Add configuration modal
                    toast.error('Configuration modal coming soon!');
                  }}
                >
                  <Settings2 size={16} />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => executeQuickButton(route.id, 1)}
                >
                  {getButtonLabel(route.id, 1)}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => executeQuickButton(route.id, 2)}
                >
                  {getButtonLabel(route.id, 2)}
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          No inbound routes found
        </p>
      )}
    </Card>
  );
}
