import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Building2,
  Users,
  Phone,
  Mail,
  ChevronRight,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Company, Contact } from '@/types';
import { formatPhoneNumber } from '@/utils/phoneUtils';

interface CompanyDetailProps {
  company: Company;
  onClose: () => void;
  onSelectContact: (contact: Contact) => void;
}

export function CompanyDetail({ company, onClose, onSelectContact }: CompanyDetailProps) {
  const { contacts } = useStore();

  // Get all contacts for this company (by companyId OR matching company name)
  const companyContacts = useMemo(() => {
    return contacts.filter((contact) => {
      // Match by companyId
      if (contact.companyId === company.id) return true;
      // Also match by company name (case-insensitive) for backwards compatibility
      if (contact.company?.toLowerCase() === company.name.toLowerCase()) return true;
      return false;
    });
  }, [contacts, company.id, company.name]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="relative p-6 pb-4 bg-gradient-to-br from-emerald-500 to-teal-600">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-white">
              <Building2 className="w-8 h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{company.name}</h2>
              <p className="text-white/80 text-sm flex items-center gap-1">
                <Users className="w-4 h-4" />
                {companyContacts.length} contact{companyContacts.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            Contacts
          </h3>

          {companyContacts.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500 dark:text-gray-400">
                No contacts associated with this company
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {companyContacts.map((contact) => {
                const primaryPhone = contact.phones[0];
                return (
                  <button
                    key={contact.id}
                    onClick={() => onSelectContact(contact)}
                    className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
                  >
                    {/* Avatar */}
                    <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {contact.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Contact Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {contact.name}
                      </p>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                        {primaryPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {formatPhoneNumber(primaryPhone.number)}
                          </span>
                        )}
                        {contact.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3" />
                            {contact.email}
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
