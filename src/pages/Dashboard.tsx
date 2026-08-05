import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useNetwork } from '../hooks/useNetwork';
import { formatDate } from '../utils/dateFormatter';
import {
  Bed,
  X,
  CreditCard,
  User,
  Phone,
  Calendar,
  MapPin
} from 'lucide-react';

interface Room {
  id: string;
  roomNumber: string;
  floorNumber: number;
  roomType: string;
  capacity: number;
  amenities: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'ADVANCE_BOOKED' | 'MAINTENANCE';
  checkIns?: any[];
  bookings?: any[];
}

interface Stats {
  totalRooms: number;
  availableRooms: number;
  occupiedRooms: number;
  bookedRooms: number;
  todayCheckins: number;
  todayCheckouts: number;
  todayRevenue: number;
  pendingPayments: number;
}

const PRESET_ITEMS = [
  { name: 'Water Bottle'},
  { name: 'Tea'},
];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isOnline } = useNetwork();
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Fetch Rooms
  const { data: roomsRes, isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get('/rooms').then((res) => res.data),
  });

  // Fetch Stats
  const { data: statsRes } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/admin/dashboard-stats').then((res) => res.data),
  });

  // Fetch Single Room Details (Active checkin/booking data)
  const { data: roomDetailsRes, isLoading: detailsLoading } = useQuery({
    queryKey: ['room-details', selectedRoom?.id],
    queryFn: () => {
      if (!selectedRoom) return null;
      return api.get(`/rooms/${selectedRoom.id}`).then((res) => res.data);
    },
    enabled: !!selectedRoom,
  });

  // Additional Item Orders States
  const [extraItemName, setExtraItemName] = useState('');
  const [extraItemPrice, setExtraItemPrice] = useState('');
  const [extraItemQty, setExtraItemQty] = useState('1');
  const [extraItemLoading, setExtraItemLoading] = useState(false);
  const [drawerPreset, setDrawerPreset] = useState<string>('custom');

  // Quick Add Item States
  const [quickAddStayId, setQuickAddStayId] = useState<string | null>(null);
  const [quickAddRoomNum, setQuickAddRoomNum] = useState<string | null>(null);
  const [quickItemName, setQuickItemName] = useState('');
  const [quickItemPrice, setQuickItemPrice] = useState('');
  const [quickItemQty, setQuickItemQty] = useState('1');
  const [quickItemLoading, setQuickItemLoading] = useState(false);
  const [quickPreset, setQuickPreset] = useState<string>('custom');

  const [deleteItemLoading, setDeleteItemLoading] = useState<string | null>(null);

  const handleDeleteExtraItem = async (chargeId: string) => {
    const checkInId = roomDetailsRes?.data?.checkIns?.[0]?.id;
    if (!checkInId) return;
    if (!window.confirm('Are you sure you want to remove this item?')) return;

    setDeleteItemLoading(chargeId);
    try {
      await api.delete(`/stay/checkin/${checkInId}/extra-charges/${chargeId}`);
      queryClient.invalidateQueries({ queryKey: ['room-details', selectedRoom?.id] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['payment-ledger'] });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to remove item.');
    } finally {
      setDeleteItemLoading(null);
    }
  };

  const handleAddExtraItem = async () => {
    const checkInId = roomDetailsRes?.data?.checkIns?.[0]?.id;
    if (!checkInId) return;
    if (!extraItemName.trim() || !extraItemPrice.trim() || !extraItemQty.trim()) {
      alert('Please enter item name, price, and quantity.');
      return;
    }
    const qty = parseInt(extraItemQty, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Quantity must be a positive integer.');
      return;
    }
    setExtraItemLoading(true);
    try {
      await api.post(`/stay/checkin/${checkInId}/extra-charges`, {
        itemName: extraItemName.trim(),
        amount: Number(extraItemPrice) * qty,
        quantity: qty,
      });
      setExtraItemName('');
      setExtraItemPrice('');
      setExtraItemQty('1');
      setDrawerPreset('custom');
      // Invalidate queries to refresh details
      queryClient.invalidateQueries({ queryKey: ['room-details', selectedRoom?.id] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['payment-ledger'] });
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add charge.');
    } finally {
      setExtraItemLoading(false);
    }
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddStayId) return;
    if (!quickItemName.trim() || !quickItemPrice.trim() || !quickItemQty.trim()) {
      alert('Please enter item name, price, and quantity.');
      return;
    }
    const qty = parseInt(quickItemQty, 10);
    if (isNaN(qty) || qty <= 0) {
      alert('Quantity must be a positive integer.');
      return;
    }
    setQuickItemLoading(true);
    try {
      await api.post(`/stay/checkin/${quickAddStayId}/extra-charges`, {
        itemName: quickItemName.trim(),
        amount: Number(quickItemPrice) * qty,
        quantity: qty,
      });
      setQuickItemName('');
      setQuickItemPrice('');
      setQuickItemQty('1');
      setQuickPreset('custom');
      setQuickAddStayId(null);
      setQuickAddRoomNum(null);
      // Invalidate queries to refresh rooms inventory
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['payment-ledger'] });
      // If the selected room is the one we just added an item to, refresh its details too
      if (selectedRoom) {
        queryClient.invalidateQueries({ queryKey: ['room-details', selectedRoom.id] });
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add charge.');
    } finally {
      setQuickItemLoading(false);
    }
  };

  // Toggle Maintenance Mutation
  const updateStatusMutation = useMutation({
    mutationFn: (data: { roomId: string; status: string }) =>
      api.patch(`/rooms/${data.roomId}/status`, { status: data.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      if (selectedRoom) {
        setSelectedRoom((prev) => (prev ? { ...prev, status: prev.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE' } : null));
      }
    },
  });

  const rooms: Room[] = roomsRes?.data || [];
  const stats: Stats = statsRes?.data || {
    totalRooms: 0,
    availableRooms: 0,
    occupiedRooms: 0,
    bookedRooms: 0,
    todayCheckins: 0,
    todayCheckouts: 0,
    todayRevenue: 0,
    pendingPayments: 0,
  };

  const getStatusColor = (status: Room['status']) => {
    switch (status) {
      case 'AVAILABLE':
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25';
      case 'OCCUPIED':
        return 'bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25';
      case 'ADVANCE_BOOKED':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25';
      case 'MAINTENANCE':
        return 'bg-slate-500/10 border-slate-500/20 text-slate-400 hover:bg-slate-500/20';
    }
  };

  const getStatusBadge = (status: Room['status']) => {
    switch (status) {
      case 'AVAILABLE':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300">Available</span>;
      case 'OCCUPIED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300">Occupied</span>;
      case 'ADVANCE_BOOKED':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300">Booked</span>;
      case 'MAINTENANCE':
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">Maintenance</span>;
    }
  };

  return (
    <div className="space-y-8">
      {!isOnline && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-scale-in">
          <div>
            <h3 className="text-amber-400 font-extrabold text-base flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mr-2.5 animate-pulse"></span>
              PostgreSQL Database Offline
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-semibold">
              The application is currently offline. You can switch to the SQLite Offline Mode to manage local check-ins and bookings.
            </p>
          </div>
          <button
            onClick={() => navigate('/offline')}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
          >
            Switch to SQLite Offline Mode
          </button>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Rooms */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center shadow-md relative overflow-hidden">
          <div className="p-4 bg-blue-500/15 text-blue-400 rounded-xl mr-5">
            <Bed className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">Inventory Summary</p>
            <p className="text-3xl font-extrabold text-white mt-1">{stats.totalRooms} Rooms</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {stats.availableRooms} Available / {stats.occupiedRooms} Occupied
            </p>
          </div>
          <div className="absolute -right-6 -bottom-6 w-16 h-16 bg-blue-500/5 rounded-full blur-xl" />
        </div>

        {/* Today Check-Ins */}

        {/* Today's Revenue */}
        

        {/* Outstanding Receivables */}
        

      </div>

      {/* Main Grid Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-200">Room Grid Status</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-slate-400">
          <div className="flex items-center"><span className="w-3 h-3 bg-emerald-500 rounded-full mr-2"></span>Available</div>
          <div className="flex items-center"><span className="w-3 h-3 bg-rose-500 rounded-full mr-2"></span>Occupied</div>
          <div className="flex items-center"><span className="w-3 h-3 bg-amber-500 rounded-full mr-2"></span>Booked</div>
        </div>
      </div>

      {/* Grid of rooms */}
      {roomsLoading ? (
        <div className="text-center py-20 text-slate-500">Loading rooms inventory...</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
          {rooms.map((room) => (
            <div
              key={room.id}
              onClick={() => setSelectedRoom(room)}
              className={`border p-3.5 sm:p-5 rounded-xl sm:rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between h-32 sm:h-36 select-none ${getStatusColor(
                room.status
              )}`}
            >
              <div className="flex justify-between items-start">
                <span className="text-2xl font-bold tracking-tight font-mono text-white">
                  {room.roomNumber}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-950/45 text-slate-350">
                  Fl {room.floorNumber}
                </span>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-300 tracking-wider truncate">
                  {room.checkIns?.[0]?.customer?.fullName}
                </p>
                {room.checkIns?.[0]?.checkInTime && (
                  <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                    In: {new Date(room.checkIns[0].checkInTime).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                )}
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm font-semibold text-white">
                    {room.status === 'OCCUPIED' && room.checkIns?.[0] ? (
                      `₹${(room.checkIns?.[0]?.pricePerNight || 0).toFixed(2)}/nt`
                    ) : room.status === 'ADVANCE_BOOKED' && room.bookings?.[0] ? (
                      `₹${(room.bookings?.[0]?.price || 0).toFixed(2)}/nt`
                    ) : (
                      '₹ Custom'
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide Drawer Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setSelectedRoom(null)}
          />

          {/* Drawer content */}
          <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col justify-between z-10 animate-slide-in">
            <div>
              {/* Header */}
              <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/60 backdrop-blur-md sticky top-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-100 flex items-center">
                    Room {selectedRoom.roomNumber} Details
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedRoom.roomType} Room</p>
                </div>
                <button
                  onClick={() => setSelectedRoom(null)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-160px)]">
                {/* Status Badge */}
                <div className="flex justify-between items-center bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                  <span className="text-sm text-slate-400 font-medium">Current Status</span>
                  {getStatusBadge(selectedRoom.status)}
                </div>

                {/* Loading detail stubs */}
                {detailsLoading ? (
                  <div className="text-center py-10 text-slate-500 text-sm">Fetching context...</div>
                ) : (
                  <>
                    {/* OCCUPIED DETAILS */}
                    {selectedRoom.status === 'OCCUPIED' && roomDetailsRes?.data?.checkIns?.[0] && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Active Stay Guest</h4>
                        <div className="bg-slate-950/30 border border-slate-800 rounded-xl p-4 space-y-3">
                          {roomDetailsRes.data.checkIns[0].registrationNumber && (
                            <div className="text-[10px] bg-emerald-500/10 text-emerald-400 font-mono font-bold px-2.5 py-1 rounded-lg border border-emerald-500/20 inline-block">
                              Registration No: {roomDetailsRes.data.checkIns[0].registrationNumber}
                            </div>
                          )}
                          <div className="flex items-center text-sm">
                            <User className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                            <span className="font-semibold text-slate-200">
                              {roomDetailsRes.data.checkIns[0].customer.fullName} {roomDetailsRes.data.checkIns[0].customer.gender ? `(${roomDetailsRes.data.checkIns[0].customer.gender})` : ''}
                            </span>
                          </div>
                          <div className="flex items-center text-sm">
                            <Phone className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                            <span className="text-slate-350">
                              {roomDetailsRes.data.checkIns[0].customer.mobileNumber}
                              {roomDetailsRes.data.checkIns[0].customer.alternateNumber && ` / ${roomDetailsRes.data.checkIns[0].customer.alternateNumber}`}
                            </span>
                          </div>
                          {roomDetailsRes.data.checkIns[0].customer.email && (
                            <div className="flex items-center text-sm text-slate-350">
                              <span className="w-4 text-slate-550 mr-2.5 text-center font-bold font-mono">@</span>
                              <span className="truncate">{roomDetailsRes.data.checkIns[0].customer.email}</span>
                            </div>
                          )}
                          {roomDetailsRes.data.checkIns[0].customer.dob && (
                            <div className="flex items-center text-sm text-slate-350">
                              <Calendar className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                              <span>DOB: {formatDate(roomDetailsRes.data.checkIns[0].customer.dob)}</span>
                            </div>
                          )}
                          {(roomDetailsRes.data.checkIns[0].customer.address || roomDetailsRes.data.checkIns[0].customer.city) && (
                            <div className="flex items-start text-sm">
                              <MapPin className="w-4 h-4 text-slate-500 mr-2.5 shrink-0 mt-0.5" />
                              <span className="text-slate-350 leading-tight">
                                {[
                                  roomDetailsRes.data.checkIns[0].customer.address,
                                  roomDetailsRes.data.checkIns[0].customer.city,
                                  roomDetailsRes.data.checkIns[0].customer.state,
                                  roomDetailsRes.data.checkIns[0].customer.country,
                                  roomDetailsRes.data.checkIns[0].customer.pincode
                                ].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center text-sm">
                            <Calendar className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                            <span className="text-slate-400 text-xs">
                              In: {new Date(roomDetailsRes.data.checkIns[0].checkInTime).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          </div>
                          <div className="flex items-center text-sm border-t border-slate-800/80 pt-2.5 mt-2.5">
                            <CreditCard className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                            <div className="flex-1 flex justify-between text-xs">
                              <span className="text-slate-400">Advance Paid:</span>
                              <span className="text-emerald-400 font-bold">₹{roomDetailsRes.data.checkIns[0].advancePaid}</span>
                            </div>
                          </div>
                          <div className="flex items-center text-sm">
                            <div className="w-4 mr-2.5" />
                            <div className="flex-1 flex justify-between text-xs font-semibold">
                              <span className="text-slate-400">Remaining Balance:</span>
                              <span className="text-rose-400">₹{roomDetailsRes.data.checkIns[0].remainingAmount}</span>
                            </div>
                          </div>
                          <div className="flex items-center text-sm">
                            <div className="w-4 mr-2.5" />
                            <div className="flex-1 flex justify-between text-xs font-semibold">
                              <span className="text-slate-400">Rate / Night:</span>
                              <span className="text-emerald-450 font-semibold">₹{roomDetailsRes.data.checkIns[0].pricePerNight}</span>
                            </div>
                          </div>
                        </div>

                        {roomDetailsRes.data.checkIns[0].otherCheckIns && roomDetailsRes.data.checkIns[0].otherCheckIns.length > 0 && (
                          <div className="space-y-2.5 mt-4">
                            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Other Rooms Checked-In Simultaneously</h5>
                            <div className="space-y-2">
                              {roomDetailsRes.data.checkIns[0].otherCheckIns.map((other: any) => (
                                <div key={other.id} className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-xs space-y-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-white font-mono">Room(s) {other.rooms?.map((r: any) => r.roomNumber).join(', ')}</span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">Occupied</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-400">
                                    <div>Reg No: <span className="text-slate-200 font-mono">{other.registrationNumber}</span></div>
                                    <div>Guests: <span className="text-slate-200">{other.numberOfGuests}</span></div>
                                    <div>Rate: <span className="text-slate-200">₹{other.pricePerNight}/nt</span></div>
                                    <div>Out: <span className="text-slate-200">{formatDate(other.expectedCheckOutDate)}</span></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Additional Room Charges Section */}
                        <div className="space-y-4 pt-4 border-t border-slate-800/85">
                          <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider">Additional Room Charges</h4>
                          
                          {/* List of charges */}
                          <div className="space-y-2">
                            {roomDetailsRes.data.checkIns[0].extraCharges && roomDetailsRes.data.checkIns[0].extraCharges.length > 0 ? (
                              roomDetailsRes.data.checkIns[0].extraCharges.map((charge: any) => (
                                <div key={charge.id} className="flex justify-between items-center bg-slate-950/40 px-3.5 py-2.5 rounded-xl border border-slate-850 text-xs">
                                  <div className="flex flex-col">
                                    <span className="text-slate-300 font-semibold">
                                      {charge.itemName} {charge.quantity > 1 ? `x${charge.quantity}` : ''}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                                      ₹{(charge.amount / charge.quantity).toFixed(2)} each
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono font-bold text-emerald-450">₹{charge.amount.toFixed(2)}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteExtraItem(charge.id)}
                                      disabled={deleteItemLoading === charge.id}
                                      className="p-1 rounded-md text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                      title="Remove item"
                                    >
                                      {deleteItemLoading === charge.id ? (
                                        <div className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <X className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-500 italic">No additional items ordered yet.</p>
                            )}
                          </div>

                          {/* Form to add charge */}
                          <div className="bg-slate-950/30 p-4 rounded-2xl border border-slate-850 space-y-3">
                            <span className="text-[10px] uppercase font-black tracking-wider block text-slate-450">Add Ordered Item</span>
                            
                            <div className="space-y-1">
                              <select
                                value={drawerPreset}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDrawerPreset(val);
                                  if (val === 'custom') {
                                    setExtraItemName('');
                                    setExtraItemPrice('');
                                  } else {
                                    const preset = PRESET_ITEMS[parseInt(val)];
                                    if (preset) {
                                      setExtraItemName(preset.name);
                                    }
                                  }
                                }}
                                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                              >
                                <option value="custom">-- Custom Item --</option>
                                {PRESET_ITEMS.map((item, idx) => (
                                  <option key={idx} value={idx}>
                                    {item.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex flex-col gap-2">
  {/* Inputs Row */}
  <div className="flex gap-2 items-center">
    <input
      type="text"
      placeholder="Item name"
      value={extraItemName}
      onChange={(e) => {
        setExtraItemName(e.target.value);
        setDrawerPreset('custom');
      }}
      className="flex-grow bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-2.5 text-xs text-white outline-none"
    />

    <input
      type="number"
      placeholder="Price"
      value={extraItemPrice}
      onChange={(e) => {
        setExtraItemPrice(e.target.value);
        setDrawerPreset('custom');
      }}
      className="w-16 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-2 py-2.5 text-xs text-white outline-none font-mono"
    />

    <input
      type="number"
      placeholder="Qty"
      min="1"
      value={extraItemQty}
      onChange={(e) => {
        setExtraItemQty(e.target.value);
      }}
      className="w-12 bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-2 py-2.5 text-xs text-white outline-none font-mono"
    />
  </div>

  {/* Button Row */}
  <button
    type="button"
    onClick={handleAddExtraItem}
    disabled={extraItemLoading}
    className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed font-mono"
  >
    {extraItemLoading ? '...' : 'Add'}
  </button>
</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ADVANCE BOOKED DETAILS */}
                    {selectedRoom.status === 'ADVANCE_BOOKED' && roomDetailsRes?.data?.bookings?.[0] && (
                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Advance Reservation Details</h4>
                        <div className="bg-slate-950/30 border border-slate-800 rounded-xl p-4 space-y-3">
                          <div className="flex items-center text-sm">
                            <User className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                            <span className="font-semibold text-slate-200">
                              {roomDetailsRes.data.bookings[0].customer.fullName} {roomDetailsRes.data.bookings[0].customer.gender ? `(${roomDetailsRes.data.bookings[0].customer.gender})` : ''}
                            </span>
                          </div>
                          <div className="flex items-center text-sm">
                            <Phone className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                            <span className="text-slate-350">
                              {roomDetailsRes.data.bookings[0].customer.mobileNumber}
                              {roomDetailsRes.data.bookings[0].customer.alternateNumber && ` / ${roomDetailsRes.data.bookings[0].customer.alternateNumber}`}
                            </span>
                          </div>
                          {roomDetailsRes.data.bookings[0].customer.email && (
                            <div className="flex items-center text-sm text-slate-350">
                              <span className="w-4 text-slate-550 mr-2.5 text-center font-bold font-mono">@</span>
                              <span className="truncate">{roomDetailsRes.data.bookings[0].customer.email}</span>
                            </div>
                          )}
                          {roomDetailsRes.data.bookings[0].customer.dob && (
                            <div className="flex items-center text-sm text-slate-350">
                              <Calendar className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                              <span>DOB: {formatDate(roomDetailsRes.data.bookings[0].customer.dob)}</span>
                            </div>
                          )}
                          {(roomDetailsRes.data.bookings[0].customer.address || roomDetailsRes.data.bookings[0].customer.city) && (
                            <div className="flex items-start text-sm">
                              <MapPin className="w-4 h-4 text-slate-500 mr-2.5 shrink-0 mt-0.5" />
                              <span className="text-slate-350 leading-tight">
                                {[
                                  roomDetailsRes.data.bookings[0].customer.address,
                                  roomDetailsRes.data.bookings[0].customer.city,
                                  roomDetailsRes.data.bookings[0].customer.state,
                                  roomDetailsRes.data.bookings[0].customer.country,
                                  roomDetailsRes.data.bookings[0].customer.pincode
                                ].filter(Boolean).join(', ')}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center text-sm">
                            <Calendar className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                            <span className="text-slate-400 text-xs">
                              Stay: {formatDate(roomDetailsRes.data.bookings[0].checkInDate)} to {formatDate(roomDetailsRes.data.bookings[0].checkOutDate)}
                            </span>
                          </div>
                          <div className="flex items-center text-sm border-t border-slate-800/80 pt-2.5 mt-2.5">
                            <CreditCard className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                            <div className="flex-1 flex justify-between text-xs">
                              <span className="text-slate-400">Paid Deposit:</span>
                              <span className="text-emerald-400 font-bold">₹{roomDetailsRes.data.bookings[0].advancePayment}</span>
                            </div>
                          </div>
                          <div className="flex items-center text-sm">
                            <div className="w-4 mr-2.5" />
                            <div className="flex-1 flex justify-between text-xs font-semibold">
                              <span className="text-slate-400">Rate / Night:</span>
                              <span className="text-emerald-450 font-semibold">₹{roomDetailsRes.data.bookings[0].price}</span>
                            </div>
                          </div>
                        </div>

                        {roomDetailsRes.data.bookings[0].otherBookings && roomDetailsRes.data.bookings[0].otherBookings.length > 0 && (
                          <div className="space-y-2.5 mt-4">
                            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Other Rooms Booked Simultaneously</h5>
                            <div className="space-y-2">
                              {roomDetailsRes.data.bookings[0].otherBookings.map((other: any) => (
                                <div key={other.id} className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-xs space-y-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-white font-mono">Room(s) {other.rooms?.map((r: any) => r.roomNumber).join(', ')}</span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-355 border border-amber-500/20">Booked</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-400">
                                    <div>Guests: <span className="text-slate-200">{other.numberOfGuests}</span></div>
                                    <div>Rate: <span className="text-slate-200">₹{other.price}/nt</span></div>
                                    <div className="col-span-2">Stay: <span className="text-slate-200">{formatDate(other.checkInDate)} to {formatDate(other.checkOutDate)}</span></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Amenities list */}
                    

                    {/* Room Capacity */}
                   
                  </>
                )}
              </div>
            </div>

            {/* Actions footer */}
            <div className="p-6 border-t border-slate-800 space-y-3 bg-slate-900/40 sticky bottom-0">
              {/* AVAILABLE actions */}
              {selectedRoom.status === 'AVAILABLE' && (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      setSelectedRoom(null);
                      navigate('/checkin', { state: { roomId: selectedRoom.id, roomNumber: selectedRoom.roomNumber } });
                    }}
                    className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/10 text-center text-xs transition-colors cursor-pointer"
                  >
                    Check-In Guest
                  </button>
                  <button
                    onClick={() => {
                      setSelectedRoom(null);
                      navigate('/bookings', { state: { roomId: selectedRoom.id, roomNumber: selectedRoom.roomNumber } });
                    }}
                    className="py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/10 text-center text-xs transition-colors cursor-pointer"
                  >
                    Book Room
                  </button>
                </div>
              )}

              {/* OCCUPIED actions */}
              {selectedRoom.status === 'OCCUPIED' && roomDetailsRes?.data?.checkIns?.[0] && (
                <button
                  onClick={() => {
                    setSelectedRoom(null);
                    navigate('/checkout', { state: { checkInId: roomDetailsRes.data.checkIns[0].id } });
                  }}
                  className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Proceed to Check-Out
                </button>
              )}

              {/* BOOKED actions */}
              {selectedRoom.status === 'ADVANCE_BOOKED' && roomDetailsRes?.data?.bookings?.[0] && (
                <button
                  onClick={() => {
                    setSelectedRoom(null);
                    navigate('/checkin', { state: { bookingId: roomDetailsRes.data.bookings[0].id } });
                  }}
                  className="w-full py-3 px-4 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Convert Reservation to Check-In
                </button>
              )}

              {/* MAINTENANCE actions */}
              {selectedRoom.status === 'MAINTENANCE' && (
                <button
                  onClick={() => updateStatusMutation.mutate({ roomId: selectedRoom.id, status: 'AVAILABLE' })}
                  className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-900 text-white font-bold rounded-xl text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  Mark Available (Clean)
                </button>
              )}

              {/* General Maintenance Trigger */}
              {selectedRoom.status === 'AVAILABLE' && (
                <button
                  onClick={() => updateStatusMutation.mutate({ roomId: selectedRoom.id, status: 'MAINTENANCE' })}
                  className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-900 text-slate-200 hover:text-white rounded-xl text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  Send to Maintenance Room
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Extra Charge Modal */}
      {quickAddStayId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => {
              setQuickAddStayId(null);
              setQuickAddRoomNum(null);
              setQuickItemName('');
              setQuickItemPrice('');
              setQuickItemQty('1');
              setQuickPreset('custom');
            }}
          />

          {/* Modal Content */}
          <form
            onSubmit={handleQuickAddSubmit}
            className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10 animate-fade-in"
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60 backdrop-blur-md">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                  Add Additional Item
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Room {quickAddRoomNum}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setQuickAddStayId(null);
                  setQuickAddRoomNum(null);
                  setQuickItemName('');
                  setQuickItemPrice('');
                  setQuickItemQty('1');
                  setQuickPreset('custom');
                }}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-slate-500">Preset Item</label>
                <select
                  value={quickPreset}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuickPreset(val);
                    if (val === 'custom') {
                      setQuickItemName('');
                      setQuickItemPrice('');
                    } else {
                      const preset = PRESET_ITEMS[parseInt(val)];
                      if (preset) {
                        setQuickItemName(preset.name);
                        setQuickItemPrice('');
                      }
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none cursor-pointer"
                >
                  <option value="custom">-- Custom Item --</option>
                  {PRESET_ITEMS.map((item, idx) => (
                    <option key={idx} value={idx}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-slate-500">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Water Bottle, Tea, Snacks"
                  value={quickItemName}
                  onChange={(e) => {
                    setQuickItemName(e.target.value);
                    setQuickPreset('custom');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none"
                  autoFocus
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-slate-500">Price (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  placeholder="Price in Rupees"
                  value={quickItemPrice}
                  onChange={(e) => {
                    setQuickItemPrice(e.target.value);
                    setQuickPreset('custom');
                  }}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-wider text-slate-500">Quantity</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="Quantity"
                  value={quickItemQty}
                  onChange={(e) => setQuickItemQty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none font-mono"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-800 bg-slate-900/40 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setQuickAddStayId(null);
                  setQuickAddRoomNum(null);
                  setQuickItemName('');
                  setQuickItemPrice('');
                  setQuickItemQty('1');
                  setQuickPreset('custom');
                }}
                className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-700 text-slate-200 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={quickItemLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {quickItemLoading ? 'Adding...' : 'Add Charge'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
