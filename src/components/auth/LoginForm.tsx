import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { getAccessToken, setApiConfig, testProxyConnection } from '@/services/api';
import { useStore } from '@/store/useStore';
import { isValidPbxHost } from '@/utils/security';
import toast from 'react-hot-toast';
import { Shield, ChevronDown, Plus, Trash2, Save } from 'lucide-react';
import type { SavedLine } from '@/types';

const SAVED_LINES_KEY = 'yeastarSavedLines';

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function loadSavedLines(): SavedLine[] {
  try {
    const saved = localStorage.getItem(SAVED_LINES_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load saved lines');
  }
  return [];
}

function saveLinestoStorage(lines: SavedLine[]): void {
  localStorage.setItem(SAVED_LINES_KEY, JSON.stringify(lines));
}

export function LoginForm() {
  const { setConfig, setAuthenticated } = useStore();
  const [loading, setLoading] = useState(false);
  const [savedLines, setSavedLines] = useState<SavedLine[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [formData, setFormData] = useState({
    proxyUrl: '',
    pbxHost: '',
    clientId: '',
    clientSecret: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load saved lines on mount
  useEffect(() => {
    const lines = loadSavedLines();
    setSavedLines(lines);

    // If there are saved lines, select the first one by default
    if (lines.length > 0) {
      selectLine(lines[0]);
    } else {
      // Try to load from old yeastarConfig for backward compatibility
      const oldConfig = localStorage.getItem('yeastarConfig');
      if (oldConfig) {
        try {
          const parsed = JSON.parse(oldConfig);
          setFormData((prev) => ({
            ...prev,
            proxyUrl: parsed.proxyUrl || '',
            pbxHost: parsed.pbxHost || '',
            clientId: parsed.clientId || '',
          }));
        } catch (e) {
          console.error('Failed to load old config');
        }
      }
    }
  }, []);

  const selectLine = (line: SavedLine) => {
    setSelectedLineId(line.id);
    setFormData({
      proxyUrl: line.proxyUrl,
      pbxHost: line.pbxHost,
      clientId: line.clientId,
      clientSecret: '',
    });
    setShowDropdown(false);
  };

  const handleSaveLine = () => {
    if (!newLineName.trim()) {
      toast.error('Please enter a name for this line');
      return;
    }
    if (!formData.proxyUrl || !formData.pbxHost || !formData.clientId) {
      toast.error('Please fill in Proxy URL, PBX Host, and Client ID before saving');
      return;
    }

    const newLine: SavedLine = {
      id: generateId(),
      name: newLineName.trim(),
      proxyUrl: formData.proxyUrl,
      pbxHost: formData.pbxHost,
      clientId: formData.clientId,
    };

    const updatedLines = [...savedLines, newLine];
    setSavedLines(updatedLines);
    saveLinestoStorage(updatedLines);
    setSelectedLineId(newLine.id);
    setNewLineName('');
    setShowSaveDialog(false);
    toast.success(`Line "${newLine.name}" saved!`);
  };

  const handleDeleteLine = (lineId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const lineToDelete = savedLines.find((l) => l.id === lineId);
    const updatedLines = savedLines.filter((l) => l.id !== lineId);
    setSavedLines(updatedLines);
    saveLinestoStorage(updatedLines);

    if (selectedLineId === lineId) {
      setSelectedLineId(null);
      if (updatedLines.length > 0) {
        selectLine(updatedLines[0]);
      } else {
        setFormData({
          proxyUrl: '',
          pbxHost: '',
          clientId: '',
          clientSecret: '',
        });
      }
    }
    toast.success(`Line "${lineToDelete?.name}" deleted`);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.proxyUrl.trim()) {
      newErrors.proxyUrl = 'Proxy URL is required';
    } else if (!formData.proxyUrl.startsWith('http')) {
      newErrors.proxyUrl = 'Proxy URL must start with http:// or https://';
    }

    if (!formData.pbxHost.trim()) {
      newErrors.pbxHost = 'PBX Host is required';
    } else if (!isValidPbxHost(formData.pbxHost)) {
      newErrors.pbxHost = 'Invalid PBX Host format';
    }

    if (!formData.clientId.trim()) {
      newErrors.clientId = 'Client ID is required';
    }

    if (!formData.clientSecret.trim()) {
      newErrors.clientSecret = 'Client Secret is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please fill in all fields correctly');
      return;
    }

    setLoading(true);

    try {
      // First, test proxy connection
      console.log('Step 1: Testing proxy connection...');
      toast.loading('Testing proxy connection...', { id: 'proxy-test' });

      const proxyOk = await testProxyConnection(formData.proxyUrl);

      if (!proxyOk) {
        toast.dismiss('proxy-test');
        throw new Error(
          `Cannot reach proxy at ${formData.proxyUrl}\n\n` +
          'Please check:\n' +
          '1. Proxy URL is correct (e.g., https://your-proxy.vercel.app)\n' +
          '2. Proxy server is deployed and running\n' +
          '3. No typos in the URL'
        );
      }

      toast.dismiss('proxy-test');
      console.log('Step 2: Authenticating with PBX...');
      toast.loading('Authenticating with PBX...', { id: 'auth' });

      const token = await getAccessToken(
        formData.pbxHost,
        formData.clientId,
        formData.clientSecret,
        formData.proxyUrl
      );

      toast.dismiss('auth');

      setApiConfig({
        pbxHost: formData.pbxHost,
        proxyUrl: formData.proxyUrl,
        accessToken: token,
      });

      setConfig({
        proxyUrl: formData.proxyUrl,
        pbxHost: formData.pbxHost,
        clientId: formData.clientId,
      });

      setAuthenticated(true);
      toast.success('Successfully connected to PBX!');
    } catch (error: any) {
      console.error('Connection error:', error);
      toast.dismiss();

      // Show multi-line error message
      const errorLines = error.message.split('\n');
      toast.error(
        errorLines[0] + (errorLines.length > 1 ? '\n(See console for details)' : ''),
        { duration: 6000 }
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedLine = savedLines.find((l) => l.id === selectedLineId);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card>
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-block p-4 bg-primary-100 dark:bg-primary-900 rounded-full mb-4"
            >
              <Shield size={48} className="text-primary-600 dark:text-primary-400" />
            </motion.div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Yeastar Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Connect to your PBX to get started
            </p>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            {/* Saved Lines Dropdown */}
            {savedLines.length > 0 && (
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Select Saved Line
                </label>
                <button
                  type="button"
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-left text-gray-900 dark:text-white hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <span>
                    {selectedLine ? selectedLine.name : 'Select a line...'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                  >
                    {savedLines.map((line) => (
                      <div
                        key={line.id}
                        className={`flex items-center justify-between px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${
                          selectedLineId === line.id ? 'bg-primary-50 dark:bg-primary-900/30' : ''
                        }`}
                        onClick={() => selectLine(line)}
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-gray-900 dark:text-white font-medium block truncate">
                            {line.name}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 text-xs block truncate">
                            {line.pbxHost}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteLine(line.id, e)}
                          className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </motion.div>
                )}
              </div>
            )}

            {/* Manual Entry Fields (shown when no saved line selected or for editing) */}
            <div className={savedLines.length > 0 && selectedLine ? 'hidden' : ''}>
              <Input
                label="Proxy URL"
                type="text"
                placeholder="https://your-proxy.vercel.app"
                value={formData.proxyUrl}
                onChange={(e) =>
                  setFormData({ ...formData, proxyUrl: e.target.value })
                }
                error={errors.proxyUrl}
              />
            </div>

            <div className={savedLines.length > 0 && selectedLine ? 'hidden' : ''}>
              <Input
                label="PBX Host URL"
                type="text"
                placeholder="pbx.yeastarcloud.com or https://your-pbx.com"
                value={formData.pbxHost}
                onChange={(e) =>
                  setFormData({ ...formData, pbxHost: e.target.value })
                }
                error={errors.pbxHost}
              />
            </div>

            <div className={savedLines.length > 0 && selectedLine ? 'hidden' : ''}>
              <Input
                label="Client ID"
                type="text"
                placeholder="Your Client ID"
                value={formData.clientId}
                onChange={(e) =>
                  setFormData({ ...formData, clientId: e.target.value })
                }
                error={errors.clientId}
              />
            </div>

            {/* Always show Client Secret */}
            <Input
              label="Client Secret"
              type="password"
              placeholder="Your Client Secret"
              value={formData.clientSecret}
              onChange={(e) =>
                setFormData({ ...formData, clientSecret: e.target.value })
              }
              error={errors.clientSecret}
            />

            {/* Save Line Button (only show when entering new details) */}
            {!selectedLine && formData.proxyUrl && formData.pbxHost && formData.clientId && (
              <div>
                {showSaveDialog ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Line name (e.g., Main Office)"
                      value={newLineName}
                      onChange={(e) => setNewLineName(e.target.value)}
                      className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleSaveLine}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowSaveDialog(false);
                        setNewLineName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </motion.div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSaveDialog(true)}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Save as new line
                  </Button>
                )}
              </div>
            )}

            {/* Add new line button when a line is selected */}
            {selectedLine && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedLineId(null);
                  setFormData({
                    proxyUrl: '',
                    pbxHost: '',
                    clientId: '',
                    clientSecret: '',
                  });
                }}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add new line
              </Button>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={loading}
            >
              Connect & Fetch Data
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
