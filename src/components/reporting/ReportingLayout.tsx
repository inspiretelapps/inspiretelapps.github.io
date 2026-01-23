import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Calendar,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  BarChart3,
  RefreshCw,
  ChevronDown,
  User,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { fetchExtensions, fetchCallStats, fetchCallStatsByType } from '@/services/api';
import type { Extension, ExtensionReportData, MonthlyCallData } from '@/types';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';

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

      // Find working date format by testing call_report API
      let workingFormatIndex = 0;
      let formatFound = false;

      for (let i = 0; i < startFormats.length && !formatFound; i++) {
        try {
          const testStats = await fetchCallStats([extId], startFormats[i], endFormats[i]);
          if (testStats && testStats.length >= 0) {
            workingFormatIndex = i;
            formatFound = true;
            console.log('Working date format found:', startFormats[i]);
          }
        } catch (err) {
          console.warn(`Date format ${i} failed:`, startFormats[i]);
        }
      }

      if (!formatFound) {
        toast.error('Unable to determine PBX date format. Please check PBX configuration.');
        setLoading(false);
        return;
      }

      // Helper function to get month date range in working format
      const getMonthDateRange = (year: number, month: number) => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const formatDate = (d: Date, isEndOfDay: boolean): string => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const time = isEndOfDay ? '23:59:59' : '00:00:00';

          // Use the working format pattern
          switch (workingFormatIndex) {
            case 0: return `${y}/${m}/${day} ${time}`;
            case 1: return `${m}/${day}/${y} ${time}`;
            case 2: return `${day}/${m}/${y} ${time}`;
            case 3: return `${y}-${m}-${day} ${time}`;
            case 4: return `${y}/${m}/${day} ${isEndOfDay ? '11:59:59 PM' : '12:00:00 AM'}`;
            case 5: return `${m}/${day}/${y} ${isEndOfDay ? '11:59:59 PM' : '12:00:00 AM'}`;
            default: return `${y}/${m}/${day} ${time}`;
          }
        };

        return {
          start: formatDate(firstDay, false),
          end: formatDate(lastDay, true),
        };
      };

      // Build list of months in the range
      const months: Array<{ year: number; month: number; key: string; label: string }> = [];
      const start = new Date(startDate);
      const end = new Date(endDate);
      let current = new Date(start.getFullYear(), start.getMonth(), 1);

      while (current <= end) {
        const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = current.toLocaleString('default', { month: 'short', year: 'numeric' });
        months.push({
          year: current.getFullYear(),
          month: current.getMonth(),
          key: monthKey,
          label: monthLabel,
        });
        current.setMonth(current.getMonth() + 1);
      }

      console.log('=== FETCHING DATA FROM CALL_REPORT API ===');
      console.log('Extension:', extNumber, 'ID:', extId);
      console.log('Months to fetch:', months.map(m => m.key));

      // Fetch data for each month using the call_report API
      // This matches Yeastar's Extension Call Statistics Report exactly
      const monthlyDataMap = new Map<string, MonthlyCallData>();

      // Totals - matching Yeastar's format: Answered / No Answer / Total
      let totalInboundAnswered = 0;
      let totalInboundNoAnswer = 0;
      let totalOutboundAnswered = 0;
      let totalOutboundNoAnswer = 0;
      let totalTalkDuration = 0; // in seconds

      for (const monthInfo of months) {
        const { start: monthStart, end: monthEnd } = getMonthDateRange(monthInfo.year, monthInfo.month);

        console.log(`Fetching ${monthInfo.label}: ${monthStart} to ${monthEnd}`);

        // Fetch inbound and outbound stats separately for accuracy
        let inboundStats = null;
        let outboundStats = null;

        try {
          const [inboundResult, outboundResult] = await Promise.all([
            fetchCallStatsByType([extId], monthStart, monthEnd, 'Inbound'),
            fetchCallStatsByType([extId], monthStart, monthEnd, 'Outbound'),
          ]);

          inboundStats = inboundResult.find(s => s.ext_num === extNumber) || inboundResult[0] || null;
          outboundStats = outboundResult.find(s => s.ext_num === extNumber) || outboundResult[0] || null;
        } catch (err) {
          console.warn(`Failed to fetch stats for ${monthInfo.label}:`, err);
        }

        // Extract data from API response - matching Yeastar's format
        const inboundAnswered = inboundStats?.answered_calls || 0;
        const inboundNoAnswer = (inboundStats?.no_answer_calls || 0) +
                                (inboundStats?.busy_calls || 0) +
                                (inboundStats?.failed_calls || 0);
        const inboundTotal = inboundAnswered + inboundNoAnswer;

        const outboundAnswered = outboundStats?.answered_calls || 0;
        const outboundNoAnswer = (outboundStats?.no_answer_calls || 0) +
                                 (outboundStats?.busy_calls || 0) +
                                 (outboundStats?.failed_calls || 0);
        const outboundTotal = outboundAnswered + outboundNoAnswer;

        const monthTalkDuration = (inboundStats?.total_talking_time || 0) +
                                  (outboundStats?.total_talking_time || 0);

        monthlyDataMap.set(monthInfo.key, {
          month: monthInfo.label,
          monthKey: monthInfo.key,
          inboundAnswered,
          inboundNoAnswer,
          inboundTotal,
          outboundAnswered,
          outboundNoAnswer,
          outboundTotal,
          totalTalkDuration: monthTalkDuration,
        });

        // Accumulate totals
        totalInboundAnswered += inboundAnswered;
        totalInboundNoAnswer += inboundNoAnswer;
        totalOutboundAnswered += outboundAnswered;
        totalOutboundNoAnswer += outboundNoAnswer;
        totalTalkDuration += monthTalkDuration;

        console.log(`${monthInfo.label}: Inbound(${inboundAnswered}/${inboundNoAnswer}/${inboundTotal}), Outbound(${outboundAnswered}/${outboundNoAnswer}/${outboundTotal}), Duration=${monthTalkDuration}s`);
      }

      const monthlyData = Array.from(monthlyDataMap.values()).sort(
        (a, b) => a.monthKey.localeCompare(b.monthKey)
      );

      const totalAnsweredCalls = totalInboundAnswered + totalOutboundAnswered;

      console.log('=== TOTALS ===');
      console.log(`Inbound: ${totalInboundAnswered}/${totalInboundNoAnswer}/${totalInboundAnswered + totalInboundNoAnswer}`);
      console.log(`Outbound: ${totalOutboundAnswered}/${totalOutboundNoAnswer}/${totalOutboundAnswered + totalOutboundNoAnswer}`);
      console.log(`Total Talk Duration: ${totalTalkDuration}s`);

      // Build summary matching Yeastar's format
      const summary = {
        inboundAnswered: totalInboundAnswered,
        inboundNoAnswer: totalInboundNoAnswer,
        inboundTotal: totalInboundAnswered + totalInboundNoAnswer,
        outboundAnswered: totalOutboundAnswered,
        outboundNoAnswer: totalOutboundNoAnswer,
        outboundTotal: totalOutboundAnswered + totalOutboundNoAnswer,
        totalTalkDuration,
        averageCallDuration: totalAnsweredCalls > 0
          ? Math.round(totalTalkDuration / totalAnsweredCalls)
          : 0,
      };

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
    if (!reportData) return;

    setExportingPdf(true);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      let yPos = margin;

      // Colors
      const primaryColor: [number, number, number] = [59, 130, 246]; // Blue
      const greenColor: [number, number, number] = [34, 197, 94];
      const redColor: [number, number, number] = [239, 68, 68];
      const grayColor: [number, number, number] = [107, 114, 128];
      const darkColor: [number, number, number] = [31, 41, 55];

      // Helper function for text
      const addText = (text: string, x: number, y: number, options?: {
        fontSize?: number;
        fontStyle?: 'normal' | 'bold' | 'italic';
        color?: [number, number, number];
        align?: 'left' | 'center' | 'right';
      }) => {
        const { fontSize = 10, fontStyle = 'normal', color = darkColor, align = 'left' } = options || {};
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', fontStyle);
        pdf.setTextColor(...color);
        pdf.text(text, x, y, { align });
      };

      // Header
      addText('Extension Detail Report', pageWidth / 2, yPos, {
        fontSize: 18,
        fontStyle: 'bold',
        color: primaryColor,
        align: 'center',
      });
      yPos += 10;

      // Extension Info
      const extName = reportData.extension.display_name || reportData.extension.username || 'Unknown';
      addText(`Extension: ${reportData.extension.number} - ${extName}`, pageWidth / 2, yPos, {
        fontSize: 12,
        align: 'center',
      });
      yPos += 6;

      const periodText = `Period: ${new Date(reportData.period.startDate).toLocaleDateString()} - ${new Date(reportData.period.endDate).toLocaleDateString()}`;
      addText(periodText, pageWidth / 2, yPos, {
        fontSize: 10,
        color: grayColor,
        align: 'center',
      });
      yPos += 15;

      // Summary Section
      addText('Summary', margin, yPos, { fontSize: 14, fontStyle: 'bold' });
      yPos += 8;

      // Summary boxes
      const boxWidth = (contentWidth - 10) / 3;
      const boxHeight = 25;

      // Inbound box
      pdf.setFillColor(240, 253, 244); // Light green
      pdf.roundedRect(margin, yPos, boxWidth, boxHeight, 2, 2, 'F');
      addText('Inbound', margin + boxWidth / 2, yPos + 6, { fontSize: 9, color: grayColor, align: 'center' });
      addText(reportData.summary.inboundTotal.toString(), margin + boxWidth / 2, yPos + 14, { fontSize: 16, fontStyle: 'bold', color: greenColor, align: 'center' });
      addText(`${reportData.summary.inboundAnswered} answered / ${reportData.summary.inboundNoAnswer} missed`, margin + boxWidth / 2, yPos + 21, { fontSize: 7, color: grayColor, align: 'center' });

      // Outbound box
      pdf.setFillColor(239, 246, 255); // Light blue
      pdf.roundedRect(margin + boxWidth + 5, yPos, boxWidth, boxHeight, 2, 2, 'F');
      addText('Outbound', margin + boxWidth + 5 + boxWidth / 2, yPos + 6, { fontSize: 9, color: grayColor, align: 'center' });
      addText(reportData.summary.outboundTotal.toString(), margin + boxWidth + 5 + boxWidth / 2, yPos + 14, { fontSize: 16, fontStyle: 'bold', color: primaryColor, align: 'center' });
      addText(`${reportData.summary.outboundAnswered} answered / ${reportData.summary.outboundNoAnswer} missed`, margin + boxWidth + 5 + boxWidth / 2, yPos + 21, { fontSize: 7, color: grayColor, align: 'center' });

      // Duration box
      pdf.setFillColor(250, 245, 255); // Light purple
      pdf.roundedRect(margin + (boxWidth + 5) * 2, yPos, boxWidth, boxHeight, 2, 2, 'F');
      addText('Talk Duration', margin + (boxWidth + 5) * 2 + boxWidth / 2, yPos + 6, { fontSize: 9, color: grayColor, align: 'center' });
      addText(formatDurationHMS(reportData.summary.totalTalkDuration), margin + (boxWidth + 5) * 2 + boxWidth / 2, yPos + 14, { fontSize: 14, fontStyle: 'bold', color: [147, 51, 234], align: 'center' });
      addText(`Avg: ${formatDuration(reportData.summary.averageCallDuration)}`, margin + (boxWidth + 5) * 2 + boxWidth / 2, yPos + 21, { fontSize: 7, color: grayColor, align: 'center' });

      yPos += boxHeight + 15;

      // Monthly Breakdown Table
      if (reportData.monthlyData.length > 0) {
        addText('Monthly Breakdown', margin, yPos, { fontSize: 14, fontStyle: 'bold' });
        yPos += 8;

        // Table header
        const colWidths = [30, 20, 20, 20, 20, 20, 20, 30];
        const headers = ['Month', 'In Ans', 'In Miss', 'In Total', 'Out Ans', 'Out Miss', 'Out Total', 'Duration'];

        // Header background
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, yPos - 4, contentWidth, 8, 'F');

        let xPos = margin;
        headers.forEach((header, i) => {
          addText(header, xPos + colWidths[i] / 2, yPos, {
            fontSize: 8,
            fontStyle: 'bold',
            color: grayColor,
            align: 'center',
          });
          xPos += colWidths[i];
        });
        yPos += 6;

        // Table rows
        reportData.monthlyData.forEach((month, index) => {
          // Check if we need a new page
          if (yPos > 270) {
            pdf.addPage();
            yPos = margin;
          }

          // Alternate row background
          if (index % 2 === 0) {
            pdf.setFillColor(249, 250, 251);
            pdf.rect(margin, yPos - 3, contentWidth, 6, 'F');
          }

          xPos = margin;
          const rowData = [
            month.month,
            month.inboundAnswered.toString(),
            month.inboundNoAnswer.toString(),
            month.inboundTotal.toString(),
            month.outboundAnswered.toString(),
            month.outboundNoAnswer.toString(),
            month.outboundTotal.toString(),
            formatDurationHMS(month.totalTalkDuration),
          ];

          rowData.forEach((cell, i) => {
            let color = darkColor;
            if (i === 1 || i === 4) color = greenColor; // Answered
            if (i === 2 || i === 5) color = redColor; // Missed
            addText(cell, xPos + colWidths[i] / 2, yPos, {
              fontSize: 8,
              color,
              align: 'center',
            });
            xPos += colWidths[i];
          });
          yPos += 6;
        });

        // Totals row
        yPos += 2;
        pdf.setFillColor(229, 231, 235);
        pdf.rect(margin, yPos - 3, contentWidth, 7, 'F');

        xPos = margin;
        const totals = [
          'Total',
          reportData.summary.inboundAnswered.toString(),
          reportData.summary.inboundNoAnswer.toString(),
          reportData.summary.inboundTotal.toString(),
          reportData.summary.outboundAnswered.toString(),
          reportData.summary.outboundNoAnswer.toString(),
          reportData.summary.outboundTotal.toString(),
          formatDurationHMS(reportData.summary.totalTalkDuration),
        ];

        totals.forEach((cell, i) => {
          let color = darkColor;
          if (i === 1 || i === 4) color = greenColor;
          if (i === 2 || i === 5) color = redColor;
          addText(cell, xPos + colWidths[i] / 2, yPos, {
            fontSize: 8,
            fontStyle: 'bold',
            color,
            align: 'center',
          });
          xPos += colWidths[i];
        });
      }

      // Footer
      yPos = pdf.internal.pageSize.getHeight() - 15;
      addText(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, yPos, {
        fontSize: 8,
        color: grayColor,
        align: 'center',
      });
      addText('Yeastar PBX Dashboard - Extension Detail Report', pageWidth / 2, yPos + 4, {
        fontSize: 8,
        color: grayColor,
        align: 'center',
      });

      const extNameFile = reportData.extension.display_name || reportData.extension.number;
      const fileName = `Extension_Report_${extNameFile}_${reportData.period.startDate}_to_${reportData.period.endDate}.pdf`;
      pdf.save(fileName);
      toast.success('PDF exported successfully!');
    } catch (error: any) {
      toast.error('Failed to export PDF');
      console.error(error);
    } finally {
      setExportingPdf(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  // Format duration as HH:MM:SS (like Yeastar)
  const formatDurationHMS = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
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

          {/* Summary Stats - Yeastar Style */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Inbound Summary */}
            <Card>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 sm:p-3 rounded-xl flex-shrink-0 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                  <PhoneIncoming className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Inbound</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{reportData.summary.inboundTotal}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                  <span className="text-gray-500 dark:text-gray-400">Answered</span>
                  <p className="font-semibold text-green-600 dark:text-green-400">{reportData.summary.inboundAnswered}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                  <span className="text-gray-500 dark:text-gray-400">No Answer</span>
                  <p className="font-semibold text-red-600 dark:text-red-400">{reportData.summary.inboundNoAnswer}</p>
                </div>
              </div>
            </Card>

            {/* Outbound Summary */}
            <Card>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 sm:p-3 rounded-xl flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <PhoneOutgoing className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Outbound</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{reportData.summary.outboundTotal}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                  <span className="text-gray-500 dark:text-gray-400">Answered</span>
                  <p className="font-semibold text-green-600 dark:text-green-400">{reportData.summary.outboundAnswered}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-2">
                  <span className="text-gray-500 dark:text-gray-400">No Answer</span>
                  <p className="font-semibold text-red-600 dark:text-red-400">{reportData.summary.outboundNoAnswer}</p>
                </div>
              </div>
            </Card>

            {/* Talk Time Summary */}
            <Card>
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 sm:p-3 rounded-xl flex-shrink-0 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Talk Duration</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatDurationHMS(reportData.summary.totalTalkDuration)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-2">
                  <span className="text-gray-500 dark:text-gray-400">Avg Duration</span>
                  <p className="font-semibold text-purple-600 dark:text-purple-400">{formatDuration(reportData.summary.averageCallDuration)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                  <span className="text-gray-500 dark:text-gray-400">Total Answered</span>
                  <p className="font-semibold text-gray-900 dark:text-white">{reportData.summary.inboundAnswered + reportData.summary.outboundAnswered}</p>
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

          {/* Monthly Details Table - Yeastar Style */}
          {reportData.monthlyData.length > 0 && (
            <Card>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Monthly Breakdown
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                      <th rowSpan={2} className="text-left py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300 align-bottom">
                        Month
                      </th>
                      <th colSpan={3} className="text-center py-2 px-3 text-sm font-semibold text-green-700 dark:text-green-400 border-b border-gray-200 dark:border-gray-700">
                        Inbound
                      </th>
                      <th colSpan={3} className="text-center py-2 px-3 text-sm font-semibold text-blue-700 dark:text-blue-400 border-b border-gray-200 dark:border-gray-700">
                        Outbound
                      </th>
                      <th rowSpan={2} className="text-center py-2 px-3 text-sm font-semibold text-gray-700 dark:text-gray-300 align-bottom">
                        Total Talk<br />Duration
                      </th>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400">Answered</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400">No Answer</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400">Total</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400">Answered</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400">No Answer</th>
                      <th className="text-center py-2 px-2 text-xs font-medium text-gray-500 dark:text-gray-400">Total</th>
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
                        <td className="py-3 px-3 font-medium text-gray-900 dark:text-white">
                          {month.month}
                        </td>
                        {/* Inbound */}
                        <td className="py-3 px-2 text-center text-green-600 dark:text-green-400">
                          {month.inboundAnswered}
                        </td>
                        <td className="py-3 px-2 text-center text-red-500 dark:text-red-400">
                          {month.inboundNoAnswer}
                        </td>
                        <td className="py-3 px-2 text-center font-medium text-gray-700 dark:text-gray-300">
                          {month.inboundTotal}
                        </td>
                        {/* Outbound */}
                        <td className="py-3 px-2 text-center text-green-600 dark:text-green-400">
                          {month.outboundAnswered}
                        </td>
                        <td className="py-3 px-2 text-center text-red-500 dark:text-red-400">
                          {month.outboundNoAnswer}
                        </td>
                        <td className="py-3 px-2 text-center font-medium text-gray-700 dark:text-gray-300">
                          {month.outboundTotal}
                        </td>
                        {/* Duration */}
                        <td className="py-3 px-3 text-center font-medium text-gray-900 dark:text-white">
                          {formatDurationHMS(month.totalTalkDuration)}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 font-semibold border-t-2 border-gray-300 dark:border-gray-600">
                      <td className="py-3 px-3 text-gray-900 dark:text-white">Total</td>
                      {/* Inbound Totals */}
                      <td className="py-3 px-2 text-center text-green-600 dark:text-green-400">
                        {reportData.summary.inboundAnswered}
                      </td>
                      <td className="py-3 px-2 text-center text-red-500 dark:text-red-400">
                        {reportData.summary.inboundNoAnswer}
                      </td>
                      <td className="py-3 px-2 text-center text-gray-700 dark:text-gray-300">
                        {reportData.summary.inboundTotal}
                      </td>
                      {/* Outbound Totals */}
                      <td className="py-3 px-2 text-center text-green-600 dark:text-green-400">
                        {reportData.summary.outboundAnswered}
                      </td>
                      <td className="py-3 px-2 text-center text-red-500 dark:text-red-400">
                        {reportData.summary.outboundNoAnswer}
                      </td>
                      <td className="py-3 px-2 text-center text-gray-700 dark:text-gray-300">
                        {reportData.summary.outboundTotal}
                      </td>
                      {/* Duration Total */}
                      <td className="py-3 px-3 text-center text-gray-900 dark:text-white">
                        {formatDurationHMS(reportData.summary.totalTalkDuration)}
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

// Monthly Chart Component
interface MonthlyChartProps {
  data: MonthlyCallData[];
}

function MonthlyChart({ data }: MonthlyChartProps) {
  if (data.length === 0) return null;

  // Use totals for the chart
  const maxCalls = Math.max(
    ...data.map((d) => Math.max(d.inboundTotal, d.outboundTotal))
  );
  const chartHeight = 200;
  const chartWidth = 800;
  const padding = { top: 20, right: 20, bottom: 60, left: 50 };
  const barWidth = Math.min(
    (chartWidth - padding.left - padding.right) / data.length / 3,
    35
  );
  const groupWidth = barWidth * 2 + 15;

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
          const x = padding.left + index * groupWidth + groupWidth / 2 - (barWidth + 2.5);
          const baseY = chartHeight - padding.bottom;

          return (
            <g key={month.monthKey}>
              {/* Inbound Total Bar */}
              <rect
                x={x}
                y={baseY - month.inboundTotal * scale}
                width={barWidth}
                height={month.inboundTotal * scale || 1}
                fill="#22c55e"
                rx={2}
              />
              {/* Outbound Total Bar */}
              <rect
                x={x + barWidth + 5}
                y={baseY - month.outboundTotal * scale}
                width={barWidth}
                height={month.outboundTotal * scale || 1}
                fill="#3b82f6"
                rx={2}
              />
              {/* Month Label */}
              <text
                x={x + barWidth + 2.5}
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
        <g transform={`translate(${chartWidth - 150}, ${chartHeight - 10})`}>
          <rect x={0} y={0} width={12} height={12} fill="#22c55e" rx={2} />
          <text x={16} y={10} className="fill-current text-gray-600 dark:text-gray-400" fontSize="11">
            Inbound
          </text>
          <rect x={70} y={0} width={12} height={12} fill="#3b82f6" rx={2} />
          <text x={86} y={10} className="fill-current text-gray-600 dark:text-gray-400" fontSize="11">
            Outbound
          </text>
        </g>
      </svg>
    </div>
  );
}
