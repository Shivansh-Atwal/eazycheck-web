import { DatabaseService } from '../database/database.service';
import type { Room } from '../models/room';

const DEFAULT_ROOMS: Omit<Room, 'cachedAt'>[] = [
  { id: 'seed-201', roomNumber: '201', floorNumber: 2, roomType: 'Standard', capacity: 2, pricePerNight: 1500, amenities: 'WiFi, AC', status: 'AVAILABLE' },
  { id: 'seed-202', roomNumber: '202', floorNumber: 2, roomType: 'Standard', capacity: 2, pricePerNight: 1800, amenities: 'WiFi, AC', status: 'AVAILABLE' },
  { id: 'seed-203', roomNumber: '203', floorNumber: 2, roomType: 'Deluxe', capacity: 2, pricePerNight: 2000, amenities: 'WiFi, AC, TV', status: 'AVAILABLE' },
  { id: 'seed-204', roomNumber: '204', floorNumber: 2, roomType: 'Deluxe', capacity: 3, pricePerNight: 2200, amenities: 'WiFi, AC, TV', status: 'AVAILABLE' },
  { id: 'seed-205', roomNumber: '205', floorNumber: 2, roomType: 'Suite', capacity: 4, pricePerNight: 3500, amenities: 'WiFi, AC, Balcony', status: 'AVAILABLE' },
];

export async function seedDefaultRoomsIfEmpty(): Promise<void> {
  const db = DatabaseService.getInstance();
  const rows = await db.query<{ count: number }>('SELECT COUNT(*) as count FROM rooms_cache');
  if ((rows[0]?.count ?? 0) > 0) return;

  const now = Date.now();
  for (const room of DEFAULT_ROOMS) {
    await db.run(
      `INSERT INTO rooms_cache (
        id, room_number, floor_number, room_type, capacity,
        price_per_night, amenities, status, cached_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        room.id,
        room.roomNumber,
        room.floorNumber,
        room.roomType,
        room.capacity,
        room.pricePerNight,
        room.amenities,
        room.status,
        now,
      ]
    );
  }
}
