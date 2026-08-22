import React from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useNetwork } from './hooks/useNetwork';
import { SyncManager } from './services/SyncManager';
import { ProtectedRoute } from './components/ProtectedRoute';
import api from './utils/api';
import ProfileModal from './components/ProfileModal';
import { useRealTimeSync } from './hooks/useRealTimeSync';

// Online Screens (cloned from checkin-web)
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Bookings from './pages/Bookings';
import Customers from './pages/Customers';
import CheckIn from './pages/CheckIn';
import CheckOut from './pages/CheckOut';
import Employees from './pages/Employees';
import Reports from './pages/Reports';
import Records from './pages/Records';
import AuditLogs from './pages/AuditLogs';
import Inventory from './pages/Inventory';
import PreviousStay from './pages/PreviousStay';

// Offline Screens (SQLite-based, kept as-is)
import { OfflineDashboard } from './screens/offline/OfflineDashboard';
import { OfflineBookingForm } from './screens/offline/OfflineBookingForm';
import { OfflineBookingDetail } from './screens/offline/OfflineBookingDetail';

import {
  LayoutDashboard,
  Bed,
  CalendarCheck,
  Users,
  CheckCircle,
  LogOut,
  UserCheck,
  History,
  Menu,
  X,
  Map,
  ClipboardList,
  Package,
  WifiOff,
  User
} from 'lucide-react';

const PrivateLayout: React.FC = () => {
  const { user, logout, hasPermission } = useAuthStore();
  const { isOnline, pendingChangesCount } = useNetwork();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

  React.useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, permission: 'dashboard.view' },
    { label: 'Rooms', path: '/rooms', icon: Bed, permission: 'rooms.read' },
    { label: 'Bookings', path: '/bookings', icon: CalendarCheck, permission: 'bookings.read' },
    { label: 'Customers', path: '/customers', icon: Users, permission: 'customers.read' },
    { label: 'Check-In', path: '/checkin', icon: CheckCircle, permission: 'checkins.create' },
    { label: 'Check-Out', path: '/checkout', icon: LogOut, permission: 'checkouts.create' },
    { label: 'Employees', path: '/employees', icon: UserCheck, permission: 'employees.manage' },
    { label: 'Reports & Revenue', path: '/reports', icon: Map, permission: 'reports.read' },
    { label: 'Stay Records', path: '/records', icon: ClipboardList, permission: 'reports.read' },
    { label: 'Inventory', path: '/inventory', icon: Package, permission: 'dashboard.view' },
    { label: 'Audit Logs', path: '/logs', icon: History, permission: 'auditlogs.read' },
    { label: 'Offline Mode', path: '/offline', icon: WifiOff, permission: 'dashboard.view' },
  ];

  const renderNavLinks = () => {
    return navItems.map((item) => {
      if (!hasPermission(item.permission)) return null;
      const Icon = item.icon;
      const isActive = location.pathname === item.path;

      return (
        <Link
          key={item.label}
          to={item.path}
          className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
            isActive
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
          }`}
        >
          <Icon className="w-5 h-5 mr-3 shrink-0" />
          {item.label}
        </Link>
      );
    });
  };

  const renderUserProfile = () => {
    return (
      <div className="p-4 pb-8 border-t border-slate-800 space-y-3 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center px-2">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-200 shrink-0">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-medium text-slate-200 truncate">{user.fullName}</p>
            <p className="text-xs text-slate-500 capitalize">{user.role.toLowerCase()}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-lg shadow-rose-600/25 border border-rose-500/20"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </button>
      </div>
    );
  };

  const renderSyncBanner = () => {
    if (!isOnline) {
      return (
        <div className="bg-amber-600/90 backdrop-blur-sm text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-3 sticky top-0 z-50">
          <div className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-white mr-2 animate-ping shrink-0"></span>
            Offline Mode — {pendingChangesCount} changes queued locally
          </div>
          <Link
            to="/offline"
            className="bg-slate-900 hover:bg-slate-950 text-white px-3 py-1 rounded-md text-[11px] font-bold transition-all border border-slate-800 shadow-sm ml-2"
          >
            Switch to SQLite Offline Mode
          </Link>
        </div>
      );
    }

    if (pendingChangesCount > 0) {
      return (
        <div className="bg-blue-600/90 backdrop-blur-sm text-white px-4 py-2 text-xs font-bold text-center flex items-center justify-center sticky top-0 z-50 animate-pulse">
          Syncing — Uploading {pendingChangesCount} pending changes...
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex min-h-screen md:h-screen md:overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 flex-col justify-between shrink-0 h-full">
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand header */}
          <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
            <span className="text-xl font-bold tracking-wider text-blue-400 font-mono">EazyCheck</span>
          </div>

          {/* Nav links */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-800 hover:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full">
            {renderNavLinks()}
          </nav>
        </div>

        {/* User profile footer */}
        <div className="shrink-0">
          {renderUserProfile()}
        </div>
      </aside>

      {/* Sidebar - Mobile Drawer */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
          
          {/* Drawer content */}
          <aside className="relative flex flex-col w-64 max-w-xs bg-slate-900 border-r border-slate-800 h-full justify-between z-10 animate-slide-in-left">
            <div className="flex flex-col flex-1 min-h-0">
              {/* Brand header */}
              <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
                <span className="text-xl font-bold tracking-wider text-blue-400 font-mono">EazyCheck</span>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex-1 p-4 space-y-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-800 hover:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                {renderNavLinks()}
              </nav>
            </div>

            {/* User profile footer */}
            <div className="shrink-0">
              {renderUserProfile()}
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-h-screen flex flex-col md:h-screen md:overflow-y-auto pb-16 md:pb-0">
        {renderSyncBanner()}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-4 md:px-8 bg-slate-900/40 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center">
            {/* Hamburger button for mobile */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 mr-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 md:hidden cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold tracking-tight text-slate-100">
              {navItems.find((item) => item.path === location.pathname)?.label || 'System'}
            </h1>
          </div>
          <div className="flex items-center">
            <button
              onClick={() => setIsProfileOpen(true)}
              className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer border border-slate-700/50 bg-slate-800/30"
              title="View Profile"
            >
              <User className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/rooms" element={<Rooms />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/checkin" element={<CheckIn />} />
            <Route path="/checkout" element={<CheckOut />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/records" element={<Records />} />
            <Route path="/records/previous" element={<PreviousStay />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/logs" element={<AuditLogs />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      </main>

      {/* Bottom Navigation Bar - Mobile Native Style */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-slate-900 border-t border-slate-800 flex justify-around items-center z-40 px-2 pb-safe">
        {navItems.slice(0, 5).map((item) => {
          if (!hasPermission(item.permission)) return null;
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex flex-col items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                isActive ? 'text-blue-500 font-bold' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[9px] mt-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

const App: React.FC = () => {
  const { isAuthenticated, isInitializing, initialize } = useAuthStore();
  const { isOnline } = useNetwork();

  React.useEffect(() => {
    initialize();
  }, [initialize]);

  // Connect to SSE real-time updates
  useRealTimeSync();

  // Synchronizer triggers: run sync Push and Pull automatically when online
  React.useEffect(() => {
    if (isOnline && isAuthenticated) {
      SyncManager.syncAll();
    }
  }, [isOnline, isAuthenticated]);

  // Caching rooms locally when online
  React.useEffect(() => {
    if (isOnline && isAuthenticated) {
      api.get('/rooms')
        .then((res) => {
          const roomsData = res.data?.data || res.data || [];
          localStorage.setItem('hotel_rooms_cache', JSON.stringify(roomsData));
        })
        .catch((err) => console.error('Failed to cache rooms:', err));
    }
  }, [isOnline, isAuthenticated]);

  // Caching next registration number locally when online
  React.useEffect(() => {
    if (isOnline && isAuthenticated) {
      localStorage.removeItem('offline_reg_counter');
      api.get('/bookings/next-reg')
        .then((res) => {
          if (res.data && res.data.success && res.data.data) {
            localStorage.setItem('next_online_reg_number', res.data.data);
          }
        })
        .catch((err) => console.error('Failed to cache next reg number:', err));
    }
  }, [isOnline, isAuthenticated]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="text-slate-400 text-xs tracking-widest font-mono">LOADING EAZYCHECK...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/register" element={!isAuthenticated ? <Login initialMode="register" /> : <Navigate to="/" replace />} />
      {/* Offline screens mounted at root level to bypass checkin-web's sidebar layout */}
      <Route path="/offline" element={<ProtectedRoute><OfflineDashboard /></ProtectedRoute>} />
      <Route path="/offline/booking/new" element={<ProtectedRoute><OfflineBookingForm /></ProtectedRoute>} />
      <Route path="/offline/booking/:id" element={<ProtectedRoute><OfflineBookingDetail /></ProtectedRoute>} />
      <Route path="/offline/booking/:id/edit" element={<ProtectedRoute><OfflineBookingForm /></ProtectedRoute>} />
      {/* All other routes fallback to the online dashboard layout */}
      <Route path="/*" element={<PrivateLayout />} />
    </Routes>
  );
};

export default App;
