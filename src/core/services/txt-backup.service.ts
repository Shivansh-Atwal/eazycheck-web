import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { TXT_BACKUP } from '../constants';
import type { OfflineBooking } from '../models/booking';
import { decryptSensitive } from '../utils/crypto';

export class TxtBackupService {
  private static instance: TxtBackupService | null = null;

  static getInstance(): TxtBackupService {
    if (!this.instance) {
      this.instance = new TxtBackupService();
    }
    return this.instance;
  }

  private getPath(): string {
    return `${TXT_BACKUP.DIRECTORY}/${TXT_BACKUP.FILENAME}`;
  }

  formatBookings(bookings: OfflineBooking[]): string {
    const header = [
      '=== EAZYCHECK OFFLINE BACKUP ===',
      `Generated: ${new Date().toISOString()}`,
      `Total Entries: ${bookings.length}`,
      '',
    ].join('\n');

    const entries = bookings.map((b, index) => {
      const rooms = b.selectedRooms
        .map((r) => `  - Room ${r.roomNumber}: ₹${r.price}`)
        .join('\n');

      return [
        `--- Entry ${index + 1} ---`,
        `ID: ${b.id}`,
        `Registration: ${b.registrationNumber ?? b.tempRegistrationNumber}`,
        `Customer: ${b.customerName}`,
        `Phone: ${b.phoneNumber}`,
        `Address: ${b.address}`,
        `Aadhaar: ${decryptSensitive(b.aadhaarNumber) || 'N/A'}`,
        `Status: ${b.bookingStatus}`,
        `Guests: ${b.guests}`,
        `Check-in: ${b.checkInDate} ${b.checkInTime}`,
        b.checkOutDate ? `Check-out: ${b.checkOutDate} ${b.checkOutTime}` : null,
        `Rooms:\n${rooms}`,
        `Sync Status: ${b.syncStatus}`,
        b.syncError ? `Sync Error: ${b.syncError}` : null,
        '',
      ]
        .filter(Boolean)
        .join('\n');
    });

    return header + entries.join('\n');
  }

  async write(bookings: OfflineBooking[]): Promise<void> {
    const content = this.formatBookings(bookings);
    await this.ensureDirectory();
    await Filesystem.writeFile({
      path: this.getPath(),
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  }

  async read(): Promise<string> {
    try {
      const result = await Filesystem.readFile({
        path: this.getPath(),
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      return typeof result.data === 'string' ? result.data : '';
    } catch {
      return '';
    }
  }

  async rewrite(bookings: OfflineBooking[]): Promise<void> {
    await this.write(bookings);
  }

  async export(bookings: OfflineBooking[]): Promise<{ path: string; content: string }> {
    const content = this.formatBookings(bookings);
    await this.write(bookings);

    const uri = await Filesystem.getUri({
      path: this.getPath(),
      directory: Directory.Documents,
    });

    if (!Capacitor.isNativePlatform() && typeof document !== 'undefined') {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = TXT_BACKUP.FILENAME;
      link.click();
      URL.revokeObjectURL(url);
    }

    return { path: uri.uri, content };
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await Filesystem.mkdir({
        path: TXT_BACKUP.DIRECTORY,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch {
      // Directory may already exist
    }
  }
}
