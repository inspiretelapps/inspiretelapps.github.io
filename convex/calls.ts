import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Call Records Queries & Mutations
 *
 * Features:
 * - Calls Inbox with filters and search
 * - Call detail view
 * - Link calls to contacts
 * - Manual call creation (for testing)
 */

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Calls Inbox - Main query with filters and search
 */
export const listCallsForInbox = query({
  args: {
    filters: v.object({
      dateRange: v.object({
        start: v.number(),
        end: v.number(),
      }),
      callType: v.optional(
        v.union(v.literal("Inbound"), v.literal("Outbound"), v.literal("Internal"))
      ),
      disposition: v.optional(v.string()),
      hasRecording: v.optional(v.boolean()),
      matchStatus: v.optional(v.union(v.literal("matched"), v.literal("unmatched"))),
      extensionId: v.optional(v.string()),
    }),
    search: v.optional(v.string()),
    pagination: v.object({
      page: v.number(),
      limit: v.number(),
    }),
  },
  handler: async (ctx, { filters, search, pagination }) => {
    // Start with time-based query (most important for performance)
    let calls = await ctx.db
      .query("callRecords")
      .withIndex("by_start_time")
      .filter((q) =>
        q.and(
          q.gte(q.field("startTime"), filters.dateRange.start),
          q.lte(q.field("startTime"), filters.dateRange.end),
          q.eq(q.field("deleted"), undefined)
        )
      )
      .order("desc")
      .collect();

    // Apply filters in memory
    calls = calls.filter((call) => {
      // Call type filter
      if (filters.callType && call.callType !== filters.callType) return false;

      // Disposition filter
      if (filters.disposition && call.disposition !== filters.disposition)
        return false;

      // Recording filter
      if (
        filters.hasRecording !== undefined &&
        call.hasRecording !== filters.hasRecording
      )
        return false;

      // Match status filter
      if (filters.matchStatus === "unmatched" && call.contactId) return false;
      if (filters.matchStatus === "matched" && !call.contactId) return false;

      // Extension filter
      if (filters.extensionId && call.extensionId !== filters.extensionId)
        return false;

      return true;
    });

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      calls = calls.filter(
        (call) =>
          call.callFrom.includes(search) ||
          call.callTo.includes(search) ||
          call.extensionName?.toLowerCase().includes(searchLower) ||
          call.extensionId?.includes(search)
      );
    }

    // Get total before pagination
    const total = calls.length;

    // Pagination
    const start = pagination.page * pagination.limit;
    const end = start + pagination.limit;
    const paginatedCalls = calls.slice(start, end);

    // Enrich with contact and company data
    const enrichedCalls = await Promise.all(
      paginatedCalls.map(async (call) => {
        const contact = call.contactId ? await ctx.db.get(call.contactId) : null;
        const company = call.companyId ? await ctx.db.get(call.companyId) : null;

        return {
          ...call,
          contact,
          company,
        };
      })
    );

    return {
      calls: enrichedCalls,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  },
});

/**
 * Get call detail with context
 */
export const getCallDetail = query({
  args: { callId: v.id("callRecords") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (!call) throw new Error("Call not found");

    const contact = call.contactId ? await ctx.db.get(call.contactId) : null;
    const company = call.companyId ? await ctx.db.get(call.companyId) : null;

    // Get other calls from same number (for "link all" feature)
    const phoneNumber = call.callType === "Inbound" ? call.callFrom : call.callTo;

    // Find unmatched calls from the same number
    const relatedCallsFrom = await ctx.db
      .query("callRecords")
      .withIndex("by_call_from", (q) => q.eq("callFrom", phoneNumber))
      .filter((q) =>
        q.and(
          q.eq(q.field("contactId"), undefined),
          q.eq(q.field("deleted"), undefined)
        )
      )
      .collect();

    const relatedCallsTo = await ctx.db
      .query("callRecords")
      .withIndex("by_call_to", (q) => q.eq("callTo", phoneNumber))
      .filter((q) =>
        q.and(
          q.eq(q.field("contactId"), undefined),
          q.eq(q.field("deleted"), undefined)
        )
      )
      .collect();

    // Combine and dedupe
    const relatedCallsMap = new Map();
    [...relatedCallsFrom, ...relatedCallsTo].forEach((c) => {
      relatedCallsMap.set(c._id, c);
    });
    const relatedCalls = Array.from(relatedCallsMap.values());

    // Get notes if contact exists
    const notes = contact
      ? await ctx.db
          .query("contactNotes")
          .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
          .filter((q) => q.eq(q.field("deleted"), undefined))
          .order("desc")
          .take(5)
      : [];

    return {
      call,
      contact,
      company,
      relatedCalls,
      notes,
    };
  },
});

/**
 * Get recent calls (for dashboard widgets)
 */
export const getRecentCalls = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 10 }) => {
    const calls = await ctx.db
      .query("callRecords")
      .withIndex("by_start_time")
      .filter((q) => q.eq(q.field("deleted"), undefined))
      .order("desc")
      .take(limit);

    // Enrich with contact and company data
    const enrichedCalls = await Promise.all(
      calls.map(async (call) => {
        const contact = call.contactId ? await ctx.db.get(call.contactId) : null;
        const company = call.companyId ? await ctx.db.get(call.companyId) : null;

        return {
          ...call,
          contact,
          company,
        };
      })
    );

    return enrichedCalls;
  },
});

/**
 * Get unmatched calls count
 */
export const getUnmatchedCallsCount = query({
  args: {
    dateRange: v.optional(
      v.object({
        start: v.number(),
        end: v.number(),
      })
    ),
  },
  handler: async (ctx, { dateRange }) => {
    let query = ctx.db.query("callRecords").withIndex("unmatched_calls");

    const calls = await query
      .filter((q) =>
        q.and(q.eq(q.field("contactId"), undefined), q.eq(q.field("deleted"), undefined))
      )
      .collect();

    // Apply date range filter if provided
    const filteredCalls = dateRange
      ? calls.filter(
          (c) => c.startTime >= dateRange.start && c.startTime <= dateRange.end
        )
      : calls;

    return filteredCalls.length;
  },
});

/**
 * Get call statistics for a date range
 */
export const getCallStats = query({
  args: {
    dateRange: v.object({
      start: v.number(),
      end: v.number(),
    }),
    companyId: v.optional(v.id("companies")),
    contactId: v.optional(v.id("contacts")),
  },
  handler: async (ctx, { dateRange, companyId, contactId }) => {
    let query = ctx.db.query("callRecords").withIndex("by_start_time");

    // Get calls based on filter
    let calls = await query
      .filter((q) =>
        q.and(
          q.gte(q.field("startTime"), dateRange.start),
          q.lte(q.field("startTime"), dateRange.end),
          q.eq(q.field("deleted"), undefined)
        )
      )
      .collect();

    // Filter by company or contact
    if (companyId) {
      calls = calls.filter((c) => c.companyId === companyId);
    }
    if (contactId) {
      calls = calls.filter((c) => c.contactId === contactId);
    }

    // Calculate stats
    const stats = {
      totalCalls: calls.length,
      inboundCalls: calls.filter((c) => c.callType === "Inbound").length,
      outboundCalls: calls.filter((c) => c.callType === "Outbound").length,
      internalCalls: calls.filter((c) => c.callType === "Internal").length,
      answeredCalls: calls.filter((c) => c.disposition === "ANSWERED").length,
      missedCalls: calls.filter((c) => c.disposition !== "ANSWERED").length,
      withRecording: calls.filter((c) => c.hasRecording).length,
      totalDuration: calls.reduce((sum, c) => sum + c.talkDuration, 0),
      avgDuration:
        calls.length > 0
          ? calls.reduce((sum, c) => sum + c.talkDuration, 0) / calls.length
          : 0,
      uniqueNumbers: new Set([
        ...calls.map((c) => c.callFrom),
        ...calls.map((c) => c.callTo),
      ]).size,
    };

    return stats;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Link a call to a contact (manual matching)
 */
export const linkCallToContact = mutation({
  args: {
    callId: v.id("callRecords"),
    contactId: v.id("contacts"),
  },
  handler: async (ctx, { callId, contactId }) => {
    const call = await ctx.db.get(callId);
    if (!call) throw new Error("Call not found");

    const contact = await ctx.db.get(contactId);
    if (!contact) throw new Error("Contact not found");

    await ctx.db.patch(callId, {
      contactId,
      companyId: contact.companyId,
      matchedAt: Date.now(),
      matchMethod: "manual",
    });

    return callId;
  },
});

/**
 * Unlink a call from contact
 */
export const unlinkCallFromContact = mutation({
  args: { callId: v.id("callRecords") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (!call) throw new Error("Call not found");

    await ctx.db.patch(callId, {
      contactId: undefined,
      companyId: undefined,
      matchedAt: undefined,
      matchMethod: undefined,
    });

    return callId;
  },
});

/**
 * Delete a call record (soft delete)
 */
export const deleteCall = mutation({
  args: { callId: v.id("callRecords") },
  handler: async (ctx, { callId }) => {
    const call = await ctx.db.get(callId);
    if (!call) throw new Error("Call not found");

    await ctx.db.patch(callId, {
      deleted: true,
    });

    return callId;
  },
});
