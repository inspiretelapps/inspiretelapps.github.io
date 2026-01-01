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
  Contact,
  Company,
  ContactNote,
  AppView,
  CMSSyncState,
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

  // CMS State
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  callerExtension: string | null;
  setCallerExtension: (ext: string | null) => void;

  // CMS Data
  contacts: Contact[];
  companies: Company[];
  contactNotes: ContactNote[];
  cmsSyncState: CMSSyncState;

  setContacts: (contacts: Contact[]) => void;
  addContact: (contact: Contact) => void;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;

  setCompanies: (companies: Company[]) => void;
  addCompany: (company: Company) => void;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  deleteCompany: (id: string) => void;

  setContactNotes: (notes: ContactNote[]) => void;
  addContactNote: (note: ContactNote) => void;
  deleteContactNote: (id: string) => void;

  setCmsSyncState: (state: Partial<CMSSyncState>) => void;

  // CMS Loading states
  cmsLoading: {
    contacts: boolean;
    companies: boolean;
    sync: boolean;
  };
  setCmsLoading: (key: keyof AppState['cmsLoading'], value: boolean) => void;
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

  // CMS State
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),
  callerExtension: null,
  setCallerExtension: (ext) => set({ callerExtension: ext }),

  // CMS Data
  contacts: [],
  companies: [],
  contactNotes: [],
  cmsSyncState: {
    lastYeastarSync: null,
    inProgress: false,
  },

  setContacts: (contacts) => set({ contacts }),
  addContact: (contact) =>
    set((state) => ({ contacts: [...state.contacts, contact] })),
  updateContact: (id, updates) =>
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
      ),
    })),
  deleteContact: (id) =>
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== id),
    })),

  setCompanies: (companies) => set({ companies }),
  addCompany: (company) =>
    set((state) => ({ companies: [...state.companies, company] })),
  updateCompany: (id, updates) =>
    set((state) => ({
      companies: state.companies.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
      ),
    })),
  deleteCompany: (id) =>
    set((state) => ({
      companies: state.companies.filter((c) => c.id !== id),
    })),

  setContactNotes: (notes) => set({ contactNotes: notes }),
  addContactNote: (note) =>
    set((state) => ({ contactNotes: [...state.contactNotes, note] })),
  deleteContactNote: (id) =>
    set((state) => ({
      contactNotes: state.contactNotes.filter((n) => n.id !== id),
    })),

  setCmsSyncState: (syncState) =>
    set((state) => ({
      cmsSyncState: { ...state.cmsSyncState, ...syncState },
    })),

  // CMS Loading states
  cmsLoading: {
    contacts: false,
    companies: false,
    sync: false,
  },
  setCmsLoading: (key, value) =>
    set((state) => ({
      cmsLoading: { ...state.cmsLoading, [key]: value },
    })),
}));
