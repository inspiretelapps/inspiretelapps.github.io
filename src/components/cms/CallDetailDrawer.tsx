import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  X,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Mic,
  UserPlus,
  Building2,
  User,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import { Card } from '@/components/ui/Card';
import {
  formatTimestamp,
  formatDuration,
  formatDate,
  formatTime,
} from '@/utils/dateUtils';
import { formatPhoneNumber } from '@/utils/phoneUtils';
import type { Id } from '../../../convex/_generated/dataModel';

interface CallDetailDrawerProps {
  callId: Id<'callRecords'>;
  onClose: () => void;
  onCreateContact: (callId: Id<'callRecords'>) => void;
}

export function CallDetailDrawer({
  callId,
  onClose,
  onCreateContact,
}: CallDetailDrawerProps) {
  const data = useQuery(api.calls.getCallDetail, { callId });

  if (!data) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8">
          <Loader size="lg" />
        </div>
      </div>
    );
  }

  const { call, contact, company, relatedCalls, notes } = data;

  const getCallTypeIcon = () => {
    switch (call.callType) {
      case 'Inbound':
        return <PhoneIncoming className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'Outbound':
        return <PhoneOutgoing className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'Internal':
        return <Phone className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full max-w-2xl h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            {getCallTypeIcon()}
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Call Details
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {formatTimestamp(call.startTime)}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Call Metadata */}
          <Card>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Status
                </span>
                <Badge
                  variant={
                    call.disposition === 'ANSWERED' ? 'success' : 'error'
                  }
                >
                  {call.disposition}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  From
                </span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                  {formatPhoneNumber(call.callFrom)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  To
                </span>
                <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                  {formatPhoneNumber(call.callTo)}
                </span>
              </div>

              {call.extensionName && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Extension
                  </span>
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {call.extensionName} ({call.extensionId})
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Duration
                </span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {formatDuration(call.talkDuration)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Date
                </span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {formatDate(call.startTime)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Time
                </span>
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {formatTime(call.startTime)}
                </span>
              </div>
            </div>
          </Card>

          {/* Recording */}
          {call.hasRecording && call.recordingUrl && (
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Mic className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Recording
                  </h3>
                </div>
                <audio controls className="w-full">
                  <source src={call.recordingUrl} type="audio/mpeg" />
                  Your browser does not support audio playback.
                </audio>
              </div>
            </Card>
          )}

          {/* Contact Info */}
          {contact ? (
            <Card>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Contact
                  </h3>
                </div>
                <div className="space-y-2">
                  <div className="text-lg font-medium text-gray-900 dark:text-white">
                    {contact.name}
                  </div>
                  {contact.email && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {contact.email}
                    </div>
                  )}
                  {company && (
                    <div className="flex items-center gap-2 mt-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {company.name}
                      </span>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Matched: {call.matchMethod} •{' '}
                    {formatTimestamp(call.matchedAt!)}
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-4">
                <div className="text-center py-6">
                  <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    No Contact Linked
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Create a contact from this call
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => onCreateContact(callId)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Create Contact
                  </Button>

                  {relatedCalls.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        💡 {relatedCalls.length} other call
                        {relatedCalls.length > 1 ? 's' : ''} from this number
                        can be linked automatically
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Notes */}
          {notes.length > 0 && (
            <Card>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Notes ({notes.length})
                </h3>
                <div className="space-y-2">
                  {notes.map((note) => (
                    <div
                      key={note._id}
                      className="p-3 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {note.content}
                      </p>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatTimestamp(note.createdAt)}
                        {note.createdBy && ` • ${note.createdBy}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Related Calls (if unmatched) */}
          {!contact && relatedCalls.length > 0 && (
            <Card>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Other Calls from This Number ({relatedCalls.length})
                </h3>
                <div className="space-y-2">
                  {relatedCalls.slice(0, 5).map((relatedCall) => (
                    <div
                      key={relatedCall._id}
                      className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-gray-700 rounded"
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatDate(relatedCall.startTime)}
                        </span>
                      </div>
                      <Badge
                        variant={
                          relatedCall.disposition === 'ANSWERED'
                            ? 'success'
                            : 'error'
                        }
                      >
                        {relatedCall.disposition}
                      </Badge>
                    </div>
                  ))}
                  {relatedCalls.length > 5 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center pt-1">
                      + {relatedCalls.length - 5} more
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
