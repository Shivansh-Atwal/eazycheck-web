import { DatabaseService } from './database/database.service';
import { NetworkService } from './network/network.service';
import { SyncManager } from './sync/sync-manager';
import { ApiService } from './services/api.service';
import { AuthService } from './services/auth.service';
import { TxtBackupService } from './services/txt-backup.service';
import { BookingRepository } from './repositories/booking.repository';
import { RoomRepository } from './repositories/room.repository';
import { MasterDataRepository } from './repositories/master-data.repository';
import { SyncQueueRepository } from './repositories/sync-queue.repository';
import { seedDefaultRoomsIfEmpty } from './database/seed';

export * from './models';
export * from './constants';
export * from './utils/errors';
export * from './utils/crypto';

export {
  DatabaseService,
  NetworkService,
  SyncManager,
  ApiService,
  AuthService,
  TxtBackupService,
  BookingRepository,
  RoomRepository,
  MasterDataRepository,
  SyncQueueRepository,
};

export interface AppBootstrapResult {
  isOnline: boolean;
  isAuthenticated: boolean;
}

export async function bootstrapApp(): Promise<AppBootstrapResult> {
  const db = DatabaseService.getInstance();
  await db.initialize();
  await seedDefaultRoomsIfEmpty();

  const network = NetworkService.getInstance();
  await network.initialize();

  const syncManager = SyncManager.getInstance();
  syncManager.initialize();

  const auth = AuthService.getInstance();
  const isAuthenticated = await auth.isAuthenticated();

  if (network.isOnline() && isAuthenticated) {
    void syncManager.sync();
  }

  return {
    isOnline: network.isOnline(),
    isAuthenticated,
  };
}
