# Convex Architecture Blueprint
## Company-First Call Analytics + CRM System

**Author:** Senior Full-Stack Engineer
**Date:** 2026-01-02
**Branch:** `claude/company-cms-convex-inbox-wQjkf`

---

## 🎯 TRANSFORMATION GOALS

Transform the existing dashboard + mini CMS into a **company-first call analytics + lightweight CRM** system with:
- **Persistent database** (Convex)
- **Company-centric** information architecture
- **Fast operational workflow** for unmatched calls
- **Time-based reporting** (today, 7d, 30d, custom)
- **Automated CDR sync** from Yeastar PBX

---

## 📊 CONVEX SCHEMA DESIGN

### **1. Companies Table**

```typescript
// convex/schema.ts
export const companies = defineTable({
  name: v.string(),
  phonePatterns: v.array(v.string()),        // e.g., ["+2711", "+2721"]
  website: v.optional(v.string()),
  notes: v.optional(v.string()),

  // Metadata
  createdAt: v.number(),                     // timestamp
  updatedAt: v.number(),
  createdBy: v.optional(v.string()),         // extension number

  // Soft delete
  deleted: v.optional(v.boolean()),
})
.index("by_name", ["name"])
.index("by_created", ["createdAt"])
.index("active_companies", ["deleted", "name"]);
```

**Key Features:**
- Phone patterns for automatic call matching
- Soft delete support
- Indexed by name for fast lookup

---

### **2. Contacts Table**

```typescript
export const contacts = defineTable({
  // Basic Info
  name: v.string(),
  companyId: v.optional(v.id("companies")),  // FK to companies
  email: v.optional(v.string()),

  // Phone Numbers (array of objects)
  phones: v.array(v.object({
    number: v.string(),                       // Normalized: +27XXXXXXXXX
    type: v.union(
      v.literal("mobile"),
      v.literal("work"),
      v.literal("home"),
      v.literal("other")
    ),
    isPrimary: v.boolean(),
  })),

  // Yeastar Integration
  yeastarContactId: v.optional(v.number()),   // Two-way sync
  source: v.union(
    v.literal("yeastar"),
    v.literal("manual"),
    v.literal("call_inbox")
  ),
  syncStatus: v.optional(v.union(
    v.literal("synced"),
    v.literal("pending"),
    v.literal("error")
  )),

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
// Phone number search requires custom query (array field)
.searchIndex("search_contacts", {
  searchField: "name",
  filterFields: ["companyId", "deleted"]
});
```

**Key Features:**
- Multiple phone numbers per contact
- Company relationship (optional)
- Yeastar two-way sync tracking
- Search by name
- Source tracking (where contact came from)

---

### **3. Call Records Table**

```typescript
export const callRecords = defineTable({
  // Yeastar CDR Fields
  cdrId: v.string(),                          // Unique CDR ID from Yeastar
  callFrom: v.string(),                       // Caller number
  callTo: v.string(),                         // Callee number

  // Call Metadata
  callType: v.union(
    v.literal("Inbound"),
    v.literal("Outbound"),
    v.literal("Internal")
  ),
  disposition: v.string(),                    // ANSWERED, NO ANSWER, etc.

  // Timing
  startTime: v.number(),                      // Unix timestamp
  answerTime: v.optional(v.number()),
  endTime: v.number(),
  duration: v.number(),                       // Total seconds
  talkDuration: v.number(),                   // Talk time in seconds

  // Extension Info
  extensionId: v.optional(v.string()),
  extensionName: v.optional(v.string()),

  // Recording
  recordingUrl: v.optional(v.string()),
  hasRecording: v.boolean(),

  // Contact Linking
  contactId: v.optional(v.id("contacts")),    // FK to contacts
  companyId: v.optional(v.id("companies")),   // FK to companies
  matchedAt: v.optional(v.number()),          // When contact was linked
  matchMethod: v.optional(v.union(
    v.literal("auto"),                        // Phone number match
    v.literal("manual"),                      // User linked
    v.literal("created")                      // Created from inbox
  )),

  // Queue/IVR Context
  queueId: v.optional(v.string()),
  ivrPath: v.optional(v.string()),

  // Sync Metadata
  syncedAt: v.number(),                       // When imported to Convex
  syncBatchId: v.optional(v.string()),        // For tracking sync batches

  // Soft delete
  deleted: v.optional(v.boolean()),
})
.index("by_cdr_id", ["cdrId"])                // Unique constraint simulation
.index("by_start_time", ["startTime"])
.index("by_contact", ["contactId", "startTime"])
.index("by_company", ["companyId", "startTime"])
.index("by_extension", ["extensionId", "startTime"])
.index("unmatched_calls", ["contactId", "startTime"])  // Where contactId is undefined
.index("by_number", ["callFrom", "startTime"])
.index("by_type_and_time", ["callType", "startTime"])
.index("by_disposition", ["disposition", "startTime"]);
```

**Key Features:**
- Complete CDR data from Yeastar
- Contact/company relationships
- Match tracking (auto vs manual)
- Recording support
- Unmatched calls index for inbox
- Time-based queries optimized

---

### **4. Contact Notes Table**

```typescript
export const contactNotes = defineTable({
  contactId: v.id("contacts"),                // FK to contacts
  content: v.string(),

  // Metadata
  createdAt: v.number(),
  createdBy: v.optional(v.string()),          // Extension number

  // Optional call context
  callRecordId: v.optional(v.id("callRecords")),

  // Soft delete
  deleted: v.optional(v.boolean()),
})
.index("by_contact", ["contactId", "createdAt"])
.index("by_call", ["callRecordId"]);
```

---

### **5. Sync Metadata Table**

```typescript
export const syncMetadata = defineTable({
  // Sync Config
  tenantId: v.string(),                       // Yeastar tenant/PBX identifier
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
  lastCdrId: v.optional(v.string()),          // For incremental sync
  lastTimestamp: v.optional(v.number()),

  // Error Tracking
  errorMessage: v.optional(v.string()),
  errorDetails: v.optional(v.string()),

  // Metadata
  triggeredBy: v.union(
    v.literal("scheduled"),                   // Hourly cron
    v.literal("manual"),                      // User clicked "Sync Now"
    v.literal("webhook")                      // Future: Yeastar webhook
  ),
  triggeredByUser: v.optional(v.string()),
})
.index("by_tenant_and_type", ["tenantId", "syncType", "startedAt"])
.index("by_status", ["status", "startedAt"])
.index("latest_sync", ["tenantId", "syncType", "completedAt"]);
```

**Key Features:**
- Track all sync operations
- Incremental sync cursor
- Error tracking
- Performance metrics

---

### **6. Aggregated Stats Table (Optional - Materialized View)**

```typescript
export const dailyStats = defineTable({
  // Dimensions
  companyId: v.optional(v.id("companies")),
  contactId: v.optional(v.id("contacts")),
  date: v.string(),                           // YYYY-MM-DD

  // Metrics
  totalCalls: v.number(),
  inboundCalls: v.number(),
  outboundCalls: v.number(),
  answeredCalls: v.number(),
  missedCalls: v.number(),
  totalDuration: v.number(),                  // Seconds
  avgDuration: v.number(),

  // Metadata
  calculatedAt: v.number(),
})
.index("by_company_date", ["companyId", "date"])
.index("by_contact_date", ["contactId", "date"])
.index("by_date", ["date"]);
```

**Note:** This table is **optional**. Can be computed on-demand for now, materialized later if performance requires.

---

## 🔄 SYNC FLOW ARCHITECTURE

### **Hourly Background Sync (Scheduled Function)**

```typescript
// convex/crons.ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync CDR from Yeastar",
  { minutes: 60 },  // Every hour
  internal.sync.syncYeastarCDR
);

export default crons;
```

### **Sync Implementation**

```typescript
// convex/sync.ts
import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// Step 1: Fetch CDRs from Yeastar API (runs in Node.js runtime)
export const syncYeastarCDR = internalAction(async (ctx) => {
  const config = await ctx.runQuery(internal.config.getYeastarConfig);

  // 1. Get last sync metadata
  const lastSync = await ctx.runQuery(internal.sync.getLastSync, {
    tenantId: config.tenantId,
    syncType: "cdr"
  });

  // 2. Create new sync record
  const syncId = await ctx.runMutation(internal.sync.createSyncRecord, {
    tenantId: config.tenantId,
    syncType: "cdr",
    triggeredBy: "scheduled"
  });

  try {
    // 3. Fetch CDRs from Yeastar (incremental)
    const startTime = lastSync?.lastTimestamp
      ? new Date(lastSync.lastTimestamp)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days back

    const cdrs = await fetchYeastarCDRs(config, startTime);

    // 4. Process CDRs in batches
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    const batchSize = 100;
    for (let i = 0; i < cdrs.length; i += batchSize) {
      const batch = cdrs.slice(i, i + batchSize);
      const result = await ctx.runMutation(internal.sync.processCDRBatch, {
        cdrs: batch,
        syncId
      });

      inserted += result.inserted;
      updated += result.updated;
      skipped += result.skipped;
    }

    // 5. Update sync record as completed
    await ctx.runMutation(internal.sync.completeSyncRecord, {
      syncId,
      status: "completed",
      recordsFetched: cdrs.length,
      recordsInserted: inserted,
      recordsUpdated: updated,
      recordsSkipped: skipped,
      lastTimestamp: cdrs[cdrs.length - 1]?.startTime
    });

  } catch (error) {
    // Mark sync as failed
    await ctx.runMutation(internal.sync.failSyncRecord, {
      syncId,
      errorMessage: error.message
    });
    throw error;
  }
});

// Step 2: Process CDR batch (idempotent insert)
export const processCDRBatch = internalMutation(async (ctx, { cdrs, syncId }) => {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const cdr of cdrs) {
    // Check if CDR already exists
    const existing = await ctx.db
      .query("callRecords")
      .withIndex("by_cdr_id", q => q.eq("cdrId", cdr.id))
      .first();

    if (existing) {
      skipped++;
      continue;
    }

    // Auto-match to contact by phone number
    const contact = await findContactByPhone(ctx,
      cdr.callType === "Inbound" ? cdr.callFrom : cdr.callTo
    );

    // Insert new call record
    await ctx.db.insert("callRecords", {
      cdrId: cdr.id,
      callFrom: cdr.callFrom,
      callTo: cdr.callTo,
      callType: cdr.callType,
      disposition: cdr.disposition,
      startTime: cdr.startTime,
      answerTime: cdr.answerTime,
      endTime: cdr.endTime,
      duration: cdr.duration,
      talkDuration: cdr.talkDuration,
      extensionId: cdr.extensionId,
      extensionName: cdr.extensionName,
      recordingUrl: cdr.recordingUrl,
      hasRecording: !!cdr.recordingUrl,
      contactId: contact?.contactId,
      companyId: contact?.companyId,
      matchedAt: contact ? Date.now() : undefined,
      matchMethod: contact ? "auto" : undefined,
      syncedAt: Date.now(),
      syncBatchId: syncId,
    });

    inserted++;
  }

  return { inserted, updated, skipped };
});
```

---

### **Manual "Sync Now" Flow**

```typescript
// convex/sync.ts
export const triggerManualSync = internalAction(async (ctx, {
  tenantId,
  userId
}) => {
  // Check if sync is already running
  const runningSyncs = await ctx.runQuery(internal.sync.getRunningSyncs, {
    tenantId,
    syncType: "cdr"
  });

  if (runningSyncs.length > 0) {
    throw new Error("Sync already in progress");
  }

  // Trigger sync with manual trigger
  return await ctx.scheduler.runAfter(0, internal.sync.syncYeastarCDR, {
    triggeredBy: "manual",
    triggeredByUser: userId
  });
});
```

---

## 🏗️ KEY UI COMPONENTS

### **1. Company-First CMS Home**

**Component:** `src/components/cms/CompaniesHome.tsx`

**Features:**
- Grid/list view of companies
- Each card shows:
  - Company name
  - Last sync timestamp
  - Total calls (selected date range)
  - Inbound/outbound split
  - Total duration
  - Answered vs missed
- Quick actions: View Company, Sync Now
- Date range picker (sticky header)

**Convex Query:**
```typescript
// convex/companies.ts
export const listCompaniesWithStats = query(async (ctx, {
  dateRange
}: {
  dateRange: { start: number; end: number }
}) => {
  const companies = await ctx.db
    .query("companies")
    .withIndex("active_companies", q => q.eq("deleted", undefined))
    .collect();

  // For each company, aggregate call stats
  const companiesWithStats = await Promise.all(
    companies.map(async (company) => {
      const calls = await ctx.db
        .query("callRecords")
        .withIndex("by_company", q =>
          q.eq("companyId", company._id)
        )
        .filter(q =>
          q.and(
            q.gte(q.field("startTime"), dateRange.start),
            q.lte(q.field("startTime"), dateRange.end)
          )
        )
        .collect();

      const stats = {
        totalCalls: calls.length,
        inboundCalls: calls.filter(c => c.callType === "Inbound").length,
        outboundCalls: calls.filter(c => c.callType === "Outbound").length,
        answeredCalls: calls.filter(c => c.disposition === "ANSWERED").length,
        missedCalls: calls.filter(c => c.disposition !== "ANSWERED").length,
        totalDuration: calls.reduce((sum, c) => sum + c.talkDuration, 0),
      };

      return { ...company, stats };
    })
  );

  return companiesWithStats;
});
```

---

### **2. Company Overview Page**

**Component:** `src/components/cms/CompanyOverview.tsx`

**Features:**
- Company header with edit button
- Aggregated stats (time-filtered)
- List of linked contacts with mini stats
- Click contact → opens Visual Contact view

**Convex Query:**
```typescript
// convex/companies.ts
export const getCompanyWithContacts = query(async (ctx, {
  companyId,
  dateRange
}) => {
  const company = await ctx.db.get(companyId);
  if (!company) throw new Error("Company not found");

  // Get all contacts for company
  const contacts = await ctx.db
    .query("contacts")
    .withIndex("by_company", q => q.eq("companyId", companyId))
    .collect();

  // Get call stats per contact
  const contactsWithStats = await Promise.all(
    contacts.map(async (contact) => {
      const calls = await ctx.db
        .query("callRecords")
        .withIndex("by_contact", q => q.eq("contactId", contact._id))
        .filter(q =>
          q.and(
            q.gte(q.field("startTime"), dateRange.start),
            q.lte(q.field("startTime"), dateRange.end)
          )
        )
        .collect();

      return {
        ...contact,
        stats: {
          totalCalls: calls.length,
          lastCallAt: calls[0]?.startTime
        }
      };
    })
  );

  return { company, contacts: contactsWithStats };
});
```

---

### **3. Calls Inbox**

**Component:** `src/components/cms/CallsInbox.tsx`

**Features:**
- **Filters:**
  - Date: Today, 7d, 30d, Custom
  - Direction: Inbound/Outbound
  - Status: Answered/Missed
  - Has Recording: Yes/No
  - Match Status: Has Contact / Unmatched
- **Search:**
  - Phone number
  - Contact name
  - Company name
  - Extension
- **Table Columns:**
  - Date/Time
  - Direction icon
  - From → To
  - Duration
  - Status badge
  - Contact (with link or "Create" button)
  - Actions menu
- **Pagination:** 50 per page
- **Real-time updates** via Convex subscriptions

**Convex Query:**
```typescript
// convex/calls.ts
export const listCallsForInbox = query(async (ctx, {
  filters,
  search,
  pagination
}) => {
  let query = ctx.db.query("callRecords");

  // Apply time filter (most important for performance)
  query = query
    .withIndex("by_start_time")
    .order("desc");

  let calls = await query.collect();

  // Filter in memory (Convex doesn't support complex filters on indexes)
  calls = calls.filter(call => {
    if (filters.dateRange) {
      if (call.startTime < filters.dateRange.start ||
          call.startTime > filters.dateRange.end) return false;
    }

    if (filters.callType && call.callType !== filters.callType) return false;
    if (filters.disposition && call.disposition !== filters.disposition) return false;
    if (filters.hasRecording !== undefined && call.hasRecording !== filters.hasRecording) return false;
    if (filters.matchStatus === "unmatched" && call.contactId) return false;
    if (filters.matchStatus === "matched" && !call.contactId) return false;

    return true;
  });

  // Search
  if (search) {
    calls = calls.filter(call =>
      call.callFrom.includes(search) ||
      call.callTo.includes(search) ||
      call.extensionName?.toLowerCase().includes(search.toLowerCase())
    );
  }

  // Pagination
  const total = calls.length;
  const page = pagination.page || 0;
  const limit = pagination.limit || 50;
  const paginatedCalls = calls.slice(page * limit, (page + 1) * limit);

  // Enrich with contact/company data
  const enrichedCalls = await Promise.all(
    paginatedCalls.map(async (call) => {
      const contact = call.contactId
        ? await ctx.db.get(call.contactId)
        : null;
      const company = call.companyId
        ? await ctx.db.get(call.companyId)
        : null;

      return { ...call, contact, company };
    })
  );

  return { calls: enrichedCalls, total, page, limit };
});
```

---

### **4. Call Detail View**

**Component:** `src/components/cms/CallDetailDrawer.tsx`

**Features:**
- Drawer/modal overlay
- Full call metadata display
- Recording player (if available)
- Linked contact/company cards
- Notes section (future)
- **If unmatched:**
  - Prominent "Create Contact" button
  - Pre-filled form modal
  - Option: "Link all historical calls from this number"

**Convex Query:**
```typescript
// convex/calls.ts
export const getCallDetail = query(async (ctx, { callId }) => {
  const call = await ctx.db.get(callId);
  if (!call) throw new Error("Call not found");

  const contact = call.contactId ? await ctx.db.get(call.contactId) : null;
  const company = call.companyId ? await ctx.db.get(call.companyId) : null;

  // Get other calls from same number (for "link all" feature)
  const phoneNumber = call.callType === "Inbound" ? call.callFrom : call.callTo;
  const relatedCalls = await ctx.db
    .query("callRecords")
    .withIndex("by_number", q => q.eq("callFrom", phoneNumber))
    .filter(q => q.eq(q.field("contactId"), undefined))
    .collect();

  return { call, contact, company, relatedCalls };
});
```

**Mutation: Create Contact from Call**
```typescript
// convex/contacts.ts
export const createContactFromCall = mutation(async (ctx, {
  callId,
  contactData,
  linkAllHistoricalCalls
}) => {
  const call = await ctx.db.get(callId);
  if (!call) throw new Error("Call not found");

  // Create contact
  const contactId = await ctx.db.insert("contacts", {
    name: contactData.name,
    companyId: contactData.companyId,
    phones: [{
      number: contactData.phoneNumber,
      type: "mobile",
      isPrimary: true
    }],
    source: "call_inbox",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  // Link current call
  await ctx.db.patch(callId, {
    contactId,
    companyId: contactData.companyId,
    matchedAt: Date.now(),
    matchMethod: "created"
  });

  // Link all historical calls (if requested)
  if (linkAllHistoricalCalls) {
    const phoneNumber = call.callType === "Inbound" ? call.callFrom : call.callTo;
    const unmatchedCalls = await ctx.db
      .query("callRecords")
      .withIndex("by_number", q => q.eq("callFrom", phoneNumber))
      .filter(q => q.eq(q.field("contactId"), undefined))
      .collect();

    for (const unmatchedCall of unmatchedCalls) {
      await ctx.db.patch(unmatchedCall._id, {
        contactId,
        companyId: contactData.companyId,
        matchedAt: Date.now(),
        matchMethod: "manual"
      });
    }
  }

  return contactId;
});
```

---

## 🕒 TIME-BASED REPORTING

### **Date Range State Management**

**Zustand Store:**
```typescript
// src/store/useStore.ts
interface DateRangeState {
  preset: 'today' | '7d' | '30d' | 'custom';
  start: number;  // Unix timestamp
  end: number;

  setPreset: (preset: 'today' | '7d' | '30d') => void;
  setCustomRange: (start: Date, end: Date) => void;
}
```

**Utility Functions:**
```typescript
// src/utils/dateUtils.ts
export const getDateRangeFromPreset = (preset: string) => {
  const now = new Date();
  const endOfToday = new Date(now.setHours(23, 59, 59, 999));

  switch (preset) {
    case 'today':
      const startOfToday = new Date(now.setHours(0, 0, 0, 0));
      return { start: startOfToday.getTime(), end: endOfToday.getTime() };

    case '7d':
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start: sevenDaysAgo.getTime(), end: endOfToday.getTime() };

    case '30d':
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start: thirtyDaysAgo.getTime(), end: endOfToday.getTime() };

    default:
      return { start: now.getTime(), end: endOfToday.getTime() };
  }
};
```

**UI Component:**
```tsx
// src/components/cms/DateRangePicker.tsx
export const DateRangePicker = () => {
  const { preset, setPreset, setCustomRange } = useStore();

  return (
    <div className="flex gap-2">
      <button onClick={() => setPreset('today')}>Today</button>
      <button onClick={() => setPreset('7d')}>Last 7 Days</button>
      <button onClick={() => setPreset('30d')}>Last 30 Days</button>
      <button onClick={() => {/* open date picker */}}>Custom</button>
    </div>
  );
};
```

---

## 🔌 YEASTAR API INTEGRATION

### **CDR Fetch Service**

```typescript
// src/services/yeastar/cdrSync.ts
export async function fetchYeastarCDRs(
  config: YeastarConfig,
  startTime: Date,
  endTime: Date = new Date()
) {
  const token = await getAccessToken(config);

  const response = await fetch('/api/proxy/cdr/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      page: 1,
      page_size: 1000,  // Max allowed
    })
  });

  const data = await response.json();

  return data.data.records.map(transformCDRToCallRecord);
}

function transformCDRToCallRecord(cdr: YeastarCDR): CallRecord {
  return {
    cdrId: cdr.id,
    callFrom: normalizePhoneNumber(cdr.call_from),
    callTo: normalizePhoneNumber(cdr.call_to),
    callType: cdr.call_type,
    disposition: cdr.disposition,
    startTime: new Date(cdr.time).getTime(),
    answerTime: cdr.answer_time ? new Date(cdr.answer_time).getTime() : undefined,
    endTime: new Date(cdr.end_time).getTime(),
    duration: cdr.duration,
    talkDuration: cdr.talk_duration,
    extensionId: cdr.ext_id,
    extensionName: cdr.ext_name,
    recordingUrl: cdr.recording_url,
    hasRecording: !!cdr.recording_url,
  };
}
```

---

## 📱 DATA RELATIONSHIPS

```
┌─────────────┐
│  Companies  │
└──────┬──────┘
       │ 1:N
       │
       ▼
┌─────────────┐       ┌──────────────┐
│  Contacts   │◄──────│ ContactNotes │
└──────┬──────┘  1:N  └──────────────┘
       │ 1:N
       │
       ▼
┌─────────────┐
│ CallRecords │
└─────────────┘
       ▲
       │
┌──────┴────────┐
│ SyncMetadata  │
└───────────────┘
```

**Key Relationships:**
1. **Company → Contacts:** One-to-many (optional)
2. **Contact → CallRecords:** One-to-many (optional, can be unmatched)
3. **Contact → ContactNotes:** One-to-many
4. **CallRecord → ContactNote:** One-to-one (optional)

---

## 🚀 MIGRATION STRATEGY

### **Phase 1: Convex Setup**
1. Install Convex: `npm install convex`
2. Initialize: `npx convex dev`
3. Create schema in `convex/schema.ts`
4. Deploy: `npx convex deploy`

### **Phase 2: Data Layer**
1. Implement Convex queries (read operations)
2. Implement Convex mutations (write operations)
3. Implement sync actions (CDR import)
4. Set up cron jobs for hourly sync

### **Phase 3: UI Migration**
1. Replace Zustand queries with Convex `useQuery`
2. Replace Zustand mutations with Convex `useMutation`
3. Keep Zustand for UI state (theme, filters, etc.)
4. Add ConvexProvider to App.tsx

### **Phase 4: New Features**
1. Build Calls Inbox component
2. Build Call Detail View
3. Build Company Overview page
4. Refactor CMS home to company-first
5. Add time-based reporting

### **Phase 5: Testing & Deployment**
1. Test sync flow end-to-end
2. Test contact creation from inbox
3. Test company stats aggregation
4. Deploy to production

---

## ✅ SUCCESS CRITERIA

- [x] Convex schema deployed and tested
- [ ] Hourly CDR sync running automatically
- [ ] Company-first CMS home displaying aggregated stats
- [ ] Calls Inbox with all filters working
- [ ] Create contact from unmatched call flow working
- [ ] Time-based reporting (today, 7d, 30d, custom) functional
- [ ] Manual "Sync Now" working without duplicates
- [ ] Call recordings playing in Call Detail View
- [ ] Phone number normalization working correctly
- [ ] Zero duplicate CDRs in database

---

## 🎯 PERFORMANCE TARGETS

- **CMS Home Load:** < 500ms
- **Calls Inbox Load:** < 1s (50 records)
- **Company Overview:** < 800ms
- **CDR Sync (1000 records):** < 10s
- **Contact Creation:** < 200ms
- **Search Response:** < 300ms

---

## 📦 PACKAGE DEPENDENCIES

**New Dependencies to Add:**
```json
{
  "convex": "^1.16.0",
  "date-fns": "^3.0.0"  // For date range utilities
}
```

**No Need For:**
- ❌ Recharts (not part of this phase)
- ❌ @tanstack/react-query (Convex handles caching)
- ❌ axios (using fetch)

---

## 🔐 SECURITY CONSIDERATIONS

1. **API Keys:** Store Yeastar credentials in Convex environment variables
2. **Phone Numbers:** Normalize and validate before storage
3. **XSS Protection:** Already using DOMPurify
4. **Rate Limiting:** Already implemented in proxy
5. **Auth:** Future consideration (Convex Auth integration)

---

## 📝 NEXT STEPS

1. ✅ Review and approve this architecture
2. Install Convex and initialize project
3. Create schema definitions
4. Implement sync service
5. Build UI components
6. Test end-to-end
7. Deploy to production

---

**Ready to implement! 🚀**
