import { useState, useEffect } from 'react';
import { Network, type ConnectionStatus } from '@capacitor/network';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

export const useNetwork = () => {
  const [status, setStatus] = useState<ConnectionStatus>({
    connected: navigator.onLine,
    connectionType: 'unknown',
  });

  useEffect(() => {
    // 1. Initial lookup
    Network.getStatus().then((s) => {
      setStatus(s);
    });

    // 2. Setup Network listeners
    const handler = Network.addListener('networkStatusChange', (s) => {
      console.log('[Network Hook] Connection state updated:', s);
      setStatus(s);
    });

    return () => {
      handler.then((h) => h.remove());
    };
  }, []);

  const isOnline = status.connected;

  // Reactively track the size of the pending offline queue using Dexie's live query hook
  const pendingChangesCount = useLiveQuery(
    async () => {
      return await db.offlineQueue.where('status').equals('PENDING').count();
    },
    [],
    0
  );

  const syncingChangesCount = useLiveQuery(
    async () => {
      return await db.offlineQueue.where('status').equals('SYNCING').count();
    },
    [],
    0
  );

  const failedChangesCount = useLiveQuery(
    async () => {
      return await db.offlineQueue.where('status').equals('FAILED').count();
    },
    [],
    0
  );

  let syncStatus: 'synced' | 'syncing' | 'failed' | 'offline' = 'synced';
  if (!isOnline) {
    syncStatus = 'offline';
  } else if (syncingChangesCount > 0) {
    syncStatus = 'syncing';
  } else if (failedChangesCount > 0) {
    syncStatus = 'failed';
  }

  return {
    isOnline,
    connectionType: status.connectionType,
    pendingChangesCount,
    syncStatus,
  };
};
