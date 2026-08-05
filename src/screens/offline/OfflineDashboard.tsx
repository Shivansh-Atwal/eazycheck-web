import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { OfflineBooking } from '@core/index';
import { BookingRepository, TxtBackupService } from '@core/index';
import { useApp } from '../../context/AppContext';
import { SyncBadge } from '../../components/SyncBadge';

function BookingCard({
  booking,
  onView,
  onEdit,
  onDelete,
  onRetry,
}: {
  booking: OfflineBooking;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRetry: () => void;
}) {
  const regNum = booking.registrationNumber ?? booking.tempRegistrationNumber;
  const rooms = booking.selectedRooms.map((r: any) => r.roomNumber).join(', ');

  return (
    <div className="card booking-card">
      <div className="booking-card-header">
        <div>
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>{booking.customerName}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{regNum}</p>
        </div>
        <SyncBadge status={booking.syncStatus} />
      </div>
      <p style={{ fontSize: 13, marginTop: 4 }}>
        <strong>Status:</strong> {booking.bookingStatus}
      </p>
      <p style={{ fontSize: 13 }}><strong>Rooms:</strong> {rooms || '—'}</p>
      <p style={{ fontSize: 13 }}><strong>Guests:</strong> {booking.guests}</p>
      <p style={{ fontSize: 13 }}>
        <strong>Check-in:</strong> {booking.checkInDate} {booking.checkInTime}
      </p>
      {booking.syncError && (
        <p className="error-text" style={{ fontSize: 12 }}>{booking.syncError}</p>
      )}
      <div className="booking-card-actions">
        <button className="btn btn-secondary" onClick={onView}>View</button>
        <button className="btn btn-primary" onClick={onEdit}>Edit</button>
        <button className="btn btn-danger" onClick={onDelete}>Delete</button>
        {booking.syncStatus !== 'Synced' && (
          <button
            className="btn btn-secondary"
            disabled={booking.syncStatus === 'Syncing'}
            onClick={onRetry}
            style={{ background: '#d97706', color: '#ffffff', borderColor: '#d97706' }}
          >
            {booking.syncStatus === 'Syncing' ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>
    </div>
  );
}

export function OfflineDashboard() {
  const { bookings, refreshBookings, retrySync, networkStatus } = useApp();
  const navigate = useNavigate();
  const bookingRepo = new BookingRepository();
  const txtBackup = TxtBackupService.getInstance();

  const [checkedRooms, setCheckedRooms] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('hotel_offline_room_check_states');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    void refreshBookings();
  }, [refreshBookings]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this offline booking?')) return;
    await bookingRepo.delete(id);
    await refreshBookings();
    await txtBackup.rewrite(await bookingRepo.getAll());
  };

  const handleExport = async () => {
    await txtBackup.export(bookings);
  };

  const handleToggleRoom = (roomNumber: string, checked: boolean) => {
    const next = { ...checkedRooms, [roomNumber]: checked };
    setCheckedRooms(next);
    localStorage.setItem('hotel_offline_room_check_states', JSON.stringify(next));
  };

  // Load cached rooms from localStorage
  const cachedRoomsRaw = localStorage.getItem('hotel_rooms_cache');
  const cachedRooms: any[] = cachedRoomsRaw ? JSON.parse(cachedRoomsRaw) : [];

  return (
    <div className="page offline-mode">
      {networkStatus.isConnected && (
        <div style={{
          background: '#dcfce7',
          color: '#166534',
          border: '1px solid #bbf7d0',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 14,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 2px 4px rgba(22, 101, 52, 0.05)'
        }}>
          <span style={{ color: '#15803d', fontSize: 16 }}>●</span> Network is back! Auto-sync activated.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>EAZYCHECK OFFLINE</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Offline Mode</p>
        </div>
        <Link to="/" className="btn btn-secondary" style={{ fontSize: 12, padding: '8px 14px' }}>
          Online
        </Link>
      </div>

      <h2 className="section-title">Room Status</h2>
      {cachedRooms.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '16px 0', fontWeight: 'semibold' }}>
          No rooms cached yet. Please connect online once to load the rooms list.
        </p>
      ) : (
        <div className="room-grid">
          {cachedRooms.map((room: any) => {
            const isChecked = !!checkedRooms[room.roomNumber];
            return (
              <label
                key={room.id || room.roomNumber}
                className={`room-check ${isChecked ? 'checked' : 'free'}`}
              >
                <input
                  type="checkbox"
                  style={{ display: 'none' }}
                  checked={isChecked}
                  onChange={(e) => handleToggleRoom(room.roomNumber, e.target.checked)}
                />
                <span style={{ fontWeight: 800, fontSize: 16 }}>{room.roomNumber}</span>
                <span style={{ 
                  fontSize: 10, 
                  fontWeight: 700, 
                  marginTop: 4, 
                  padding: '2px 6px', 
                  borderRadius: 4, 
                  background: isChecked ? '#fecdd3' : '#dcfce7', 
                  color: isChecked ? '#9f1239' : '#166534' 
                }}>
                  {isChecked ? 'BOOKED' : 'FREE'}
                </span>
              </label>
            );
          })}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <h2 className="section-title" style={{ margin: 0 }}>Offline Bookings</h2>
        <button className="btn btn-secondary" style={{ fontSize: 11, padding: '6px 12px' }} onClick={() => void handleExport()}>
          Export TXT
        </button>
      </div>

      {bookings.length === 0 ? (
        <div className="empty-state">No offline bookings yet. Tap + to create one.</div>
      ) : (
        bookings.map((b) => (
          <BookingCard
            key={b.id}
            booking={b}
            onView={() => navigate(`/offline/booking/${b.id}`)}
            onEdit={() => navigate(`/offline/booking/${b.id}/edit`)}
            onDelete={() => void handleDelete(b.id)}
            onRetry={() => void retrySync(b.id)}
          />
        ))
      )}

      <button
        className="fab"
        onClick={() => navigate('/offline/booking/new')}
        aria-label="Create booking"
      >
        +
      </button>
    </div>
  );
}
