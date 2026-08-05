import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#10b981',
  OCCUPIED: '#ef4444',
  ADVANCE_BOOKED: '#f59e0b',
  MAINTENANCE: '#64748b',
};

export function DashboardScreen() {
  const { stats, rooms, refreshStats, refreshRooms, networkStatus } = useApp();

  useEffect(() => {
    void refreshStats();
    void refreshRooms();
  }, [refreshStats, refreshRooms, networkStatus.state]);

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>EazyCheck Dashboard</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Real-time room occupancy</p>
        </div>
        <Link to="/offline" className="btn btn-secondary" style={{ fontSize: 12, padding: '8px 14px' }}>
          Offline Mode
        </Link>
      </div>

      {stats && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#3b82f6' }}>{stats.total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#10b981' }}>{stats.available}</div>
            <div className="stat-label">Available</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#ef4444' }}>{stats.occupied}</div>
            <div className="stat-label">Occupied</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#f59e0b' }}>{stats.booked}</div>
            <div className="stat-label">Booked</div>
          </div>
        </div>
      )}

      <h2 className="section-title">Room Occupancy Grid</h2>

      {rooms.length === 0 ? (
        <div className="empty-state">
          {networkStatus.isConnected
            ? 'Loading rooms...'
            : 'No cached room data. Connect to internet to refresh.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {rooms.map((room) => (
            <div
              key={room.id}
              className="card"
              style={{ borderLeft: `4px solid ${STATUS_COLORS[room.status] || '#64748b'}` }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 800, fontSize: 18 }}>{room.roomNumber}</span>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: STATUS_COLORS[room.status],
                  }}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{room.roomType}</p>
              <p style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                ₹{room.pricePerNight?.toFixed(0) || '—'}/nt
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
