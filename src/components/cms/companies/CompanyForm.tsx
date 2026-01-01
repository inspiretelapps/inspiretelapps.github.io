import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Company } from '@/types';
import { generateId } from '@/utils/phoneUtils';
import toast from 'react-hot-toast';

interface CompanyFormProps {
  company?: Company | null;
  onClose: () => void;
}

export function CompanyForm({ company, onClose }: CompanyFormProps) {
  const { addCompany, updateCompany } = useStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [name, setName] = useState(company?.name || '');
  const [patterns, setPatterns] = useState<string[]>(
    company?.phonePatterns.length ? [...company.phonePatterns] : ['']
  );

  const addPattern = () => {
    setPatterns((prev) => [...prev, '']);
  };

  const removePattern = (index: number) => {
    if (patterns.length > 1) {
      setPatterns((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const updatePattern = (index: number, value: string) => {
    setPatterns((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Company name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const validPatterns = patterns.filter((p) => p.trim());

      if (company) {
        // Update existing company
        updateCompany(company.id, {
          name: name.trim(),
          phonePatterns: validPatterns,
        });
        toast.success('Company updated');
      } else {
        // Create new company
        const newCompany: Company = {
          id: generateId(),
          name: name.trim(),
          phonePatterns: validPatterns,
          createdAt: now,
          updatedAt: now,
        };
        addCompany(newCompany);
        toast.success('Company created');
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving company:', error);
      toast.error(error.message || 'Failed to save company');
    } finally {
      setIsSubmitting(false);
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
            {company ? 'Edit Company' : 'New Company'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Company Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter company name"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Phone Patterns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Phone Number Patterns
              </label>
              <button
                type="button"
                onClick={addPattern}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Patterns to auto-match contacts (e.g., "+2711", "011" for Johannesburg numbers)
            </p>
            <div className="space-y-2">
              {patterns.map((pattern, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={pattern}
                    onChange={(e) => updatePattern(index, e.target.value)}
                    placeholder="e.g., +2711 or 011"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {patterns.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePattern(index)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
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
            {isSubmitting ? 'Saving...' : company ? 'Save Changes' : 'Create Company'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
