import type { SyncStatus } from './sync';

export type BookingStatus = 'Booked' | 'Check In' | 'Check Out';

export interface SelectedRoom {
  roomNumber: string;
  price: number;
}

export interface OfflineBooking {
  id: string;
  tempRegistrationNumber: string;
  registrationNumber: string | null;
  customerName: string;
  phoneNumber: string;
  address: string;
  aadhaarNumber: string;
  bookingStatus: BookingStatus;
  selectedRooms: SelectedRoom[];
  guests: number;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string | null;
  checkOutTime: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  backendId: string | null;
  createdAt: number;
  updatedAt: number;
  isDeleted: boolean;
}

export interface CreateBookingInput {
  customerName: string;
  phoneNumber: string;
  address: string;
  aadhaarNumber: string;
  bookingStatus: BookingStatus;
  selectedRooms: SelectedRoom[];
  guests: number;
  checkInDate: string;
  checkInTime: string;
  checkOutDate?: string | null;
  checkOutTime?: string | null;
}

export interface UpdateBookingInput extends Partial<CreateBookingInput> {
  id: string;
}
