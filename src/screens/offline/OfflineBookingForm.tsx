import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { BookingStatus, SelectedRoom } from '@core/index';
import { BookingRepository, TxtBackupService } from '@core/index';
import { useApp } from '../../context/AppContext';
import { BOOKING_STATUS } from '@core/constants';

interface OfflineBookingFormState {
  customerName: string;
  phoneNumber: string;
  streetAddress: string;
  city: string;
  state: string;
  pincode: string;
  nationality: string;
  idType: string;
  idNumber: string;
  bookingStatus: BookingStatus;
  guests: string;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
}

const emptyForm: OfflineBookingFormState = {
  customerName: '',
  phoneNumber: '',
  streetAddress: '',
  city: '',
  state: '',
  pincode: '',
  nationality: 'INDIAN',
  idType: 'AADHAAR CARD',
  idNumber: '',
  bookingStatus: 'Booked' as BookingStatus,
  guests: '',
  checkInDate: new Date().toISOString().split('T')[0],
  checkInTime: new Date().toTimeString().slice(0, 5),
  checkOutDate: '',
  checkOutTime: '',
};

export function OfflineBookingForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = id && id !== 'new';
  const navigate = useNavigate();
  const { refreshBookings } = useApp();

  // Load rooms from local cache
  const cachedRoomsRaw = localStorage.getItem('hotel_rooms_cache');
  const rooms: any[] = cachedRoomsRaw ? JSON.parse(cachedRoomsRaw) : [];

  const [form, setForm] = useState(emptyForm);
  const [selectedRooms, setSelectedRooms] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const bookingRepo = new BookingRepository();
  const txtBackup = TxtBackupService.getInstance();

  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      const booking = await bookingRepo.getById(id);
      if (!booking) return;

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
      let idType = 'AADHAAR CARD';
      let idNumber = '';
      const decryptedAadhaar = bookingRepo.getDecryptedAadhaar(booking);
      try {
        const idObj = JSON.parse(decryptedAadhaar);
        idType = idObj.idType || 'AADHAAR CARD';
        idNumber = idObj.idNumber || '';
      } catch {
        idNumber = decryptedAadhaar || '';
      }

      setForm({
        customerName: booking.customerName,
        phoneNumber: booking.phoneNumber,
        streetAddress,
        city,
        state,
        pincode,
        nationality,
        idType,
        idNumber,
        bookingStatus: booking.bookingStatus,
        guests: String(booking.guests),
        checkInDate: booking.checkInDate,
        checkInTime: booking.checkInTime,
        checkOutDate: booking.checkOutDate ?? '',
        checkOutTime: booking.checkOutTime ?? '',
      });
      const map = new Map<string, number>();
      booking.selectedRooms.forEach((r: any) => map.set(r.roomNumber, r.price));
      setSelectedRooms(map);
    })();
  }, [id, isEdit]);

  const toggleRoom = (roomNumber: string, defaultPrice: number) => {
    setSelectedRooms((prev) => {
      const next = new Map(prev);
      if (next.has(roomNumber)) {
        next.delete(roomNumber);
      } else {
        next.set(roomNumber, defaultPrice);
      }
      return next;
    });
  };

  const setRoomPrice = (roomNumber: string, price: number) => {
    setSelectedRooms((prev) => {
      const next = new Map(prev);
      next.set(roomNumber, price);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.customerName.trim() || !form.phoneNumber.trim()) {
      setError('Customer name and phone are required.');
      return;
    }

    const guests = Number(form.guests);
    if (!Number.isInteger(guests) || guests < 1) {
      setError('Enter number of guests.');
      return;
    }

    if (selectedRooms.size === 0) {
      setError('Select at least one room.');
      return;
    }

    const roomsList: SelectedRoom[] = Array.from(selectedRooms.entries()).map(
      ([roomNumber, price]) => ({ roomNumber, price })
    );

    const addressData = {
      streetAddress: form.streetAddress.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      nationality: form.nationality.trim()
    };

    const idData = {
      idType: form.idType,
      idNumber: form.idNumber.trim()
    };

    setLoading(true);
    try {
      const payload = {
        customerName: form.customerName,
        phoneNumber: form.phoneNumber,
        address: JSON.stringify(addressData),
        aadhaarNumber: JSON.stringify(idData),
        bookingStatus: form.bookingStatus,
        selectedRooms: roomsList,
        guests,
        checkInDate: form.checkInDate,
        checkInTime: form.checkInTime,
        checkOutDate: form.bookingStatus === 'Check Out' ? form.checkOutDate || null : null,
        checkOutTime: form.bookingStatus === 'Check Out' ? form.checkOutTime || null : null,
      };

      if (isEdit && id) {
        await bookingRepo.update({ id, ...payload });
      } else {
        await bookingRepo.create(payload);
      }

      const all = await bookingRepo.getAll();
      await txtBackup.rewrite(all);
      await refreshBookings();
      navigate('/offline');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const showCheckOut = form.bookingStatus === 'Check Out';

  return (
    <div className="page offline-mode">
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>
        {isEdit ? 'Edit Booking' : 'Create Booking'}
      </h1>

      <form onSubmit={handleSubmit} className="card">
        <div className="form-group">
          <label className="label">Guest Name *</label>
          <input className="input" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} required />
        </div>

        <div className="form-group">
          <label className="label">Mobile Number *</label>
          <input className="input" type="tel" value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} required />
        </div>

        <div style={{ margin: '20px 0 10px 0', fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
          ADDRESS DETAILS
        </div>

        <div className="form-group">
          <label className="label">Street Address</label>
          <input className="input" value={form.streetAddress} onChange={(e) => setForm({ ...form, streetAddress: e.target.value })} placeholder="e.g. 123 Main St, Apartment 4B" />
        </div>

        <div className="form-group">
          <label className="label">City</label>
          <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="e.g. Mumbai" />
        </div>

        <div className="form-group">
          <label className="label">State</label>
          <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="e.g. Maharashtra" />
        </div>

        <div className="form-group">
          <label className="label">Pincode / Zip Code</label>
          <input className="input" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} placeholder="e.g. 10001" />
        </div>

        <div className="form-group">
          <label className="label">Nationality</label>
          <input className="input" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} placeholder="e.g. INDIAN" />
        </div>

        <div style={{ margin: '20px 0 10px 0', fontSize: 13, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', borderBottom: '1px solid var(--border)', paddingBottom: 4 }}>
          GOVERNMENT ID DETAILS
        </div>

        <div className="form-group">
          <label className="label">Government ID Type</label>
          <select className="select input" value={form.idType} onChange={(e) => setForm({ ...form, idType: e.target.value })}>
            <option value="AADHAAR CARD">AADHAAR CARD</option>
            <option value="PAN CARD">PAN CARD</option>
            <option value="PASSPORT">PASSPORT</option>
            <option value="DRIVING LICENSE">DRIVING LICENSE</option>
            <option value="VOTER ID">VOTER ID</option>
          </select>
        </div>

        <div className="form-group">
          <label className="label">ID Number</label>
          <input className="input" value={form.idNumber} onChange={(e) => setForm({ ...form, idNumber: e.target.value })} placeholder="Document reference number" />
        </div>

        <div className="form-group">
          <label className="label">Booking Status</label>
          <select className="select" value={form.bookingStatus} onChange={(e) => setForm({ ...form, bookingStatus: e.target.value as BookingStatus })}>
            {BOOKING_STATUS.map((s: any) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="label">Check-in Date *</label>
          <input className="input" type="date" value={form.checkInDate} onChange={(e) => setForm({ ...form, checkInDate: e.target.value })} required />
        </div>

        <div className="form-group">
          <label className="label">Check-in Time *</label>
          <input className="input" type="time" value={form.checkInTime} onChange={(e) => setForm({ ...form, checkInTime: e.target.value })} required />
        </div>

        {showCheckOut && (
          <>
            <div className="form-group">
              <label className="label">Check-out Date</label>
              <input className="input" type="date" value={form.checkOutDate} onChange={(e) => setForm({ ...form, checkOutDate: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="label">Check-out Time</label>
              <input className="input" type="time" value={form.checkOutTime} onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })} />
            </div>
          </>
        )}

        <div className="form-group">
          <label className="label">Number of Guests *</label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.guests}
            onChange={(e) => setForm({ ...form, guests: e.target.value })}
            placeholder="Enter number of guests"
            required
          />
        </div>

        <h3 className="section-title">Select Rooms</h3>
        <div className="room-select-grid">
          {rooms.map((room) => {
            const selected = selectedRooms.has(room.roomNumber);
            return (
              <div
                key={room.id}
                className={`room-select-item ${selected ? 'selected' : ''}`}
                onClick={() => toggleRoom(room.roomNumber, room.pricePerNight || 1500)}
              >
                <div style={{ fontWeight: 700 }}>Room {room.roomNumber}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{room.roomType}</div>
                {selected && (
                  <input
                    className="input price-input"
                    type="number"
                    value={selectedRooms.get(room.roomNumber)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRoomPrice(room.roomNumber, parseFloat(e.target.value) || 0)}
                    placeholder="Price ₹"
                  />
                )}
                {!selected && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>₹{room.pricePerNight || 1500}</div>
                )}
              </div>
            );
          })}
        </div>

        {rooms.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Room list loaded from local cache. Connect online once to refresh rooms.
          </p>
        )}

        {error && <p className="error-text">{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/offline')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
