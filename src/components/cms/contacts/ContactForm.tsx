import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Contact, ContactPhone, ContactPhoneType } from '@/types';
import { generateId, getPhoneTypeLabel } from '@/utils/phoneUtils';
import {
  createCompanyContact,
  updateCompanyContact,
} from '@/services/api';
import { contactToYeastarFormat } from '@/utils/phoneUtils';
import toast from 'react-hot-toast';

interface ContactFormProps {
  contact?: Contact | null;
  onClose: () => void;
}

const PHONE_TYPES: ContactPhoneType[] = [
  'mobile',
  'business',
  'home',
  'mobile2',
  'business2',
  'home2',
  'business_fax',
  'home_fax',
  'other',
];

export function ContactForm({ contact, onClose }: ContactFormProps) {
  const { addContact, updateContact, setCmsLoading } = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: contact?.name || '',
    company: contact?.company || '',
    email: contact?.email || '',
    remark: contact?.remark || '',
  });

  const [phones, setPhones] = useState<ContactPhone[]>(
    contact?.phones.length ? [...contact.phones] : [{ type: 'mobile', number: '' }]
  );

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhoneChange = (index: number, field: 'type' | 'number', value: string) => {
    setPhones((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addPhoneField = () => {
    // Find unused phone type
    const usedTypes = new Set(phones.map((p) => p.type));
    const availableType = PHONE_TYPES.find((t) => !usedTypes.has(t)) || 'other';
    setPhones((prev) => [...prev, { type: availableType, number: '' }]);
  };

  const removePhoneField = (index: number) => {
    if (phones.length > 1) {
      setPhones((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    const validPhones = phones.filter((p) => p.number.trim());
    if (validPhones.length === 0) {
      toast.error('At least one phone number is required');
      return;
    }

    setIsSubmitting(true);
    setCmsLoading('contacts', true);

    try {
      const now = new Date().toISOString();

      if (contact) {
        // Update existing contact
        const updatedContact: Partial<Contact> = {
          name: formData.name.trim(),
          company: formData.company.trim() || undefined,
          email: formData.email.trim() || undefined,
          remark: formData.remark.trim() || undefined,
          phones: validPhones,
          updatedAt: now,
          syncStatus: 'pending',
        };

        // Always sync to Yeastar (two-way sync)
        const fullContact = { ...contact, ...updatedContact } as Contact;
        const yeastarData = contactToYeastarFormat(fullContact);

        if (contact.yeastarContactId) {
          // Update existing Yeastar contact
          const success = await updateCompanyContact(contact.yeastarContactId, yeastarData);
          if (success) {
            updatedContact.syncStatus = 'synced';
            updatedContact.source = 'yeastar';
          }
        } else {
          // Create new Yeastar contact for manual contacts being synced
          const result = await createCompanyContact(yeastarData);
          if (result.success && result.id) {
            updatedContact.yeastarContactId = result.id;
            updatedContact.source = 'yeastar';
            updatedContact.syncStatus = 'synced';
          }
        }

        updateContact(contact.id, updatedContact);
        toast.success('Contact updated and synced to Yeastar');
      } else {
        // Create new contact
        const newContact: Contact = {
          id: generateId(),
          name: formData.name.trim(),
          company: formData.company.trim() || undefined,
          email: formData.email.trim() || undefined,
          remark: formData.remark.trim() || undefined,
          phones: validPhones,
          source: 'manual',
          syncStatus: 'pending',
          createdAt: now,
          updatedAt: now,
        };

        // Try to sync to Yeastar
        const yeastarData = contactToYeastarFormat(newContact);
        const result = await createCompanyContact(yeastarData);

        if (result.success && result.id) {
          newContact.yeastarContactId = result.id;
          newContact.source = 'yeastar';
          newContact.syncStatus = 'synced';
        }

        addContact(newContact);
        toast.success(newContact.syncStatus === 'synced' ? 'Contact created and synced to Yeastar' : 'Contact created (sync pending)');
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving contact:', error);
      toast.error(error.message || 'Failed to save contact');
    } finally {
      setIsSubmitting(false);
      setCmsLoading('contacts', false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {contact ? 'Edit Contact' : 'New Contact'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Contact name"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Company */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => handleInputChange('company', e.target.value)}
              placeholder="Company name"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="email@example.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Phone Numbers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Phone Numbers *
              </label>
              <button
                type="button"
                onClick={addPhoneField}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            <div className="space-y-3">
              {phones.map((phone, index) => (
                <div key={index} className="flex gap-2">
                  <select
                    value={phone.type}
                    onChange={(e) => handlePhoneChange(index, 'type', e.target.value)}
                    className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {PHONE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {getPhoneTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={phone.number}
                    onChange={(e) => handlePhoneChange(index, 'number', e.target.value)}
                    placeholder="Phone number"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhoneField(index)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes/Remark */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.remark}
              onChange={(e) => handleInputChange('remark', e.target.value)}
              placeholder="Additional notes..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </form>

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
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            {isSubmitting ? 'Saving...' : contact ? 'Save Changes' : 'Create Contact'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
