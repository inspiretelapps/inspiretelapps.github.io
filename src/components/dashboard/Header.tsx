import { motion } from 'framer-motion';
import { Moon, Sun, LogOut } from 'lucide-react';
import { useStore } from '@/store/useStore';
import { Button } from '@/components/ui/Button';
import { NotificationCenter } from '@/components/dashboard/NotificationCenter';

export function Header() {
  const { theme, toggleTheme, logout } = useStore();

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-30"
    >
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <motion.h1
          initial={{ x: -20 }}
          animate={{ x: 0 }}
          className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent"
        >
          Yeastar Dashboard
        </motion.h1>

        <div className="flex items-center gap-3">
          {/* Notification Center */}
          <NotificationCenter />

          {/* Theme Toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </motion.button>

          {/* Logout Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut size={18} />
            <span className="hidden md:inline">Logout</span>
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
