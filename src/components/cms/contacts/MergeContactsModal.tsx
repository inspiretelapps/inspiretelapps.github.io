import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Merge, Check, Phone, Building2 } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Contact, ContactPhone } from '@/types';
import { formatPhoneNumber, contactToYeastarFormat } from '@/utils/phoneUtils';
import { deleteCompanyContact, updateCompanyContact } from '@/services/api';
import toast from 'react-hot-toast';

interface MergeContactsModalProps {
  contacts: Contact[];
  onClose: () => void;
}

export function MergeContactsModal({ contacts, onClose }: MergeContactsModalProps) {
  const { updateContact, deleteContact, setCmsLoading } = useStore();
  const [selectedPrimary, setSelectedPrimary] = useState<string>(contacts[0]?.id || '');
  const [isMerging, setIsMerging] = useState(false);

  // Get the primary contact (the one we'll keep)
  const primaryContact = useMemo(() =>
    contacts.find((c) => c.id === selectedPrimary),
    [contacts, selectedPrimary]
  );

  // Get secondary contacts (ones that will be merged into primary)
  const secondaryContacts = useMemo(() =>
    contacts.filter((c) => c.id !== selectedPrimary),
    [contacts, selectedPrimary]
  );

  // Preview of merged contact
  const mergedPreview = useMemo(() => {
    if (!primaryContact) return null;

    // Collect all unique phone numbers
    const allPhones: ContactPhone[] = [...primaryContact.phones];
    const existingNumbers = new Set(allPhones.map((p) => p.number));

    for (const contact of secondaryContacts) {
      for (const phone of contact.phones) {
        if (!existingNumbers.has(phone.number)) {
          allPhones.push(phone);
          existingNumbers.add(phone.number);
        }
      }
    }

    // Use primary contact's info, but collect additional notes
    const remarks: string[] = [];
    if (primaryContact.remark) remarks.push(primaryContact.remark);
    for (const contact of secondaryContacts) {
      if (contact.remark) remarks.push(`[Merged from ${contact.name}]: ${contact.remark}`);
    }

    return {
      name: primaryContact.name,
      company: primaryContact.company || secondaryContacts.find((c) => c.company)?.company,
      email: primaryContact.email || secondaryContacts.find((c) => c.email)?.email,
      phones: allPhones,
      remark: remarks.join('\n'),
    };
  }, [primaryContact, secondaryContacts]);

  const handleMerge = async () => {
    if (!primaryContact || !mergedPreview) return;

    setIsMerging(true);
    setCmsLoading('contacts', true);

    try {
      // Update primary contact with merged data
      const now = new Date().toISOString();
      const updates: Partial<Contact> = {
        phones: mergedPreview.phones,
        company: mergedPreview.company,
        email: mergedPreview.email,
        remark: mergedPreview.remark,
        updatedAt: now,
        syncStatus: 'pending',
      };

      // If primary is from Yeastar, update there too
      if (primaryContact.source === 'yeastar' && primaryContact.yeastarContactId) {
        const yeastarData = contactToYeastarFormat({ ...primaryContact, ...updates } as Contact);
        const success = await updateCompanyContact(primaryContact.yeastarContactId, yeastarData);
        if (success) {
          updates.syncStatus = 'synced';
        }
      }

      updateContact(primaryContact.id, updates);

      // Delete secondary contacts
      for (const contact of secondaryContacts) {
        // Delete from Yeastar if synced
        if (contact.source === 'yeastar' && contact.yeastarContactId) {
          try {
            await deleteCompanyContact(contact.yeastarContactId);
          } catch (err) {
            console.warn(`Failed to delete ${contact.name} from Yeastar:`, err);
          }
        }
        deleteContact(contact.id);
      }

      toast.success(`Merged ${contacts.length} contacts into "${primaryContact.name}"`);
      onClose();
    } catch (error: any) {
      console.error('Merge error:', error);
      toast.error(error.message || 'Failed to merge contacts');
    } finally {
      setIsMerging(false);
      setCmsLoading('contacts', false);
    }
  };

  if (contacts.length < 2) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Merge className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Merge {contacts.length} Contacts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Select Primary Contact */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Select Primary Contact (this one will be kept)
            </h3>
            <div className="space-y-2">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedPrimary(contact.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                    selectedPrimary === contact.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                    selectedPrimary === contact.id
                      ? 'bg-blue-600'
                      : 'bg-gray-400'
                  }`}>
                    {contact.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900 dark:text-white">{contact.name}</p>
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      {contact.company && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {contact.company}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {contact.phones.length} phone{contact.phones.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  {selectedPrimary === contact.id && (
                    <Check className="w-5 h-5 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Merge Preview */}
          {mergedPreview && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Merged Result Preview
              </h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {mergedPreview.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{mergedPreview.name}</p>
                    {mergedPreview.company && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">{mergedPreview.company}</p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Phone Numbers ({mergedPreview.phones.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {mergedPreview.phones.map((phone, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-600 rounded text-sm text-gray-700 dark:text-gray-300"
                      >
                        <Phone className="w-3 h-3" />
                        {formatPhoneNumber(phone.number)}
                      </span>
                    ))}
                  </div>
                </div>

                {mergedPreview.email && (
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Email: {mergedPreview.email}
                  </div>
                )}
              </div>

              <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                Warning: {secondaryContacts.length} contact{secondaryContacts.length !== 1 ? 's' : ''} will be deleted after merging.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMerge}
            disabled={isMerging || contacts.length < 2}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
          >
            <Merge className="w-4 h-4" />
            {isMerging ? 'Merging...' : 'Merge Contacts'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
