import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useStore } from '@/store/useStore';
import { LoginForm } from '@/components/auth/LoginForm';
import { Header } from '@/components/dashboard/Header';
import { TodayStats } from '@/components/dashboard/TodayStats';
import { RecentCalls } from '@/components/dashboard/RecentCalls';
import { LiveDashboardWidgets } from '@/components/dashboard/LiveDashboardWidgets';
import { QuickActionsBar } from '@/components/dashboard/QuickActionsBar';
import { ExtensionStatusDashboard } from '@/components/dashboard/ExtensionStatus';
import { QueueMonitor } from '@/components/dashboard/QueueMonitor';
import { ActiveCallControls } from '@/components/dashboard/ActiveCallControls';
import { InboundRoutingManager } from '@/components/dashboard/InboundRoutingManager';
import { SimplifiedAnalytics } from '@/components/dashboard/SimplifiedAnalytics';
import { CMSLayout } from '@/components/cms/CMSLayout';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, BarChart3 } from 'lucide-react';
import { ReportingLayout } from '@/components/reporting/ReportingLayout';

function App() {
  const { isAuthenticated, theme, currentView, setCurrentView } = useStore();

  useEffect(() => {
    // Set initial theme
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const handleRefreshExtensions = () => {
    // Components already auto-refresh every 5 seconds
    // Just show the toast notification
    return Promise.resolve();
  };

  const handleRefreshQueues = () => {
    // Components already auto-refresh every 3-5 seconds
    // Just show the toast notification
    return Promise.resolve();
  };

  const handleRefreshCalls = () => {
    // Components already auto-refresh every 5 seconds
    // Just show the toast notification
    return Promise.resolve();
  };

  const handleRefreshAll = () => {
    // All components already auto-refresh
    // Just show the toast notification
    return Promise.resolve();
  };

  if (!isAuthenticated) {
    return (
      <>
        <LoginForm />
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'dark:bg-gray-800 dark:text-white',
            duration: 4000,
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-200">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* View Toggle */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${currentView === 'dashboard'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }
            `}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>
          <button
            onClick={() => setCurrentView('cms')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${currentView === 'cms'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }
            `}
          >
            <Users className="w-4 h-4" />
            Contacts CMS
          </button>
          <button
            onClick={() => setCurrentView('reporting')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
              ${currentView === 'reporting'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }
            `}
          >
            <BarChart3 className="w-4 h-4" />
            Reporting
          </button>
        </div>

        {currentView === 'dashboard' ? (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* Quick Actions Bar */}
            <QuickActionsBar
              onRefreshExtensions={handleRefreshExtensions}
              onRefreshQueues={handleRefreshQueues}
              onRefreshCalls={handleRefreshCalls}
              onRefreshAll={handleRefreshAll}
            />

            {/* Live Dashboard Widgets */}
            <LiveDashboardWidgets />

            {/* Stats Section */}
            <TodayStats />

            {/* Analytics */}
            <SimplifiedAnalytics />

            {/* Two Column Layout - Extension Status & Queue Monitor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ExtensionStatusDashboard />
              <QueueMonitor />
            </div>

            {/* Active Call Controls */}
            <ActiveCallControls />

            {/* Inbound Routing */}
            <InboundRoutingManager />

            {/* Recent Calls */}
            <RecentCalls />
          </motion.div>
        ) : currentView === 'cms' ? (
          <motion.div
            key="cms"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <CMSLayout />
          </motion.div>
        ) : (
          <motion.div
            key="reporting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <ReportingLayout />
          </motion.div>
        )}
      </main>

      <Toaster
        position="top-right"
        toastOptions={{
          className: 'dark:bg-gray-800 dark:text-white',
          duration: 4000,
        }}
      />
    </div>
  );
}

export default App;
