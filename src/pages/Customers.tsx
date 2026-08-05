import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api, { getBackendUrl } from '../utils/api';
import { Search, X, Phone, Mail, MapPin, Printer } from 'lucide-react';
import { formatDate } from '../utils/dateFormatter';

interface Customer {
  id: string;
  fullName: string;
  mobileNumber: string;
  alternateNumber?: string;
  email?: string;
  dob?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  documents: Array<{
    idType: string;
    idNumber: string;
    frontImageUrl?: string;
    backImageUrl?: string;
    customerPhotoUrl?: string;
  }>;
}

const Customers: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const handlePrintDocuments = (customer: Customer) => {
    const doc = customer.documents[0];
    if (!doc) return;

    const backendUrl = getBackendUrl();
    
    const getFullUrl = (url?: string) => {
      if (!url) return '';
      return url.startsWith('/') ? `${backendUrl}${url}` : url;
    };

    const frontUrl = getFullUrl(doc.frontImageUrl);
    const backUrl = getFullUrl(doc.backImageUrl);
    const photoUrl = getFullUrl(doc.customerPhotoUrl);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print documents.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Customer Documents - ${customer.fullName}</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #1a202c;
              margin: 0;
              padding: 0;
              background-color: #fff;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #2d3748;
              padding-bottom: 12px;
              margin-bottom: 24px;
            }
            .header h1 {
              font-size: 22px;
              margin: 0 0 6px 0;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #1a202c;
            }
            .header p {
              font-size: 13px;
              margin: 3px 0;
              color: #4a5568;
            }
            .container {
              display: flex;
              flex-direction: column;
              gap: 24px;
            }
            .section-title {
              font-size: 12px;
              font-weight: bold;
              text-transform: uppercase;
              color: #4a5568;
              margin-bottom: 8px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 4px;
              width: 100%;
            }
            .photo-section {
              display: flex;
              justify-content: center;
              margin-bottom: 10px;
            }
            .photo-card {
              border: 1px solid #cbd5e0;
              border-radius: 6px;
              padding: 12px;
              background-color: #f7fafc;
              display: flex;
              flex-direction: column;
              align-items: center;
              width: 180px;
              page-break-inside: avoid;
            }
            .passport-image {
              height: 165px;
              width: 130px;
              object-fit: cover;
              border-radius: 4px;
              border: 1px solid #cbd5e0;
            }
            .ids-section {
              display: flex;
              gap: 20px;
            }
            .id-card {
              flex: 1;
              border: 1px solid #cbd5e0;
              border-radius: 6px;
              padding: 16px;
              background-color: #f7fafc;
              display: flex;
              flex-direction: column;
              align-items: center;
              box-sizing: border-box;
              page-break-inside: avoid;
            }
            .doc-image {
              max-width: 100%;
              max-height: 280px;
              object-fit: contain;
              border-radius: 4px;
              border: 1px solid #cbd5e0;
              background-color: #fff;
            }
            .no-image {
              font-size: 12px;
              color: #a0aec0;
              padding: 40px 0;
              font-style: italic;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              font-size: 10px;
              color: #a0aec0;
              border-top: 1px solid #e2e8f0;
              padding-top: 8px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Customer Identity Documents</h1>
            <p><strong>Guest Name:</strong> ${customer.fullName} &nbsp;|&nbsp; <strong>Mobile:</strong> ${customer.mobileNumber}</p>
            <p><strong>Document Type:</strong> ${doc.idType} &nbsp;|&nbsp; <strong>Document Number:</strong> ${doc.idNumber}</p>
          </div>
          
          <div class="container">
            <!-- Passport Photo -->
            <div class="photo-section">
              <div class="photo-card">
                <div class="section-title">Passport Size Photo</div>
                ${photoUrl ? `<img class="passport-image" src="${photoUrl}" alt="Customer Photo" />` : '<div class="no-image">No Photo Uploaded</div>'}
              </div>
            </div>

            <!-- Front & Back IDs -->
            <div class="ids-section">
              <div class="id-card">
                <div class="section-title">ID Card Front</div>
                ${frontUrl ? `<img class="doc-image" src="${frontUrl}" alt="ID Front" />` : '<div class="no-image">No Front Image Uploaded</div>'}
              </div>
              <div class="id-card">
                <div class="section-title">ID Card Back</div>
                ${backUrl ? `<img class="doc-image" src="${backUrl}" alt="ID Back" />` : '<div class="no-image">No Back Image Uploaded</div>'}
              </div>
            </div>
          </div>

          <div class="footer">
            Generated by EazyCheck Management System on ${new Date().toLocaleString()}
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Fetch Customers
  const { data: customersRes, isLoading } = useQuery({
    queryKey: ['customers', searchQuery],
    queryFn: () =>
      api.get(`/customers/search?q=${searchQuery}`).then((res) => res.data),
  });

  // Fetch Stay History
  const { data: historyRes, isLoading: historyLoading } = useQuery({
    queryKey: ['customer-history', selectedCustomer?.id],
    queryFn: () => {
      if (!selectedCustomer) return null;
      return api.get(`/customers/${selectedCustomer.id}`).then((res) => res.data);
    },
    enabled: !!selectedCustomer,
  });

  const customers: Customer[] = customersRes?.data || [];
  const customerHistory = historyRes?.data || null;

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Name, Mob, or Govt ID..."
            className="w-full bg-slate-900 border border-slate-850 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Customer List */}
      {isLoading ? (
        <div className="text-center py-20 text-slate-500 text-sm">Loading guests index...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customers.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedCustomer(c)}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-blue-500/50 cursor-pointer transition-all shadow-md flex justify-between items-start"
            >
              <div className="space-y-2">
                <h4 className="text-base font-bold text-white leading-tight">{c.fullName}</h4>
                <div className="space-y-1 text-xs text-slate-400">
                  <p className="flex items-center">
                    <Phone className="w-3.5 h-3.5 mr-2 text-slate-500" />
                    {c.mobileNumber}
                  </p>
                  {c.email && (
                    <p className="flex items-center">
                      <Mail className="w-3.5 h-3.5 mr-2 text-slate-500" />
                      {c.email}
                    </p>
                  )}
                  {c.city && (
                    <p className="flex items-center">
                      <MapPin className="w-3.5 h-3.5 mr-2 text-slate-500" />
                      {c.city}, {c.state}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 items-end shrink-0">
                <div className="px-2.5 py-1 bg-slate-950 hover:bg-slate-900 text-slate-200 text-[10px] uppercase font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer">
                  View History
                </div>
                {c.documents?.[0] && (c.documents[0].frontImageUrl || c.documents[0].backImageUrl || c.documents[0].customerPhotoUrl) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePrintDocuments(c);
                    }}
                    className="p-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 rounded-lg border border-blue-500/20 transition-colors cursor-pointer flex items-center justify-center"
                    title="Print Documents"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide Drawer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setSelectedCustomer(null)}
          />

          {/* Drawer content */}
          <div className="relative w-full max-w-lg bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col justify-between z-10 animate-slide-in">
            <div className="overflow-y-auto flex-1">
              {/* Header */}
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/60 backdrop-blur-md sticky top-0 z-10">
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedCustomer.fullName}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Guest Profile Summary</p>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6">
                {/* Contact and Demographics */}
                <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-3 text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-slate-500 block">Mobile Number</span>
                      <span className="font-semibold text-slate-200">{selectedCustomer.mobileNumber}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Alt Mobile</span>
                      <span className="font-semibold text-slate-200">{selectedCustomer.alternateNumber || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/60">
                    <div>
                      <span className="text-xs text-slate-500 block">Date of Birth</span>
                      <span className="font-semibold text-slate-200">
                        {selectedCustomer.dob ? formatDate(selectedCustomer.dob) : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block">Gender</span>
                      <span className="font-semibold text-slate-200 capitalize">{selectedCustomer.gender || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60">
                    <span className="text-xs text-slate-500 block">Address</span>
                    <span className="font-semibold text-slate-200">
                      {[selectedCustomer.address, selectedCustomer.city, selectedCustomer.state, selectedCustomer.pincode]
                        .filter(Boolean)
                        .join(', ') || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Identity verification documents */}
                {selectedCustomer.documents?.[0] && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-semibold text-slate-450 tracking-wider uppercase">Identity Verification</h4>
                      {(selectedCustomer.documents[0].frontImageUrl || selectedCustomer.documents[0].backImageUrl || selectedCustomer.documents[0].customerPhotoUrl) && (
                        <button
                          onClick={() => handlePrintDocuments(selectedCustomer)}
                          className="flex items-center gap-1 px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] uppercase font-bold rounded-lg border border-blue-500/25 transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Print A4 ID
                        </button>
                      )}
                    </div>
                    <div className="bg-slate-950/20 border border-slate-850 p-4 rounded-xl space-y-3 text-sm">
                      <div className="flex justify-between">
                        <div>
                          <span className="text-xs text-slate-500 block">ID Document Type</span>
                          <span className="font-semibold text-slate-200">{selectedCustomer.documents[0].idType}</span>
                        </div>
                        <div>
                          <span className="text-xs text-slate-500 block">Document Number</span>
                          <span className="font-semibold text-slate-200 font-mono">{selectedCustomer.documents[0].idNumber}</span>
                        </div>
                      </div>

                      {/* Display image stubs */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        {selectedCustomer.documents[0].customerPhotoUrl && (
                          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center text-[10px]">
                            <p className="text-slate-400 mb-1">Face Photo</p>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">Uploaded</span>
                          </div>
                        )}
                        {selectedCustomer.documents[0].frontImageUrl && (
                          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center text-[10px]">
                            <p className="text-slate-400 mb-1">Front ID</p>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">Uploaded</span>
                          </div>
                        )}
                        {selectedCustomer.documents[0].backImageUrl && (
                          <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-center text-[10px]">
                            <p className="text-slate-400 mb-1">Back ID</p>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300">Uploaded</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Stay history timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-450 tracking-wider uppercase">Stay History Logs</h4>
                  {historyLoading ? (
                    <div className="text-center py-6 text-slate-500 text-xs">Loading logs...</div>
                  ) : (
                    <div className="space-y-3">
                      {customerHistory?.bookings?.length === 0 ? (
                        <p className="text-xs text-slate-500 py-2">No past stays registered.</p>
                      ) : (
                        customerHistory?.bookings?.map((b: any) => (
                          <div key={b.id} className="bg-slate-950/20 border border-slate-850 p-4 rounded-xl flex justify-between items-center text-xs">
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-200">
                                Room {b.rooms?.map((r: any) => r.roomNumber).join(', ') || 'N/A'}
                              </p>
                              <p className="text-slate-400">
                                {formatDate(b.checkInDate)} - {formatDate(b.checkOutDate)}
                              </p>
                            </div>
                            <div className="text-right space-y-1">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-350 capitalize">{b.status.toLowerCase()}</span>
                              <p className="font-semibold text-emerald-400">₹{b.price}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
