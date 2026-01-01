import { useState, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useStore } from '@/store/useStore';
import {
  Search,
  Plus,
  User,
  Merge,
  X,
  SortAsc,
  Clock,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ContactCard } from './ContactCard';
import { ContactForm } from './ContactForm';
import { ContactDetail } from './ContactDetail';
import { MergeContactsModal } from './MergeContactsModal';
import type { Contact } from '@/types';

type SortOption = 'name' | 'recent';

export function ContactsList() {
  const { contacts, cmsLoading } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);

  // Filter and sort contacts
  const filteredContacts = useMemo(() => {
    let result = contacts;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (contact) =>
          contact.name.toLowerCase().includes(query) ||
          contact.company?.toLowerCase().includes(query) ||
          contact.email?.toLowerCase().includes(query) ||
          contact.phones.some((p) => p.number.includes(query))
      );
    }

    // Sort
    return [...result].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else {
        // Sort by createdAt descending (most recent first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [contacts, searchQuery, sortBy]);

  const handleAddContact = () => {
    setEditingContact(null);
    setShowForm(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingContact(null);
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const handleCloseDetail = () => {
    setSelectedContact(null);
  };

  const toggleMergeMode = () => {
    setMergeMode(!mergeMode);
    setSelectedForMerge(new Set());
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedForMerge((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
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

  const contactsToMerge = useMemo(() =>
    contacts.filter((c) => selectedForMerge.has(c.id)),
    [contacts, selectedForMerge]
  );

  if (cmsLoading.contacts || cmsLoading.sync) {
    return (
      <Card>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 dark:text-gray-400">Loading contacts...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card>
        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search contacts by name, company, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {/* Sort Toggle */}
          <div className="flex items-center">
            <button
              onClick={() => setSortBy(sortBy === 'name' ? 'recent' : 'name')}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm"
              title={sortBy === 'name' ? 'Sorted alphabetically' : 'Sorted by recently added'}
            >
              {sortBy === 'name' ? (
                <>
                  <SortAsc className="w-4 h-4" />
                  <span className="hidden sm:inline">A-Z</span>
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4" />
                  <span className="hidden sm:inline">Recent</span>
                </>
              )}
            </button>
          </div>
          <div className="flex gap-2">
            {mergeMode ? (
              <>
                <button
                  onClick={handleStartMerge}
                  disabled={selectedForMerge.size < 2}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg transition-colors whitespace-nowrap"
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
                  onClick={handleAddContact}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  Add Contact
                </button>
              </>
            )}
          </div>
        </div>

        {/* Merge Mode Instructions */}
        {mergeMode && (
          <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-sm text-purple-700 dark:text-purple-300">
            Select 2 or more contacts to merge them. The primary contact's information will be preserved, and phone numbers from all selected contacts will be combined.
          </div>
        )}

        {/* Results count */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {filteredContacts.length === contacts.length
            ? `${contacts.length} contacts`
            : `${filteredContacts.length} of ${contacts.length} contacts`}
        </p>

        {/* Contacts List */}
        {filteredContacts.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {contacts.length === 0
                ? 'No contacts yet. Sync from Yeastar or add manually.'
                : 'No contacts match your search.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            <AnimatePresence mode="popLayout">
              {filteredContacts.map((contact) => (
                <div key={contact.id} className="flex items-center gap-2">
                  {mergeMode && (
                    <input
                      type="checkbox"
                      checked={selectedForMerge.has(contact.id)}
                      onChange={() => toggleContactSelection(contact.id)}
                      className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                    />
                  )}
                  <div className="flex-1">
                    <ContactCard
                      contact={contact}
                      onClick={() => mergeMode ? toggleContactSelection(contact.id) : handleSelectContact(contact)}
                      onEdit={() => handleEditContact(contact)}
                    />
                  </div>
                </div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Card>

      {/* Contact Form Modal */}
      {showForm && (
        <ContactForm
          contact={editingContact}
          onClose={handleCloseForm}
        />
      )}

      {/* Contact Detail Modal */}
      {selectedContact && (
        <ContactDetail
          contact={selectedContact}
          onClose={handleCloseDetail}
          onEdit={() => {
            handleCloseDetail();
            handleEditContact(selectedContact);
          }}
        />
      )}

      {/* Merge Contacts Modal */}
      {showMergeModal && contactsToMerge.length >= 2 && (
        <MergeContactsModal
          contacts={contactsToMerge}
          onClose={handleCloseMergeModal}
        />
      )}
    </>
  );
}
