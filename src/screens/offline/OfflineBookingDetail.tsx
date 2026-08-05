import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { OfflineBooking } from '@core/index';
import { BookingRepository, SyncManager } from '@core/index';
import { SyncBadge } from '../../components/SyncBadge';

export function OfflineBookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<OfflineBooking | null>(null);
  const bookingRepo = new BookingRepository();

  useEffect(() => {
    if (!id) return;
    void bookingRepo.getById(id).then(setBooking);
  }, [id]);

  if (!booking) {
    return <div className="page empty-state offline-mode">Loading...</div>;
  }

  const regNum = booking.registrationNumber ?? booking.tempRegistrationNumber;

  // Extract address components
  let streetAddress = '';
  let city = '';
  let state = '';
  let pincode = '';
  let nationality = 'INDIAN';
  try {
    const addr = JSON.parse(booking.address);
    streetAddress = addr.streetAddress || '';
    city = addr.city || '';
    state = addr.state || '';
    pincode = addr.pincode || '';
    nationality = addr.nationality || 'INDIAN';
  } catch {
    streetAddress = booking.address || '';
  }

  // Extract ID components
  let idType = 'GOVERNMENT ID';
  let idNumber = '';
  const decryptedAadhaar = bookingRepo.getDecryptedAadhaar(booking);
  try {
    const idObj = JSON.parse(decryptedAadhaar);
    idType = idObj.idType || 'GOVERNMENT ID';
    idNumber = idObj.idNumber || '';
  } catch {
    idType = 'AADHAAR CARD';
    idNumber = decryptedAadhaar || '';
  }

  return (
    <div className="page offline-mode">
      <button className="btn btn-secondary" style={{ marginBottom: 16 }} onClick={() => navigate('/offline')}>
        ← Back
      </button>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800 }}>{booking.customerName}</h1>
          <SyncBadge status={booking.syncStatus} />
        </div>

        <dl style={{ display: 'grid', gap: 10, fontSize: 14 }}>
          <div><dt style={{ color: 'var(--text-muted)', fontSize: 11 }}>REGISTRATION</dt><dd>{regNum}</dd></div>
          <div><dt style={{ color: 'var(--text-muted)', fontSize: 11 }}>PHONE</dt><dd>{booking.phoneNumber}</dd></div>
          <div>
            <dt style={{ color: 'var(--text-muted)', fontSize: 11 }}>ADDRESS DETAILS</dt>
            <dd>
              {streetAddress && <div>{streetAddress}</div>}
              {(city || state || pincode) && (
                <div>{[city, state, pincode].filter(Boolean).join(', ')}</div>
              )}
              {nationality && <div>Nationality: {nationality}</div>}
              {!streetAddress && !city && !state && !pincode && <div>—</div>}
            </dd>
          </div>
          <div><dt style={{ color: 'var(--text-muted)', fontSize: 11 }}>{idType}</dt><dd>{idNumber || '—'}</dd></div>
          <div><dt style={{ color: 'var(--text-muted)', fontSize: 11 }}>STATUS</dt><dd>{booking.bookingStatus}</dd></div>
          <div><dt style={{ color: 'var(--text-muted)', fontSize: 11 }}>GUESTS</dt><dd>{booking.guests}</dd></div>
          <div><dt style={{ color: 'var(--text-muted)', fontSize: 11 }}>CHECK-IN</dt><dd>{booking.checkInDate} {booking.checkInTime}</dd></div>
          {booking.checkOutDate && (
            <div><dt style={{ color: 'var(--text-muted)', fontSize: 11 }}>CHECK-OUT</dt><dd>{booking.checkOutDate} {booking.checkOutTime}</dd></div>
          )}
          <div>
            <dt style={{ color: 'var(--text-muted)', fontSize: 11 }}>ROOMS</dt>
            <dd>
              {booking.selectedRooms.map((r: any) => (
                <div key={r.roomNumber}>Room {r.roomNumber} — ₹{r.price}</div>
              ))}
            </dd>
          </div>
        </dl>

        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 20 }}
          onClick={() => navigate(`/offline/booking/${booking.id}/edit`)}
        >
          Edit Booking
        </button>

        {booking.syncStatus !== 'Synced' && (
          <button
            className="btn btn-secondary"
            style={{
              width: '100%',
              marginTop: 10,
              background: '#d97706',
              color: '#ffffff',
              borderColor: '#d97706'
            }}
            disabled={booking.syncStatus === 'Syncing'}
            onClick={async () => {
              const syncManager = SyncManager.getInstance();
              await syncManager.retryFailed(booking.id);
              const updated = await bookingRepo.getById(booking.id);
              if (updated) setBooking(updated);
            }}
          >
            {booking.syncStatus === 'Syncing' ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>
    </div>
  );
}
