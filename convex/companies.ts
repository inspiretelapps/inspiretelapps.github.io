import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Companies Queries & Mutations
 *
 * Features:
 * - List companies with aggregated call stats
 * - Get company detail with contacts
 * - CRUD operations for companies
 * - Search companies
 */

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List all companies with aggregated call stats for a date range
 */
export const listCompaniesWithStats = query({
  args: {
    dateRange: v.object({
      start: v.number(),
      end: v.number(),
    }),
  },
  handler: async (ctx, { dateRange }) => {
    // Get all active companies
    const companies = await ctx.db
      .query("companies")
      .filter((q) => q.eq(q.field("deleted"), undefined))
      .order("desc")
      .collect();

    // For each company, aggregate call stats
    const companiesWithStats = await Promise.all(
      companies.map(async (company) => {
        const calls = await ctx.db
          .query("callRecords")
          .withIndex("by_company", (q) => q.eq("companyId", company._id))
          .filter((q) =>
            q.and(
              q.gte(q.field("startTime"), dateRange.start),
              q.lte(q.field("startTime"), dateRange.end),
              q.eq(q.field("deleted"), undefined)
            )
          )
          .collect();

        const stats = {
          totalCalls: calls.length,
          inboundCalls: calls.filter((c) => c.callType === "Inbound").length,
          outboundCalls: calls.filter((c) => c.callType === "Outbound").length,
          answeredCalls: calls.filter((c) => c.disposition === "ANSWERED")
            .length,
          missedCalls: calls.filter((c) => c.disposition !== "ANSWERED").length,
          totalDuration: calls.reduce((sum, c) => sum + c.talkDuration, 0),
          avgDuration:
            calls.length > 0
              ? calls.reduce((sum, c) => sum + c.talkDuration, 0) / calls.length
              : 0,
        };

        // Get last sync timestamp
        const lastSync = await ctx.db
          .query("syncMetadata")
          .filter((q) =>
            q.and(
              q.eq(q.field("syncType"), "cdr"),
              q.eq(q.field("status"), "completed")
            )
          )
          .order("desc")
          .first();

        return {
          ...company,
          stats,
          lastSyncAt: lastSync?.completedAt,
        };
      })
    );

    return companiesWithStats;
  },
});

/**
 * Get company detail with linked contacts and stats
 */
export const getCompanyWithContacts = query({
  args: {
    companyId: v.id("companies"),
    dateRange: v.object({
      start: v.number(),
      end: v.number(),
    }),
  },
  handler: async (ctx, { companyId, dateRange }) => {
    const company = await ctx.db.get(companyId);
    if (!company) throw new Error("Company not found");

    // Get all contacts for company
    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) => q.eq(q.field("deleted"), undefined))
      .collect();

    // Get call stats per contact
    const contactsWithStats = await Promise.all(
      contacts.map(async (contact) => {
        const calls = await ctx.db
          .query("callRecords")
          .withIndex("by_contact", (q) => q.eq("contactId", contact._id))
          .filter((q) =>
            q.and(
              q.gte(q.field("startTime"), dateRange.start),
              q.lte(q.field("startTime"), dateRange.end),
              q.eq(q.field("deleted"), undefined)
            )
          )
          .collect();

        const stats = {
          totalCalls: calls.length,
          inboundCalls: calls.filter((c) => c.callType === "Inbound").length,
          outboundCalls: calls.filter((c) => c.callType === "Outbound").length,
          lastCallAt: calls[0]?.startTime,
          totalDuration: calls.reduce((sum, c) => sum + c.talkDuration, 0),
        };

        return {
          ...contact,
          stats,
        };
      })
    );

    // Get company-level call stats
    const companyCalls = await ctx.db
      .query("callRecords")
      .withIndex("by_company", (q) => q.eq("companyId", companyId))
      .filter((q) =>
        q.and(
          q.gte(q.field("startTime"), dateRange.start),
          q.lte(q.field("startTime"), dateRange.end),
          q.eq(q.field("deleted"), undefined)
        )
      )
      .collect();

    const companyStats = {
      totalCalls: companyCalls.length,
      inboundCalls: companyCalls.filter((c) => c.callType === "Inbound")
        .length,
      outboundCalls: companyCalls.filter((c) => c.callType === "Outbound")
        .length,
      answeredCalls: companyCalls.filter((c) => c.disposition === "ANSWERED")
        .length,
      missedCalls: companyCalls.filter((c) => c.disposition !== "ANSWERED")
        .length,
      totalDuration: companyCalls.reduce((sum, c) => sum + c.talkDuration, 0),
    };

    return {
      company,
      contacts: contactsWithStats,
      stats: companyStats,
    };
  },
});

/**
 * Get a single company by ID
 */
export const getCompany = query({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const company = await ctx.db.get(companyId);
    if (!company) throw new Error("Company not found");
    return company;
  },
});

/**
 * Search companies by name
 */
export const searchCompanies = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, { searchTerm }) => {
    const companies = await ctx.db
      .query("companies")
      .withSearchIndex("search_companies", (q) => q.search("name", searchTerm))
      .filter((q) => q.eq(q.field("deleted"), undefined))
      .collect();

    return companies;
  },
});

/**
 * List all active companies (no stats)
 */
export const listCompanies = query({
  args: {},
  handler: async (ctx) => {
    const companies = await ctx.db
      .query("companies")
      .filter((q) => q.eq(q.field("deleted"), undefined))
      .order("desc")
      .collect();

    return companies;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new company
 */
export const createCompany = mutation({
  args: {
    name: v.string(),
    phonePatterns: v.optional(v.array(v.string())),
    website: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const companyId = await ctx.db.insert("companies", {
      name: args.name,
      phonePatterns: args.phonePatterns || [],
      website: args.website,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
      createdBy: args.createdBy,
    });

    return companyId;
  },
});

/**
 * Update a company
 */
export const updateCompany = mutation({
  args: {
    companyId: v.id("companies"),
    name: v.optional(v.string()),
    phonePatterns: v.optional(v.array(v.string())),
    website: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { companyId, ...updates }) => {
    const existing = await ctx.db.get(companyId);
    if (!existing) throw new Error("Company not found");

    await ctx.db.patch(companyId, {
      ...updates,
      updatedAt: Date.now(),
    });

    return companyId;
  },
});

/**
 * Delete a company (soft delete)
 */
export const deleteCompany = mutation({
  args: { companyId: v.id("companies") },
  handler: async (ctx, { companyId }) => {
    const existing = await ctx.db.get(companyId);
    if (!existing) throw new Error("Company not found");

    await ctx.db.patch(companyId, {
      deleted: true,
      updatedAt: Date.now(),
    });

    return companyId;
  },
});
