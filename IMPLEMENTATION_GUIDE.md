# Implementation Guide
## Company-First Call Analytics with Convex

**Status:** 🚧 In Progress
**Last Updated:** 2026-01-02
**Branch:** `claude/company-cms-convex-inbox-wQjkf`

---

## ✅ COMPLETED WORK

### 1. Convex Database Layer
- [x] Schema designed and implemented (`convex/schema.ts`)
  - companies table with phone patterns and soft delete
  - contacts table with array of phones and company relationship
  - callRecords table with full CDR data and auto-matching
  - contactNotes table for annotations
  - syncMetadata table for tracking sync jobs
  - dailyStats table (optional materialized view)

- [x] Companies Queries & Mutations (`convex/companies.ts`)
  - listCompaniesWithStats - Aggregated call stats per company
  - getCompanyWithContacts - Company detail with linked contacts
  - getCompany - Single company fetch
  - searchCompanies - Full-text search
  - createCompany, updateCompany, deleteCompany (soft delete)

- [x] Contacts Queries & Mutations (`convex/contacts.ts`)
  - listContacts - All contacts with company enrichment
  - getContact - Single contact with company
  - searchContacts - Full-text search
  - findContactByPhone - Phone number matching
  - getContactWithCalls - Contact + call history + notes
  - createContact - Standard contact creation
  - createContactFromCall - **Inbox flow** with historical call linking
  - updateContact, deleteContact (soft delete)
  - addContactNote - Add notes to contacts

- [x] Calls Queries & Mutations (`convex/calls.ts`)
  - **listCallsForInbox** - Main inbox query with filters & pagination
  - getCallDetail - Call detail with related calls for "link all" feature
  - getRecentCalls - Dashboard widget
  - getUnmatchedCallsCount - Badge counter
  - getCallStats - Aggregated statistics
  - linkCallToContact - Manual matching
  - unlinkCallFromContact - Undo matching
  - deleteCall (soft delete)

- [x] Sync Service (`convex/sync.ts`)
  - CDR sync workflow (manual + scheduled support)
  - Idempotent inserts (no duplicates)
  - Auto-matching phone numbers to contacts
  - Sync metadata tracking
  - Error handling
  - Public mutations for frontend integration

### 2. Utilities
- [x] Date utilities (`src/utils/dateUtils.ts`)
  - getDateRangeFromPreset (today, 7d, 30d, custom)
  - formatDateRange, formatTimestamp, formatDuration
  - getRelativeTime ("2 hours ago")

- [x] Phone utilities (existing `src/utils/phoneUtils.ts`)
  - normalizePhoneNumber - Strips formatting, keeps +
  - phoneNumbersMatch - SA-aware matching (+27 vs 0)
  - formatPhoneNumber - Display formatting

- [x] Convex type definitions (`src/types/convex.ts`)
  - Re-exports of Convex generated types
  - Extended types with relationships
  - Helper interfaces for UI components

### 3. Documentation
- [x] CONVEX_ARCHITECTURE.md - Complete architecture blueprint
- [x] IMPLEMENTATION_GUIDE.md - This file

---

## 🚧 IN PROGRESS / TODO

### 4. Convex Setup & Integration

**Before starting, you need to deploy Convex:**

```bash
# 1. Initialize Convex (creates .env.local with VITE_CONVEX_URL)
npx convex dev

# 2. Push schema to Convex cloud
npx convex deploy

# 3. Generate TypeScript types
# (happens automatically with `convex dev`)
```

**Then integrate into React app:**

```typescript
// src/main.tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <App />
    </ConvexProvider>
  </React.StrictMode>
);
```

### 5. UI Components (Pending)

**Priority 1: Calls Inbox**
- [ ] `src/components/cms/CallsInbox.tsx`
  - Date range picker
  - Filters: call type, disposition, recording, match status, extension
  - Search bar
  - Call table with pagination
  - Actions: Create Contact button for unmatched calls
  - Real-time updates (Convex subscriptions)

**Priority 2: Call Detail Drawer**
- [ ] `src/components/cms/CallDetailDrawer.tsx`
  - Call metadata display
  - Recording playback (audio player)
  - Linked contact/company cards
  - Notes section
  - **Create Contact button** (if unmatched)
  - "Link all historical calls" checkbox

**Priority 3: Create Contact Modal (from Inbox)**
- [ ] `src/components/cms/CreateContactFromCallModal.tsx`
  - Pre-filled phone number
  - Name input (suggest "Unknown - 082...")
  - Company selector (dropdown)
  - Email input (optional)
  - **"Link all historical calls from this number"** checkbox
  - Submit → creates contact + links calls

**Priority 4: Company-First CMS Home**
- [ ] `src/components/cms/CompaniesHome.tsx`
  - Replace current CMS landing page
  - Grid/list of companies
  - Each card shows:
    - Company name
    - Last sync timestamp
    - Total calls (date range)
    - Inbound/outbound split
    - Answered vs missed
    - Actions: View Company, Sync Now
  - Date range picker (sticky header)

**Priority 5: Company Overview Page**
- [ ] `src/components/cms/CompanyOverview.tsx`
  - Company header with edit button
  - Aggregated stats (time-filtered)
  - List of linked contacts with mini stats
  - Click contact → opens Visual Contact view

**Priority 6: Time-Based Reporting Components**
- [ ] `src/components/cms/DateRangePicker.tsx`
  - Today, 7d, 30d, Custom buttons
  - Date picker modal for custom range
  - Display active range
- [ ] Update existing components to use date ranges

### 6. CDR Sync Integration (Pending)

**Frontend Sync Service:**
- [ ] `src/services/cdrSync.ts`
  - fetchAndSyncCDRs() - Calls Yeastar API, then Convex mutations
  - Uses existing `src/services/api.ts` for Yeastar API
  - Calls Convex mutations to insert CDRs
  - Progress tracking
  - Error handling

**Workflow:**
1. User clicks "Sync Now" or cron triggers
2. Call Convex mutation `triggerManualSync` → get syncId + startTime
3. Fetch CDRs from Yeastar API (existing `api.ts`)
4. Normalize phone numbers
5. Call Convex mutation `processCDRBatchFromAPI` with CDRs
6. Repeat for all pages/batches
7. Call Convex mutation `completeSync` with stats

**Optional: Scheduled Sync (Convex Crons)**
- [ ] `convex/crons.ts`
  - Hourly sync (requires backend Yeastar API integration)
  - For now, manual sync is sufficient

### 7. Zustand Store Migration (Pending)

**Current Zustand store should be updated to:**
- Keep UI state (theme, current view, filters, etc.)
- Remove data state (contacts, companies, calls)
- Replace with Convex queries (useQuery, useMutation)

**Example migration:**
```typescript
// OLD (Zustand)
const { contacts } = useStore();

// NEW (Convex)
const contacts = useQuery(api.contacts.listContacts);
```

### 8. Testing & Validation (Pending)

- [ ] Test CDR sync end-to-end
- [ ] Test auto-matching phone numbers
- [ ] Test "Create Contact from Call" flow
- [ ] Test "Link all historical calls" feature
- [ ] Test company stats aggregation
- [ ] Test date range filtering
- [ ] Test search and filters in inbox
- [ ] Verify no duplicate CDRs after multiple syncs
- [ ] Test soft delete functionality

---

## 📋 DEPLOYMENT CHECKLIST

### Before Deployment

1. **Convex Setup:**
   - [ ] Create Convex account (convex.dev)
   - [ ] Run `npx convex dev` and deploy schema
   - [ ] Save VITE_CONVEX_URL in `.env.local`
   - [ ] Set up Convex environment variables (Yeastar credentials if using crons)

2. **Environment Variables:**
   ```bash
   # .env.local
   VITE_CONVEX_URL=https://your-deployment.convex.cloud
   ```

3. **Build & Test:**
   ```bash
   npm run build
   npm run preview
   ```

4. **Convex Deployment:**
   ```bash
   npx convex deploy --prod
   ```

5. **Git Commit:**
   ```bash
   git add .
   git commit -m "Add Convex integration + company-first CMS + Calls Inbox"
   git push -u origin claude/company-cms-convex-inbox-wQjkf
   ```

---

## 🎯 CURRENT PRIORITIES

### Immediate Next Steps (In Order)

1. **Set up Convex deployment**
   - Run `npx convex dev`
   - Verify schema pushes successfully
   - Test basic queries in Convex dashboard

2. **Integrate ConvexProvider**
   - Update `src/main.tsx`
   - Add ConvexReactClient
   - Verify connection works

3. **Build Calls Inbox UI**
   - Create CallsInbox component
   - Implement filters and search
   - Add pagination
   - Connect to Convex queries

4. **Build Call Detail Drawer**
   - Call metadata display
   - Create Contact button
   - Link all historical calls feature

5. **Build Create Contact Modal**
   - Pre-fill phone from call
   - Company selector
   - Historical call linking

6. **Build Company-First CMS Home**
   - Replace current CMS home
   - Company list with stats
   - Date range filtering

7. **Build CDR Sync Service**
   - Integrate with Yeastar API
   - Call Convex mutations
   - Progress tracking

---

## 📚 REFERENCE

### Key Files

**Convex Backend:**
- `convex/schema.ts` - Database schema
- `convex/companies.ts` - Company queries/mutations
- `convex/contacts.ts` - Contact queries/mutations
- `convex/calls.ts` - Call queries/mutations
- `convex/sync.ts` - Sync service

**Frontend Services:**
- `src/services/api.ts` - Yeastar API integration (existing)
- `src/services/cdrSync.ts` - CDR sync orchestration (TODO)

**Utilities:**
- `src/utils/dateUtils.ts` - Date range helpers
- `src/utils/phoneUtils.ts` - Phone normalization

**Types:**
- `src/types/index.ts` - Existing types
- `src/types/convex.ts` - Convex-specific types
- `convex/_generated/dataModel.ts` - Auto-generated Convex types

**UI Components (To Build):**
- `src/components/cms/CallsInbox.tsx`
- `src/components/cms/CallDetailDrawer.tsx`
- `src/components/cms/CreateContactFromCallModal.tsx`
- `src/components/cms/CompaniesHome.tsx`
- `src/components/cms/CompanyOverview.tsx`
- `src/components/cms/DateRangePicker.tsx`

### Convex Queries Usage in React

```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// Query example
const companies = useQuery(api.companies.listCompaniesWithStats, {
  dateRange: { start: Date.now() - 30*24*60*60*1000, end: Date.now() }
});

// Mutation example
const createContact = useMutation(api.contacts.createContactFromCall);

const handleCreate = async () => {
  await createContact({
    callId,
    name: "John Doe",
    phoneNumber: "+27821234567",
    linkAllHistoricalCalls: true
  });
};
```

---

## 🔧 TROUBLESHOOTING

### Common Issues

1. **"convex/_generated not found"**
   - Run `npx convex dev` to generate types
   - Make sure Convex is running

2. **"Phone numbers not matching"**
   - Check normalizePhoneNumber function
   - Ensure +27 vs 0 handling works
   - Test with phoneNumbersMatch utility

3. **"Duplicate CDRs"**
   - Check cdrId uniqueness
   - Verify idempotent insert logic in processCDRBatch

4. **"Stats not updating"**
   - Verify date range is correct
   - Check Convex indexes are being used
   - Ensure soft-deleted records are filtered

---

## 📞 SUPPORT

**Documentation:**
- CONVEX_ARCHITECTURE.md - Full architecture details
- This file - Implementation guide

**Convex Docs:**
- https://docs.convex.dev/
- https://docs.convex.dev/client/react

**Questions?**
Review the architecture blueprint first, then check Convex docs.

---

**Ready to continue! 🚀**
