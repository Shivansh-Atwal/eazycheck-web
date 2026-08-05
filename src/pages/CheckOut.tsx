import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Receipt, CreditCard, FileText, Loader2 } from 'lucide-react';

interface CheckIn {
  id: string;
  checkInTime: string;
  expectedCheckOutDate: string;
  advancePaid: number;
  remainingAmount: number;
  pricePerNight: number;
  customer: {
    fullName: string;
    mobileNumber: string;
    documents?: Array<{
      idType: string;
      idNumber: string;
    }>;
  };
  rooms: {
    id: string;
    roomNumber: string;
  }[];
  roomType: string;
  registrationNumber?: string;
}

const CheckOut: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [checkInId, setCheckInId] = useState<string | null>(null);

  // Bill custom factors
  const additionalCharges = 0;
  const discount = 0; // Force 0 discount
  const taxRate = 0.0; // 0% default (no tax)
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const getLocalDateString = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [checkoutDate, setCheckoutDate] = useState(getLocalDateString(new Date()));
  const [checkoutTime, setCheckoutTime] = useState(new Date().toTimeString().slice(0, 5));

  const [loading, setLoading] = useState(false);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [offlineCheckoutSaved, setOfflineCheckoutSaved] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [checkoutResults, setCheckoutResults] = useState<any[]>([]);

  useEffect(() => {
    if (location.state && location.state.checkInId) {
      setCheckInId(location.state.checkInId);
    }
  }, [location.state]);

  // Fetch Check-In stays list if none mapped
  const { data: staysRes } = useQuery({
    queryKey: ['active-stays-checkout'],
    queryFn: () => api.get('/stay/checkins').then((res) => res.data),
    enabled: !checkInId,
  });

  const activeStays: CheckIn[] = staysRes?.data || [];
  const filteredStays = activeStays.filter((stay) => {
    const term = searchTerm.toLowerCase();
    return (
      stay.customer.fullName.toLowerCase().includes(term) ||
      stay.customer.mobileNumber.includes(term) ||
      stay.rooms.map((r: any) => r.roomNumber).join(', ').toLowerCase().includes(term) ||
      (stay.registrationNumber && stay.registrationNumber.toLowerCase().includes(term))
    );
  });

  // Fetch Live calculations preview
  const { data: previewRes, isLoading: previewLoading } = useQuery({
    queryKey: ['checkout-preview', checkInId, additionalCharges, discount, taxRate, checkoutDate, checkoutTime],
    queryFn: () => {
      const checkoutTimeISO = new Date(`${checkoutDate}T${checkoutTime}`).toISOString();
      return api
        .get(
          `/stay/checkout/preview/${checkInId}?additionalCharges=${additionalCharges}&discount=${discount}&taxRate=${taxRate}&checkoutDate=${checkoutDate}&checkoutTime=${checkoutTime}&checkoutTimeISO=${encodeURIComponent(checkoutTimeISO)}`
        )
        .then((res) => res.data);
    },
    enabled: !!checkInId,
  });

  const checkIn: CheckIn | null = previewRes?.data?.checkIn || null;
  const calculations: any = previewRes?.data?.calculations || {
    nights: 0,
    roomCharges: 0,
    subtotal: 0,
    taxAmount: 0,
    finalAmount: 0,
    advancePaid: 0,
    stayDetails: [],
  };

  // Checkout Mutation
  const checkoutMutation = useMutation({
    mutationFn: (payload: any) => api.post('/stay/checkout', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['payment-ledger'] });
      const checkout = res.data?.data?.checkout;
      const allCheckouts = res.data?.data?.allCheckouts;

      if (checkout) {
        setOfflineCheckoutSaved(false);
        setInvoiceUrl(checkout.invoiceUrl);
        setCheckoutResults(allCheckouts || [checkout]);
      } else {
        setOfflineCheckoutSaved(true);
        setInvoiceUrl(null);
        setCheckoutResults([
          {
            id: res.data?.data?.id || checkInId,
            roomNumber: checkIn?.rooms?.map((r: any) => r.roomNumber).join(', ') || 'Offline',
            invoiceUrl: null,
          },
        ]);
      }
      setLoading(false);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Check-out failed.');
      setLoading(false);
    },
  });

  const handleFinalize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkInId) return;

    setLoading(true);
    const checkoutTimeISO = new Date(`${checkoutDate}T${checkoutTime}`).toISOString();
    checkoutMutation.mutate({
      checkInId,
      additionalCharges,
      discount,
      taxRate,
      roomCharges: calculations.roomCharges,
      taxAmount: calculations.taxAmount,
      finalAmount: calculations.finalAmount,
      paymentMethod,
      notes,
      checkoutDate,
      checkoutTime,
      checkoutTimeISO,
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Back link */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </button>

      {invoiceUrl || offlineCheckoutSaved ? (
        /* Success Invoicing screen */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">Check-Out Completed Successfully!</h3>
            <p className="text-slate-400 text-sm mt-2">
              {offlineCheckoutSaved
                ? 'Check-out was saved offline. It will sync and generate the invoice when the server is reachable.'
                : `Payment was settled. All (${checkoutResults.length}) rooms are now available for new check-ins.`}
            </p>
          </div>

          <div className="space-y-3 max-w-sm mx-auto">
            {checkoutResults.map((result: any, idx: number) => {
              const apiBase = api.defaults.baseURL || '';
              const backendHost = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase;
              if (!result.invoiceUrl) {
                return (
                  <div
                    key={idx}
                    className="px-6 py-3 bg-slate-950 text-slate-300 font-semibold rounded-xl text-xs border border-slate-700 flex items-center justify-center w-full"
                  >
                    <FileText className="w-4.5 h-4.5 mr-2" />
                    Invoice pending sync (Room {result.roomNumber})
                  </div>
                );
              }
              return (
                <a
                  key={idx}
                  href={`${backendHost}${result.invoiceUrl}`}
                  target="_blank"
                  rel="noreferrer"
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/10 text-xs transition-colors flex items-center justify-center w-full"
              >
                <FileText className="w-4.5 h-4.5 mr-2" />
                Download Invoice (Room {result.roomNumber})
              </a>
            );
          })}
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-slate-950 hover:bg-slate-900 text-slate-200 font-semibold rounded-xl text-xs border border-slate-700 transition-colors cursor-pointer w-full mt-4"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      ) : (
        /* Settlement Selector */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h3 className="text-lg font-bold text-white flex items-center border-b border-slate-800 pb-4">
            <Receipt className="w-5 h-5 text-blue-500 mr-2.5" />
            Hotel Check-Out Settlement
          </h3>

          {!checkInId && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-455 mb-1.5 font-mono text-blue-500 uppercase tracking-wider">
                  Quick Search Stays
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by customer name, registration / document ID, or room number..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-455 mb-3 uppercase tracking-wider">
                  Active Guest Occupancies ({filteredStays.length})
                </label>
                {filteredStays.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm bg-slate-950 rounded-xl border border-slate-850">
                    No active stays match your search.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredStays.map((stay) => {
                      const doc = stay.customer.documents?.[0] || null;
                      return (
                        <div
                          key={stay.id}
                          onClick={() => setCheckInId(stay.id)}
                          className="bg-slate-950 border border-slate-800/80 hover:border-blue-500 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg hover:shadow-blue-500/5 group flex flex-col justify-between"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1 pr-2">
                              <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors text-sm truncate">
                                {stay.customer.fullName}
                              </h4>
                              <p className="text-xs text-slate-400 mt-1 font-mono">{stay.customer.mobileNumber}</p>
                            </div>
                            <div className="bg-blue-500/10 text-blue-400 text-xs px-2.5 py-1.5 rounded-lg font-bold font-mono">
                              Room(s) {stay.rooms?.map((r: any) => r.roomNumber).join(', ')}
                            </div>
                          </div>
                          <div className="border-t border-slate-900 pt-2.5 mt-1 flex justify-between items-end">
                            <div>
                              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Registration / Identity</span>
                              <p className="text-xs text-slate-350 mt-0.5">
                                {doc ? (
                                  <><span className="text-slate-450">{doc.idType}:</span> <span className="font-mono text-emerald-400">{doc.idNumber}</span></>
                                ) : (
                                  <span className="text-slate-500 italic">No Document Loaded</span>
                                )}
                              </p>
                            </div>
                            {stay.registrationNumber && (
                              <div className="bg-emerald-500/10 text-emerald-400 text-[9px] px-2 py-0.5 rounded font-mono font-bold border border-emerald-500/20">
                                {stay.registrationNumber}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {checkInId && checkIn && (
            <form onSubmit={handleFinalize} className="space-y-6">
              {/* Stay Summary metadata */}
              <div className="bg-slate-950/40 p-4 border border-slate-850 rounded-xl text-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider">Guest Profile</span>
                  <p className="font-semibold text-white mt-1">{checkIn.customer.fullName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{checkIn.customer.mobileNumber}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block font-semibold uppercase tracking-wider">
                    Rooms to Checkout ({calculations.stayDetails?.length || 1})
                  </span>
                  <div className="mt-1.5 space-y-2.5">
                    {calculations.stayDetails ? (
                      calculations.stayDetails.map((detail: any, idx: number) => (
                        <div key={idx}>
                          <p className="font-semibold text-white">
                            Room {detail.roomNumber} <span className="text-xs text-slate-400 font-normal">({detail.roomType} - ₹{detail.pricePerNight}/night)</span>
                          </p>
                          {detail.checkInTime && (
                            <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                              Check-In: {new Date(detail.checkInTime).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div>
                        <p className="font-semibold text-white">Room(s) {checkIn.rooms?.map((r: any) => r.roomNumber).join(', ')}</p>
                        <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                          Check-In: {new Date(checkIn.checkInTime).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Custom Checkout Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800/60 pt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-450 mb-1.5">Custom Checkout Date</label>
                  <input
                    type="date"
                    required
                    value={checkoutDate}
                    onChange={(e) => setCheckoutDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-450 mb-1.5">Custom Checkout Time</label>
                  <input
                    type="time"
                    required
                    value={checkoutTime}
                    onChange={(e) => setCheckoutTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
                  />
                </div>
              </div>

              {/* Settle Payment Method Dropdown */}
              <div className="grid grid-cols-1 gap-4 border-t border-slate-800/60 pt-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-450 mb-1.5">Settle Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / QR Scan</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
              </div> {/* Billing breakdown receipts */}
              <div className="bg-slate-950/70 border border-slate-850 p-5 rounded-xl space-y-3.5 text-sm">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                  Invoice Estimation Breakdown
                </h4>
                {previewLoading ? (
                  <div className="text-center py-6 text-slate-500 text-xs">Recalculating charges...</div>
                ) : (
                  <div className="space-y-2.5 text-slate-300">
                    <div className="flex justify-between">
                      <span>Base Room Rate ({calculations.nights} nights):</span>
                      <span className="font-mono text-white">₹{calculations.roomCharges.toFixed(2)}</span>
                    </div>
                    {calculations.additionalCharges > 0 && (
                      <div className="space-y-1.5 border-t border-slate-850 pt-2">
                        <span className="text-[10px] text-slate-450 uppercase font-black tracking-wider block">Additional Ordered Items</span>
                        {calculations.stayDetails && calculations.stayDetails.map((stay: any) => 
                          stay.extraCharges && stay.extraCharges.map((charge: any) => (
                            <div key={charge.id} className="flex justify-between text-xs text-slate-350 pl-2">
                              <span>• {charge.itemName} {charge.quantity > 1 ? `x${charge.quantity}` : ''}:</span>
                              <span className="font-mono text-white">₹{charge.amount.toFixed(2)}</span>
                            </div>
                          ))
                        )}
                        <div className="flex justify-between text-xs text-slate-400 font-semibold pt-1 border-t border-slate-900/40">
                          <span>Total Additional Charges:</span>
                          <span className="font-mono text-white">₹{calculations.additionalCharges.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-slate-800 pt-2 font-bold text-white text-base">
                      <span>Estimated Final Bill:</span>
                      <span>₹{calculations.finalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-450 pt-1 border-t border-slate-850">
                      <span>Deposited Advance (Deducted):</span>
                      <span className="font-mono text-emerald-400">-₹{calculations.advancePaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm text-rose-400 pt-1">
                      <span>Outs. Balance to Pay:</span>
                      <span className="font-mono">₹{Math.max(0, calculations.finalAmount - calculations.advancePaid).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Settlement Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5">Settlement Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Mini-fridge items restocked. Guest checked out satisfied."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
                />
              </div>

              {/* Submit Checkout */}
              <div className="flex justify-end pt-4 border-t border-slate-800 mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800 text-white font-bold rounded-xl shadow-lg shadow-rose-600/10 text-xs transition-colors flex items-center cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing Check-Out...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4.5 h-4.5 mr-2" />
                      Collect Balance & Check-Out
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default CheckOut;
