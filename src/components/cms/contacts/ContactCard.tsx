import { motion } from 'framer-motion';
import {
  Phone,
  Mail,
  Building2,
  ChevronRight,
  Edit2,
  Cloud,
  HardDrive,
} from 'lucide-react';
import type { Contact } from '@/types';
import { formatPhoneNumber } from '@/utils/phoneUtils';

interface ContactCardProps {
  contact: Contact;
  onClick: () => void;
  onEdit: () => void;
}

export function ContactCard({ contact, onClick, onEdit }: ContactCardProps) {
  const primaryPhone = contact.phones[0];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="group flex items-center gap-4 py-4 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* Avatar */}
      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
        {contact.name.charAt(0).toUpperCase()}
      </div>

      {/* Contact Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900 dark:text-white truncate">
            {contact.name}
          </h3>
          {/* Source indicator */}
          <span
            title={contact.source === 'yeastar' ? 'Synced from Yeastar' : 'Manual entry'}
            className="flex-shrink-0"
          >
            {contact.source === 'yeastar' ? (
              <Cloud className="w-3.5 h-3.5 text-blue-500" />
            ) : (
              <HardDrive className="w-3.5 h-3.5 text-gray-400" />
            )}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-500 dark:text-gray-400">
          {contact.company && (
            <span className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              {contact.company}
            </span>
          )}
          {primaryPhone && (
            <span className="flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" />
              {formatPhoneNumber(primaryPhone.number)}
            </span>
          )}
          {contact.email && (
            <span className="flex items-center gap-1 truncate">
              <Mail className="w-3.5 h-3.5" />
              {contact.email}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          title="Edit contact"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>
    </motion.div>
  );
}
