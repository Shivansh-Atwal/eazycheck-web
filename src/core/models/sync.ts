import type { QUEUE_OPERATIONS } from '../constants';

export type SyncStatus = 'Pending' | 'Syncing' | 'Synced' | 'Failed' | 'Conflict';
export type QueueOperation = (typeof QUEUE_OPERATIONS)[keyof typeof QUEUE_OPERATIONS];
export type QueueStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'conflict';

export interface SyncQueueItem {
  id: string;
  operation: QueueOperation;
  entityType: 'booking' | 'checkin' | 'checkout';
  entityId: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: string;
  status: QueueStatus;
  retryCount: number;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SyncResult {
  successCount: number;
  failedCount: number;
  conflictCount: number;
  pendingCount: number;
}

export type NetworkState = 'online' | 'offline' | 'syncing' | 'stable';

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  state: NetworkState;
  lastOnlineAt: number | null;
  syncMessage: string | null;
}
