import { startOfToday, endOfToday, subDays, format } from 'date-fns';

/**
 * Date Range Utilities for Time-Based Reporting
 *
 * Provides consistent date range calculations for:
 * - Today
 * - Last 7 days
 * - Last 30 days
 * - Custom ranges
 */

export type DateRangePreset = 'today' | '7d' | '30d' | 'custom';

export interface DateRange {
  start: number;  // Unix timestamp (ms)
  end: number;    // Unix timestamp (ms)
}

/**
 * Get date range from preset
 */
export function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const end = endOfToday().getTime();

  switch (preset) {
    case 'today': {
      const start = startOfToday().getTime();
      return { start, end };
    }

    case '7d': {
      const start = subDays(startOfToday(), 6).getTime(); // Last 7 days including today
      return { start, end };
    }

    case '30d': {
      const start = subDays(startOfToday(), 29).getTime(); // Last 30 days including today
      return { start, end };
    }

    case 'custom':
    default: {
      // Default to last 30 days for custom (will be overridden by user selection)
      const start = subDays(startOfToday(), 29).getTime();
      return { start, end };
    }
  }
}

/**
 * Format date range for display
 */
export function formatDateRange(dateRange: DateRange): string {
  const startDate = new Date(dateRange.start);
  const endDate = new Date(dateRange.end);

  // If same day, show single date
  if (format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
    return format(startDate, 'MMM d, yyyy');
  }

  // If same month, optimize format
  if (format(startDate, 'yyyy-MM') === format(endDate, 'yyyy-MM')) {
    return `${format(startDate, 'MMM d')} - ${format(endDate, 'd, yyyy')}`;
  }

  // Different months
  return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: number): string {
  return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
}

/**
 * Format timestamp as time only
 */
export function formatTime(timestamp: number): string {
  return format(new Date(timestamp), 'h:mm a');
}

/**
 * Format timestamp as date only
 */
export function formatDate(timestamp: number): string {
  return format(new Date(timestamp), 'MMM d, yyyy');
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

/**
 * Get relative time description (e.g., "2 minutes ago")
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }

  return 'Just now';
}

/**
 * Check if a timestamp is today
 */
export function isToday(timestamp: number): boolean {
  const date = new Date(timestamp);
  const today = new Date();

  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Get start and end of day for a given timestamp
 */
export function getDayBounds(timestamp: number): DateRange {
  const date = new Date(timestamp);
  const start = new Date(date.setHours(0, 0, 0, 0)).getTime();
  const end = new Date(date.setHours(23, 59, 59, 999)).getTime();

  return { start, end };
}
