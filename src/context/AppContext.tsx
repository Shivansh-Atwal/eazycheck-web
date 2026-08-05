import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  bootstrapApp,
  NetworkService,
  SyncManager,
  BookingRepository,
  RoomRepository,
  AuthService,
  type NetworkStatus,
  type OfflineBooking,
  type Room,
  type RoomChecklistItem,
  type DashboardStats,
  type SyncResult,
} from '@core/index';

interface AppContextValue {
  ready: boolean;
  isAuthenticated: boolean;
  networkStatus: NetworkStatus;
  bookings: OfflineBooking[];
  rooms: Room[];
  checklist: RoomChecklistItem[];
  stats: DashboardStats | null;
  refreshBookings: () => Promise<void>;
  refreshRooms: () => Promise<void>;
  refreshChecklist: () => Promise<void>;
  refreshStats: () => Promise<void>;
  toggleChecklist: (roomNumber: string, checked: boolean) => Promise<void>;
  login: (email: string, password: string, tenantId?: string) => Promise<void>;
  logout: () => Promise<void>;
  retrySync: (bookingId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    state: 'online',
    lastOnlineAt: null,
    syncMessage: null,
  });
  const [bookings, setBookings] = useState<OfflineBooking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [checklist, setChecklist] = useState<RoomChecklistItem[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const bookingRepo = useMemo(() => new BookingRepository(), []);
  const roomRepo = useMemo(() => new RoomRepository(), []);
  const authService = useMemo(() => AuthService.getInstance(), []);
  const wasOnlineRef = useRef(true);

  const refreshBookings = useCallback(async () => {
    const data = await bookingRepo.getAll();
    setBookings(data);
  }, [bookingRepo]);

  const refreshRooms = useCallback(async () => {
    const data = await roomRepo.getAll();
    setRooms(data);
  }, [roomRepo]);

  const refreshChecklist = useCallback(async () => {
    const data = await roomRepo.getChecklist();
    setChecklist(data);
  }, [roomRepo]);

  const refreshStats = useCallback(async () => {
    const data = await roomRepo.getDashboardStats();
    setStats(data);
  }, [roomRepo]);

  const toggleChecklist = useCallback(
    async (roomNumber: string, checked: boolean) => {
      await roomRepo.toggleChecklistItem(roomNumber, checked);
      await refreshChecklist();
    },
    [roomRepo, refreshChecklist]
  );

  const login = useCallback(
    async (email: string, password: string, tenantId?: string) => {
      await authService.login({ email, password, tenantId });
      setIsAuthenticated(true);
      await Promise.all([refreshRooms(), refreshStats(), refreshBookings()]);
      void SyncManager.getInstance().sync();
    },
    [authService, refreshRooms, refreshStats, refreshBookings]
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setIsAuthenticated(false);
  }, [authService]);

  const retrySync = useCallback(async (bookingId: string) => {
    await SyncManager.getInstance().retryFailed(bookingId);
    await refreshBookings();
  }, [refreshBookings]);

  const snapshotActiveCheckIns = useCallback(async () => {
    const saved = await bookingRepo.snapshotActiveCheckInsFromRoomCache();
    if (saved > 0) {
      await refreshBookings();
    }
  }, [bookingRepo, refreshBookings]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const result = await bootstrapApp();
        if (!mounted) return;

        setIsAuthenticated(result.isAuthenticated);
        await Promise.all([
          refreshBookings(),
          refreshRooms(),
          refreshChecklist(),
          refreshStats(),
        ]);
        if (!result.isOnline) {
          await snapshotActiveCheckIns();
        }
        setReady(true);
      } catch (error) {
        console.error('Bootstrap failed:', error);
        if (mounted) setReady(true);
      }
    })();

    const unsubNetwork = NetworkService.getInstance().subscribe((status) => {
      setNetworkStatus(status);
      const isOnlineNow = status.isConnected && status.isInternetReachable && status.state !== 'offline';
      if (!isOnlineNow && wasOnlineRef.current) {
        void snapshotActiveCheckIns();
      }
      wasOnlineRef.current = isOnlineNow;
    });
    const unsubSync = SyncManager.getInstance().subscribe((_result: SyncResult) => {
      void refreshBookings();
      void refreshRooms();
      void refreshStats();
    });

    return () => {
      mounted = false;
      unsubNetwork();
      unsubSync();
    };
  }, [refreshBookings, refreshRooms, refreshChecklist, refreshStats, snapshotActiveCheckIns]);

  const value: AppContextValue = {
    ready,
    isAuthenticated,
    networkStatus,
    bookings,
    rooms,
    checklist,
    stats,
    refreshBookings,
    refreshRooms,
    refreshChecklist,
    refreshStats,
    toggleChecklist,
    login,
    logout,
    retrySync,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
