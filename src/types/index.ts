// API Configuration
export interface YeastarConfig {
  proxyUrl: string;
  pbxHost: string;
  clientId: string;
  // Note: clientSecret should NOT be stored on client side in production
}

// Extension Types
export interface Extension {
  id: string;
  number: string;
  display_name?: string;
  username?: string;
  ext_name?: string;
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

// Quick Button Configuration
export interface QuickButtonConfig {
  button1: ButtonConfig;
  button2: ButtonConfig;
}

export interface ButtonConfig {
  label: string;
  dest: string;
  destValue: string;
}

// Theme
export type Theme = 'light' | 'dark';
