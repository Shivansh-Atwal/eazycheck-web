import { SYNC_CONFIG, SYNC_STATUS } from '../constants';
import { NetworkService } from '../network/network.service';
import { ApiService, type ApiResponse } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { BookingRepository } from '../repositories/booking.repository';
import { RoomRepository } from '../repositories/room.repository';
import { MasterDataRepository } from '../repositories/master-data.repository';
import { SyncQueueRepository } from '../repositories/sync-queue.repository';
import type { SyncResult } from '../models/sync';
import { AppError, sleep } from '../utils/errors';

type SyncListener = (result: SyncResult) => void;

interface BackendBookingResponse {
  id?: string;
  bookingId?: string;
  registrationNumber?: string;
  clientId?: string;
}

export class SyncManager {
  private static instance: SyncManager | null = null;
  private network = NetworkService.getInstance();
  private api = ApiService.getInstance();
  private auth = AuthService.getInstance();
  private bookingRepo = new BookingRepository();
  private roomRepo = new RoomRepository();
  private masterDataRepo = new MasterDataRepository();
  private syncQueue = new SyncQueueRepository();
  private listeners = new Set<SyncListener>();
  private activeSync: Promise<SyncResult> | null = null;
  private nextSyncAt = 0;
  private initialized = false;

  static getInstance(): SyncManager {
    if (!this.instance) {
      this.instance = new SyncManager();
    }
    return this.instance;
  }

  initialize(): void {
    if (this.initialized) return;

    let wasOffline = !this.network.isOnline();
    this.network.subscribe((status) => {
      const isOnlineNow =
        status.isConnected &&
        status.isInternetReachable &&
        (status.state === 'stable' || status.state === 'online');

      if (isOnlineNow) {
        if (wasOffline || Date.now() >= this.nextSyncAt) {
          wasOffline = false;
          void this.sync();
        }
      } else {
        wasOffline = true;
      }
    });

    this.initialized = true;
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async sync(): Promise<SyncResult> {
    if (this.activeSync) return this.activeSync;

    this.activeSync = this.performSync();
    try {
      return await this.activeSync;
    } finally {
      this.activeSync = null;
    }
  }

  private async performSync(): Promise<SyncResult> {
    const result: SyncResult = {
      successCount: 0,
      failedCount: 0,
      conflictCount: 0,
      pendingCount: 0,
    };

    if (!this.network.isOnline()) {
      result.pendingCount = await this.syncQueue.getPendingCount();
      return result;
    }

    const stable = await this.network.waitForStableConnection();
    if (!stable) {
      result.pendingCount = await this.syncQueue.getPendingCount();
      return result;
    }

    this.network.setSyncing('Synchronizing offline changes...');

    try {
      const isAuth = await this.auth.isAuthenticated();
      if (!isAuth) {
        this.network.setSyncing(null);
        result.pendingCount = await this.syncQueue.getPendingCount();
        return result;
      }

      await this.refreshBackendData();
      await this.processQueue(result);

      result.pendingCount = await this.syncQueue.getPendingCount();

      if (result.successCount > 0 && result.failedCount === 0 && result.conflictCount === 0) {
        this.network.setSyncComplete();
      } else {
        this.network.setSyncing(null);
      }

      this.listeners.forEach((l) => l(result));
      return result;
    } catch {
      this.network.setSyncing(null);
      result.pendingCount = await this.syncQueue.getPendingCount();
      return result;
    }
  }

  private async refreshBackendData(): Promise<void> {
    try {
      await this.roomRepo.refreshFromBackend();
    } catch {
      // Continue sync even if refresh fails
    }
    try {
      await this.masterDataRepo.refreshAll();
    } catch {
      // Continue
    }
  }

  private async processQueue(result: SyncResult): Promise<void> {
    const pending = await this.syncQueue.getPending();

    for (const item of pending) {
      await this.syncQueue.updateStatus(item.id, 'processing');

      const booking = await this.bookingRepo.getById(item.entityId);
      if (booking) {
        await this.bookingRepo.updateSyncStatus(booking.id, SYNC_STATUS.SYNCING as 'Syncing');
      }

      try {
        let payload = JSON.parse(item.payload);
        let endpoint = item.endpoint;

        if (item.entityType === 'booking' && booking) {
          if (item.method === 'POST') {
            payload = this.bookingRepo.toApiPayload(booking);
            endpoint = '/stay/checkin/walkin';
          } else if ((item.method === 'PUT' || item.method === 'PATCH') && booking.backendId) {
            payload = this.bookingRepo.toApiPayload(booking);
            endpoint = `/bookings/${booking.backendId}`;
          }
        }

        let response: ApiResponse<BackendBookingResponse> | undefined;

        switch (item.method) {
          case 'POST':
            response = await this.api.post<BackendBookingResponse>(endpoint, payload);
            break;
          case 'PUT':
            response = await this.api.put<BackendBookingResponse>(endpoint, payload);
            break;
          case 'PATCH':
            response = await this.api.patch<BackendBookingResponse>(endpoint, payload);
            break;
          case 'DELETE':
            response = await this.api.delete(endpoint);
            break;
        }

        if (response?.success === false) {
          throw new AppError(response.error || 'Sync failed', 'API_ERROR', true);
        }

        if (booking) {
          if (item.method === 'DELETE') {
            await this.bookingRepo.hardDelete(booking.id);
          } else {
            const synced = response?.data;
            await this.bookingRepo.updateSyncStatus(
              booking.id,
              SYNC_STATUS.SYNCED as 'Synced',
              {
                registrationNumber: synced?.registrationNumber,
                backendId: synced?.bookingId || synced?.id,
              }
            );
          }
        }

        await this.syncQueue.markCompleted(item.id);
        result.successCount++;
      } catch (error) {
        const err = error as AppError;
        const message = err.message || 'Sync failed';

        if (err.code === 'CONFLICT') {
          if (booking) {
            await this.bookingRepo.updateSyncStatus(
              booking.id,
              SYNC_STATUS.CONFLICT as 'Conflict',
              { error: message }
            );
          }
          await this.syncQueue.updateStatus(item.id, 'conflict', message);
          result.conflictCount++;
        } else if (err.code === 'RETRYABLE' || err.code === 'NETWORK_ERROR') {
          if (booking) {
            await this.bookingRepo.updateSyncStatus(
              booking.id,
              SYNC_STATUS.PENDING as 'Pending',
              { error: message }
            );
          }
          await this.syncQueue.updateStatus(item.id, 'failed', message);
          result.failedCount++;
          this.nextSyncAt = Date.now() + SYNC_CONFIG.SYNC_COOLDOWN_MS;
        } else {
          if (booking) {
            await this.bookingRepo.updateSyncStatus(
              booking.id,
              SYNC_STATUS.FAILED as 'Failed',
              { error: message }
            );
          }
          await this.syncQueue.updateStatus(item.id, 'failed', message);
          result.failedCount++;
        }

        if (item.retryCount >= SYNC_CONFIG.MAX_RETRIES) {
          await sleep(SYNC_CONFIG.RETRY_BASE_DELAY_MS);
        }
      }
    }
  }

  async retryFailed(entityId: string): Promise<void> {
    const items = await this.syncQueue.getPending();
    const item = items.find((i) => i.entityId === entityId);
    if (!item) return;

    await this.syncQueue.updateStatus(item.id, 'queued');
    await this.bookingRepo.updateSyncStatus(entityId, SYNC_STATUS.PENDING as 'Pending');
    await this.sync();
  }
}
