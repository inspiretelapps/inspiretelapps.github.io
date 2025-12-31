import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { getAccessToken, setApiConfig } from '@/services/api';
import { useStore } from '@/store/useStore';
import { isValidPbxHost } from '@/utils/security';
import toast from 'react-hot-toast';
import { Shield } from 'lucide-react';

export function LoginForm() {
  const { setConfig, setAuthenticated } = useStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    proxyUrl: '',
    pbxHost: '',
    clientId: '',
    clientSecret: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load saved config (excluding secret)
  useState(() => {
    const saved = localStorage.getItem('yeastarConfig');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFormData((prev) => ({
          ...prev,
          proxyUrl: parsed.proxyUrl || '',
          pbxHost: parsed.pbxHost || '',
          clientId: parsed.clientId || '',
        }));
      } catch (e) {
        console.error('Failed to load saved config');
      }
    }
  });

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
      const token = await getAccessToken(
        formData.pbxHost,
        formData.clientId,
        formData.clientSecret,
        formData.proxyUrl
      );

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
      toast.error(error.message || 'Failed to connect to PBX');
    } finally {
      setLoading(false);
    }
  };

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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={loading}
            >
              Connect & Fetch Data
            </Button>

            <div className="text-xs text-gray-500 dark:text-gray-400 mt-4 space-y-2">
              <p className="font-semibold">Important:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Whitelist your proxy IP in PBX API settings</li>
                <li>Enable API access in Advanced → API Settings</li>
                <li>Use API username/password (not admin credentials)</li>
                <li>Check browser console (F12) for detailed errors</li>
              </ul>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
