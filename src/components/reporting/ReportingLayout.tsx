import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Calendar,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  TrendingUp,
  BarChart3,
  RefreshCw,
  ChevronDown,
  User,
  Activity,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { fetchExtensions, fetchCDR, fetchCallStats } from '@/services/api';
import type { Extension, CallRecord, ExtensionReportData, MonthlyCallData } from '@/types';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export function ReportingLayout() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingExtensions, setLoadingExtensions] = useState(true);
  const [reportData, setReportData] = useState<ExtensionReportData | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showExtensionDropdown, setShowExtensionDropdown] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadExtensions();
  }, []);

  const loadExtensions = async () => {
    try {
      setLoadingExtensions(true);
      const exts = await fetchExtensions();
      setExtensions(exts);
    } catch (error: any) {
      toast.error('Failed to load extensions');
      console.error(error);
    } finally {
      setLoadingExtensions(false);
    }
  };

  // Generate multiple date formats to try - PBX date format must match its configuration
  const getDateFormats = (date: string, isEndOfDay: boolean): string[] => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const time = isEndOfDay ? '23:59:59' : '00:00:00';
    const time12hr = isEndOfDay ? '11:59:59 PM' : '12:00:00 AM';

    // Return multiple formats to try - order by most common
    return [
      `${year}/${month}/${day} ${time}`,           // YYYY/MM/DD HH:MM:SS (24hr)
      `${month}/${day}/${year} ${time}`,           // MM/DD/YYYY HH:MM:SS (24hr)
      `${day}/${month}/${year} ${time}`,           // DD/MM/YYYY HH:MM:SS (24hr)
      `${year}-${month}-${day} ${time}`,           // YYYY-MM-DD HH:MM:SS (24hr)
      `${year}/${month}/${day} ${time12hr}`,       // YYYY/MM/DD with AM/PM
      `${month}/${day}/${year} ${time12hr}`,       // MM/DD/YYYY with AM/PM
    ];
  };

  const generateReport = async () => {
    if (!selectedExtension) {
      toast.error('Please select an extension');
      return;
    }
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Start date must be before end date');
      return;
    }

    setLoading(true);
    try {
      const extNumber = selectedExtension.number;
      const extId = selectedExtension.id;

      // Get date format options to try
      const startFormats = getDateFormats(startDate, false);
      const endFormats = getDateFormats(endDate, true);

      // Try to get call statistics using call_report API (more reliable)
      let callStatsData = null;
      let workingDateFormat = 0;

      for (let i = 0; i < startFormats.length; i++) {
        try {
          const stats = await fetchCallStats([extId], startFormats[i], endFormats[i]);
          if (stats && stats.length > 0) {
            callStatsData = stats.find(s => s.ext_num === extNumber) || stats[0];
            workingDateFormat = i;
            console.log('Call stats API succeeded with format:', startFormats[i]);
            break;
          }
        } catch (err) {
          console.warn(`Date format ${i} failed for call_report:`, startFormats[i]);
        }
      }

      // Fetch CDR data with pagination for monthly breakdown
      let allRecords: CallRecord[] = [];
      let page = 1;
      let hasMore = true;
      const pageSize = 300;
      let useFilters = false;
      let startTime = startFormats[workingDateFormat];
      let endTime = endFormats[workingDateFormat];

      // First, try to fetch with date filters using the working format
      try {
        const testResult = await fetchCDR(1, 10, {
          startTime,
          endTime,
        });
        // If we got here with data, filters work
        if (testResult.data.length > 0) {
          allRecords = [...testResult.data];
          hasMore = testResult.hasMore;
          page = 2;
          useFilters = true;
        }
      } catch (filterError) {
        console.warn('CDR date filter failed, will try other formats or fetch all');
      }

      // If first format didn't work, try other formats
      if (!useFilters && allRecords.length === 0) {
        for (let i = 0; i < startFormats.length && !useFilters; i++) {
          if (i === workingDateFormat) continue; // Already tried this one
          try {
            const testResult = await fetchCDR(1, 10, {
              startTime: startFormats[i],
              endTime: endFormats[i],
            });
            if (testResult.data.length > 0) {
              allRecords = [...testResult.data];
              hasMore = testResult.hasMore;
              page = 2;
              useFilters = true;
              startTime = startFormats[i];
              endTime = endFormats[i];
              console.log('CDR API succeeded with format:', startFormats[i]);
              break;
            }
          } catch (err) {
            // Continue to next format
          }
        }
      }

      // If date filters still don't work, fallback to unfiltered fetch
      if (!useFilters) {
        console.warn('CDR date filter failed for all formats, fetching all records');
        toast('Fetching all records (API filter unavailable)', { icon: 'ℹ️' });
      }

      // Continue fetching remaining pages
      while (hasMore) {
        try {
          const result = await fetchCDR(
            page,
            pageSize,
            useFilters ? { startTime, endTime } : undefined
          );

          allRecords = [...allRecords, ...result.data];
          hasMore = result.hasMore && result.data.length === pageSize;
          page++;

          // Safety limit - more pages when not filtering
          if (page > (useFilters ? 100 : 50)) break;
        } catch (pageError) {
          console.warn('Error fetching page', page, pageError);
          break;
        }
      }

      // If we fetched without filters, filter by date locally
      if (!useFilters) {
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0);
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);

        allRecords = allRecords.filter((record) => {
          // Parse date - try multiple formats
          let recordDate: Date;
          try {
            // Try YYYY/MM/DD format first
            recordDate = new Date(record.time.replace(/\//g, '-'));
          } catch {
            // Try MM/DD/YYYY format
            const parts = record.time.split(/[\s\/\-]/);
            if (parts.length >= 3) {
              const [p1, p2, p3] = parts;
              // Determine if MM/DD/YYYY or DD/MM/YYYY based on values
              if (parseInt(p1) > 12) {
                recordDate = new Date(`${p3}-${p2}-${p1}`);
              } else if (parseInt(p3) > 31) {
                recordDate = new Date(`${p3}-${p1}-${p2}`);
              } else {
                recordDate = new Date(record.time);
              }
            } else {
              recordDate = new Date(record.time);
            }
          }
          return recordDate >= startDateObj && recordDate <= endDateObj;
        });
      }

      // Log CDR data status
      console.log('Total CDR records fetched:', allRecords.length);
      if (allRecords.length > 0) {
        console.log('Sample record:', allRecords[0]);
      }

      // Filter records for the selected extension
      const extensionRecords = allRecords.filter(
        (record) =>
          record.call_from === extNumber ||
          record.call_to === extNumber ||
          record.call_from?.includes(extNumber) ||
          record.call_to?.includes(extNumber)
      );

      console.log('Extension records found:', extensionRecords.length, 'for extension', extNumber);

      // Calculate statistics
      const inboundCalls = extensionRecords.filter(
        (r) => r.call_type === 'Inbound' && (r.call_to === extNumber || r.call_to.includes(extNumber))
      );
      const outboundCalls = extensionRecords.filter(
        (r) => r.call_type === 'Outbound' && (r.call_from === extNumber || r.call_from.includes(extNumber))
      );
      const missedCalls = extensionRecords.filter(
        (r) =>
          (r.disposition === 'NO ANSWER' || r.disposition === 'BUSY' || r.disposition === 'FAILED') &&
          (r.call_to === extNumber || r.call_to.includes(extNumber))
      );
      const answeredCalls = extensionRecords.filter(
        (r) => r.disposition === 'ANSWERED'
      );

      const inboundSeconds = inboundCalls.reduce((sum, r) => sum + (r.talk_duration || 0), 0);
      const outboundSeconds = outboundCalls.reduce((sum, r) => sum + (r.talk_duration || 0), 0);
      const totalSeconds = extensionRecords.reduce((sum, r) => sum + (r.talk_duration || 0), 0);

      // Calculate monthly data
      const monthlyDataMap = new Map<string, MonthlyCallData>();

      // Initialize all months in the range
      const start = new Date(startDate);
      const end = new Date(endDate);
      let current = new Date(start.getFullYear(), start.getMonth(), 1);

      while (current <= end) {
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        const monthName = current.toLocaleString('default', { month: 'short', year: 'numeric' });
        monthlyDataMap.set(monthKey, {
          month: monthName,
          monthKey,
          inboundCalls: 0,
          outboundCalls: 0,
          missedCalls: 0,
          inboundMinutes: 0,
          outboundMinutes: 0,
          totalMinutes: 0,
        });
        current.setMonth(current.getMonth() + 1);
      }

      // Helper function to parse CDR date in various formats
      const parseCdrDate = (timeStr: string): Date => {
        if (!timeStr) return new Date();

        // Try parsing different formats
        // Format 1: YYYY/MM/DD HH:MM:SS or YYYY-MM-DD HH:MM:SS
        let match = timeStr.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})/);
        if (match) {
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
                         parseInt(match[4]), parseInt(match[5]), parseInt(match[6]));
        }

        // Format 2: MM/DD/YYYY HH:MM:SS
        match = timeStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
        if (match) {
          return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]),
                         parseInt(match[4]), parseInt(match[5]), parseInt(match[6]));
        }

        // Format 3: DD/MM/YYYY HH:MM:SS (if day > 12)
        match = timeStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/);
        if (match && parseInt(match[1]) > 12) {
          return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]),
                         parseInt(match[4]), parseInt(match[5]), parseInt(match[6]));
        }

        // Fallback: try native Date parsing
        const parsed = new Date(timeStr.replace(/\//g, '-'));
        return isNaN(parsed.getTime()) ? new Date() : parsed;
      };

      // Populate monthly data from records
      console.log('Processing', extensionRecords.length, 'extension records for monthly breakdown');

      for (const record of extensionRecords) {
        const recordDate = parseCdrDate(record.time);
        const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;

        const monthData = monthlyDataMap.get(monthKey);
        if (monthData) {
          const isInbound = record.call_type === 'Inbound' && (record.call_to === extNumber || record.call_to.includes(extNumber));
          const isOutbound = record.call_type === 'Outbound' && (record.call_from === extNumber || record.call_from.includes(extNumber));
          const isMissed = (record.disposition === 'NO ANSWER' || record.disposition === 'BUSY' || record.disposition === 'FAILED') &&
            (record.call_to === extNumber || record.call_to.includes(extNumber));
          const duration = record.talk_duration || 0;

          if (isInbound) {
            monthData.inboundCalls++;
            monthData.inboundMinutes += duration / 60;
          }
          if (isOutbound) {
            monthData.outboundCalls++;
            monthData.outboundMinutes += duration / 60;
          }
          if (isMissed) {
            monthData.missedCalls++;
          }
          monthData.totalMinutes += duration / 60;
        }
      }

      const monthlyData = Array.from(monthlyDataMap.values()).sort(
        (a, b) => a.monthKey.localeCompare(b.monthKey)
      );

      console.log('Monthly data calculated:', monthlyData);
      console.log('Inbound calls:', inboundCalls.length, 'Outbound:', outboundCalls.length, 'Missed:', missedCalls.length);

      // Use call_report API data if available (more reliable), otherwise use CDR calculations
      let summary;
      if (callStatsData) {
        // Use data from call_report API
        const answeredFromApi = callStatsData.answered_calls || 0;
        const noAnswerFromApi = callStatsData.no_answer_calls || 0;
        const busyFromApi = callStatsData.busy_calls || 0;
        const failedFromApi = callStatsData.failed_calls || 0;
        const totalTalkTime = callStatsData.total_talking_time || 0;

        summary = {
          totalInboundCalls: inboundCalls.length || answeredFromApi,
          totalOutboundCalls: outboundCalls.length,
          totalMissedCalls: noAnswerFromApi + busyFromApi + failedFromApi,
          inboundMinutes: Math.round(inboundSeconds / 60 * 10) / 10,
          outboundMinutes: Math.round(outboundSeconds / 60 * 10) / 10,
          totalMinutes: Math.round(totalTalkTime / 60 * 10) / 10 || Math.round(totalSeconds / 60 * 10) / 10,
          answeredCalls: answeredFromApi || answeredCalls.length,
          averageCallDuration: answeredFromApi > 0
            ? Math.round(totalTalkTime / answeredFromApi)
            : (answeredCalls.length > 0 ? Math.round(totalSeconds / answeredCalls.length) : 0),
        };
        console.log('Using call_report API data for summary');
      } else {
        // Use CDR-calculated data
        summary = {
          totalInboundCalls: inboundCalls.length,
          totalOutboundCalls: outboundCalls.length,
          totalMissedCalls: missedCalls.length,
          inboundMinutes: Math.round(inboundSeconds / 60 * 10) / 10,
          outboundMinutes: Math.round(outboundSeconds / 60 * 10) / 10,
          totalMinutes: Math.round(totalSeconds / 60 * 10) / 10,
          answeredCalls: answeredCalls.length,
          averageCallDuration: answeredCalls.length > 0
            ? Math.round(totalSeconds / answeredCalls.length)
            : 0,
        };
        console.log('Using CDR-calculated data for summary');
      }

      const report: ExtensionReportData = {
        extension: selectedExtension,
        period: { startDate, endDate },
        summary,
        monthlyData,
      };

      setReportData(report);
      toast.success('Report generated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportToPdf = async () => {
    if (!reportRef.current || !reportData) return;

    setExportingPdf(true);
    try {
      // Hide elements that shouldn't appear in PDF
      const hideElements = reportRef.current.querySelectorAll('.pdf-hide');
      hideElements.forEach(el => (el as HTMLElement).style.display = 'none');

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      // Restore hidden elements
      hideElements.forEach(el => (el as HTMLElement).style.display = '');

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      // Add first page
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 20;

      // Add more pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 20;
      }

      const extName = reportData.extension.display_name || reportData.extension.number;
      const fileName = `Extension_Report_${extName}_${reportData.period.startDate}_to_${reportData.period.endDate}.pdf`;
      pdf.save(fileName);
      toast.success('PDF exported successfully!');
    } catch (error: any) {
      toast.error('Failed to export PDF');
      console.error(error);
    } finally {
      setExportingPdf(false);
    }
  };

  const formatMinutes = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes.toFixed(1)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* Report Configuration Card */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Extension Detail Report
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Generate detailed call statistics for any extension
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Extension Selector */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Extension
            </label>
            {loadingExtensions ? (
              <div className="h-10 bg-gray-100 dark:bg-gray-700 rounded-lg animate-pulse" />
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExtensionDropdown(!showExtensionDropdown)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-left text-gray-900 dark:text-white hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <span className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    {selectedExtension
                      ? `${selectedExtension.number} - ${selectedExtension.display_name || selectedExtension.username || 'Unknown'}`
                      : 'Select extension...'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showExtensionDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showExtensionDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                  >
                    {extensions.map((ext) => (
                      <button
                        key={ext.id}
                        onClick={() => {
                          setSelectedExtension(ext);
                          setShowExtensionDropdown(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
                          selectedExtension?.id === ext.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                        }`}
                      >
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900 dark:text-white font-medium">{ext.number}</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          - {ext.display_name || ext.username || 'Unknown'}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Start Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              End Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Generate Button */}
          <div className="flex items-end">
            <Button
              onClick={generateReport}
              disabled={loading || !selectedExtension || !startDate || !endDate}
              className="w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">Quick select:</span>
          {[
            { label: 'This Month', start: () => {
              const now = new Date();
              return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            }, end: () => new Date().toISOString().split('T')[0] },
            { label: 'Last Month', start: () => {
              const now = new Date();
              return new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
            }, end: () => {
              const now = new Date();
              return new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
            }},
            { label: 'This Year', start: () => {
              const now = new Date();
              return `${now.getFullYear()}-01-01`;
            }, end: () => new Date().toISOString().split('T')[0] },
            { label: 'Last Year', start: () => {
              const now = new Date();
              return `${now.getFullYear() - 1}-01-01`;
            }, end: () => {
              const now = new Date();
              return `${now.getFullYear() - 1}-12-31`;
            }},
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setStartDate(preset.start());
                setEndDate(preset.end());
              }}
              className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader text="Generating report..." />
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              This may take a moment for large date ranges
            </p>
          </div>
        </Card>
      )}

      {/* Report Results */}
      {reportData && !loading && (
        <div ref={reportRef} className="space-y-6 bg-white dark:bg-gray-900 p-1">
          {/* Report Header */}
          <Card>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Report: Extension {reportData.extension.number}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {reportData.extension.display_name || reportData.extension.username || 'Unknown'}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                  Period: {new Date(reportData.period.startDate).toLocaleDateString()} - {new Date(reportData.period.endDate).toLocaleDateString()}
                </p>
              </div>
              <Button
                onClick={exportToPdf}
                disabled={exportingPdf}
                variant="secondary"
                className="pdf-hide"
              >
                {exportingPdf ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export to PDF
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Summary Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<PhoneIncoming className="w-6 h-6" />}
              label="Inbound Calls"
              value={reportData.summary.totalInboundCalls}
              subValue={formatMinutes(reportData.summary.inboundMinutes)}
              color="green"
            />
            <StatCard
              icon={<PhoneOutgoing className="w-6 h-6" />}
              label="Outbound Calls"
              value={reportData.summary.totalOutboundCalls}
              subValue={formatMinutes(reportData.summary.outboundMinutes)}
              color="blue"
            />
            <StatCard
              icon={<PhoneMissed className="w-6 h-6" />}
              label="Missed Calls"
              value={reportData.summary.totalMissedCalls}
              subValue="unanswered"
              color="red"
            />
            <StatCard
              icon={<Clock className="w-6 h-6" />}
              label="Total Talk Time"
              value={formatMinutes(reportData.summary.totalMinutes)}
              subValue={`Avg: ${formatDuration(reportData.summary.averageCallDuration)}`}
              color="purple"
            />
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <Phone className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Answered Calls</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {reportData.summary.answeredCalls}
                  </p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Answer Rate</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {reportData.summary.totalInboundCalls + reportData.summary.totalOutboundCalls > 0
                      ? Math.round(
                          (reportData.summary.answeredCalls /
                            (reportData.summary.totalInboundCalls + reportData.summary.totalOutboundCalls)) *
                            100
                        )
                      : 0}
                    %
                  </p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Avg Call Duration</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatDuration(reportData.summary.averageCallDuration)}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Monthly Comparison Chart */}
          {reportData.monthlyData.length > 0 && (
            <Card>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Monthly Activity Comparison
              </h4>
              <MonthlyChart data={reportData.monthlyData} />
            </Card>
          )}

          {/* Monthly Details Table */}
          {reportData.monthlyData.length > 0 && (
            <Card>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Monthly Breakdown
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Month
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Inbound
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Outbound
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Missed
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Inbound Min
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Outbound Min
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Total Min
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.monthlyData.map((month, index) => (
                      <motion.tr
                        key={month.monthKey}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                          {month.month}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 dark:text-green-400 font-medium">
                          {month.inboundCalls}
                        </td>
                        <td className="py-3 px-4 text-right text-blue-600 dark:text-blue-400 font-medium">
                          {month.outboundCalls}
                        </td>
                        <td className="py-3 px-4 text-right text-red-600 dark:text-red-400 font-medium">
                          {month.missedCalls}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                          {month.inboundMinutes.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                          {month.outboundMinutes.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                          {month.totalMinutes.toFixed(1)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold">
                      <td className="py-3 px-4 text-gray-900 dark:text-white">Total</td>
                      <td className="py-3 px-4 text-right text-green-600 dark:text-green-400">
                        {reportData.summary.totalInboundCalls}
                      </td>
                      <td className="py-3 px-4 text-right text-blue-600 dark:text-blue-400">
                        {reportData.summary.totalOutboundCalls}
                      </td>
                      <td className="py-3 px-4 text-right text-red-600 dark:text-red-400">
                        {reportData.summary.totalMissedCalls}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                        {reportData.summary.inboundMinutes.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                        {reportData.summary.outboundMinutes.toFixed(1)}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-900 dark:text-white">
                        {reportData.summary.totalMinutes.toFixed(1)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}

          {/* Report Footer */}
          <Card>
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              <p>Report generated on {new Date().toLocaleString()}</p>
              <p className="mt-1">Yeastar PBX Dashboard - Extension Detail Report</p>
            </div>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!reportData && !loading && (
        <Card>
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
              <BarChart3 className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Report Generated
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
              Select an extension and date range above, then click "Generate Report" to view detailed call statistics.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color: 'green' | 'blue' | 'red' | 'purple' | 'orange';
}

function StatCard({ icon, label, value, subValue, color }: StatCardProps) {
  const colorClasses = {
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  };

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className={`p-2 sm:p-3 rounded-xl flex-shrink-0 ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subValue && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subValue}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

// Monthly Chart Component
interface MonthlyChartProps {
  data: MonthlyCallData[];
}

function MonthlyChart({ data }: MonthlyChartProps) {
  if (data.length === 0) return null;

  const maxCalls = Math.max(
    ...data.map((d) => Math.max(d.inboundCalls, d.outboundCalls, d.missedCalls))
  );
  const chartHeight = 200;
  const chartWidth = 800;
  const padding = { top: 20, right: 20, bottom: 60, left: 50 };
  const barWidth = Math.min(
    (chartWidth - padding.left - padding.right) / data.length / 4,
    30
  );
  const groupWidth = barWidth * 3 + 20;

  const scale = maxCalls > 0 ? (chartHeight - padding.top - padding.bottom) / maxCalls : 0;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight + 20}`}
        className="w-full min-w-[600px]"
        style={{ maxHeight: '300px' }}
      >
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + (chartHeight - padding.top - padding.bottom) * (1 - tick);
          const value = Math.round(maxCalls * tick);
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.1}
                className="text-gray-400"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-current text-gray-500 dark:text-gray-400"
                fontSize="12"
              >
                {value}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((month, index) => {
          const x = padding.left + index * groupWidth + groupWidth / 2 - (barWidth * 1.5 + 5);
          const baseY = chartHeight - padding.bottom;

          return (
            <g key={month.monthKey}>
              {/* Inbound Bar */}
              <rect
                x={x}
                y={baseY - month.inboundCalls * scale}
                width={barWidth}
                height={month.inboundCalls * scale || 1}
                fill="#22c55e"
                rx={2}
              />
              {/* Outbound Bar */}
              <rect
                x={x + barWidth + 5}
                y={baseY - month.outboundCalls * scale}
                width={barWidth}
                height={month.outboundCalls * scale || 1}
                fill="#3b82f6"
                rx={2}
              />
              {/* Missed Bar */}
              <rect
                x={x + (barWidth + 5) * 2}
                y={baseY - month.missedCalls * scale}
                width={barWidth}
                height={month.missedCalls * scale || 1}
                fill="#ef4444"
                rx={2}
              />
              {/* Month Label */}
              <text
                x={x + barWidth * 1.5 + 5}
                y={baseY + 20}
                textAnchor="middle"
                className="fill-current text-gray-600 dark:text-gray-400"
                fontSize="11"
              >
                {month.month}
              </text>
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${chartWidth - 180}, ${chartHeight - 10})`}>
          <rect x={0} y={0} width={12} height={12} fill="#22c55e" rx={2} />
          <text x={16} y={10} className="fill-current text-gray-600 dark:text-gray-400" fontSize="11">
            Inbound
          </text>
          <rect x={60} y={0} width={12} height={12} fill="#3b82f6" rx={2} />
          <text x={76} y={10} className="fill-current text-gray-600 dark:text-gray-400" fontSize="11">
            Outbound
          </text>
          <rect x={130} y={0} width={12} height={12} fill="#ef4444" rx={2} />
          <text x={146} y={10} className="fill-current text-gray-600 dark:text-gray-400" fontSize="11">
            Missed
          </text>
        </g>
      </svg>
    </div>
  );
}
