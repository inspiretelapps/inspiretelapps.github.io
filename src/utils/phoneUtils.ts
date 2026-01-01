import type { ContactPhone, ContactPhoneType, YeastarContact, Contact } from '@/types';

// Phone field types that Yeastar supports
const PHONE_FIELDS: ContactPhoneType[] = [
  'business',
  'business2',
  'mobile',
  'mobile2',
  'home',
  'home2',
  'business_fax',
  'home_fax',
  'other',
];

/**
 * Convert Yeastar contact phone fields to our ContactPhone array format
 */
export function yeastarToPhones(contact: YeastarContact): ContactPhone[] {
  const phones: ContactPhone[] = [];

  for (const field of PHONE_FIELDS) {
    const value = contact[field as keyof YeastarContact];
    if (value && typeof value === 'string' && value.trim()) {
      phones.push({ type: field, number: value.trim() });
    }
  }

  return phones;
}

/**
 * Convert our ContactPhone array to Yeastar phone fields format
 * Explicitly sets empty strings for unused phone types so Yeastar clears them
 */
export function phonesToYeastar(phones: ContactPhone[]): Record<string, string> {
  const result: Record<string, string> = {};

  // Build a map of phone types that have values
  const phoneMap = new Map<string, string>();
  for (const phone of phones) {
    if (phone.number && phone.number.trim()) {
      phoneMap.set(phone.type, phone.number.trim());
    }
  }

  // Set all phone fields - empty string for types not in use
  for (const field of PHONE_FIELDS) {
    result[field] = phoneMap.get(field) || '';
  }

  return result;
}

/**
 * Normalize a phone number by removing common formatting characters
 * Keeps the + prefix if present for international numbers
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone) return '';

  // Keep the leading + if present
  const hasPlus = phone.startsWith('+');

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  return hasPlus ? `+${digits}` : digits;
}

/**
 * Check if two phone numbers match (accounting for different formats)
 */
export function phoneNumbersMatch(phone1: string, phone2: string): boolean {
  const normalized1 = normalizePhoneNumber(phone1);
  const normalized2 = normalizePhoneNumber(phone2);

  if (!normalized1 || !normalized2) return false;

  // Exact match
  if (normalized1 === normalized2) return true;

  // Match without country code prefix
  // South African numbers: +27 vs 0
  const stripped1 = normalized1.replace(/^\+27/, '0');
  const stripped2 = normalized2.replace(/^\+27/, '0');

  if (stripped1 === stripped2) return true;

  // Check if one ends with the other (last 9-10 digits)
  const minLength = 9;
  if (normalized1.length >= minLength && normalized2.length >= minLength) {
    const suffix1 = normalized1.slice(-10);
    const suffix2 = normalized2.slice(-10);
    if (suffix1 === suffix2) return true;

    // Try 9 digits
    const suffix1Short = normalized1.slice(-9);
    const suffix2Short = normalized2.slice(-9);
    if (suffix1Short === suffix2Short) return true;
  }

  return false;
}

/**
 * Format a phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';

  const normalized = normalizePhoneNumber(phone);

  // South African format: +27 XX XXX XXXX
  if (normalized.startsWith('+27') && normalized.length === 12) {
    return `+27 ${normalized.slice(3, 5)} ${normalized.slice(5, 8)} ${normalized.slice(8)}`;
  }

  // South African format with 0 prefix: 0XX XXX XXXX
  if (normalized.startsWith('0') && normalized.length === 10) {
    return `${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`;
  }

  // Generic international format
  if (normalized.startsWith('+') && normalized.length > 10) {
    const countryCode = normalized.slice(0, 3);
    const rest = normalized.slice(3);
    return `${countryCode} ${rest.replace(/(\d{3})(?=\d)/g, '$1 ').trim()}`;
  }

  // Return as-is if no format matches
  return phone;
}

/**
 * Get the display label for a phone type
 */
export function getPhoneTypeLabel(type: ContactPhoneType): string {
  const labels: Record<ContactPhoneType, string> = {
    business: 'Business',
    business2: 'Business 2',
    mobile: 'Mobile',
    mobile2: 'Mobile 2',
    home: 'Home',
    home2: 'Home 2',
    business_fax: 'Business Fax',
    home_fax: 'Home Fax',
    other: 'Other',
  };
  return labels[type] || type;
}

/**
 * Get all phone numbers for a contact as a flat array of strings
 */
export function getAllPhoneNumbers(contact: Contact): string[] {
  return contact.phones
    .map((p) => p.number)
    .filter((n) => n && n.trim());
}

/**
 * Find contacts that match a given phone number
 */
export function findContactsByPhone(
  contacts: Contact[],
  phoneNumber: string
): Contact[] {
  if (!phoneNumber) return [];

  return contacts.filter((contact) =>
    contact.phones.some((p) => phoneNumbersMatch(p.number, phoneNumber))
  );
}

/**
 * Get all phone numbers for a company (from all associated contacts)
 */
export function getCompanyPhoneNumbers(
  contacts: Contact[],
  companyId: string
): string[] {
  const companyContacts = contacts.filter((c) => c.companyId === companyId);
  const phones = new Set<string>();

  for (const contact of companyContacts) {
    for (const phone of contact.phones) {
      if (phone.number) {
        phones.add(normalizePhoneNumber(phone.number));
      }
    }
  }

  return Array.from(phones);
}

/**
 * Generate a UUID for new contacts/companies
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Convert a Yeastar contact to our Contact format
 */
export function yeastarContactToContact(yeastarContact: YeastarContact): Contact {
  return {
    id: generateId(),
    yeastarContactId: yeastarContact.id,
    name: yeastarContact.contact_name || '',
    company: yeastarContact.company,
    email: yeastarContact.email,
    phones: yeastarToPhones(yeastarContact),
    remark: yeastarContact.remark,
    phonebookIds: yeastarContact.phonebook_list?.map((p) => p.id),
    source: 'yeastar',
    syncStatus: 'synced',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Convert our Contact to Yeastar format for API calls
 */
export function contactToYeastarFormat(contact: Contact): Record<string, string | undefined> {
  return {
    contact_name: contact.name,
    company: contact.company,
    email: contact.email,
    remark: contact.remark,
    ...phonesToYeastar(contact.phones),
  };
}
