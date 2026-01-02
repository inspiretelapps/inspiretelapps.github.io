import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { UserPlus, Building2, Mail, Phone, Link } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loader } from '@/components/ui/Loader';
import { formatPhoneNumber, normalizePhoneNumber } from '@/utils/phoneUtils';
import toast from 'react-hot-toast';
import type { Id } from '../../../convex/_generated/dataModel';

interface CreateContactFromCallModalProps {
  callId: Id<'callRecords'>;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateContactFromCallModal({
  callId,
  onClose,
  onSuccess,
}: CreateContactFromCallModalProps) {
  const callData = useQuery(api.calls.getCallDetail, { callId });
  const companies = useQuery(api.companies.listCompanies);
  const createContact = useMutation(api.contacts.createContactFromCall);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyId, setCompanyId] = useState<Id<'companies'> | undefined>();
  const [linkAllHistoricalCalls, setLinkAllHistoricalCalls] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!callData || !companies) {
    return (
      <Modal isOpen onClose={onClose} title="Create Contact">
        <div className="flex items-center justify-center p-8">
          <Loader size="lg" />
        </div>
      </Modal>
    );
  }

  const { call, relatedCalls } = callData;

  // Determine phone number to use
  const phoneNumber =
    call.callType === 'Inbound' ? call.callFrom : call.callTo;
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  // Suggest a name
  const suggestedName = `Unknown - ${formatPhoneNumber(phoneNumber)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setIsSubmitting(true);

    try {
      await createContact({
        callId,
        name: name.trim(),
        phoneNumber: normalizedPhone,
        companyId,
        email: email.trim() || undefined,
        linkAllHistoricalCalls,
      });

      toast.success('Contact created successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating contact:', error);
      toast.error(error.message || 'Failed to create contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Create Contact from Call"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Phone Number (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Phone Number
          </label>
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
            <Phone className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
              {formatPhoneNumber(phoneNumber)}
            </span>
          </div>
        </div>

        {/* Name */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Name *
          </label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={suggestedName}
            required
            autoFocus
          />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Email (optional)
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@example.com"
              className="pl-10"
            />
          </div>
        </div>

        {/* Company */}
        <div>
          <label
            htmlFor="company"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Company (optional)
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              id="company"
              value={companyId || ''}
              onChange={(e) =>
                setCompanyId(
                  e.target.value ? (e.target.value as Id<'companies'>) : undefined
                )
              }
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">No company</option>
              {companies.map((company: any) => (
                <option key={company._id} value={company._id}>
                  {company.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Link Historical Calls */}
        {relatedCalls.length > 0 && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={linkAllHistoricalCalls}
                onChange={(e) => setLinkAllHistoricalCalls(e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                  <Link className="w-4 h-4" />
                  Link all historical calls from this number
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {relatedCalls.length} other call{relatedCalls.length > 1 ? 's' : ''} will
                  be automatically linked to this contact
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Info Box */}
        <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            💡 This contact will be created with the phone number from the call. Future
            calls from this number will be automatically matched.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader size="sm" />
                <span className="ml-2">Creating...</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Create Contact
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
