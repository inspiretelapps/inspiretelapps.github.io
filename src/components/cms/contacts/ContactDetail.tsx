import { useState, useEffect } from 'react';
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
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
} from 'lucide-react';
import { useStore } from '@/store/useStore';
import type { Contact, CallRecord } from '@/types';
import { formatPhoneNumber, getPhoneTypeLabel, normalizePhoneNumber, phoneNumbersMatch } from '@/utils/phoneUtils';
import { deleteCompanyContact, fetchCDR } from '@/services/api';
import toast from 'react-hot-toast';

interface ContactDetailProps {
  contact: Contact;
  onClose: () => void;
  onEdit: () => void;
}

interface CallStats {
  inbound: number;
  outbound: number;
  missed: number;
}

interface ContactCall extends CallRecord {
  direction: 'inbound' | 'outbound';
  wasAnswered: boolean;
}

type CallFilter = 'all' | 'received' | 'made' | 'missed';

export function ContactDetail({ contact, onClose, onEdit }: ContactDetailProps) {
  const { deleteContact } = useStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [callStats, setCallStats] = useState<CallStats>({ inbound: 0, outbound: 0, missed: 0 });
  const [recentCalls, setRecentCalls] = useState<ContactCall[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [callFilter, setCallFilter] = useState<CallFilter>('all');

  // Fetch call statistics and CDR for this contact's phone numbers
  useEffect(() => {
    const fetchCallData = async () => {
      setLoadingStats(true);
      try {
        // Get phone numbers for this contact
        const contactPhones = contact.phones.map((p) => p.number);

        // Fetch recent CDR (last 90 days, up to 1000 records)
        const endTime = new Date().toISOString().replace('T', ' ').slice(0, 19);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        const startTime = startDate.toISOString().replace('T', ' ').slice(0, 19);

        const result = await fetchCDR(1, 1000, { startTime, endTime });

        // Filter and count calls involving this contact's phone numbers
        const stats: CallStats = { inbound: 0, outbound: 0, missed: 0 };
        const calls: ContactCall[] = [];

        for (const call of result.data) {
          // Check if contact's number is in call_from or call_to
          const matchesFrom = contactPhones.some((num) => phoneNumbersMatch(call.call_from, num));
          const matchesTo = contactPhones.some((num) => phoneNumbersMatch(call.call_to, num));

          if (!matchesFrom && !matchesTo) continue;

          const wasAnswered = call.disposition === 'ANSWERED';

          // Determine direction based on call_type and which field matches:
          // - Inbound call where contact is in call_from = Contact called us
          // - Outbound call where contact is in call_to = We called contact
          let direction: 'inbound' | 'outbound';

          if (call.call_type === 'Inbound' && matchesFrom) {
            // External caller (contact) called us - this is inbound FROM the contact
            direction = 'inbound';
            if (wasAnswered) {
              stats.inbound++;
            } else {
              stats.missed++;
            }
          } else if (call.call_type === 'Outbound' && matchesTo) {
            // We called external number (contact) - this is outbound TO the contact
            direction = 'outbound';
            if (wasAnswered) {
              stats.outbound++;
            } else {
              stats.missed++;
            }
          } else if (matchesFrom || matchesTo) {
            // Internal calls or other scenarios - use best guess
            direction = matchesFrom ? 'inbound' : 'outbound';
            if (wasAnswered) {
              if (direction === 'inbound') stats.inbound++;
              else stats.outbound++;
            } else {
              stats.missed++;
            }
          } else {
            continue;
          }

          calls.push({
            ...call,
            direction,
            wasAnswered,
          });
        }

        // Sort by time descending (most recent first)
        calls.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

        setCallStats(stats);
        setRecentCalls(calls.slice(0, 20)); // Keep last 20 calls
      } catch (error) {
        console.error('Error fetching call data:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    if (contact.phones.length > 0) {
      fetchCallData();
    } else {
      setLoadingStats(false);
    }
  }, [contact.phones]);

  // Format phone number for tel: link (ensure it starts with +)
  const formatTelLink = (phoneNumber: string): string => {
    const normalized = normalizePhoneNumber(phoneNumber);
    // If it doesn't start with +, add + (assuming it's a valid international format)
    return normalized.startsWith('+') ? normalized : `+${normalized}`;
  };

  // Format call time for display
  const formatCallTime = (time: string): string => {
    const date = new Date(time);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  // Format duration in seconds to readable format
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  // Toggle filter on stat card click
  const toggleFilter = (filter: CallFilter) => {
    setCallFilter((prev) => (prev === filter ? 'all' : filter));
  };

  // Filter calls based on selected filter
  const filteredCalls = recentCalls.filter((call) => {
    if (callFilter === 'all') return true;
    if (callFilter === 'received') return call.direction === 'inbound' && call.wasAnswered;
    if (callFilter === 'made') return call.direction === 'outbound' && call.wasAnswered;
    if (callFilter === 'missed') return !call.wasAnswered;
    return true;
  });

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
          {/* Call Statistics */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              Call Statistics (Last 90 Days)
            </h3>
            {loadingStats ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => toggleFilter('received')}
                  className={`flex flex-col items-center p-3 rounded-lg transition-all ${
                    callFilter === 'received'
                      ? 'bg-green-200 dark:bg-green-800/50 ring-2 ring-green-500'
                      : 'bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30'
                  }`}
                >
                  <PhoneIncoming className="w-5 h-5 text-green-600 dark:text-green-400 mb-1" />
                  <span className="text-lg font-semibold text-green-700 dark:text-green-300">{callStats.inbound}</span>
                  <span className="text-xs text-green-600 dark:text-green-400">Received</span>
                </button>
                <button
                  onClick={() => toggleFilter('made')}
                  className={`flex flex-col items-center p-3 rounded-lg transition-all ${
                    callFilter === 'made'
                      ? 'bg-blue-200 dark:bg-blue-800/50 ring-2 ring-blue-500'
                      : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                  }`}
                >
                  <PhoneOutgoing className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-1" />
                  <span className="text-lg font-semibold text-blue-700 dark:text-blue-300">{callStats.outbound}</span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">Made</span>
                </button>
                <button
                  onClick={() => toggleFilter('missed')}
                  className={`flex flex-col items-center p-3 rounded-lg transition-all ${
                    callFilter === 'missed'
                      ? 'bg-red-200 dark:bg-red-800/50 ring-2 ring-red-500'
                      : 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                  }`}
                >
                  <PhoneMissed className="w-5 h-5 text-red-600 dark:text-red-400 mb-1" />
                  <span className="text-lg font-semibold text-red-700 dark:text-red-300">{callStats.missed}</span>
                  <span className="text-xs text-red-600 dark:text-red-400">Missed</span>
                </button>
              </div>
            )}
          </div>

          {/* Recent Call History */}
          {!loadingStats && recentCalls.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {callFilter === 'all' ? 'Recent Calls' :
                   callFilter === 'received' ? 'Received Calls' :
                   callFilter === 'made' ? 'Made Calls' : 'Missed Calls'}
                  {callFilter !== 'all' && (
                    <span className="ml-2 text-gray-400">({filteredCalls.length})</span>
                  )}
                </h3>
                {callFilter !== 'all' && (
                  <button
                    onClick={() => setCallFilter('all')}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Show all
                  </button>
                )}
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredCalls.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
                    No {callFilter === 'received' ? 'received' : callFilter === 'made' ? 'made' : 'missed'} calls
                  </p>
                ) : filteredCalls.map((call, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm"
                  >
                    {/* Direction Icon */}
                    <div className={`p-1.5 rounded-full ${
                      !call.wasAnswered
                        ? 'bg-red-100 dark:bg-red-900/30'
                        : call.direction === 'inbound'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      {!call.wasAnswered ? (
                        <PhoneMissed className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                      ) : call.direction === 'inbound' ? (
                        <PhoneIncoming className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                      ) : (
                        <PhoneOutgoing className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>

                    {/* Call Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 dark:text-white truncate">
                        {call.direction === 'inbound' ? call.call_to : call.call_from}
                        <span className="text-gray-400 mx-1">→</span>
                        {call.direction === 'inbound' ? call.call_from : call.call_to}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatCallTime(call.time)}
                        {call.wasAnswered && call.talk_duration > 0 && (
                          <span className="ml-2">({formatDuration(call.talk_duration)})</span>
                        )}
                      </p>
                    </div>

                    {/* Status */}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      call.wasAnswered
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {call.disposition}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                    <a
                      href={`tel:${formatTelLink(phone.number)}`}
                      className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors"
                      title="Click to call"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
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
