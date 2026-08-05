import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { FileDown, Search, ClipboardList, Calendar } from 'lucide-react';
import { formatDate } from '../utils/dateFormatter';
import { Link } from 'react-router-dom';
import { downloadTextFile } from '../utils/download';

interface StayRecord {
  id: string;
  checkInTime: string;
  actualCheckOutTime: string | null;
  status: string;
  customerName: string;
  mobileNumber: string;
  completeAddress: string;
  idCardType: string;
  idCardNumber: string;
  state: string;
  nationality: string;
  roomNumber: string;
  roomPrice: number;
  numberOfGuests: number;
  bednights: number;
  registrationNumber?: string;
}

interface ReportsData {
  detailedRecords: StayRecord[];
}

const Records: React.FC = () => {
  // Filters state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');

  // Fetch reports data
  const { data: reportsRes, isLoading } = useQuery({
    queryKey: ['reports'],
    queryFn: () => api.get('/admin/reports').then((res) => res.data),
  });

  const reportData = (reportsRes?.data || { detailedRecords: [] }) as ReportsData;
  const detailedRecords = reportData.detailedRecords;

  // Filter detailed records
  const filteredRecords = detailedRecords.filter((rec) => {
    // 1. One-in-All Text Search query (Name, Mobile, ID, Room, Address, Origin)
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = query
      ? rec.customerName.toLowerCase().includes(query) ||
        rec.mobileNumber.includes(query) ||
        rec.idCardNumber.toLowerCase().includes(query) ||
        rec.roomNumber.toLowerCase().includes(query) ||
        rec.state.toLowerCase().includes(query) ||
        rec.nationality.toLowerCase().includes(query) ||
        rec.completeAddress.toLowerCase().includes(query)
      : true;

    // 2. Date Range Filter on check-in arrival date
    const recordTime = new Date(rec.checkInTime).getTime();
    
    // Normalize start date to 00:00:00
    let matchesStart = true;
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      matchesStart = recordTime >= start.getTime();
    }

    // Normalize end date to 23:59:59
    let matchesEnd = true;
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesEnd = recordTime <= end.getTime();
    }

    return matchesSearch && matchesStart && matchesEnd;
  });

  // CSV Exporter for detailed records
  const handleExportCSV = async () => {
    if (!filteredRecords.length) return;

    let csvContent = '';
    csvContent += 'Check-In Date,Check-Out Date,Guest Name,Mobile Number,Complete Address,ID Card Type,ID Card Number,State,Nationality,Room Number,Room Price,No of Members,Bednights Spent,Status\n';
    
    filteredRecords.forEach((ci) => {
      const formattedCheckInDate = formatDate(ci.checkInTime);
      const formattedCheckOutDate = ci.status === 'CHECKED_OUT' && ci.actualCheckOutTime
        ? formatDate(ci.actualCheckOutTime)
        : '';
      const escapedAddress = `"${ci.completeAddress.replace(/"/g, '""')}"`;
      const escapedName = `"${ci.customerName.replace(/"/g, '""')}"`;
      csvContent += `${formattedCheckInDate},${formattedCheckOutDate},${escapedName},${ci.mobileNumber},${escapedAddress},${ci.idCardType},${ci.idCardNumber},${ci.state},${ci.nationality},${ci.roomNumber},${ci.roomPrice},${ci.numberOfGuests},${ci.bednights},${ci.status}\n`;
    });

    await downloadTextFile('eazycheck_detailed_stay_report.csv', csvContent);
  };

  return (
    <div className="space-y-6">
      {/* Export Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center border-b border-slate-800 pb-4">
        <div>
          <p className="text-sm font-semibold text-slate-350">Search, review, and export all guest check-in records</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/records/previous"
            className="flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/10 transition-colors cursor-pointer"
          >
            Add Missed Stay Record
          </Link>
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-770 hover:border-slate-600 text-white font-black rounded-xl text-xs shadow-lg shadow-slate-950/50 transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Export Stay Records CSV
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-slate-500 font-bold text-sm">Loading stay records ledger...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
          <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
            <ClipboardList className="w-5 h-5 text-blue-500" />
            <div>
              <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Detailed Stay Ledger</h3>
              <p className="text-xs text-slate-450 mt-0.5">Comprehensive history of all guests, stays, and pricing parameters</p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col gap-4 p-4 bg-slate-950/40 rounded-xl border border-slate-850">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* One in All Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by Name, Mobile, ID, Room, Address, State..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-200 outline-none"
                />
              </div>

              {/* Date From */}
              <div className="flex items-center space-x-3.5 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1">
                <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="flex items-center w-full min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-500 mr-2 shrink-0">From</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-transparent text-slate-200 text-xs font-semibold outline-none py-1.5 cursor-pointer [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Date To */}
              <div className="flex items-center space-x-3.5 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1">
                <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                <div className="flex items-center w-full min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-500 mr-2 shrink-0">To</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-transparent text-slate-200 text-xs font-semibold outline-none py-1.5 cursor-pointer [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            {/* Clear filters trigger */}
            {(searchQuery || startDate || endDate) && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-bold transition-colors cursor-pointer"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRecords.length > 0 ? (
              filteredRecords.map((ci) => (
                <div key={ci.id} className="bg-slate-950/40 border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-slate-750 transition-all shadow-lg hover:shadow-slate-950/40 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Room Number</span>
                        <h4 className="text-xl font-black text-blue-400 font-mono">Room {ci.roomNumber}</h4>
                        {ci.registrationNumber && ci.registrationNumber !== 'N/A' && (
                          <span className="text-[10px] font-mono font-bold text-emerald-400 mt-0.5 block">
                            Reg: {ci.registrationNumber}
                          </span>
                        )}
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold border ${
                        ci.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {ci.status}
                      </span>
                    </div>

                    {/* Guest Info */}
                    <div className="border-t border-slate-850 pt-3">
                      <span className="text-[10px] uppercase font-bold text-slate-550 tracking-wider">Guest Information</span>
                      <p className="font-black text-white text-base mt-0.5 leading-tight">{ci.customerName}</p>
                      <p className="text-xs font-bold text-slate-350 mt-1">{ci.mobileNumber}</p>
                    </div>

                    {/* Stay Duration Stats */}
                    <div className={`grid ${ci.status === 'CHECKED_OUT' ? 'grid-cols-4' : 'grid-cols-3'} gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-850`}>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-550 block">Check-In</span>
                        <span className="text-xs font-bold text-slate-200">
                          {formatDate(ci.checkInTime)}
                        </span>
                      </div>
                      {ci.status === 'CHECKED_OUT' && ci.actualCheckOutTime && (
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-550 block">Check-Out</span>
                          <span className="text-xs font-bold text-slate-200">
                            {formatDate(ci.actualCheckOutTime)}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-550 block">Bednights</span>
                        <span className="text-xs font-bold text-indigo-400 font-mono">{ci.bednights} bednights</span>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-bold text-slate-555 block">Guests</span>
                        <span className="text-xs font-bold text-slate-200 font-mono">{ci.numberOfGuests} guests</span>
                      </div>
                    </div>

                    {/* Verification & Origin Details */}
                    <div className="grid grid-cols-2 gap-4 text-xs border-t border-slate-850 pt-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-555 block">ID Verification</span>
                        <p className="font-bold text-slate-200 mt-1">{ci.idCardType}</p>
                        <p className="font-mono text-[11px] text-slate-455 mt-0.5">{ci.idCardNumber}</p>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-555 block">Origin Region</span>
                        <p className="font-bold text-slate-200 mt-1">{ci.state}</p>
                        <p className="text-xs text-slate-455 mt-0.5">{ci.nationality}</p>
                      </div>
                    </div>

                    {/* Complete Address Block */}
                    <div className="text-xs bg-slate-900/40 p-3 rounded-xl border border-slate-850/80">
                      <span className="text-[10px] uppercase font-bold text-slate-555 block mb-1">Complete Address</span>
                      <p className="text-slate-200 leading-relaxed font-bold break-words">
                        {ci.completeAddress}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Room Price */}
                  <div className="flex justify-between items-center border-t border-slate-850 pt-3.5 mt-2">
                    <span className="text-xs font-bold text-slate-400">Room Price</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">₹{ci.roomPrice}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-16 text-center text-slate-500 font-bold border border-dashed border-slate-800 rounded-2xl bg-slate-950/20">
                No stay records found matching filters.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Records;
