import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Merge, Check, Building2, Users } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Company } from '@/types';
import { updateCompanyContact } from '@/services/api';
import { contactToYeastarFormat } from '@/utils/phoneUtils';
import toast from 'react-hot-toast';

interface MergeCompaniesModalProps {
  companies: Company[];
  onClose: () => void;
}

export function MergeCompaniesModal({ companies, onClose }: MergeCompaniesModalProps) {
  const { contacts, updateContact, deleteCompany, setCmsLoading } = useStore();
  const [selectedPrimary, setSelectedPrimary] = useState<string>(companies[0]?.id || '');
  const [isMerging, setIsMerging] = useState(false);

  // Get the primary company (the one we'll keep)
  const primaryCompany = useMemo(() =>
    companies.find((c) => c.id === selectedPrimary),
    [companies, selectedPrimary]
  );

  // Get secondary companies (ones that will be merged into primary)
  const secondaryCompanies = useMemo(() =>
    companies.filter((c) => c.id !== selectedPrimary),
    [companies, selectedPrimary]
  );

  // Get contact counts per company
  const getContactCount = (companyId: string, companyName: string) => {
    return contacts.filter((c) =>
      c.companyId === companyId ||
      c.company?.toLowerCase() === companyName.toLowerCase()
    ).length;
  };

  // Preview: total contacts after merge
  const totalContacts = useMemo(() => {
    const contactIds = new Set<string>();
    for (const company of companies) {
      contacts.forEach((contact) => {
        if (contact.companyId === company.id ||
            contact.company?.toLowerCase() === company.name.toLowerCase()) {
          contactIds.add(contact.id);
        }
      });
    }
    return contactIds.size;
  }, [companies, contacts]);

  const handleMerge = async () => {
    if (!primaryCompany) return;

    setIsMerging(true);
    setCmsLoading('companies', true);

    try {
      // Find all contacts that belong to secondary companies
      const contactsToUpdate = contacts.filter((contact) => {
        for (const company of secondaryCompanies) {
          if (contact.companyId === company.id ||
              contact.company?.toLowerCase() === company.name.toLowerCase()) {
            return true;
          }
        }
        return false;
      });

      // Update contacts to point to primary company
      for (const contact of contactsToUpdate) {
        const updates = {
          companyId: primaryCompany.id,
          company: primaryCompany.name,
        };

        // Update locally
        updateContact(contact.id, updates);

        // Sync to Yeastar if contact is synced
        if (contact.yeastarContactId) {
          try {
            const fullContact = { ...contact, ...updates };
            const yeastarData = contactToYeastarFormat(fullContact);
            await updateCompanyContact(contact.yeastarContactId, yeastarData);
          } catch (err) {
            console.warn(`Failed to sync contact ${contact.name} to Yeastar:`, err);
          }
        }
      }

      // Delete secondary companies
      for (const company of secondaryCompanies) {
        deleteCompany(company.id);
      }

      toast.success(`Merged ${companies.length} companies into "${primaryCompany.name}" and updated ${contactsToUpdate.length} contacts`);
      onClose();
    } catch (error: any) {
      console.error('Merge error:', error);
      toast.error(error.message || 'Failed to merge companies');
    } finally {
      setIsMerging(false);
      setCmsLoading('companies', false);
    }
  };

  if (companies.length < 2) {
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
            <Merge className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Merge {companies.length} Companies
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
          {/* Select Primary Company */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Select Primary Company (this one will be kept)
            </h3>
            <div className="space-y-2">
              {companies.map((company) => {
                const contactCount = getContactCount(company.id, company.name);
                return (
                  <button
                    key={company.id}
                    onClick={() => setSelectedPrimary(company.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                      selectedPrimary === company.id
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${
                      selectedPrimary === company.id
                        ? 'bg-emerald-600'
                        : 'bg-gray-400'
                    }`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900 dark:text-white">{company.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {contactCount} contact{contactCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    {selectedPrimary === company.id && (
                      <Check className="w-5 h-5 text-emerald-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Merge Preview */}
          {primaryCompany && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Merge Result Preview
              </h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{primaryCompany.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {totalContacts} total contact{totalContacts !== 1 ? 's' : ''} after merge
                    </p>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Companies to merge:</p>
                  <div className="flex flex-wrap gap-2">
                    {secondaryCompanies.map((company) => (
                      <span
                        key={company.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-600 rounded text-sm text-gray-700 dark:text-gray-300"
                      >
                        <Building2 className="w-3 h-3" />
                        {company.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                Warning: {secondaryCompanies.length} compan{secondaryCompanies.length !== 1 ? 'ies' : 'y'} will be deleted and their contacts will be updated to "{primaryCompany.name}".
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
            disabled={isMerging || companies.length < 2}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg transition-colors"
          >
            <Merge className="w-4 h-4" />
            {isMerging ? 'Merging...' : 'Merge Companies'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
