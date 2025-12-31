import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Play, Trash2, Plus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Loader } from '@/components/ui/Loader';
import { useStore } from '@/store/useStore';
import {
  fetchInboundRoutes,
  fetchExtensions,
  fetchIVRs,
  fetchQueues,
  updateInboundRoute,
} from '@/services/api';
import type { RoutePreset, RoutePresetItem } from '@/types';
import toast from 'react-hot-toast';

export function RouteSwitchingPresets() {
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

  const [presets, setPresets] = useState<RoutePreset[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [selectedRoutes, setSelectedRoutes] = useState<RoutePresetItem[]>([]);

  useEffect(() => {
    loadData();
    loadPresetsFromStorage();
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
    } catch (error: any) {
      console.error('Error loading routes:', error);
      toast.error(error.message || 'Failed to load routes');
    } finally {
      setLoading('routes', false);
    }
  };

  const loadPresetsFromStorage = () => {
    const saved = localStorage.getItem('routePresets');
    if (saved) {
      try {
        setPresets(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load presets');
      }
    }
  };

  const savePresetsToStorage = (newPresets: RoutePreset[]) => {
    localStorage.setItem('routePresets', JSON.stringify(newPresets));
    setPresets(newPresets);
  };

  const createPreset = () => {
    if (!newPresetName.trim()) {
      toast.error('Please enter a preset name');
      return;
    }

    if (selectedRoutes.length === 0) {
      toast.error('Please select at least one route configuration');
      return;
    }

    const newPreset: RoutePreset = {
      id: Date.now().toString(),
      name: newPresetName,
      routes: selectedRoutes,
    };

    const updatedPresets = [...presets, newPreset];
    savePresetsToStorage(updatedPresets);
    toast.success('Preset created successfully');
    setShowCreateModal(false);
    setNewPresetName('');
    setSelectedRoutes([]);
  };

  const deletePreset = (presetId: string) => {
    if (!confirm('Delete this preset?')) return;

    const updatedPresets = presets.filter((p) => p.id !== presetId);
    savePresetsToStorage(updatedPresets);
    toast.success('Preset deleted');
  };

  const applyPreset = async (preset: RoutePreset) => {
    if (!confirm(`Apply preset "${preset.name}"? This will update ${preset.routes.length} route(s).`)) {
      return;
    }

    try {
      let successCount = 0;

      for (const routeItem of preset.routes) {
        const payload = {
          id: routeItem.routeId,
          def_dest: routeItem.destination,
          def_dest_value: routeItem.destinationValue,
        };

        const success = await updateInboundRoute(payload);
        if (success) {
          successCount++;
        }
      }

      if (successCount === preset.routes.length) {
        toast.success(`Preset "${preset.name}" applied successfully`);
      } else {
        toast.error(`Applied ${successCount}/${preset.routes.length} routes`);
      }

      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to apply preset');
    }
  };

  const captureCurrentConfiguration = () => {
    const currentConfig: RoutePresetItem[] = inboundRoutes.map((route) => ({
      routeId: route.id,
      routeName: route.name,
      destination: route.def_dest || route.default_destination || '',
      destinationValue:
        route.def_dest_value ||
        route.default_destination_value ||
        route.default_desination_value ||
        '',
    }));

    setSelectedRoutes(currentConfig);
  };

  const getDestinationName = (dest: string, destValue: string): string => {
    switch (dest) {
      case 'extension': {
        const ext = extensions.find((e) => e.id === destValue);
        return ext
          ? `Ext ${ext.number} (${ext.display_name || ext.username || 'Unnamed'})`
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

  if (loading.routes) {
    return (
      <Card>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
          Route Switching Presets
        </h2>
        <Loader text="Loading routes..." />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Route Switching Presets
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Save and quickly apply routing configurations
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              captureCurrentConfiguration();
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} className="mr-1" />
            Create Preset
          </Button>
        </div>

        {presets.length > 0 ? (
          <div className="space-y-3">
            {presets.map((preset, index) => (
              <motion.div
                key={preset.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg text-gray-900 dark:text-white">
                      {preset.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {preset.routes.length} route(s) configured
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => applyPreset(preset)}
                    >
                      <Play size={16} className="mr-1" />
                      Apply
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => deletePreset(preset.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  {preset.routes.map((routeItem) => (
                    <div
                      key={routeItem.routeId}
                      className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded"
                    >
                      <span className="font-medium">{routeItem.routeName}:</span>{' '}
                      {getDestinationName(routeItem.destination, routeItem.destinationValue)}
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No presets saved yet
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create a preset to save your current routing configuration for quick switching
            </p>
          </div>
        )}
      </Card>

      {/* Create Preset Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setNewPresetName('');
          setSelectedRoutes([]);
        }}
        title="Create Route Preset"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preset Name
            </label>
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="e.g., Business Hours, After Hours, Weekend"
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Routes to Save ({selectedRoutes.length})
            </label>
            <div className="max-h-64 overflow-y-auto space-y-2 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
              {selectedRoutes.map((routeItem) => (
                <div
                  key={routeItem.routeId}
                  className="text-sm text-gray-700 dark:text-gray-300 p-2 bg-white dark:bg-gray-700 rounded"
                >
                  <span className="font-medium">{routeItem.routeName}:</span>{' '}
                  {getDestinationName(routeItem.destination, routeItem.destinationValue)}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateModal(false);
                setNewPresetName('');
                setSelectedRoutes([]);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={createPreset}>
              <Save size={16} className="mr-1" />
              Save Preset
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
