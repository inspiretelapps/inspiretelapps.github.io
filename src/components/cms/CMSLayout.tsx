import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@/store/useStore';
import {
  Users,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { ContactsList } from './contacts/ContactsList';
import { CompaniesList } from './companies/CompaniesList';
import { fetchCompanyContacts } from '@/services/api';
import { yeastarContactToContact } from '@/utils/phoneUtils';
import toast from 'react-hot-toast';

type CMSTab = 'contacts' | 'companies';

export function CMSLayout() {
  const [activeTab, setActiveTab] = useState<CMSTab>('contacts');
  const {
    contacts,
    setContacts,
    setCmsLoading,
    cmsLoading,
    cmsSyncState,
    setCmsSyncState,
  } = useStore();

  const handleSyncFromYeastar = async () => {
    setCmsLoading('sync', true);
    setCmsSyncState({ inProgress: true, error: undefined });

    try {
      const result = await fetchCompanyContacts();

      if (result.data.length > 0) {
        // Convert Yeastar contacts to our format
        const newContacts = result.data.map(yeastarContactToContact);

        // Merge with existing contacts, preserving manual contacts
        const manualContacts = contacts.filter((c) => c.source === 'manual');

        // Combine Yeastar contacts with manual contacts
        const mergedContacts = [
          ...newContacts,
          ...manualContacts,
        ];

        setContacts(mergedContacts);
        setCmsSyncState({
          lastYeastarSync: new Date().toISOString(),
          inProgress: false,
        });

        toast.success(`Synced ${result.data.length} contacts from Yeastar`);
      } else {
        toast.success('No contacts found in Yeastar');
        setCmsSyncState({
          lastYeastarSync: new Date().toISOString(),
          inProgress: false,
        });
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      setCmsSyncState({
        inProgress: false,
        error: error.message || 'Failed to sync',
      });
      toast.error(error.message || 'Failed to sync contacts from Yeastar');
    } finally {
      setCmsLoading('sync', false);
    }
  };

  // Auto-sync on mount if never synced
  useEffect(() => {
    if (!cmsSyncState.lastYeastarSync && contacts.length === 0) {
      handleSyncFromYeastar();
    }
  }, []);

  const tabs = [
    { id: 'contacts' as CMSTab, label: 'Contacts', icon: Users, count: contacts.length },
    { id: 'companies' as CMSTab, label: 'Companies', icon: Building2, count: useStore.getState().companies.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Sync */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Contact Management
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {cmsSyncState.lastYeastarSync
              ? `Last synced: ${new Date(cmsSyncState.lastYeastarSync).toLocaleString()}`
              : 'Not synced yet'}
          </p>
        </div>

        <button
          onClick={handleSyncFromYeastar}
          disabled={cmsLoading.sync}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${cmsLoading.sync ? 'animate-spin' : ''}`} />
          {cmsLoading.sync ? 'Syncing...' : 'Sync from Yeastar'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4" aria-label="CMS Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`
                      px-2 py-0.5 text-xs rounded-full
                      ${isActive
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }
                    `}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {activeTab === 'contacts' && <ContactsList />}
        {activeTab === 'companies' && <CompaniesList />}
      </motion.div>
    </div>
  );
}
