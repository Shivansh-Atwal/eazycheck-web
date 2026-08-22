import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SyncManager } from '../services/SyncManager';
import { getBackendUrl } from '../utils/api';

export const useRealTimeSync = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout;

    const connect = () => {
      const backendUrl = getBackendUrl();
      eventSource = new EventSource(`${backendUrl}/api/events`);

      eventSource.onopen = () => {
        console.log('[Real-Time Sync] Connected to SSE stream.');
      };

      eventSource.addEventListener('db_update', () => {
        console.log('[Real-Time Sync] Received db_update event! Triggering targeted refresh.');
        
        // Refetch all active queries safely
        queryClient.invalidateQueries();
        
        // Sync local offline IndexedDB databases
        SyncManager.syncPull();
      });

      eventSource.onerror = (err) => {
        console.error('[Real-Time Sync] SSE connection error:', err);
        eventSource?.close();
        
        // Auto-reconnect after 3 seconds
        retryTimeout = setTimeout(() => {
          console.log('[Real-Time Sync] Attempting to reconnect...');
          connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      clearTimeout(retryTimeout);
    };
  }, [queryClient]);
};
