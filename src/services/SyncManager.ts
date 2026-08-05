import api from '../utils/api';
import { db } from '../db/db';

export class SyncManager {
  private static isSyncing = false;

  // Process and push the offline queued operations to the backend in sequence
  static async syncPush() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    console.log('[Sync Engine] Starting offline queue sync push...');

    try {
      const pendingOperations = await db.offlineQueue
        .where('status')
        .anyOf(['PENDING', 'FAILED'])
        .sortBy('timestamp');

      for (const op of pendingOperations) {
        console.log(`[Sync Engine] Syncing operation: ${op.method} ${op.endpoint}`, op);

        // Mark as SYNCING
        await db.offlineQueue.update(op.id, { status: 'SYNCING' });

        try {
          let response;
          if (op.method === 'POST') {
            // Include client-generated ID (uniqueSyncId) in payload to preserve references
            const payloadWithId = { ...op.payload, id: op.uniqueSyncId };
            response = await api.post(op.endpoint, payloadWithId);
          } else if (op.method === 'PUT') {
            response = await api.put(op.endpoint, op.payload);
          } else if (op.method === 'DELETE') {
            response = await api.delete(op.endpoint);
          }

          if (response?.data?.success) {
            // Delete from queue upon successful processing
            await db.offlineQueue.delete(op.id);
            console.log(`[Sync Engine] Successfully synced operation ${op.id}`);
          } else {
            throw new Error(response?.data?.message || 'Server returned failure response.');
          }
        } catch (err: any) {
          const errMsg = err.response?.data?.message || err.message || 'Network request failed';
          console.error(`[Sync Engine] Failed to sync operation ${op.id}:`, errMsg);

          // Mark as FAILED and abort sequence to prevent out-of-order execution bugs
          await db.offlineQueue.update(op.id, { status: 'FAILED', errorMessage: errMsg });
          break;
        }
      }
    } catch (error) {
      console.error('[Sync Engine] Push synchronization crashed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  // Pull delta updates from the backend and merge them into IndexedDB
  static async syncPull() {
    console.log('[Sync Engine] Pulling delta changes from backend...');
    try {
      const lastSyncedRecord = await db.syncMetadata.get('lastSyncedAt');
      const lastSyncedAt = lastSyncedRecord ? lastSyncedRecord.value : new Date(0).toISOString();

      const response = await api.get(`/sync/delta?lastSyncedAt=${encodeURIComponent(lastSyncedAt)}`);
      if (response.data && response.data.success) {
        const { delta, serverTime } = response.data.data;

        // Perform bulk writes in a transaction
        await db.transaction('rw', [
          db.rooms,
          db.customers,
          db.bookings,
          db.checkins,
          db.checkouts,
          db.payments,
          db.inventory,
          db.auditlogs,
          db.syncMetadata
        ], async () => {
          // Bulk upserts for updated/created records
          if (delta.rooms?.length) await db.rooms.bulkPut(delta.rooms);
          if (delta.customers?.length) await db.customers.bulkPut(delta.customers);
          if (delta.bookings?.length) await db.bookings.bulkPut(delta.bookings);
          if (delta.checkins?.length) await db.checkins.bulkPut(delta.checkins);
          if (delta.checkouts?.length) await db.checkouts.bulkPut(delta.checkouts);
          if (delta.payments?.length) await db.payments.bulkPut(delta.payments);
          if (delta.inventory?.length) await db.inventory.bulkPut(delta.inventory);
          if (delta.auditlogs?.length) await db.auditlogs.bulkPut(delta.auditlogs);

          // Apply deletions
          if (delta.deleted?.length) {
            for (const del of delta.deleted) {
              const { id, type } = del;
              if (type === 'Room') await db.rooms.delete(id);
              if (type === 'Customer') await db.customers.delete(id);
              if (type === 'Booking') await db.bookings.delete(id);
              if (type === 'CheckIn') await db.checkins.delete(id);
              if (type === 'Checkout') await db.checkouts.delete(id);
              if (type === 'Payment') await db.payments.delete(id);
              if (type === 'InventoryItem') await db.inventory.delete(id);
            }
          }

          // Save lastSyncedAt timestamp
          await db.syncMetadata.put({ key: 'lastSyncedAt', value: serverTime });
        });

        console.log('[Sync Engine] Pull synchronization delta applied successfully.');
      }
    } catch (err) {
      console.error('[Sync Engine] Failed to pull delta from backend:', err);
    }
  }

  // Trigger both push and pull operations
  static async syncAll() {
    await this.syncPush();
    await this.syncPull();
  }
}
