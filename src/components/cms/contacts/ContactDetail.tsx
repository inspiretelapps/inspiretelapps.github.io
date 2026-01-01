import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Phone,
  Mail,
  Building2,
  Edit2,
  Trash2,
  Cloud,
  HardDrive,
  Clock,
  PhoneCall,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Contact } from '@/types';
import { formatPhoneNumber, getPhoneTypeLabel } from '@/utils/phoneUtils';
import { dialCall, deleteCompanyContact } from '@/services/api';
import toast from 'react-hot-toast';

interface ContactDetailProps {
  contact: Contact;
  onClose: () => void;
  onEdit: () => void;
}

export function ContactDetail({ contact, onClose, onEdit }: ContactDetailProps) {
  const { deleteContact, callerExtension } = useStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [callingNumber, setCallingNumber] = useState<string | null>(null);

  const handleCall = async (phoneNumber: string) => {
    if (!callerExtension) {
      toast.error('Please select your extension in the header first');
      return;
    }

    setCallingNumber(phoneNumber);
    try {
      const result = await dialCall(callerExtension, phoneNumber);
      if (result.success) {
        toast.success(`Calling ${formatPhoneNumber(phoneNumber)}...`);
      } else {
        toast.error('Failed to initiate call');
      }
    } catch (error: any) {
      console.error('Call error:', error);
      toast.error(error.message || 'Failed to initiate call');
    } finally {
      setCallingNumber(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${contact.name}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      // Delete from Yeastar if synced
      if (contact.source === 'yeastar' && contact.yeastarContactId) {
        await deleteCompanyContact(contact.yeastarContactId);
      }

      deleteContact(contact.id);
      toast.success('Contact deleted');
      onClose();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.message || 'Failed to delete contact');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="relative p-6 pb-4 bg-gradient-to-br from-blue-500 to-purple-600">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white font-bold text-2xl">
              {contact.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{contact.name}</h2>
              {contact.company && (
                <p className="text-white/80 text-sm flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {contact.company}
                </p>
              )}
            </div>
          </div>

          {/* Source badge */}
          <div className="absolute bottom-4 right-4">
            <span
              className={`
                inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
                ${contact.source === 'yeastar'
                  ? 'bg-blue-400/30 text-white'
                  : 'bg-gray-400/30 text-white'
                }
              `}
            >
              {contact.source === 'yeastar' ? (
                <>
                  <Cloud className="w-3 h-3" />
                  Yeastar
                </>
              ) : (
                <>
                  <HardDrive className="w-3 h-3" />
                  Manual
                </>
              )}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[50vh] overflow-y-auto">
          {/* Phone Numbers */}
          {contact.phones.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Phone Numbers
              </h3>
              <div className="space-y-2">
                {contact.phones.map((phone, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {getPhoneTypeLabel(phone.type)}
                      </p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatPhoneNumber(phone.number)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCall(phone.number)}
                      disabled={callingNumber === phone.number}
                      className="p-2 bg-green-500 hover:bg-green-600 disabled:bg-green-400 text-white rounded-full transition-colors"
                      title="Click to call"
                    >
                      {callingNumber === phone.number ? (
                        <PhoneCall className="w-4 h-4 animate-pulse" />
                      ) : (
                        <Phone className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Email */}
          {contact.email && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Email
              </h3>
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Mail className="w-4 h-4" />
                {contact.email}
              </a>
            </div>
          )}

          {/* Notes */}
          {contact.remark && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Notes
              </h3>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {contact.remark}
              </p>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
            <p className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Created: {new Date(contact.createdAt).toLocaleString()}
            </p>
            <p className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Updated: {new Date(contact.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>
      </motion.div>
    </div>
  );
}
