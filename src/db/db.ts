import Dexie, { type Table } from 'dexie';

export interface LocalRoom {
  id: string;
  roomNumber: string;
  capacity: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocalCustomer {
  id: string;
  fullName: string;
  mobileNumber: string;
  alternateNumber?: string | null;
  email?: string | null;
  dob?: string | null;
  gender?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocalBooking {
  id: string;
  bookingNumber: string;
  customerId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  roomId: string;
  advancePayment: number;
  price: number;
  status: string;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocalCheckIn {
  id: string;
  registrationNumber?: string | null;
  bookingId?: string | null;
  customerId: string;
  roomId: string;
  numberOfGuests: number;
  checkInTime: string;
  expectedCheckOutDate: string;
  actualCheckOutTime?: string | null;
  advancePaid: number;
  remainingAmount: number;
  pricePerNight: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocalCheckout {
  id: string;
  checkInId: string;
  roomCharges: number;
  additionalCharges: number;
  discount: number;
  taxAmount: number;
  finalAmount: number;
  billingStatus: string;
  createdAt?: string;
}

export interface LocalPayment {
  id: string;
  checkInId?: string | null;
  bookingId?: string | null;
  amount: number;
  paymentType: string;
  paymentMethod: string;
  transactionId?: string | null;
  paymentDate: string;
  paymentStatus: string;
  notes?: string | null;
  createdAt?: string;
}

export interface LocalInventoryItem {
  id: string;
  name: string;
  quantity: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LocalAuditLog {
  id: string;
  userId?: string | null;
  userName?: string | null;
  action: string;
  ipAddress?: string | null;
  deviceInformation?: string | null;
  details?: string | null;
  timestamp: string;
}

export interface QueuedOperation {
  id: string;
  operationType: 'CREATE' | 'UPDATE' | 'DELETE';
  endpoint: string;
  method: 'POST' | 'PUT' | 'DELETE';
  payload: any;
  timestamp: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  errorMessage?: string | null;
  uniqueSyncId: string;
}

export interface SyncMetadata {
  key: string;
  value: string;
}

class EazyCheckDB extends Dexie {
  rooms!: Table<LocalRoom, string>;
  customers!: Table<LocalCustomer, string>;
  bookings!: Table<LocalBooking, string>;
  checkins!: Table<LocalCheckIn, string>;
  checkouts!: Table<LocalCheckout, string>;
  payments!: Table<LocalPayment, string>;
  inventory!: Table<LocalInventoryItem, string>;
  auditlogs!: Table<LocalAuditLog, string>;
  offlineQueue!: Table<QueuedOperation, string>;
  syncMetadata!: Table<SyncMetadata, string>;

  constructor() {
    super('EazyCheckOfflineDB');
    this.version(1).stores({
      rooms: 'id, roomNumber, capacity, status',
      customers: 'id, fullName, mobileNumber, email',
      bookings: 'id, bookingNumber, customerId, roomId, status, checkInDate',
      checkins: 'id, registrationNumber, bookingId, customerId, roomId, status',
      checkouts: 'id, checkInId, billingStatus',
      payments: 'id, checkInId, bookingId, paymentDate',
      inventory: 'id, name, quantity',
      auditlogs: 'id, timestamp, action',
      offlineQueue: 'id, timestamp, status, uniqueSyncId',
      syncMetadata: 'key',
    });
  }
}

export const db = new EazyCheckDB();
