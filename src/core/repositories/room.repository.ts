import { DatabaseService } from '../database/database.service';
import type { Room, RoomChecklistItem, DashboardStats } from '../models/room';
import { ApiService } from '../services/api.service';
import { NetworkService } from '../network/network.service';

interface RoomRow {
  id: string;
  room_number: string;
  floor_number: number;
  room_type: string;
  capacity: number;
  price_per_night: number;
  amenities: string;
  status: string;
  cached_at: number;
}

export class RoomRepository {
  private db = DatabaseService.getInstance();
  private api = ApiService.getInstance();
  private network = NetworkService.getInstance();

  private mapRow(row: RoomRow): Room {
    return {
      id: row.id,
      roomNumber: row.room_number,
      floorNumber: row.floor_number,
      roomType: row.room_type,
      capacity: row.capacity,
      pricePerNight: row.price_per_night,
      amenities: row.amenities,
      status: row.status as Room['status'],
      cachedAt: row.cached_at,
    };
  }

  async getAll(): Promise<Room[]> {
    if (this.network.isOnline()) {
      try {
        await this.refreshFromBackend();
      } catch {
        // Fall through to cache
      }
    }
    return this.getFromCache();
  }

  private async getFromCache(): Promise<Room[]> {
    const rows = await this.db.query<RoomRow>(
      'SELECT * FROM rooms_cache ORDER BY room_number ASC'
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getById(id: string): Promise<Room | null> {
    const rows = await this.db.query<RoomRow>(
      'SELECT * FROM rooms_cache WHERE id = ?',
      [id]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async refreshFromBackend(): Promise<Room[]> {
    const response = await this.api.get<Room[]>('/rooms');
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to fetch rooms');
    }

    const rooms = response.data as unknown as Array<Record<string, unknown>>;
    const now = Date.now();

    try {
      localStorage.setItem('hotel_rooms_cache', JSON.stringify(rooms));
    } catch {
      // SQLite cache is the source of truth if localStorage is unavailable.
    }

    await this.db.run('DELETE FROM rooms_cache');

    for (const room of rooms) {
      await this.db.run(
        `INSERT INTO rooms_cache (
          id, room_number, floor_number, room_type, capacity,
          price_per_night, amenities, status, cached_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          room.id,
          room.roomNumber,
          room.floorNumber ?? 0,
          room.roomType ?? '',
          room.capacity ?? 1,
          room.pricePerNight ?? 0,
          room.amenities ?? '',
          room.status ?? 'AVAILABLE',
          now,
        ]
      );
    }

    return this.getFromCache();
  }

  async getChecklist(): Promise<RoomChecklistItem[]> {
    const rows = await this.db.query<{
      room_number: string;
      checked: number;
      updated_at: number;
    }>('SELECT * FROM room_checklist ORDER BY room_number ASC');

    if (rows.length > 0) {
      return rows.map((r) => ({
        roomNumber: r.room_number,
        checked: r.checked === 1,
        updatedAt: r.updated_at,
      }));
    }

    const rooms = await this.getAll();
    return rooms.map((r) => ({
      roomNumber: r.roomNumber,
      checked: false,
      updatedAt: Date.now(),
    }));
  }

  async toggleChecklistItem(roomNumber: string, checked: boolean): Promise<void> {
    await this.db.run(
      `INSERT INTO room_checklist (room_number, checked, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(room_number) DO UPDATE SET checked = excluded.checked, updated_at = excluded.updated_at`,
      [roomNumber, checked ? 1 : 0, Date.now()]
    );
  }

  async getDashboardStats(): Promise<DashboardStats> {
    if (this.network.isOnline()) {
      try {
        const response = await this.api.get<{
          totalRooms: number;
          availableRooms: number;
          occupiedRooms: number;
          bookedRooms: number;
        }>('/admin/dashboard-stats');

        if (response.success && response.data) {
          const s = response.data;
          const stats: DashboardStats = {
            total: s.totalRooms,
            available: s.availableRooms,
            occupied: s.occupiedRooms,
            booked: s.bookedRooms,
            cachedAt: Date.now(),
          };
          await this.cacheStats(stats);
          return stats;
        }
      } catch {
        // Fall through
      }
    }

    const rows = await this.db.query<{
      total: number;
      available: number;
      occupied: number;
      booked: number;
      cached_at: number;
    }>('SELECT * FROM dashboard_stats_cache WHERE id = 1');

    if (rows[0]) {
      return {
        total: rows[0].total,
        available: rows[0].available,
        occupied: rows[0].occupied,
        booked: rows[0].booked,
        cachedAt: rows[0].cached_at,
      };
    }

    const rooms = await this.getAll();
    return {
      total: rooms.length,
      available: rooms.filter((r) => r.status === 'AVAILABLE').length,
      occupied: rooms.filter((r) => r.status === 'OCCUPIED').length,
      booked: rooms.filter((r) => r.status === 'ADVANCE_BOOKED').length,
      cachedAt: Date.now(),
    };
  }

  private async cacheStats(stats: DashboardStats): Promise<void> {
    await this.db.run(
      `INSERT INTO dashboard_stats_cache (id, total, available, occupied, booked, cached_at)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         total = excluded.total,
         available = excluded.available,
         occupied = excluded.occupied,
         booked = excluded.booked,
         cached_at = excluded.cached_at`,
      [stats.total, stats.available, stats.occupied, stats.booked, stats.cachedAt]
    );
  }
}
