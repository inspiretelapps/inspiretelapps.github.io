import { Doc, Id } from "../../convex/_generated/dataModel";

/**
 * Convex Type Definitions
 *
 * Re-export Convex generated types and add helper types
 */

// Re-export Convex generated types
export type Company = Doc<"companies">;
export type Contact = Doc<"contacts">;
export type CallRecord = Doc<"callRecords">;
export type ContactNote = Doc<"contactNotes">;
export type SyncMetadata = Doc<"syncMetadata">;
export type DailyStats = Doc<"dailyStats">;

// IDs
export type CompanyId = Id<"companies">;
export type ContactId = Id<"contacts">;
export type CallRecordId = Id<"callRecords">;
export type ContactNoteId = Id<"contactNotes">;
export type SyncMetadataId = Id<"syncMetadata">;

// Enums (extract from schema)
export type ContactPhoneType = "mobile" | "work" | "home" | "other";
export type ContactSource = "yeastar" | "manual" | "call_inbox";
export type SyncStatus = "synced" | "pending" | "error";
export type CallType = "Inbound" | "Outbound" | "Internal";
export type MatchMethod = "auto" | "manual" | "created";
export type SyncType = "cdr" | "contacts" | "extensions";
export type SyncStatusType = "running" | "completed" | "failed" | "partial";
export type TriggeredBy = "scheduled" | "manual" | "webhook";

// Extended types with relationships
export interface ContactWithCompany extends Contact {
  company?: Company | null;
}

export interface CallRecordWithRelations extends CallRecord {
  contact?: Contact | null;
  company?: Company | null;
}

export interface CompanyWithStats extends Company {
  stats: {
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    answeredCalls: number;
    missedCalls: number;
    totalDuration: number;
    avgDuration: number;
  };
  lastSyncAt?: number;
}

export interface ContactWithStats extends Contact {
  stats: {
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    lastCallAt?: number;
    totalDuration: number;
  };
}

export interface CallDetailData {
  call: CallRecord;
  contact: Contact | null;
  company: Company | null;
  relatedCalls: CallRecord[];
  notes: ContactNote[];
}

export interface CallsInboxData {
  calls: CallRecordWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CompanyDetailData {
  company: Company;
  contacts: ContactWithStats[];
  stats: {
    totalCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    answeredCalls: number;
    missedCalls: number;
    totalDuration: number;
  };
}

// Date Range
export interface DateRange {
  start: number;
  end: number;
}

export type DateRangePreset = "today" | "7d" | "30d" | "custom";

// Filters for Calls Inbox
export interface CallsInboxFilters {
  dateRange: DateRange;
  callType?: CallType;
  disposition?: string;
  hasRecording?: boolean;
  matchStatus?: "matched" | "unmatched";
  extensionId?: string;
}

// Phone number with isPrimary flag
export interface ContactPhone {
  number: string;
  type: ContactPhoneType;
  isPrimary: boolean;
}

// CDR from Yeastar API (before Convex insert)
export interface YeastarCDR {
  id: string;
  callFrom: string;
  callTo: string;
  callType: CallType;
  disposition: string;
  startTime: number;
  answerTime?: number;
  endTime: number;
  duration: number;
  talkDuration: number;
  extensionId?: string;
  extensionName?: string;
  recordingUrl?: string;
  queueId?: string;
  ivrPath?: string;
}

// Sync result
export interface SyncResult {
  syncId: Id<"syncMetadata">;
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
}

// Call stats
export interface CallStats {
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  internalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  withRecording: number;
  totalDuration: number;
  avgDuration: number;
  uniqueNumbers: number;
}
