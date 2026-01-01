# Mini CMS Implementation Plan

## Overview
Add a Contact Management System (CMS) to the Cairo Yeastar Dashboard with:
- Address book (import from Yeastar phonebook)
- Company → Contact hierarchy
- Call analytics per company/contact
- Daily/Weekly/Monthly comparison charts
- Click2Call integration

## Architecture Decisions
- **Storage**: JSON file backend on Express server (`data/cms.json`)
- **Initial Data**: Auto-import from Yeastar phonebook API
- **Companies**: Auto-suggest from phone patterns + manual override
- **Charts**: Add Recharts library for visualizations

---

## Phase 1: Backend Foundation

### 1.1 Create CMS Handler
**New file**: `api/cmsHandler.js`
- JSON file read/write utilities with atomic writes
- CRUD operations for companies and contacts
- Yeastar phonebook sync logic
- Analytics aggregation helpers

### 1.2 Create Data Directory & Schema
**New file**: `data/cms.json`
```json
{
  "companies": [],
  "contacts": [],
  "notes": [],
  "syncState": { "lastYeastarSync": null }
}
```

### 1.3 Add CMS Routes to Server
**Modify**: `server.js`
```javascript
// Add these routes:
// Companies: GET/POST/PUT/DELETE /api/cms/companies
// Contacts: GET/POST/PUT/DELETE /api/cms/contacts
// Notes: GET/POST/DELETE /api/cms/contacts/:id/notes
// Sync: POST /api/cms/sync/yeastar
```

---

## Phase 2: TypeScript Types & Store

### 2.1 CMS Type Definitions
**New file**: `src/types/cms.ts`
- `Company`: id, name, phonePatterns[], createdAt, updatedAt
- `Contact`: id, firstName, lastName, phones[], companyId, source (yeastar|manual)
- `ContactNote`: id, contactId, content, createdAt
- `CallAnalyticsData`: period, totalCalls, inbound, outbound, missed, dailyBreakdown[]

### 2.2 CMS Store
**New file**: `src/store/useCmsStore.ts`
- Companies state + CRUD actions
- Contacts state with filtering (by company, search)
- Contact notes state
- Sync state (lastSync, inProgress, errors)
- Modal UI state

### 2.3 Update Main Store
**Modify**: `src/store/useStore.ts`
- Add `currentView: 'dashboard' | 'cms'`
- Add `callerExtension: string | null` for Click2Call

---

## Phase 3: CMS API Service

### 3.1 CMS API Client
**New file**: `src/services/cmsApi.ts`
- `fetchCompanies()`, `createCompany()`, `updateCompany()`, `deleteCompany()`
- `fetchContacts()`, `createContact()`, `updateContact()`, `deleteContact()`
- `fetchContactNotes()`, `createContactNote()`
- `syncFromYeastar()`
- `click2Call(callerExtension, destinationNumber)`

---

## Phase 4: Utility Functions

### 4.1 Phone Number Utilities
**New file**: `src/utils/phoneUtils.ts`
- `normalizePhoneNumber()` - strip formatting, handle SA country codes
- `phoneNumbersMatch()` - compare two numbers accounting for formats
- `findContactsByPhone()` - match CDR to contacts
- `getCompanyPhoneNumbers()` - get all numbers for a company

### 4.2 Analytics Aggregation
**New file**: `src/services/analyticsService.ts`
- `aggregateContactCalls()` - match CDR by contact phone numbers
- `aggregateCompanyCalls()` - aggregate all contact calls for company
- `aggregateByPeriod()` - daily/weekly/monthly breakdowns

---

## Phase 5: Core Components

### 5.1 Navigation & Layout
**Modify**: `src/App.tsx`
- Add view toggle tabs (Dashboard | Contacts CMS)
- Conditionally render `<DashboardView />` or `<CMSLayout />`

**New file**: `src/components/cms/CMSLayout.tsx`
- Tab navigation: Companies | Contacts | Analytics
- Render active tab content

### 5.2 Companies Components
**New files in**: `src/components/cms/companies/`
- `CompaniesList.tsx` - paginated list with search, create button
- `CompanyCard.tsx` - summary card with contact count, call stats
- `CompanyDetail.tsx` - full view with contacts list, analytics
- `CompanyForm.tsx` - create/edit modal with phone patterns

### 5.3 Contacts Components
**New files in**: `src/components/cms/contacts/`
- `ContactsList.tsx` - paginated list with company filter, search
- `ContactCard.tsx` - summary with Click2Call buttons
- `ContactDetail.tsx` - full view with notes, call history
- `ContactForm.tsx` - create/edit modal with multiple phones
- `ContactNotes.tsx` - notes list with add form

### 5.4 Shared Components
**New files in**: `src/components/cms/shared/`
- `CompanySelector.tsx` - dropdown with auto-suggest
- `Click2CallButton.tsx` - initiates call via Yeastar API
- `PhoneNumberInput.tsx` - formatted phone input
- `AnalyticsCard.tsx` - reusable stats display

---

## Phase 6: Analytics & Charts

### 6.1 Install Recharts
```bash
npm install recharts
```

### 6.2 Chart Components
**New files in**: `src/components/cms/analytics/`
- `AnalyticsDashboard.tsx` - overview with period selector
- `CallActivityChart.tsx` - line/bar chart for call trends
- `ComparisonChart.tsx` - month vs month comparison
- `ContactAnalytics.tsx` - per-contact stats panel
- `CompanyAnalytics.tsx` - per-company stats panel

---

## Phase 7: Yeastar Integration

### 7.1 Phonebook Sync
**In** `api/cmsHandler.js`:
- Call Yeastar `GET /phonebook/list`
- For each phonebook, call `GET /phonebook/get?id={id}`
- Also fetch `GET /company_contact/list`
- Merge into local contacts, preserve manual assignments

### 7.2 Sync UI
**New file**: `src/components/cms/sync/YeastarSyncPanel.tsx`
- Show last sync time
- Sync button with progress indicator
- Show imported/updated counts

### 7.3 Click2Call
**Uses Yeastar API**: `POST /call/dial`
```json
{ "caller": "1001", "callee": "+27821234567" }
```

---

## Phase 8: Additional Features

### 8.1 Call History Per Contact
Show recent calls involving contact's phone numbers in `ContactDetail.tsx`

### 8.2 Quick Contact Search
Floating search on dashboard for quick lookup + Click2Call

### 8.3 Company Auto-Assignment
When creating contacts, suggest company based on phone number patterns

### 8.4 Extension Selector in Header
**Modify**: `src/components/dashboard/Header.tsx`
- Add dropdown to select "Click2Call from extension"
- Store in `callerExtension` state

---

## Files to Create

| File | Purpose |
|------|---------|
| `data/cms.json` | JSON data storage |
| `api/cmsHandler.js` | Backend CMS logic |
| `src/types/cms.ts` | TypeScript interfaces |
| `src/store/useCmsStore.ts` | Zustand store for CMS |
| `src/services/cmsApi.ts` | API client for CMS |
| `src/services/analyticsService.ts` | Call analytics aggregation |
| `src/utils/phoneUtils.ts` | Phone number utilities |
| `src/components/cms/CMSLayout.tsx` | Main CMS container |
| `src/components/cms/companies/CompaniesList.tsx` | Company list view |
| `src/components/cms/companies/CompanyCard.tsx` | Company card |
| `src/components/cms/companies/CompanyDetail.tsx` | Company detail view |
| `src/components/cms/companies/CompanyForm.tsx` | Company form modal |
| `src/components/cms/contacts/ContactsList.tsx` | Contact list view |
| `src/components/cms/contacts/ContactCard.tsx` | Contact card |
| `src/components/cms/contacts/ContactDetail.tsx` | Contact detail view |
| `src/components/cms/contacts/ContactForm.tsx` | Contact form modal |
| `src/components/cms/contacts/ContactNotes.tsx` | Notes component |
| `src/components/cms/analytics/AnalyticsDashboard.tsx` | Analytics overview |
| `src/components/cms/analytics/CallActivityChart.tsx` | Recharts line/bar |
| `src/components/cms/shared/Click2CallButton.tsx` | Click-to-call button |
| `src/components/cms/shared/CompanySelector.tsx` | Company dropdown |
| `src/components/cms/sync/YeastarSyncPanel.tsx` | Sync controls |

## Files to Modify

| File | Changes |
|------|---------|
| `server.js` | Add CMS routes |
| `src/App.tsx` | Add view toggle, import CMSLayout |
| `src/store/useStore.ts` | Add currentView, callerExtension |
| `src/types/index.ts` | Export CMS types |
| `src/components/dashboard/Header.tsx` | Add extension selector |
| `package.json` | Add recharts dependency |

---

## Implementation Order

1. **Backend first**: data/cms.json, api/cmsHandler.js, server.js routes
2. **Types & Store**: cms.ts types, useCmsStore.ts, update useStore.ts
3. **API client**: cmsApi.ts, phoneUtils.ts
4. **Navigation**: Modify App.tsx for view toggle
5. **Companies**: CompaniesList, CompanyCard, CompanyForm, CompanyDetail
6. **Contacts**: ContactsList, ContactCard, ContactForm, ContactDetail
7. **Analytics**: Install recharts, create chart components
8. **Sync**: YeastarSyncPanel, test full import
9. **Click2Call**: Click2CallButton, Header extension selector
10. **Polish**: ContactNotes, quick search, auto-assignment

---

## Data Schemas

### Company
```typescript
interface Company {
  id: string;
  name: string;
  phonePatterns: string[];  // e.g. ["+2711", "011"] for matching
  createdAt: string;
  updatedAt: string;
}
```

### Contact
```typescript
interface Contact {
  id: string;
  yeastarContactId?: string;  // Link to Yeastar if imported
  companyId?: string;
  firstName: string;
  lastName: string;
  company?: string;           // Display name
  email?: string;
  phones: ContactPhone[];
  source: 'yeastar' | 'manual';
  createdAt: string;
  updatedAt: string;
}

interface ContactPhone {
  type: 'business' | 'mobile' | 'home' | 'fax';
  number: string;
}
```

### Contact Note
```typescript
interface ContactNote {
  id: string;
  contactId: string;
  content: string;
  createdAt: string;
  createdBy?: string;  // extension number
}
```

### Call Analytics
```typescript
interface CallAnalyticsData {
  period: { label: string; startDate: string; endDate: string };
  totalCalls: number;
  inboundCalls: number;
  outboundCalls: number;
  missedCalls: number;
  answeredCalls: number;
  totalDuration: number;
  averageDuration: number;
  dailyBreakdown: DailyCallData[];
}

interface DailyCallData {
  date: string;
  inbound: number;
  outbound: number;
  missed: number;
  duration: number;
}
```

---

## Yeastar API Endpoints Used

### Existing (already implemented)
- `POST /get_token` - Authentication
- `GET /extension/list` - Extensions
- `GET /cdr/list` - Call detail records
- `GET /call_report/list` - Call statistics

### New (to implement for CMS)
- `GET /phonebook/list` - List phonebooks
- `GET /phonebook/get?id={id}` - Get phonebook contacts
- `GET /company_contact/list` - List company contacts
- `POST /call/dial` - Click2Call

---

## Usage Instructions

To implement this plan in a new chat:
1. Reference this file: `cairo/CMS_IMPLEMENTATION_PLAN.md`
2. Start with Phase 1 (Backend Foundation)
3. Test each phase before moving to the next
4. The implementation order at the bottom provides the recommended sequence
