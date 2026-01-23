import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Calendar,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Clock,
  RefreshCw,
  ChevronDown,
  User,
  Phone,
  ArrowRight,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader } from '@/components/ui/Loader';
import { fetchExtensions, fetchExtensionCDR } from '@/services/api';
import type { Extension, CallRecord } from '@/types';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';

export function ExtensionDetailReport() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [selectedExtension, setSelectedExtension] = useState<Extension | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingExtensions, setLoadingExtensions] = useState(true);
  const [callRecords, setCallRecords] = useState<CallRecord[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showExtensionDropdown, setShowExtensionDropdown] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

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

  const formatDateTime = (timeStr: string, timestamp?: number): string => {
    try {
      if (timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
      }
      return new Date(timeStr).toLocaleString();
    } catch {
      return timeStr;
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds === 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const formatDurationHMS = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getDispositionStyle = (disposition: string) => {
    const d = disposition?.toLowerCase() || '';
    if (d.includes('answer')) {
      return { icon: PhoneIncoming, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' };
    }
    if (d.includes('no answer') || d.includes('noanswer') || d.includes('missed')) {
      return { icon: PhoneMissed, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' };
    }
    if (d.includes('busy')) {
      return { icon: Phone, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' };
    }
    if (d.includes('failed') || d.includes('cancel')) {
      return { icon: PhoneMissed, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-900/30' };
    }
    return { icon: Phone, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' };
  };

  const getCallTypeStyle = (type: string) => {
    switch (type) {
      case 'Inbound':
        return { icon: PhoneIncoming, color: 'text-green-600', label: 'Inbound' };
      case 'Outbound':
        return { icon: PhoneOutgoing, color: 'text-blue-600', label: 'Outbound' };
      default:
        return { icon: Phone, color: 'text-purple-600', label: 'Internal' };
    }
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
    setHasGenerated(false);

    try {
      // Format dates for the API
      const startDateTime = `${startDate.replace(/-/g, '/')} 00:00:00`;
      const endDateTime = `${endDate.replace(/-/g, '/')} 23:59:59`;

      const records = await fetchExtensionCDR(
        selectedExtension.number,
        startDateTime,
        endDateTime
      );

      setCallRecords(records);
      setHasGenerated(true);

      if (records.length === 0) {
        toast('No call records found for this period', { icon: 'ℹ️' });
      } else {
        toast.success(`Found ${records.length} call records`);
      }
    } catch (error: any) {
      toast.error('Failed to generate report');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportToPdf = async () => {
    if (callRecords.length === 0) return;

    setExportingPdf(true);
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;
      let yPos = margin;

      // Colors
      const primaryColor: [number, number, number] = [59, 130, 246];
      const greenColor: [number, number, number] = [34, 197, 94];
      const redColor: [number, number, number] = [239, 68, 68];
      const orangeColor: [number, number, number] = [249, 115, 22];
      const grayColor: [number, number, number] = [107, 114, 128];
      const darkColor: [number, number, number] = [31, 41, 55];

      const addText = (text: string, x: number, y: number, options?: {
        fontSize?: number;
        fontStyle?: 'normal' | 'bold';
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
      const extName = selectedExtension?.display_name || selectedExtension?.username || 'Unknown';
      addText('Extension Detail Report', pageWidth / 2, yPos, {
        fontSize: 16,
        fontStyle: 'bold',
        color: primaryColor,
        align: 'center',
      });
      yPos += 7;

      addText(`Extension: ${selectedExtension?.number} - ${extName}`, pageWidth / 2, yPos, {
        fontSize: 11,
        align: 'center',
      });
      yPos += 5;

      addText(`Period: ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`, pageWidth / 2, yPos, {
        fontSize: 9,
        color: grayColor,
        align: 'center',
      });
      yPos += 5;

      addText(`Total Records: ${callRecords.length}`, pageWidth / 2, yPos, {
        fontSize: 9,
        color: grayColor,
        align: 'center',
      });
      yPos += 10;

      // Summary stats
      const answered = callRecords.filter(r => r.disposition?.toLowerCase().includes('answer')).length;
      const missed = callRecords.filter(r => {
        const d = r.disposition?.toLowerCase() || '';
        return d.includes('no answer') || d.includes('noanswer') || d.includes('missed');
      }).length;
      const totalDuration = callRecords.reduce((sum, r) => sum + (r.talk_duration || 0), 0);
      const inbound = callRecords.filter(r => r.call_type === 'Inbound').length;
      const outbound = callRecords.filter(r => r.call_type === 'Outbound').length;

      // Summary boxes
      const boxWidth = (contentWidth - 20) / 5;
      const boxHeight = 15;
      const summaryData = [
        { label: 'Total Calls', value: callRecords.length.toString(), color: primaryColor },
        { label: 'Inbound', value: inbound.toString(), color: greenColor },
        { label: 'Outbound', value: outbound.toString(), color: primaryColor },
        { label: 'Answered', value: answered.toString(), color: greenColor },
        { label: 'Missed/Failed', value: missed.toString(), color: redColor },
      ];

      summaryData.forEach((item, i) => {
        const x = margin + i * (boxWidth + 5);
        pdf.setFillColor(245, 247, 250);
        pdf.roundedRect(x, yPos, boxWidth, boxHeight, 2, 2, 'F');
        addText(item.label, x + boxWidth / 2, yPos + 5, { fontSize: 7, color: grayColor, align: 'center' });
        addText(item.value, x + boxWidth / 2, yPos + 11, { fontSize: 11, fontStyle: 'bold', color: item.color, align: 'center' });
      });

      yPos += boxHeight + 5;

      // Total duration
      addText(`Total Talk Time: ${formatDurationHMS(totalDuration)}`, pageWidth / 2, yPos, {
        fontSize: 9,
        color: grayColor,
        align: 'center',
      });
      yPos += 8;

      // Table
      const colWidths = [45, 30, 50, 50, 30, 35, 35];
      const headers = ['Date & Time', 'Type', 'From', 'To', 'Status', 'Duration', 'Talk Time'];

      const addTableHeader = (y: number) => {
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, y - 4, contentWidth, 7, 'F');

        let xPos = margin;
        headers.forEach((header, i) => {
          addText(header, xPos + 2, y, { fontSize: 8, fontStyle: 'bold', color: grayColor });
          xPos += colWidths[i];
        });
        return y + 5;
      };

      yPos = addTableHeader(yPos);

      // Table rows
      callRecords.forEach((record, index) => {
        // Check if we need a new page
        if (yPos > pageHeight - 20) {
          pdf.addPage();
          yPos = margin;
          yPos = addTableHeader(yPos);
        }

        // Alternate row background
        if (index % 2 === 0) {
          pdf.setFillColor(249, 250, 251);
          pdf.rect(margin, yPos - 3, contentWidth, 6, 'F');
        }

        let xPos = margin;

        // Date & Time
        const dateTime = formatDateTime(record.time, record.timestamp);
        addText(dateTime.substring(0, 20), xPos + 2, yPos, { fontSize: 7 });
        xPos += colWidths[0];

        // Type
        let typeColor = primaryColor;
        if (record.call_type === 'Inbound') typeColor = greenColor;
        if (record.call_type === 'Outbound') typeColor = primaryColor;
        addText(record.call_type, xPos + 2, yPos, { fontSize: 7, color: typeColor });
        xPos += colWidths[1];

        // From
        addText(String(record.call_from || '-').substring(0, 20), xPos + 2, yPos, { fontSize: 7 });
        xPos += colWidths[2];

        // To
        addText(String(record.call_to || '-').substring(0, 20), xPos + 2, yPos, { fontSize: 7 });
        xPos += colWidths[3];

        // Status
        const d = record.disposition?.toLowerCase() || '';
        let statusColor = grayColor;
        if (d.includes('answer')) statusColor = greenColor;
        else if (d.includes('no answer') || d.includes('noanswer') || d.includes('missed')) statusColor = redColor;
        else if (d.includes('busy')) statusColor = orangeColor;
        addText(record.disposition || '-', xPos + 2, yPos, { fontSize: 7, color: statusColor });
        xPos += colWidths[4];

        // Duration (ring time)
        addText(formatDuration(record.talk_duration || 0), xPos + 2, yPos, { fontSize: 7 });
        xPos += colWidths[5];

        // Talk Time
        addText(formatDuration(record.talk_duration || 0), xPos + 2, yPos, { fontSize: 7 });

        yPos += 6;
      });

      // Footer
      yPos = pageHeight - 10;
      addText(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, yPos, {
        fontSize: 7,
        color: grayColor,
        align: 'center',
      });

      const extNameFile = selectedExtension?.display_name || selectedExtension?.number || 'extension';
      const fileName = `Extension_Detail_Report_${extNameFile}_${startDate}_to_${endDate}.pdf`;
      pdf.save(fileName);
      toast.success('PDF exported successfully!');
    } catch (error: any) {
      toast.error('Failed to export PDF');
      console.error(error);
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Configuration Card */}
      <Card>
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
            <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Extension Detail Report
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View detailed call records for any extension
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Extension Selector */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Extension
            </label>
            <button
              type="button"
              onClick={() => setShowExtensionDropdown(!showExtensionDropdown)}
              disabled={loadingExtensions}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-left text-gray-900 dark:text-white hover:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            >
              {loadingExtensions ? (
                <span className="text-gray-400">Loading...</span>
              ) : selectedExtension ? (
                <span>{selectedExtension.number} - {selectedExtension.display_name || selectedExtension.username}</span>
              ) : (
                <span className="text-gray-400">Select extension...</span>
              )}
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showExtensionDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showExtensionDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              >
                {extensions.map((ext) => (
                  <div
                    key={ext.id}
                    className={`px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer ${
                      selectedExtension?.id === ext.id ? 'bg-purple-50 dark:bg-purple-900/30' : ''
                    }`}
                    onClick={() => {
                      setSelectedExtension(ext);
                      setShowExtensionDropdown(false);
                    }}
                  >
                    <span className="text-gray-900 dark:text-white font-medium">{ext.number}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">
                      {ext.display_name || ext.username}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Generate Button */}
          <div className="flex items-end">
            <Button
              variant="primary"
              onClick={generateReport}
              isLoading={loading}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card>
          <div className="flex items-center justify-center py-12">
            <Loader size="lg" />
            <span className="ml-4 text-gray-600 dark:text-gray-400">
              Fetching call records...
            </span>
          </div>
        </Card>
      )}

      {/* Report Results */}
      {!loading && hasGenerated && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            {/* Report Header */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Call Records
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {callRecords.length} records found for {selectedExtension?.number} - {selectedExtension?.display_name || selectedExtension?.username}
                </p>
              </div>
              <Button
                variant="primary"
                onClick={exportToPdf}
                isLoading={exportingPdf}
                disabled={callRecords.length === 0}
                className="pdf-hide bg-purple-600 hover:bg-purple-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>

            {/* Summary Stats */}
            {callRecords.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Calls</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{callRecords.length}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Inbound</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {callRecords.filter(r => r.call_type === 'Inbound').length}
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Outbound</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {callRecords.filter(r => r.call_type === 'Outbound').length}
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Answered</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {callRecords.filter(r => r.disposition?.toLowerCase().includes('answer')).length}
                  </p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Missed/Failed</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {callRecords.filter(r => {
                      const d = r.disposition?.toLowerCase() || '';
                      return d.includes('no answer') || d.includes('noanswer') || d.includes('missed') || d.includes('failed') || d.includes('cancel');
                    }).length}
                  </p>
                </div>
              </div>
            )}

            {/* Call Records Table */}
            {callRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        From
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        To
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Duration
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {callRecords.map((record, index) => {
                      const dispositionStyle = getDispositionStyle(record.disposition);
                      const typeStyle = getCallTypeStyle(record.call_type);
                      const TypeIcon = typeStyle.icon;
                      const StatusIcon = dispositionStyle.icon;

                      return (
                        <motion.tr
                          key={index}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.01 }}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/30"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <Clock className="w-4 h-4 text-gray-400 mr-2" />
                              <span className="text-sm text-gray-900 dark:text-white">
                                {formatDateTime(record.time, record.timestamp)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <TypeIcon className={`w-4 h-4 ${typeStyle.color} mr-2`} />
                              <span className={`text-sm font-medium ${typeStyle.color}`}>
                                {record.call_type}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-900 dark:text-white font-mono">
                              {record.call_from || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center">
                              <ArrowRight className="w-3 h-3 text-gray-400 mr-2" />
                              <span className="text-sm text-gray-900 dark:text-white font-mono">
                                {record.call_to || '-'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${dispositionStyle.bg} ${dispositionStyle.color}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {record.disposition || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-sm text-gray-900 dark:text-white">
                              {formatDuration(record.talk_duration || 0)}
                            </span>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Phone className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  No call records found for the selected period.
                </p>
              </div>
            )}

            {/* Total Duration */}
            {callRecords.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-end">
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Talk Time</p>
                    <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {formatDurationHMS(callRecords.reduce((sum, r) => sum + (r.talk_duration || 0), 0))}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </motion.div>
      )}
    </div>
  );
}
