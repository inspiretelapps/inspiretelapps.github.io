// API Configuration
export interface YeastarConfig {
  proxyUrl: string;
  pbxHost: string;
  clientId: string;
  // Note: clientSecret should NOT be stored on client side in production
}

// Extension Types
export type ExtensionOnlineStatus = Record<string, { status?: number; ip?: string }>;

export interface Extension {
  id: string;
  number: string;
  display_name?: string;
  username?: string;
  ext_name?: string;
  caller_id_name?: string;
  online_status?: ExtensionOnlineStatus;
  presence_status?: { status?: number };
}

// IVR Types
export interface IVR {
  id: string;
  name: string;
}

// Queue Types
export interface Queue {
  id: string;
  name: string;
}

// Call Statistics
export interface CallStats {
  ext_name: string;
  ext_num: string;
  total_call_count?: number;
  answered_calls?: number;
  no_answer_calls?: number;
  busy_calls?: number;
  failed_calls?: number;
  voicemail_calls?: number;
  total_talking_time?: number;
}

// CDR (Call Detail Record)
export interface CallRecord {
  call_from: string;
  call_to: string;
  time: string;
  disposition: string;
  talk_duration: number;
  call_type: 'Inbound' | 'Outbound' | 'Internal';
}

// Inbound Route
export interface InboundRoute {
  id: number;
  name: string;
  pos: number;
  time_condition?: string;
  def_dest?: string;
  def_dest_value?: string;
  default_destination?: string;
  default_destination_value?: string;
  default_desination_value?: string; // API typo
  destination?: string;
  destination_value?: string;
  business_hours_destination?: string;
  business_hours_destination_value?: string;
  did_pattern_list?: Array<string | { pattern: string }>;
  did_patterns?: string | string[];
  did_list?: string[];
  patterns?: string[];
}

// API Response Types
export interface ApiResponse<T = any> {
  errcode: number;
  errmsg?: string;
  data?: T;
  access_token?: string;
}

export interface StatsApiResponse extends ApiResponse {
  ext_call_statistics_list?: CallStats[];
}

export interface RoutesApiResponse extends ApiResponse {
  data: InboundRoute[];
}

export interface CDRApiResponse extends ApiResponse {
  data: CallRecord[];
}

// Extension Status
export interface ExtensionStatus {
  ext_id: string;
  ext_num: string;
  ext_name?: string;
  display_name?: string;
  status: 'idle' | 'ringing' | 'busy' | 'unavailable';
  call_status?: 'idle' | 'ringing' | 'talking';
  presence_status?: number;
  presence_label?: string;
}

// Queue Status
export interface QueueStatus {
  queue_id: string;
  queue_name: string;
  waiting_count: number;
  active_count: number;
  agents: QueueAgent[];
}

export interface QueueAgent {
  agent_id: string;
  agent_num: string;
  agent_name: string;
  status: 'idle' | 'busy' | 'ringing' | 'unavailable';
  paused: boolean;
}

// Active Call
export interface ActiveCall {
  call_id: string;
  channel_id: string;
  call_from: string;
  call_to: string;
  status: 'ringing' | 'talking' | 'hold';
  duration: number;
  call_type: 'Inbound' | 'Outbound' | 'Internal';
}

// Route Preset
export interface RoutePreset {
  id: string;
  name: string;
  routes: RoutePresetItem[];
}

export interface RoutePresetItem {
  routeId: number;
  routeName: string;
  destination: string;
  destinationValue: string;
}

// Notification
export interface Notification {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

// Theme
export type Theme = 'light' | 'dark';

// ============================================
// CMS Types
// ============================================

// Phone number type for contacts (maps to Yeastar's fixed fields)
export type ContactPhoneType =
  | 'business'
  | 'business2'
  | 'mobile'
  | 'mobile2'
  | 'home'
  | 'home2'
  | 'business_fax'
  | 'home_fax'
  | 'other';

export interface ContactPhone {
  type: ContactPhoneType;
  number: string;
}

// Contact (CMS)
export interface Contact {
  id: string;                          // Local UUID
  yeastarContactId?: number;           // Yeastar's contact ID (for two-way sync)
  name: string;                        // Single name field (matches Yeastar contact_name)
  companyId?: string;                  // Local company grouping
  company?: string;                    // Company display name
  email?: string;
  phones: ContactPhone[];
  remark?: string;
  phonebookIds?: number[];             // Yeastar phonebook memberships
  source: 'yeastar' | 'manual';
  syncStatus?: 'synced' | 'pending' | 'error';
  createdAt: string;
  updatedAt: string;
}

// Company (CMS)
export interface Company {
  id: string;
  name: string;
  phonePatterns: string[];             // e.g. ["+2711", "011"] for matching
  createdAt: string;
  updatedAt: string;
}

// Contact Note (CMS)
export interface ContactNote {
  id: string;
  contactId: string;
  content: string;
  createdAt: string;
  createdBy?: string;                  // Extension number
}

// Yeastar API Contact (raw response format)
export interface YeastarContact {
  id: number;
  contact_name: string;
  company?: string;
  email?: string;
  business?: string;
  business2?: string;
  mobile?: string;
  mobile2?: string;
  home?: string;
  home2?: string;
  business_fax?: string;
  home_fax?: string;
  other?: string;
  remark?: string;
  phonebook_list?: Array<{ id: number; name: string }>;
}

// Yeastar Phonebook
export interface YeastarPhonebook {
  id: number;
  name: string;
  total: number;
  member_select: 'sel_all' | 'sel_specific';
}

// CMS API Responses
export interface CompanyContactsApiResponse extends ApiResponse {
  total_number?: number;
  data?: YeastarContact[];
}

export interface PhonebooksApiResponse extends ApiResponse {
  total_number?: number;
  data?: YeastarPhonebook[];
}

export interface DialCallApiResponse extends ApiResponse {
  call_id?: string;
}

// Call Analytics (for CMS)
export interface ContactCallAnalytics {
  contactId: string;
  period: { label: string; startDate: string; endDate: string };
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  answeredCalls: number;
  totalDuration: number;
  averageDuration: number;
}

export interface DailyCallData {
  date: string;
  inbound: number;
  outbound: number;
  missed: number;
  duration: number;
}

// CMS Sync State
export interface CMSSyncState {
  lastYeastarSync: string | null;
  inProgress: boolean;
  error?: string;
}

// CMS Data Storage (for JSON file)
export interface CMSData {
  companies: Company[];
  contacts: Contact[];
  notes: ContactNote[];
  syncState: CMSSyncState;
}

// View Type
export type AppView = 'dashboard' | 'cms' | 'reporting';

// Reporting Types
export interface ExtensionReportData {
  extension: Extension;
  period: { startDate: string; endDate: string };
  summary: {
    totalInboundCalls: number;
    totalOutboundCalls: number;
    totalMissedCalls: number;
    inboundMinutes: number;
    outboundMinutes: number;
    totalMinutes: number;
    answeredCalls: number;
    averageCallDuration: number;
  };
  monthlyData: MonthlyCallData[];
}

export interface MonthlyCallData {
  month: string; // "Jan 2025", "Feb 2025", etc.
  monthKey: string; // "2025-01", "2025-02", etc.
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  inboundMinutes: number;
  outboundMinutes: number;
  totalMinutes: number;
}
