import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Contacts Queries & Mutations
 *
 * Features:
 * - List contacts with filtering
 * - Get contact detail
 * - CRUD operations for contacts
 * - Create contact from call (inbox flow)
 * - Search contacts
 * - Find contact by phone number
 */

const phoneSchema = v.object({
  number: v.string(),
  type: v.union(
    v.literal("mobile"),
    v.literal("work"),
    v.literal("home"),
    v.literal("other")
  ),
  isPrimary: v.boolean(),
});

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List all contacts with optional company filter
 */
export const listContacts = query({
  args: {
    companyId: v.optional(v.id("companies")),
  },
  handler: async (ctx, { companyId }) => {
    let query = ctx.db.query("contacts");

    if (companyId) {
      query = query.withIndex("by_company", (q) => q.eq("companyId", companyId));
    }

    const contacts = await query
      .filter((q) => q.eq(q.field("deleted"), undefined))
      .order("desc")
      .collect();

    // Enrich with company data
    const contactsWithCompany = await Promise.all(
      contacts.map(async (contact) => {
        const company = contact.companyId
          ? await ctx.db.get(contact.companyId)
          : null;

        return {
          ...contact,
          company,
        };
      })
    );

    return contactsWithCompany;
  },
});

/**
 * Get a single contact by ID
 */
export const getContact = query({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, { contactId }) => {
    const contact = await ctx.db.get(contactId);
    if (!contact) throw new Error("Contact not found");

    const company = contact.companyId
      ? await ctx.db.get(contact.companyId)
      : null;

    return {
      ...contact,
      company,
    };
  },
});

/**
 * Search contacts by name
 */
export const searchContacts = query({
  args: {
    searchTerm: v.string(),
    companyId: v.optional(v.id("companies")),
  },
  handler: async (ctx, { searchTerm, companyId }) => {
    let contacts = await ctx.db
      .query("contacts")
      .withSearchIndex("search_contacts", (q) =>
        q.search("name", searchTerm).eq("deleted", undefined)
      )
      .collect();

    // Filter by company if provided
    if (companyId) {
      contacts = contacts.filter((c) => c.companyId === companyId);
    }

    // Enrich with company data
    const contactsWithCompany = await Promise.all(
      contacts.map(async (contact) => {
        const company = contact.companyId
          ? await ctx.db.get(contact.companyId)
          : null;

        return {
          ...contact,
          company,
        };
      })
    );

    return contactsWithCompany;
  },
});

/**
 * Find contact by phone number (normalized)
 */
export const findContactByPhone = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, { phoneNumber }) => {
    // Get all contacts (we need to search in the phones array)
    const contacts = await ctx.db
      .query("contacts")
      .filter((q) => q.eq(q.field("deleted"), undefined))
      .collect();

    // Find contact with matching phone number
    const matchingContact = contacts.find((contact) =>
      contact.phones.some((phone) => phone.number === phoneNumber)
    );

    if (!matchingContact) return null;

    const company = matchingContact.companyId
      ? await ctx.db.get(matchingContact.companyId)
      : null;

    return {
      ...matchingContact,
      company,
    };
  },
});

/**
 * Get contact with call history
 */
export const getContactWithCalls = query({
  args: {
    contactId: v.id("contacts"),
    dateRange: v.object({
      start: v.number(),
      end: v.number(),
    }),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { contactId, dateRange, limit = 50 }) => {
    const contact = await ctx.db.get(contactId);
    if (!contact) throw new Error("Contact not found");

    const company = contact.companyId
      ? await ctx.db.get(contact.companyId)
      : null;

    // Get calls for contact
    const calls = await ctx.db
      .query("callRecords")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .filter((q) =>
        q.and(
          q.gte(q.field("startTime"), dateRange.start),
          q.lte(q.field("startTime"), dateRange.end),
          q.eq(q.field("deleted"), undefined)
        )
      )
      .order("desc")
      .take(limit);

    // Get notes
    const notes = await ctx.db
      .query("contactNotes")
      .withIndex("by_contact", (q) => q.eq("contactId", contactId))
      .filter((q) => q.eq(q.field("deleted"), undefined))
      .order("desc")
      .collect();

    // Calculate stats
    const stats = {
      totalCalls: calls.length,
      inboundCalls: calls.filter((c) => c.callType === "Inbound").length,
      outboundCalls: calls.filter((c) => c.callType === "Outbound").length,
      answeredCalls: calls.filter((c) => c.disposition === "ANSWERED").length,
      missedCalls: calls.filter((c) => c.disposition !== "ANSWERED").length,
      totalDuration: calls.reduce((sum, c) => sum + c.talkDuration, 0),
      lastCallAt: calls[0]?.startTime,
    };

    return {
      contact: { ...contact, company },
      calls,
      notes,
      stats,
    };
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new contact
 */
export const createContact = mutation({
  args: {
    name: v.string(),
    companyId: v.optional(v.id("companies")),
    email: v.optional(v.string()),
    phones: v.array(phoneSchema),
    notes: v.optional(v.string()),
    source: v.union(
      v.literal("yeastar"),
      v.literal("manual"),
      v.literal("call_inbox")
    ),
    yeastarContactId: v.optional(v.number()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const contactId = await ctx.db.insert("contacts", {
      name: args.name,
      companyId: args.companyId,
      email: args.email,
      phones: args.phones,
      notes: args.notes,
      source: args.source,
      yeastarContactId: args.yeastarContactId,
      createdAt: now,
      updatedAt: now,
      createdBy: args.createdBy,
    });

    return contactId;
  },
});

/**
 * Create contact from call (inbox flow)
 */
export const createContactFromCall = mutation({
  args: {
    callId: v.id("callRecords"),
    name: v.string(),
    phoneNumber: v.string(),
    companyId: v.optional(v.id("companies")),
    email: v.optional(v.string()),
    linkAllHistoricalCalls: v.boolean(),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const call = await ctx.db.get(args.callId);
    if (!call) throw new Error("Call not found");

    // Create contact
    const contactId = await ctx.db.insert("contacts", {
      name: args.name,
      companyId: args.companyId,
      email: args.email,
      phones: [
        {
          number: args.phoneNumber,
          type: "mobile",
          isPrimary: true,
        },
      ],
      source: "call_inbox",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: args.createdBy,
    });

    // Link current call
    await ctx.db.patch(args.callId, {
      contactId,
      companyId: args.companyId,
      matchedAt: Date.now(),
      matchMethod: "created",
    });

    // Link all historical calls if requested
    if (args.linkAllHistoricalCalls) {
      // Find all unmatched calls from/to this number
      const unmatchedCalls = await ctx.db
        .query("callRecords")
        .filter((q) =>
          q.and(
            q.eq(q.field("contactId"), undefined),
            q.or(
              q.eq(q.field("callFrom"), args.phoneNumber),
              q.eq(q.field("callTo"), args.phoneNumber)
            )
          )
        )
        .collect();

      for (const unmatchedCall of unmatchedCalls) {
        await ctx.db.patch(unmatchedCall._id, {
          contactId,
          companyId: args.companyId,
          matchedAt: Date.now(),
          matchMethod: "manual",
        });
      }
    }

    return contactId;
  },
});

/**
 * Update a contact
 */
export const updateContact = mutation({
  args: {
    contactId: v.id("contacts"),
    name: v.optional(v.string()),
    companyId: v.optional(v.id("companies")),
    email: v.optional(v.string()),
    phones: v.optional(v.array(phoneSchema)),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { contactId, ...updates }) => {
    const existing = await ctx.db.get(contactId);
    if (!existing) throw new Error("Contact not found");

    await ctx.db.patch(contactId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return contactId;
  },
});

/**
 * Delete a contact (soft delete)
 */
export const deleteContact = mutation({
  args: { contactId: v.id("contacts") },
  handler: async (ctx, { contactId }) => {
    const existing = await ctx.db.get(contactId);
    if (!existing) throw new Error("Contact not found");

    await ctx.db.patch(contactId, {
      deleted: true,
      updatedAt: Date.now(),
    });

    return contactId;
  },
});

/**
 * Add a note to a contact
 */
export const addContactNote = mutation({
  args: {
    contactId: v.id("contacts"),
    content: v.string(),
    createdBy: v.optional(v.string()),
    callRecordId: v.optional(v.id("callRecords")),
  },
  handler: async (ctx, args) => {
    const contact = await ctx.db.get(args.contactId);
    if (!contact) throw new Error("Contact not found");

    const noteId = await ctx.db.insert("contactNotes", {
      contactId: args.contactId,
      content: args.content,
      createdAt: Date.now(),
      createdBy: args.createdBy,
      callRecordId: args.callRecordId,
    });

    return noteId;
  },
});
