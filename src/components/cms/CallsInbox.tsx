import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Search,
  Filter,
  UserPlus,
  Clock,
  Mic,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { DateRangePicker } from './DateRangePicker';
import { CallDetailDrawer } from './CallDetailDrawer';
import { CreateContactFromCallModal } from './CreateContactFromCallModal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Loader } from '@/components/ui/Loader';
import {
  formatTimestamp,
  formatDuration,
  getDateRangeFromPreset,
  type DateRange,
  type DateRangePreset,
} from '@/utils/dateUtils';
import { formatPhoneNumber } from '@/utils/phoneUtils';
import type { CallsInboxFilters, CallType } from '@/types/convex';
import type { Id } from '../../../convex/_generated/dataModel';

export function CallsInbox() {
  // Date range state
  const [datePreset, setDatePreset] = useState<DateRangePreset>('30d');
  const [dateRange, setDateRange] = useState<DateRange>(
    getDateRangeFromPreset('30d')
  );

  // Filter state
  const [callType, setCallType] = useState<CallType | undefined>();
  const [disposition, setDisposition] = useState<string | undefined>();
  const [hasRecording, setHasRecording] = useState<boolean | undefined>();
  const [matchStatus, setMatchStatus] = useState<
    'matched' | 'unmatched' | undefined
  >();
  const [extensionId, setExtensionId] = useState<string | undefined>();

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination state
  const [page, setPage] = useState(0);
  const [limit] = useState(50);

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<Id<'callRecords'> | null>(
    null
  );
  const [createContactCallId, setCreateContactCallId] = useState<
    Id<'callRecords'> | null
  >(null);

  // Build filters object
  const filters: CallsInboxFilters = {
    dateRange,
    callType,
    disposition,
    hasRecording,
    matchStatus,
    extensionId,
  };

  // Fetch calls from Convex
  const callsData = useQuery(api.calls.listCallsForInbox, {
    filters,
    search: searchTerm || undefined,
    pagination: { page, limit },
  });

  // Unmatched calls count for badge
  const unmatchedCount = useQuery(api.calls.getUnmatchedCallsCount, {
    dateRange,
  });

  const handleDateRangeChange = (range: DateRange, preset: DateRangePreset) => {
    setDateRange(range);
    setDatePreset(preset);
    setPage(0); // Reset to first page
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(0); // Reset to first page
  };

  const handleFilterChange = () => {
    setPage(0); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setCallType(undefined);
    setDisposition(undefined);
    setHasRecording(undefined);
    setMatchStatus(undefined);
    setExtensionId(undefined);
    setSearchTerm('');
    setPage(0);
  };

  const getCallTypeIcon = (type: CallType) => {
    switch (type) {
      case 'Inbound':
        return <PhoneIncoming className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'Outbound':
        return <PhoneOutgoing className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'Internal':
        return <Phone className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getDispositionBadge = (disp: string) => {
    const isAnswered = disp === 'ANSWERED';
    return (
      <Badge variant={isAnswered ? 'success' : 'error'}>
        {isAnswered ? (
          <CheckCircle className="w-3 h-3 mr-1" />
        ) : (
          <XCircle className="w-3 h-3 mr-1" />
        )}
        {disp}
      </Badge>
    );
  };

  if (!callsData) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader size="lg" />
      </div>
    );
  }

  const { calls, total, totalPages } = callsData;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Calls Inbox
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Review and manage call records
            {unmatchedCount !== undefined && unmatchedCount > 0 && (
              <Badge variant="warning" className="ml-2">
                {unmatchedCount} unmatched
              </Badge>
            )}
          </p>
        </div>
      </div>

      {/* Date Range Picker */}
      <DateRangePicker
        value={dateRange}
        preset={datePreset}
        onChange={handleDateRangeChange}
      />

      {/* Search & Filters */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by phone number, contact, or extension..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <Button
          variant={showFilters ? 'primary' : 'secondary'}
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Call Type */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Direction
              </label>
              <select
                value={callType || ''}
                onChange={(e) => {
                  setCallType(e.target.value as CallType | undefined);
                  handleFilterChange();
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All</option>
                <option value="Inbound">Inbound</option>
                <option value="Outbound">Outbound</option>
                <option value="Internal">Internal</option>
              </select>
            </div>

            {/* Disposition */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={disposition || ''}
                onChange={(e) => {
                  setDisposition(e.target.value || undefined);
                  handleFilterChange();
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All</option>
                <option value="ANSWERED">Answered</option>
                <option value="NO ANSWER">No Answer</option>
                <option value="BUSY">Busy</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            {/* Recording */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Recording
              </label>
              <select
                value={
                  hasRecording === undefined ? '' : hasRecording ? 'yes' : 'no'
                }
                onChange={(e) => {
                  setHasRecording(
                    e.target.value === ''
                      ? undefined
                      : e.target.value === 'yes'
                  );
                  handleFilterChange();
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All</option>
                <option value="yes">Has Recording</option>
                <option value="no">No Recording</option>
              </select>
            </div>

            {/* Match Status */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contact
              </label>
              <select
                value={matchStatus || ''}
                onChange={(e) => {
                  setMatchStatus(
                    e.target.value as 'matched' | 'unmatched' | undefined
                  );
                  handleFilterChange();
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">All</option>
                <option value="matched">Has Contact</option>
                <option value="unmatched">Unmatched</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </div>
      )}

      {/* Calls Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Direction
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  From → To
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {calls.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    No calls found for the selected filters
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr
                    key={call._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedCallId(call._id)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {formatTimestamp(call.startTime)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getCallTypeIcon(call.callType)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      <div className="flex items-center gap-2">
                        <span>{formatPhoneNumber(call.callFrom)}</span>
                        <span className="text-gray-400">→</span>
                        <span>{formatPhoneNumber(call.callTo)}</span>
                      </div>
                      {call.extensionName && (
                        <div className="text-xs text-gray-500 mt-1">
                          Ext: {call.extensionName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {formatDuration(call.talkDuration)}
                      {call.hasRecording && (
                        <Mic className="inline-block w-3 h-3 ml-2 text-blue-600 dark:text-blue-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {getDispositionBadge(call.disposition)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {call.contact ? (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {call.contact.name}
                          </div>
                          {call.company && (
                            <div className="text-xs text-gray-500">
                              {call.company.name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="warning">Unmatched</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {!call.contact && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCreateContactCallId(call._id);
                          }}
                        >
                          <UserPlus className="w-4 h-4 mr-1" />
                          Create Contact
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of{' '}
              {total} calls
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 0}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages - 1}
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Call Detail Drawer */}
      {selectedCallId && (
        <CallDetailDrawer
          callId={selectedCallId}
          onClose={() => setSelectedCallId(null)}
          onCreateContact={(callId) => {
            setSelectedCallId(null);
            setCreateContactCallId(callId);
          }}
        />
      )}

      {/* Create Contact Modal */}
      {createContactCallId && (
        <CreateContactFromCallModal
          callId={createContactCallId}
          onClose={() => setCreateContactCallId(null)}
          onSuccess={() => {
            setCreateContactCallId(null);
            // Calls will auto-refresh via Convex subscription
          }}
        />
      )}
    </div>
  );
}
