import { useState } from 'react';
import { Calendar } from 'lucide-react';
import {
  getDateRangeFromPreset,
  formatDateRange,
  type DateRange,
  type DateRangePreset,
} from '@/utils/dateUtils';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface DateRangePickerProps {
  value: DateRange;
  preset: DateRangePreset;
  onChange: (range: DateRange, preset: DateRangePreset) => void;
}

export function DateRangePicker({ value, preset, onChange }: DateRangePickerProps) {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handlePresetClick = (newPreset: DateRangePreset) => {
    if (newPreset === 'custom') {
      setShowCustomModal(true);
      return;
    }

    const range = getDateRangeFromPreset(newPreset);
    onChange(range, newPreset);
  };

  const handleCustomSubmit = () => {
    if (!customStart || !customEnd) return;

    const start = new Date(customStart).setHours(0, 0, 0, 0);
    const end = new Date(customEnd).setHours(23, 59, 59, 999);

    onChange({ start, end }, 'custom');
    setShowCustomModal(false);
    setCustomStart('');
    setCustomEnd('');
  };

  const presets: { value: DateRangePreset; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom Range' },
  ];

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Calendar className="w-4 h-4" />
          <span className="font-medium">{formatDateRange(value)}</span>
        </div>

        <div className="flex gap-1">
          {presets.map((p) => (
            <Button
              key={p.value}
              variant={preset === p.value ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => handlePresetClick(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      <Modal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        title="Custom Date Range"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              min={customStart}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCustomModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCustomSubmit}
              disabled={!customStart || !customEnd}
            >
              Apply
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
