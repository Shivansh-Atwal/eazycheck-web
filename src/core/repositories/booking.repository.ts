import { DatabaseService } from '../database/database.service';
import type {
  CreateBookingInput,
  OfflineBooking,
  SelectedRoom,
  UpdateBookingInput,
} from '../models/booking';
import type { SyncStatus } from '../models/sync';
import { QUEUE_OPERATIONS, SYNC_STATUS } from '../constants';
import { encryptSensitive, decryptSensitive } from '../utils/crypto';
import { generateId } from '../utils/errors';
import { TempIdGenerator } from '../utils/temp-id';
import { SyncQueueRepository } from './sync-queue.repository';

interface BookingRow {
  id: string;
  temp_registration_number: string;
  registration_number: string | null;
  customer_name: string;
  phone_number: string;
  address: string;
  aadhaar_number_encrypted: string;
  booking_status: string;
  selected_rooms: string;
  guests: number;
  check_in_date: string;
  check_in_time: string;
  check_out_date: string | null;
  check_out_time: string | null;
  sync_status: string;
  sync_error: string | null;
  backend_id: string | null;
  is_deleted: number;
  created_at: number;
  updated_at: number;
}

interface ActiveStaySnapshot {
  backendId: string;
  registrationNumber: string | null;
  customerName: string;
  phoneNumber: string;
  address: string;
  aadhaarNumber: string;
  selectedRooms: SelectedRoom[];
  guests: number;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string | null;
  checkOutTime: string | null;
}

export class BookingRepository {
  private db = DatabaseService.getInstance();
  private syncQueue = new SyncQueueRepository();

  private mapRow(row: BookingRow): OfflineBooking {
    let selectedRooms: SelectedRoom[] = [];
    try {
      selectedRooms = JSON.parse(row.selected_rooms) as SelectedRoom[];
    } catch {
      selectedRooms = [];
    }

    return {
      id: row.id,
      tempRegistrationNumber: row.temp_registration_number,
      registrationNumber: row.registration_number,
      customerName: row.customer_name,
      phoneNumber: row.phone_number,
      address: row.address,
      aadhaarNumber: row.aadhaar_number_encrypted,
      bookingStatus: row.booking_status as OfflineBooking['bookingStatus'],
      selectedRooms,
      guests: row.guests,
      checkInDate: row.check_in_date,
      checkInTime: row.check_in_time,
      checkOutDate: row.check_out_date,
      checkOutTime: row.check_out_time,
      syncStatus: row.sync_status as SyncStatus,
      syncError: row.sync_error,
      backendId: row.backend_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isDeleted: row.is_deleted === 1,
    };
  }

  async getAll(includeDeleted = false): Promise<OfflineBooking[]> {
    const sql = includeDeleted
      ? 'SELECT * FROM bookings ORDER BY created_at DESC'
      : 'SELECT * FROM bookings WHERE is_deleted = 0 ORDER BY created_at DESC';
    const rows = await this.db.query<BookingRow>(sql);
    return rows.map((r) => this.mapRow(r));
  }

  async getById(id: string): Promise<OfflineBooking | null> {
    const rows = await this.db.query<BookingRow>(
      'SELECT * FROM bookings WHERE id = ?',
      [id]
    );
    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async snapshotActiveCheckInsFromRoomCache(): Promise<number> {
    let rooms: any[] = [];
    try {
      const cachedRoomsRaw = localStorage.getItem('hotel_rooms_cache');
      rooms = cachedRoomsRaw ? JSON.parse(cachedRoomsRaw) : [];
    } catch {
      rooms = [];
    }

    const snapshots = rooms.flatMap((room) => this.mapRoomToActiveStaySnapshots(room));
    let savedCount = 0;

    for (const snapshot of snapshots) {
      const existingRows = await this.db.query<BookingRow>(
        'SELECT * FROM bookings WHERE backend_id = ? OR id = ? LIMIT 1',
        [snapshot.backendId, `server-${snapshot.backendId}`]
      );
      const existing = existingRows[0] ? this.mapRow(existingRows[0]) : null;

      if (existing && existing.syncStatus !== SYNC_STATUS.SYNCED) {
        continue;
      }

      await this.saveSyncedSnapshot(snapshot, existing?.id);
      savedCount++;
    }

    return savedCount;
  }

  async create(input: CreateBookingInput): Promise<OfflineBooking> {
    const id = generateId('booking');

    // Continuous registration number generation
    let tempReg = '';
    try {
      const cachedNextReg = localStorage.getItem('next_online_reg_number');
      if (cachedNextReg && cachedNextReg.includes('-')) {
        const parts = cachedNextReg.split('-');
        const prefix = parts[0];
        const numPart = parseInt(parts[1], 10);
        if (!isNaN(numPart)) {
          const currentCounter = parseInt(localStorage.getItem('offline_reg_counter') || '0', 10);
          localStorage.setItem('offline_reg_counter', String(currentCounter + 1));
          tempReg = `${prefix}-${numPart + currentCounter}`;
        } else {
          tempReg = await TempIdGenerator.next(this.db);
        }
      } else {
        tempReg = await TempIdGenerator.next(this.db);
      }
    } catch {
      tempReg = await TempIdGenerator.next(this.db);
    }
    const now = Date.now();

    const booking: OfflineBooking = {
      id,
      tempRegistrationNumber: tempReg,
      registrationNumber: null,
      customerName: input.customerName.trim(),
      phoneNumber: input.phoneNumber.trim(),
      address: input.address.trim(),
      aadhaarNumber: encryptSensitive(input.aadhaarNumber.trim()),
      bookingStatus: input.bookingStatus,
      selectedRooms: input.selectedRooms,
      guests: input.guests,
      checkInDate: input.checkInDate,
      checkInTime: input.checkInTime,
      checkOutDate: input.checkOutDate ?? null,
      checkOutTime: input.checkOutTime ?? null,
      syncStatus: SYNC_STATUS.PENDING as SyncStatus,
      syncError: null,
      backendId: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
    };

    await this.db.run(
      `INSERT INTO bookings (
        id, temp_registration_number, registration_number, customer_name,
        phone_number, address, aadhaar_number_encrypted, booking_status,
        selected_rooms, guests, check_in_date, check_in_time,
        check_out_date, check_out_time, sync_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        booking.id,
        booking.tempRegistrationNumber,
        null,
        booking.customerName,
        booking.phoneNumber,
        booking.address,
        booking.aadhaarNumber,
        booking.bookingStatus,
        JSON.stringify(booking.selectedRooms),
        booking.guests,
        booking.checkInDate,
        booking.checkInTime,
        booking.checkOutDate,
        booking.checkOutTime,
        booking.syncStatus,
        booking.createdAt,
        booking.updatedAt,
      ]
    );

    await this.syncQueue.enqueue({
      operation: QUEUE_OPERATIONS.CREATE,
      entityType: 'booking',
      entityId: booking.id,
      endpoint: '/stay/checkin/walkin',
      method: 'POST',
      payload: this.toApiPayload(booking),
    });

    return booking;
  }

  private mapRoomToActiveStaySnapshots(room: any): ActiveStaySnapshot[] {
    const checkIns = Array.isArray(room?.checkIns) ? room.checkIns : [];
    return checkIns
      .filter((checkIn: any) => checkIn?.status === 'ACTIVE' || room?.status === 'OCCUPIED')
      .map((checkIn: any) => {
        const customer = checkIn.customer || {};
        const document = Array.isArray(customer.documents) ? customer.documents[0] : null;
        const address = JSON.stringify({
          streetAddress: customer.address || '',
          city: customer.city || '',
          state: customer.state || '',
          pincode: customer.pincode || '',
          nationality: customer.country || 'INDIAN',
        });
        const idData = JSON.stringify({
          idType: document?.idType || '',
          idNumber: document?.idNumber || '',
        });
        const checkInDate = this.splitDateTime(checkIn.checkInTime);
        const checkOutDate = this.splitDateTime(checkIn.actualCheckOutTime || checkIn.expectedCheckOutDate);

        return {
          backendId: checkIn.bookingId || checkIn.id,
          registrationNumber: checkIn.registrationNumber || null,
          customerName: customer.fullName || 'Guest',
          phoneNumber: customer.mobileNumber || '',
          address,
          aadhaarNumber: encryptSensitive(idData),
          selectedRooms: [{
            roomNumber: room.roomNumber,
            price: Number(checkIn.pricePerNight || room.pricePerNight || 0),
          }],
          guests: Number(checkIn.numberOfGuests || 1),
          checkInDate: checkInDate.date,
          checkInTime: checkInDate.time,
          checkOutDate: checkOutDate.date,
          checkOutTime: checkOutDate.time,
        };
      });
  }

  private splitDateTime(value: string | null | undefined): { date: string; time: string } {
    if (!value) return { date: new Date().toISOString().split('T')[0], time: '' };
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      const [date = new Date().toISOString().split('T')[0], time = ''] = String(value).split('T');
      return { date, time: time.slice(0, 5) };
    }
    return {
      date: parsed.toISOString().split('T')[0],
      time: parsed.toTimeString().slice(0, 5),
    };
  }

  private async saveSyncedSnapshot(snapshot: ActiveStaySnapshot, existingId?: string): Promise<void> {
    const id = existingId || `server-${snapshot.backendId}`;
    const now = Date.now();

    await this.db.run(
      `INSERT INTO bookings (
        id, temp_registration_number, registration_number, customer_name,
        phone_number, address, aadhaar_number_encrypted, booking_status,
        selected_rooms, guests, check_in_date, check_in_time,
        check_out_date, check_out_time, sync_status, sync_error, backend_id,
        is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        registration_number = excluded.registration_number,
        customer_name = excluded.customer_name,
        phone_number = excluded.phone_number,
        address = excluded.address,
        aadhaar_number_encrypted = excluded.aadhaar_number_encrypted,
        selected_rooms = excluded.selected_rooms,
        guests = excluded.guests,
        check_in_date = excluded.check_in_date,
        check_in_time = excluded.check_in_time,
        check_out_date = excluded.check_out_date,
        check_out_time = excluded.check_out_time,
        sync_status = excluded.sync_status,
        sync_error = NULL,
        backend_id = excluded.backend_id,
        is_deleted = 0,
        updated_at = excluded.updated_at`,
      [
        id,
        snapshot.registrationNumber || `ONLINE-${snapshot.backendId}`,
        snapshot.registrationNumber,
        snapshot.customerName,
        snapshot.phoneNumber,
        snapshot.address,
        snapshot.aadhaarNumber,
        'Check In',
        JSON.stringify(snapshot.selectedRooms),
        snapshot.guests,
        snapshot.checkInDate,
        snapshot.checkInTime,
        snapshot.checkOutDate,
        snapshot.checkOutTime,
        SYNC_STATUS.SYNCED,
        snapshot.backendId,
        now,
        now,
      ]
    );
  }

  async update(input: UpdateBookingInput): Promise<OfflineBooking | null> {
    const existing = await this.getById(input.id);
    if (!existing || existing.isDeleted) return null;

    const updated: OfflineBooking = {
      ...existing,
      customerName: input.customerName?.trim() ?? existing.customerName,
      phoneNumber: input.phoneNumber?.trim() ?? existing.phoneNumber,
      address: input.address?.trim() ?? existing.address,
      aadhaarNumber: input.aadhaarNumber
        ? encryptSensitive(input.aadhaarNumber.trim())
        : existing.aadhaarNumber,
      bookingStatus: input.bookingStatus ?? existing.bookingStatus,
      selectedRooms: input.selectedRooms ?? existing.selectedRooms,
      guests: input.guests ?? existing.guests,
      checkInDate: input.checkInDate ?? existing.checkInDate,
      checkInTime: input.checkInTime ?? existing.checkInTime,
      checkOutDate: input.checkOutDate !== undefined ? input.checkOutDate : existing.checkOutDate,
      checkOutTime: input.checkOutTime !== undefined ? input.checkOutTime : existing.checkOutTime,
      syncStatus: SYNC_STATUS.PENDING as SyncStatus,
      syncError: null,
      updatedAt: Date.now(),
    };

    await this.db.run(
      `UPDATE bookings SET
        customer_name = ?, phone_number = ?, address = ?,
        aadhaar_number_encrypted = ?, booking_status = ?,
        selected_rooms = ?, guests = ?, check_in_date = ?,
        check_in_time = ?, check_out_date = ?, check_out_time = ?,
        sync_status = ?, sync_error = NULL, updated_at = ?
       WHERE id = ?`,
      [
        updated.customerName,
        updated.phoneNumber,
        updated.address,
        updated.aadhaarNumber,
        updated.bookingStatus,
        JSON.stringify(updated.selectedRooms),
        updated.guests,
        updated.checkInDate,
        updated.checkInTime,
        updated.checkOutDate,
        updated.checkOutTime,
        updated.syncStatus,
        updated.updatedAt,
        updated.id,
      ]
    );

    const endpoint = existing.backendId
      ? `/bookings/${existing.backendId}`
      : '/bookings/offline';

    await this.syncQueue.enqueue({
      operation: QUEUE_OPERATIONS.UPDATE,
      entityType: 'booking',
      entityId: updated.id,
      endpoint,
      method: 'PUT',
      payload: this.toApiPayload(updated),
    });

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;

    await this.db.run(
      `UPDATE bookings SET is_deleted = 1, sync_status = ?, updated_at = ? WHERE id = ?`,
      [SYNC_STATUS.PENDING, Date.now(), id]
    );

    if (existing.backendId) {
      await this.syncQueue.enqueue({
        operation: QUEUE_OPERATIONS.DELETE,
        entityType: 'booking',
        entityId: id,
        endpoint: `/bookings/${existing.backendId}`,
        method: 'DELETE',
        payload: { id: existing.backendId },
      });
    }

    return true;
  }

  async updateSyncStatus(
    id: string,
    status: SyncStatus,
    options?: { registrationNumber?: string; backendId?: string; error?: string }
  ): Promise<void> {
    await this.db.run(
      `UPDATE bookings SET
        sync_status = ?,
        sync_error = ?,
        registration_number = COALESCE(?, registration_number),
        backend_id = COALESCE(?, backend_id),
        updated_at = ?
       WHERE id = ?`,
      [
        status,
        options?.error ?? null,
        options?.registrationNumber ?? null,
        options?.backendId ?? null,
        Date.now(),
        id,
      ]
    );
  }

  getDecryptedAadhaar(booking: OfflineBooking): string {
    return decryptSensitive(booking.aadhaarNumber);
  }

  toApiPayload(booking: OfflineBooking): Record<string, unknown> {
    let streetAddress = booking.address;
    let city = '';
    let state = '';
    let pincode = '';
    let country = 'INDIA';
    try {
      const addr = JSON.parse(booking.address);
      streetAddress = addr.streetAddress || '';
      city = addr.city || '';
      state = addr.state || '';
      pincode = addr.pincode || '';
      if (addr.nationality) {
        country = addr.nationality.toUpperCase() === 'INDIAN' ? 'INDIA' : addr.nationality;
      }
    } catch {
      // Not JSON, keep as-is
    }

    let idType = 'AADHAAR CARD';
    let idNumber = '';
    const decrypted = decryptSensitive(booking.aadhaarNumber);
    try {
      const idObj = JSON.parse(decrypted);
      idType = idObj.idType || 'AADHAAR CARD';
      idNumber = idObj.idNumber || '';
    } catch {
      idNumber = decrypted;
    }

    // Look up PostgreSQL room IDs from cached rooms list
    const cachedRoomsRaw = localStorage.getItem('hotel_rooms_cache');
    const cachedRooms: any[] = cachedRoomsRaw ? JSON.parse(cachedRoomsRaw) : [];

    const roomIds: string[] = [];
    const roomPrices: Record<string, number> = {};
    let totalPrice = 0;

    booking.selectedRooms.forEach((r: any) => {
      const match = cachedRooms.find((cr) => cr.roomNumber === r.roomNumber);
      if (match) {
        roomIds.push(match.id);
        roomPrices[match.id] = r.price;
        totalPrice += r.price;
      }
    });

    const arrivalDate = booking.checkInDate;
    const arrivalTime = booking.checkInTime;
    let checkInISO = new Date().toISOString();
    try {
      checkInISO = new Date(`${arrivalDate}T${arrivalTime}`).toISOString();
    } catch {
      // Ignore
    }

    let expectedCheckOutDate: string | undefined;
    if (booking.checkOutDate) {
      try {
        expectedCheckOutDate = new Date(
          `${booking.checkOutDate}T${booking.checkOutTime || '11:00'}`
        ).toISOString();
      } catch {
        expectedCheckOutDate = booking.checkOutDate;
      }
    }

    const pricePerNight = booking.selectedRooms[0]?.price || 0;
    const status =
      booking.bookingStatus === 'Check Out'
        ? 'CHECKED_OUT'
        : booking.bookingStatus === 'Check In'
          ? 'CHECKED_IN'
          : 'CONFIRMED';

    return {
      id: booking.backendId ?? undefined,
      offlineId: booking.id,
      clientId: booking.id,
      bookingStatus: booking.bookingStatus,
      status,
      numberOfGuests: Number(booking.guests),
      arrivalDate,
      arrivalTime,
      checkInTime: checkInISO,
      expectedCheckOutDate,
      checkOutDate: expectedCheckOutDate,
      advancePaid: 0,
      remainingAmount: totalPrice,
      paymentMethod: 'CASH',
      registrationNumber: (booking.tempRegistrationNumber || '').toUpperCase(),
      pricePerNight: Number(pricePerNight),
      roomPrices,
      roomIds,
      extraBedsCount: 0,
      extraBedPrice: 0,
      customerName: booking.customerName.toUpperCase(),
      mobileNumber: booking.phoneNumber,
      address: streetAddress.toUpperCase(),
      city: city.toUpperCase(),
      state: state.toUpperCase(),
      country: country.toUpperCase(),
      pincode: pincode.toUpperCase(),
      document: {
        idType: idType.toUpperCase(),
        idNumber: idNumber.toUpperCase(),
      },
    };
  }

  async hardDelete(id: string): Promise<boolean> {
    await this.db.run('DELETE FROM bookings WHERE id = ?', [id]);
    return true;
  }
}
