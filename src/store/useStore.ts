import { create } from 'zustand';
import type {
  Extension,
  IVR,
  Queue,
  CallStats,
  CallRecord,
  InboundRoute,
  Theme,
  YeastarConfig,
} from '@/types';

interface AppState {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;

  // Authentication
  isAuthenticated: boolean;
  config: YeastarConfig | null;
  setConfig: (config: YeastarConfig) => void;
  setAuthenticated: (value: boolean) => void;
  logout: () => void;

  // Data
  extensions: Extension[];
  ivrs: IVR[];
  queues: Queue[];
  callStats: CallStats[];
  recentCalls: CallRecord[];
  inboundRoutes: InboundRoute[];

  setExtensions: (extensions: Extension[]) => void;
  setIVRs: (ivrs: IVR[]) => void;
  setQueues: (queues: Queue[]) => void;
  setCallStats: (stats: CallStats[]) => void;
  setRecentCalls: (calls: CallRecord[]) => void;
  setInboundRoutes: (routes: InboundRoute[]) => void;

  // Loading states
  loading: {
    stats: boolean;
    calls: boolean;
    routes: boolean;
  };
  setLoading: (key: keyof AppState['loading'], value: boolean) => void;
}

const getStoredTheme = (): Theme => {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;

  // Check system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

export const useStore = create<AppState>((set) => ({
  // Theme
  theme: getStoredTheme(),
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },
  toggleTheme: () =>
    set((state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
      return { theme: newTheme };
    }),

  // Authentication
  isAuthenticated: false,
  config: null,
  setConfig: (config) => {
    // Only store safe config (no secrets)
    const safeConfig = {
      proxyUrl: config.proxyUrl,
      pbxHost: config.pbxHost,
      clientId: config.clientId,
    };
    localStorage.setItem('yeastarConfig', JSON.stringify(safeConfig));
    set({ config });
  },
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  logout: () => {
    sessionStorage.removeItem('yeastar_accessToken');
    set({ isAuthenticated: false });
  },

  // Data
  extensions: [],
  ivrs: [],
  queues: [],
  callStats: [],
  recentCalls: [],
  inboundRoutes: [],

  setExtensions: (extensions) => set({ extensions }),
  setIVRs: (ivrs) => set({ ivrs }),
  setQueues: (queues) => set({ queues }),
  setCallStats: (callStats) => set({ callStats }),
  setRecentCalls: (recentCalls) => set({ recentCalls }),
  setInboundRoutes: (inboundRoutes) => set({ inboundRoutes }),

  // Loading states
  loading: {
    stats: false,
    calls: false,
    routes: false,
  },
  setLoading: (key, value) =>
    set((state) => ({
      loading: { ...state.loading, [key]: value },
    })),
}));
