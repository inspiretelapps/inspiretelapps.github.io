import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { useStore } from '@/store/useStore';
import { LoginForm } from '@/components/auth/LoginForm';
import { Header } from '@/components/dashboard/Header';
import { TodayStats } from '@/components/dashboard/TodayStats';
import { RecentCalls } from '@/components/dashboard/RecentCalls';
import { QuickRouteOverride } from '@/components/dashboard/QuickRouteOverride';
import { motion } from 'framer-motion';

function App() {
  const { isAuthenticated, theme } = useStore();

  useEffect(() => {
    // Set initial theme
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Stats Section */}
          <TodayStats />

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentCalls />
            <QuickRouteOverride />
          </div>
        </motion.div>
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
