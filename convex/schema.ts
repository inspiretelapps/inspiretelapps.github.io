import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex Schema for Company-First Call Analytics + CRM
 *
 * Tables:
 * - companies: Organization/business entities
 * - contacts: Individuals linked to companies
 * - callRecords: CDR data from Yeastar PBX
 * - contactNotes: Notes on contacts/calls
 * - syncMetadata: Sync job tracking
 */

export default defineSchema({
  // ============================================================================
  // COMPANIES TABLE
  // ============================================================================
  companies: defineTable({
    name: v.string(),
    phonePatterns: v.array(v.string()),          // e.g., ["+2711", "+2721"]
    website: v.optional(v.string()),
    notes: v.optional(v.string()),

    // Metadata
    createdAt: v.number(),                       // Unix timestamp (ms)
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),           // Extension number

    // Soft delete
    deleted: v.optional(v.boolean()),
  })
    .index("by_name", ["name"])
    .index("by_created", ["createdAt"])
    .index("active_companies", ["deleted", "name"])
    .searchIndex("search_companies", {
      searchField: "name",
      filterFields: ["deleted"],
    }),

  // ============================================================================
  // CONTACTS TABLE
  // ============================================================================
  contacts: defineTable({
    // Basic Info
    name: v.string(),
    companyId: v.optional(v.id("companies")),    // FK to companies
    email: v.optional(v.string()),

    // Phone Numbers (array of objects)
    phones: v.array(
      v.object({
        number: v.string(),                       // Normalized: +27XXXXXXXXX
        type: v.union(
          v.literal("mobile"),
          v.literal("work"),
          v.literal("home"),
          v.literal("other")
        ),
        isPrimary: v.boolean(),
      })
    ),

    // Yeastar Integration
    yeastarContactId: v.optional(v.number()),     // Two-way sync
    source: v.union(
      v.literal("yeastar"),
      v.literal("manual"),
      v.literal("call_inbox")
    ),
    syncStatus: v.optional(
      v.union(
        v.literal("synced"),
        v.literal("pending"),
        v.literal("error")
      )
    ),

    // Metadata
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    createdBy: v.optional(v.string()),

    // Soft delete
    deleted: v.optional(v.boolean()),
  })
    .index("by_company", ["companyId", "createdAt"])
    .index("by_name", ["name"])
    .index("by_yeastar", ["yeastarContactId"])
    .index("active_contacts", ["deleted", "companyId"])
    .searchIndex("search_contacts", {
      searchField: "name",
      filterFields: ["companyId", "deleted"],
    }),

  // ============================================================================
  // CALL RECORDS TABLE
  // ============================================================================
  callRecords: defineTable({
    // Yeastar CDR Fields
    cdrId: v.string(),                            // Unique CDR ID from Yeastar
    callFrom: v.string(),                         // Caller number (normalized)
    callTo: v.string(),                           // Callee number (normalized)

    // Call Metadata
    callType: v.union(
      v.literal("Inbound"),
      v.literal("Outbound"),
      v.literal("Internal")
    ),
    disposition: v.string(),                      // ANSWERED, NO ANSWER, BUSY, etc.

    // Timing
    startTime: v.number(),                        // Unix timestamp (ms)
    answerTime: v.optional(v.number()),
    endTime: v.number(),
    duration: v.number(),                         // Total seconds
    talkDuration: v.number(),                     // Talk time in seconds

    // Extension Info
    extensionId: v.optional(v.string()),
    extensionName: v.optional(v.string()),

    // Recording
    recordingUrl: v.optional(v.string()),
    hasRecording: v.boolean(),

    // Contact Linking
    contactId: v.optional(v.id("contacts")),      // FK to contacts
    companyId: v.optional(v.id("companies")),     // FK to companies
    matchedAt: v.optional(v.number()),            // When contact was linked
    matchMethod: v.optional(
      v.union(
        v.literal("auto"),                        // Phone number match
        v.literal("manual"),                      // User linked
        v.literal("created")                      // Created from inbox
      )
    ),

    // Queue/IVR Context
    queueId: v.optional(v.string()),
    ivrPath: v.optional(v.string()),

    // Sync Metadata
    syncedAt: v.number(),                         // When imported to Convex
    syncBatchId: v.optional(v.string()),          // For tracking sync batches

    // Soft delete
    deleted: v.optional(v.boolean()),
  })
    .index("by_cdr_id", ["cdrId"])                // Unique constraint simulation
    .index("by_start_time", ["startTime"])
    .index("by_contact", ["contactId", "startTime"])
    .index("by_company", ["companyId", "startTime"])
    .index("by_extension", ["extensionId", "startTime"])
    .index("unmatched_calls", ["contactId", "startTime"])  // For inbox filtering
    .index("by_call_from", ["callFrom", "startTime"])
    .index("by_call_to", ["callTo", "startTime"])
    .index("by_type_and_time", ["callType", "startTime"])
    .index("by_disposition", ["disposition", "startTime"]),

  // ============================================================================
  // CONTACT NOTES TABLE
  // ============================================================================
  contactNotes: defineTable({
    contactId: v.id("contacts"),                  // FK to contacts
    content: v.string(),

    // Metadata
    createdAt: v.number(),
    createdBy: v.optional(v.string()),            // Extension number

    // Optional call context
    callRecordId: v.optional(v.id("callRecords")),

    // Soft delete
    deleted: v.optional(v.boolean()),
  })
    .index("by_contact", ["contactId", "createdAt"])
    .index("by_call", ["callRecordId"]),

  // ============================================================================
  // SYNC METADATA TABLE
  // ============================================================================
  syncMetadata: defineTable({
    // Sync Config
    tenantId: v.string(),                         // Yeastar tenant/PBX identifier
    syncType: v.union(
      v.literal("cdr"),
      v.literal("contacts"),
      v.literal("extensions")
    ),

    // Sync Status
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("partial")
    ),

    // Timing
    startedAt: v.number(),
    completedAt: v.optional(v.number()),

    // Stats
    recordsFetched: v.number(),
    recordsInserted: v.number(),
    recordsUpdated: v.number(),
    recordsSkipped: v.number(),

    // Cursor/Progress
    lastCdrId: v.optional(v.string()),            // For incremental sync
    lastTimestamp: v.optional(v.number()),

    // Error Tracking
    errorMessage: v.optional(v.string()),
    errorDetails: v.optional(v.string()),

    // Metadata
    triggeredBy: v.union(
      v.literal("scheduled"),                     // Hourly cron
      v.literal("manual"),                        // User clicked "Sync Now"
      v.literal("webhook")                        // Future: Yeastar webhook
    ),
    triggeredByUser: v.optional(v.string()),
  })
    .index("by_tenant_and_type", ["tenantId", "syncType", "startedAt"])
    .index("by_status", ["status", "startedAt"])
    .index("latest_sync", ["tenantId", "syncType", "completedAt"]),

  // ============================================================================
  // DAILY STATS TABLE (Optional - Materialized View)
  // ============================================================================
  dailyStats: defineTable({
    // Dimensions
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
    date: v.string(),                             // YYYY-MM-DD

    // Metrics
    totalCalls: v.number(),
    inboundCalls: v.number(),
    outboundCalls: v.number(),
    answeredCalls: v.number(),
    missedCalls: v.number(),
    totalDuration: v.number(),                    // Seconds
    avgDuration: v.number(),

    // Metadata
    calculatedAt: v.number(),
  })
    .index("by_company_date", ["companyId", "date"])
    .index("by_contact_date", ["contactId", "date"])
    .index("by_date", ["date"]),
});
