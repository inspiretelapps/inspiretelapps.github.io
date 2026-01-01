import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import {
  Search,
  Plus,
  Building2,
  Users,
  Phone,
  Edit2,
  Trash2,
  Merge,
  X,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CompanyForm } from './CompanyForm';
import { CompanyDetail } from './CompanyDetail';
import { MergeCompaniesModal } from './MergeCompaniesModal';
import { ContactDetail } from '../contacts/ContactDetail';
import { ContactForm } from '../contacts/ContactForm';
import type { Company, Contact } from '@/types';
import toast from 'react-hot-toast';

export function CompaniesList() {
  const { companies, contacts, deleteCompany } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);

  // Filter companies based on search
  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;

    const query = searchQuery.toLowerCase();
    return companies.filter((company) =>
      company.name.toLowerCase().includes(query)
    );
  }, [companies, searchQuery]);

  // Count contacts per company
  const getContactCount = (companyId: string) => {
    return contacts.filter((c) => c.companyId === companyId).length;
  };

  const handleAddCompany = () => {
    setEditingCompany(null);
    setShowForm(true);
  };

  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setShowForm(true);
  };

  const handleDeleteCompany = (company: Company) => {
    const contactCount = getContactCount(company.id);
    if (contactCount > 0) {
      if (!confirm(`"${company.name}" has ${contactCount} associated contacts. Are you sure you want to delete this company? The contacts will remain but lose their company association.`)) {
        return;
      }
    } else if (!confirm(`Are you sure you want to delete "${company.name}"?`)) {
      return;
    }

    deleteCompany(company.id);
    toast.success('Company deleted');
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCompany(null);
  };

  const handleSelectCompany = (company: Company) => {
    if (mergeMode) {
      toggleCompanySelection(company.id);
    } else {
      setSelectedCompany(company);
    }
  };

  const handleCloseDetail = () => {
    setSelectedCompany(null);
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const handleCloseContactDetail = () => {
    setSelectedContact(null);
  };

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(null);
    setEditingContact(contact);
  };

  const handleCloseContactForm = () => {
    setEditingContact(null);
  };

  const toggleMergeMode = () => {
    setMergeMode(!mergeMode);
    setSelectedForMerge(new Set());
  };

  const toggleCompanySelection = (companyId: string) => {
    setSelectedForMerge((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  const handleStartMerge = () => {
    if (selectedForMerge.size >= 2) {
      setShowMergeModal(true);
    }
  };

  const handleCloseMergeModal = () => {
    setShowMergeModal(false);
    setMergeMode(false);
    setSelectedForMerge(new Set());
  };

  const companiesToMerge = useMemo(() =>
    companies.filter((c) => selectedForMerge.has(c.id)),
    [companies, selectedForMerge]
  );

  return (
    <>
      <Card>
        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            {mergeMode ? (
              <>
                <button
                  onClick={handleStartMerge}
                  disabled={selectedForMerge.size < 2}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  <Merge className="w-4 h-4" />
                  Merge ({selectedForMerge.size})
                </button>
                <button
                  onClick={toggleMergeMode}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={toggleMergeMode}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Merge className="w-4 h-4" />
                  Merge
                </button>
                <button
                  onClick={handleAddCompany}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Add Company
                </button>
              </>
            )}
          </div>
        </div>

        {/* Merge Mode Instructions */}
        {mergeMode && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm text-emerald-700 dark:text-emerald-300">
            Select 2 or more companies to merge them. Useful for merging duplicates like "Dry Ice" and "dry ice". All contacts from merged companies will be updated to the primary company.
          </div>
        )}

        {/* Results count */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {filteredCompanies.length === companies.length
            ? `${companies.length} companies`
            : `${filteredCompanies.length} of ${companies.length} companies`}
        </p>

        {/* Companies List */}
        {filteredCompanies.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {companies.length === 0
                ? 'No companies yet. Add companies to group contacts.'
                : 'No companies match your search.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            <AnimatePresence mode="popLayout">
              {filteredCompanies.map((company) => {
                const contactCount = getContactCount(company.id);
                return (
                  <div key={company.id} className="flex items-center gap-2">
                    {mergeMode && (
                      <input
                        type="checkbox"
                        checked={selectedForMerge.has(company.id)}
                        onChange={() => toggleCompanySelection(company.id)}
                        className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500"
                      />
                    )}
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onClick={() => handleSelectCompany(company)}
                      className="flex-1 group flex items-center gap-4 py-4 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg transition-colors cursor-pointer"
                    >
                      {/* Icon */}
                      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white">
                        <Building2 className="w-6 h-6" />
                      </div>

                      {/* Company Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {company.name}
                        </h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {contactCount} contact{contactCount !== 1 ? 's' : ''}
                          </span>
                          {company.phonePatterns.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3.5 h-3.5" />
                              {company.phonePatterns.length} pattern{company.phonePatterns.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditCompany(company); }}
                          className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Edit company"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteCompany(company); }}
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          title="Delete company"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </Card>

      {/* Company Form Modal */}
      {showForm && (
        <CompanyForm
          company={editingCompany}
          onClose={handleCloseForm}
        />
      )}

      {/* Company Detail Modal */}
      {selectedCompany && (
        <CompanyDetail
          company={selectedCompany}
          onClose={handleCloseDetail}
          onSelectContact={handleSelectContact}
        />
      )}

      {/* Merge Companies Modal */}
      {showMergeModal && companiesToMerge.length >= 2 && (
        <MergeCompaniesModal
          companies={companiesToMerge}
          onClose={handleCloseMergeModal}
        />
      )}

      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetail
          contact={selectedContact}
          onClose={handleCloseContactDetail}
          onEdit={() => handleEditContact(selectedContact)}
        />
      )}

      {/* Contact Form Modal */}
      {editingContact && (
        <ContactForm
          contact={editingContact}
          onClose={handleCloseContactForm}
        />
      )}
    </>
  );
}
