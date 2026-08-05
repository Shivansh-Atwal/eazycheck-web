import { Network } from '@capacitor/network';
import { SYNC_CONFIG } from '../constants';
import type { NetworkStatus, NetworkState } from '../models/sync';
import { sleep } from '../utils/errors';

type NetworkListener = (status: NetworkStatus) => void;

export class NetworkService {
  private static instance: NetworkService | null = null;
  private listeners = new Set<NetworkListener>();
  private status: NetworkStatus = {
    isConnected: true,
    isInternetReachable: true,
    state: 'online',
    lastOnlineAt: Date.now(),
    syncMessage: null,
  };
  private stabilityTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;

  static getInstance(): NetworkService {
    if (!this.instance) {
      this.instance = new NetworkService();
    }
    return this.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const current = await Network.getStatus();
    this.updateFromCapacitorStatus(current.connected, current.connected);

    Network.addListener('networkStatusChange', (s) => {
      this.handleNetworkChange(s.connected);
    });

    this.initialized = true;
  }

  private handleNetworkChange(isConnected: boolean): void {
    if (this.stabilityTimer) {
      clearTimeout(this.stabilityTimer);
      this.stabilityTimer = null;
    }

    if (!isConnected) {
      this.setStatus({
        isConnected: false,
        isInternetReachable: false,
        state: 'offline',
        syncMessage: null,
      });
      return;
    }

    this.setStatus({
      isConnected: true,
      isInternetReachable: false,
      state: 'stable',
      syncMessage: 'Connection detected. Waiting for stability...',
    });

    this.stabilityTimer = setTimeout(() => {
      this.setStatus({
        isConnected: true,
        isInternetReachable: true,
        state: 'stable',
        lastOnlineAt: Date.now(),
        syncMessage: 'Connection stable. Ready to sync.',
      });
    }, SYNC_CONFIG.STABILITY_DELAY_MS);
  }

  private updateFromCapacitorStatus(
    isConnected: boolean,
    isInternetReachable: boolean
  ): void {
    this.setStatus({
      isConnected,
      isInternetReachable: isConnected && isInternetReachable,
      state: isConnected ? 'online' : 'offline',
      lastOnlineAt: isConnected ? Date.now() : this.status.lastOnlineAt,
    });
  }

  setSyncing(message: string | null): void {
    this.setStatus({
      state: message ? 'syncing' : this.status.isConnected ? 'online' : 'offline',
      syncMessage: message,
    });
  }

  setSyncComplete(): void {
    this.setStatus({
      state: 'online',
      syncMessage: 'All changes synchronized successfully.',
    });

    setTimeout(() => {
      if (this.status.state === 'online') {
        this.setStatus({ syncMessage: null });
      }
    }, 5000);
  }

  isOnline(): boolean {
    return this.status.isConnected && this.status.isInternetReachable;
  }

  isStableForSync(): boolean {
    return (
      this.status.isConnected &&
      this.status.isInternetReachable &&
      (this.status.state === 'stable' || this.status.state === 'online')
    );
  }

  getStatus(): NetworkStatus {
    return { ...this.status };
  }

  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  async waitForStableConnection(timeoutMs = 15000): Promise<boolean> {
    if (this.isStableForSync()) return true;

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.isStableForSync()) return true;
      await sleep(500);
    }
    return false;
  }

  private setStatus(partial: Partial<NetworkStatus>): void {
    const nextState = partial.state ?? this.status.state;
    this.status = { ...this.status, ...partial, state: nextState as NetworkState };
    this.listeners.forEach((l) => l(this.getStatus()));
  }
}
