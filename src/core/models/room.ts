export type RoomStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'ADVANCE_BOOKED'
  | 'MAINTENANCE';

export interface Room {
  id: string;
  roomNumber: string;
  floorNumber: number;
  roomType: string;
  capacity: number;
  pricePerNight: number;
  amenities: string;
  status: RoomStatus;
  cachedAt: number;
}

export interface RoomChecklistItem {
  roomNumber: string;
  checked: boolean;
  updatedAt: number;
}

export interface DashboardStats {
  total: number;
  available: number;
  occupied: number;
  booked: number;
  cachedAt: number;
}
