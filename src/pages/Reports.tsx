import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { Map, TrendingUp, Calendar, Bed, Users, ClipboardList, DownloadCloud } from 'lucide-react';
import { formatDate } from '../utils/dateFormatter';
import { downloadTextFile } from '../utils/download';
import * as XLSX from 'xlsx';

interface StateWiseSummary {
  state: string;
  customers: number;
  bednights: number;
  areas?: {
    city: string;
    customers: number;
    bednights: number;
  }[];
}

interface TodaySummary {
  roomsUsed: number;
  bookingsCount: number;
  peopleStayed: number;
  todayRevenue: number;
}

interface ReportsData {
  stateWiseData: StateWiseSummary[];
  detailedRecords?: any[];
  todaySummary?: TodaySummary;
}


const Reports: React.FC = () => {
  const { hasPermission } = useAuthStore();
  const canReadPayments = hasPermission('payments.read');

  // Initialize dates to empty strings so the user is forced to select them first
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [revenueStateFilter, setRevenueStateFilter] = React.useState('');

  const [revenueData, setRevenueData] = React.useState<{
    totalRevenue: number;
    roomRevenue: number;
    additionalItemsRevenue: number;
    bookingsCount: number;
    dailyBreakdown?: Record<string, {
      date: string;
      roomRevenue: number;
      extraChargesRevenue: number;
      totalRevenue: number;
    }>;
  } | null>(null);
  const [revenueLoading, setRevenueLoading] = React.useState(false);
  const [revenueError, setRevenueError] = React.useState<string | null>(null);

  // Fetch reports data
  const { data: reportsRes, isLoading: reportsLoading, refetch: refetchReports } = useQuery({
    queryKey: ['reports'],
    queryFn: () => {
      const stateQuery = revenueStateFilter ? `&state=${encodeURIComponent(revenueStateFilter)}` : '';
      let dateQuery = '';
      if (startDate && endDate) {
        dateQuery = `?startDate=${startDate}&endDate=${endDate}${stateQuery}`;
      } else if (stateQuery) {
        dateQuery = `?${stateQuery.substring(1)}`;
      }
      return api.get(`/admin/reports${dateQuery}`).then((res) => res.data);
    },
  });

  const reportData: ReportsData = reportsRes?.data || {
    stateWiseData: [],
  };

  const handleFetchRevenue = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!startDate || !endDate) {
      setRevenueError('Please select both start and end dates.');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setRevenueError('End date must be on or after start date.');
      return;
    }

    setRevenueLoading(true);
    setRevenueError(null);
    try {
      const stateQuery = revenueStateFilter ? `&state=${encodeURIComponent(revenueStateFilter)}` : '';
      const res = await api.get(`/admin/revenue-report?startDate=${startDate}&endDate=${endDate}${stateQuery}`);
      if (res.data && res.data.success) {
        setRevenueData(res.data.data);
        await refetchReports(); // Also update state-wise records with new filters
      } else {
        setRevenueError('Failed to fetch revenue data.');
      }
    } catch (err: any) {
      setRevenueError(err.response?.data?.error || 'Failed to fetch revenue data.');
    } finally {
      setRevenueLoading(false);
    }
  };

  // CSV Exporter for state-wise records
  const handleExportCSV = async () => {
    if (!reportData.stateWiseData?.length) return;

    let csvContent = '';
    csvContent += 'State,Total Guests / Stays,Total Bednights Spent\n';
    
    reportData.stateWiseData.forEach((stat) => {
      const escapedState = `"${stat.state.replace(/"/g, '""')}"`;
      csvContent += `${escapedState},${stat.customers},${stat.bednights}\n`;
    });

    await downloadTextFile('eazycheck_state_wise_report.csv', csvContent);
  };

  const handleExportExcel = () => {
    if (!reportData.detailedRecords?.length) {
      alert('No detailed records available to export.');
      return;
    }
    
    // Format data for Excel
    const dataToExport = reportData.detailedRecords.map(record => ({
      'Guest Name': record.customerName,
      'Mobile Number': record.mobileNumber || 'N/A',
      'Check-in Date': formatDate(record.checkInTime),
      'Checkout Date': record.actualCheckOutTime ? formatDate(record.actualCheckOutTime) : 'Not Checked Out',
      'Nights Spent': Math.max(1, Math.ceil(record.bednights / record.numberOfGuests)),
      'Total Bednights': record.bednights,
      'State': record.state,
      'Address': record.completeAddress,
      'ID Type': record.idCardType,
      'ID Number': record.idCardNumber,
      'Room Number(s)': record.roomNumber,
      'Price Per Night (₹)': record.roomPrice,
      'Status': record.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Detailed Stays');
    
    // Also include a summary sheet
    if (reportData.stateWiseData?.length) {
      const summaryRows: any[] = [];
      reportData.stateWiseData.forEach(s => {
        summaryRows.push({
          'State / Area': `[STATE] ${s.state}`,
          'Total Guests': s.customers,
          'Total Bednights': s.bednights
        });
        if (s.areas && s.areas.length > 0) {
          s.areas.forEach(area => {
            summaryRows.push({
              'State / Area': `    ↳ ${area.city}`,
              'Total Guests': area.customers,
              'Total Bednights': area.bednights
            });
          });
        }
      });
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'State & Area Summary');
    }

    XLSX.writeFile(workbook, `eazycheck_detailed_report_${new Date().getTime()}.xlsx`);
  };

  const isLoading = reportsLoading;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center border-b border-slate-800 pb-4">
        <div>
          <p className="text-sm font-semibold text-slate-350">Analyze demographic distributions and revenue metrics</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-700 hover:border-slate-600 text-white font-black rounded-xl text-xs shadow-lg shadow-slate-950/50 transition-colors cursor-pointer"
          >
            <Map className="w-4 h-4 mr-2" />
            Export State CSV
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 hover:border-emerald-500 text-emerald-400 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            <DownloadCloud className="w-4 h-4 mr-2" />
            Export Detailed Excel
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-slate-500 font-bold text-sm">Aggregating analytics data...</div>
      ) : (
        <div className="space-y-6">
          {/* Daily Report Summary Cards */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
              <ClipboardList className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Today's Daily Report Summary</h3>
                <p className="text-xs text-slate-450 mt-0.5">Summary of all metrics for today's date ({formatDate(new Date().toISOString())})</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Rooms Occupied */}
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex items-center">
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-lg mr-4">
                  <Bed className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider block">Rooms Occupied</span>
                  <span className="text-xl font-extrabold text-white">{reportData.todaySummary?.roomsUsed || 0} Rooms</span>
                </div>
              </div>

              {/* Active Bookings */}
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex items-center">
                <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-lg mr-4">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-455 uppercase font-bold tracking-wider block">Active Stays</span>
                  <span className="text-xl font-extrabold text-white">{reportData.todaySummary?.bookingsCount || 0} Bookings</span>
                </div>
              </div>

              {/* People Stayed */}
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex items-center">
                <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg mr-4">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider block">Guests Stayed</span>
                  <span className="text-xl font-extrabold text-white">{reportData.todaySummary?.peopleStayed || 0} Guests</span>
                </div>
              </div>

              {/* Today's Revenue */}
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex items-center">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg mr-4">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] text-emerald-450 uppercase font-bold tracking-wider block">Today's Revenue</span>
                  <span className="text-xl font-extrabold text-emerald-400">
                    ₹{(reportData.todaySummary?.todayRevenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Section */}
          {canReadPayments ? (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-4">
                <div className="flex items-center space-x-2.5 flex-1">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Revenue Analytics</h3>
                    <p className="text-xs text-slate-450 mt-0.5">Track occupancy and booking revenues</p>
                  </div>
                </div>

                {/* Date Filter Form */}
                <form onSubmit={handleFetchRevenue} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                  <div className="flex items-center bg-slate-950/40 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300 w-full sm:w-auto justify-center">
                    <Map className="w-3.5 h-3.5 text-blue-400 shrink-0 mr-2" />
                    <input
                      type="text"
                      placeholder="State (Optional)"
                      value={revenueStateFilter}
                      onChange={(e) => setRevenueStateFilter(e.target.value)}
                      className="bg-transparent text-slate-200 font-semibold outline-none w-full sm:w-28 text-center"
                    />
                  </div>
                  <div className="flex items-center bg-slate-950/40 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300 w-full sm:w-auto justify-center">
                    <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0 mr-2" />
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent text-slate-200 font-semibold outline-none w-full sm:w-28 text-center cursor-pointer"
                    />
                  </div>
                  <span className="text-slate-500 font-bold text-center self-center sm:self-auto text-xs">to</span>
                  <div className="flex items-center bg-slate-950/40 border border-slate-800 px-3 py-1.5 rounded-xl text-xs text-slate-300 w-full sm:w-auto justify-center">
                    <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0 mr-2" />
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent text-slate-200 font-semibold outline-none w-full sm:w-28 text-center cursor-pointer"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={revenueLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-600/10 transition-colors cursor-pointer shrink-0"
                  >
                    {revenueLoading ? 'Calculating...' : 'Calculate Revenue'}
                  </button>
                </form>
              </div>

              {/* Revenue Displays or Placeholders */}
              {revenueError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl text-center">
                  {revenueError}
                </div>
              )}

              {revenueLoading && (
                <div className="text-center py-12 text-slate-500 font-bold text-xs">
                  Querying database and totaling bookings for the selected period...
                </div>
              )}

              {!revenueData && !revenueLoading && !revenueError && (
                <div className="bg-slate-950/10 border border-dashed border-slate-800 p-8 rounded-xl text-center">
                  <Calendar className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <span className="text-xs text-slate-450 uppercase font-semibold block tracking-wider">No Date Range Selected</span>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Select a start and end date above and click <strong>Calculate Revenue</strong> to retrieve booking details and total prices.
                  </p>
                </div>
              )}

              {revenueData && !revenueLoading && (
                <div className="space-y-4">
                  {/* Total Revenue Display */}
                  <div className="bg-slate-950/30 border border-slate-850 p-6 rounded-xl text-center space-y-2">
                    <span className="text-xs text-slate-400 uppercase font-black tracking-wider block">Total Revenue</span>
                    <div className="text-4xl font-black text-emerald-400">
                      ₹{revenueData.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-slate-500 font-mono">
                      Sum of room prices and additional charges for {revenueData.bookingsCount} booking(s) from {startDate ? formatDate(startDate) : ''} to {endDate ? formatDate(endDate) : ''}
                    </p>
                  </div>

                  {/* Sub-breakdowns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-950/20 border border-slate-850/80 p-4 rounded-xl text-center space-y-1">
                      <span className="text-[10px] text-slate-450 uppercase font-bold tracking-wider block">Room Bookings Revenue</span>
                      <div className="text-xl font-extrabold text-blue-400">
                        ₹{revenueData.roomRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="bg-slate-950/20 border border-slate-850/80 p-4 rounded-xl text-center space-y-1">
                      <span className="text-[10px] text-slate-455 uppercase font-bold tracking-wider block">Additional Items Revenue</span>
                      <div className="text-xl font-extrabold text-indigo-400">
                        ₹{revenueData.additionalItemsRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl text-center">
              <TrendingUp className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-400">Revenue Locked</h3>
              <p className="text-xs text-slate-500 mt-1">You require 'payments.read' permissions to view revenue data.</p>
            </div>
          )}

          {/* State-Wise Analytics Section */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-3">
              <Map className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">State-Wise Analytics</h3>
                <p className="text-xs text-slate-450 mt-0.5">Overall distribution of guests and bednights spent by state</p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-850 border-b border-slate-800 text-slate-300 text-xs uppercase font-bold tracking-wider">
                    <th className="p-4">State</th>
                    <th className="p-4">Total Guests / Stays</th>
                    <th className="p-4">Total Bednights Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm font-semibold text-slate-200 bg-slate-950/20">
                  {reportData.stateWiseData && reportData.stateWiseData.length > 0 ? (
                    reportData.stateWiseData.map((stat) => (
                      <tr key={stat.state} className="hover:bg-slate-850/30 transition-colors">
                        <td className="p-4 font-bold text-white">{stat.state}</td>
                        <td className="p-4 font-mono text-slate-300">{stat.customers}</td>
                        <td className="p-4 font-mono text-indigo-400">{stat.bednights} nights</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-500 font-bold">No state-wise data available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
