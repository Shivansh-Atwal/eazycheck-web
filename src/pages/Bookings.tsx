import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getBackendUrl } from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { Plus, X, Search, Phone, Ban, Pencil, MapPin, Globe, History, BookmarkCheck, Upload, FileText, Clock } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { formatDate, formatTime12h } from '../utils/dateFormatter';
import citiesData from '../utils/cities.json';

const indianStates = Array.from(new Set(citiesData.map((c: any) => c.state))).sort();

interface CheckInRecord {
  id: string;
  checkInTime: string;
  actualCheckOutTime?: string | null;
  registrationNumber?: string | null;
  status: string;
}

interface Booking {
  id: string;
  bookingNumber: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  advancePayment: number;
  price: number;
  status: string;
  notes: string;
  customerId: string;
  roomId: string;
  customer: {
    fullName: string;
    mobileNumber: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string; // Nationality
    pincode?: string;
    documents?: Array<{
      idType: string;
      idNumber: string;
      frontImageUrl?: string;
      backImageUrl?: string;
      customerPhotoUrl?: string;
    }>;
  };
  room: {
    id: string;
    roomNumber: string;
    roomType: string;
  };
  registrationNumber?: string;
  checkInRecord?: CheckInRecord | null;
}

const compressImage = (file: File, quality = 0.7, maxWidth = 1024, maxHeight = 1024): Promise<File> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(file);
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return resolve(file);
            }
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

interface Room {
  id: string;
  roomNumber: string;
  status: string;
  roomType: string;
}

const Bookings: React.FC = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { hasPermission } = useAuthStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Form / Edit states
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  // Document states
  const [idType, setIdType] = useState('Aadhaar Card');
  const [idNumber, setIdNumber] = useState('');
  const [frontImageUrl, setFrontImageUrl] = useState('');
  const [backImageUrl, setBackImageUrl] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [frontImageLoading, setFrontImageLoading] = useState(false);
  const [backImageLoading, setBackImageLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  const handleFileUpload = async (
    file: File,
    type: 'documents' | 'customers',
    setUrl: (url: string) => void,
    setLoading: (load: boolean) => void
  ) => {
    setLoading(true);
    try {
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        try {
          fileToUpload = await compressImage(file, 0.7, 1024, 1024);
        } catch (compressErr) {
          console.error("Compression failed, uploading original image", compressErr);
        }
      }

      const formData = new FormData();
      formData.append('document', fileToUpload);
      const res = await api.post(`/customers/upload?type=${type}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUrl(res.data.data.fileUrl);
    } catch (err: any) {
      alert(err.response?.data?.error || 'File upload failed.');
    } finally {
      setLoading(false);
    }
  };
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionField, setSuggestionField] = useState<'name' | 'mobile' | null>(null);

  const fetchSuggestions = async (val: string, field: 'name' | 'mobile') => {
    if (!val || val.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const res = await api.get(`/customers/search?q=${encodeURIComponent(val)}`);
      if (res.data && res.data.success) {
        setSuggestions(res.data.data);
        setSuggestionField(field);
        setShowSuggestions(true);
      }
    } catch (err) {
      console.error('Error fetching customer suggestions:', err);
    }
  };

  const handleSelectCustomer = (customer: any) => {
    setCustomerId(customer.id);
    setCustomerName(customer.fullName || '');
    setMobileNumber(customer.mobileNumber || '');
    setAddress(customer.address || '');
    setCity(customer.city || '');
    setState(customer.state || '');
    setCountry(customer.country || '');
    setPincode(customer.pincode || '');

    if (customer.documents && customer.documents.length > 0) {
      const doc = customer.documents[0];
      setIdType(doc.idType || 'Aadhaar Card');
      setIdNumber(doc.idNumber || '');
      setFrontImageUrl(doc.frontImageUrl || '');
      setBackImageUrl(doc.backImageUrl || '');
      setPhotoUrl(doc.customerPhotoUrl || '');
    } else {
      setIdType('Aadhaar Card');
      setIdNumber('');
      setFrontImageUrl('');
      setBackImageUrl('');
      setPhotoUrl('');
    }

    setShowSuggestions(false);
    setSuggestions([]);
  };

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');

  const filteredCities = React.useMemo(() => {
    if (!state) {
      return Array.from(new Set(citiesData.map((c: any) => c.name))).sort();
    }
    const stateNormalized = state.trim().toLowerCase();
    return Array.from(
      new Set(
        citiesData
          .filter((c: any) => c.state.toLowerCase() === stateNormalized)
          .map((c: any) => c.name)
      )
    ).sort();
  }, [state]);

  const [country, setCountry] = useState('');
  const [pincode, setPincode] = useState('');
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('12:00');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('12:00');
  const [numberOfGuests, setNumberOfGuests] = useState(1);
  const [price, setPrice] = useState(80);
  const [advancePayment, setAdvancePayment] = useState(0);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('CONFIRMED');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRoomDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pre-fill room if navigated from dashboard
  React.useEffect(() => {
    if (location.state && location.state.roomId) {
      setSelectedRoomIds([location.state.roomId]);
      setModalOpen(true);
    }
  }, [location.state]);

  React.useEffect(() => {
    const fetchNextRegNumber = async () => {
      try {
        const res = await api.get('/bookings/next-reg');
        if (res.data && res.data.success && res.data.data) {
          setRegistrationNumber(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch next registration number:', err);
      }
    };
    if (modalOpen) {
      if (!editingBooking) {
        fetchNextRegNumber();
      } else if (editingBooking && !editingBooking.registrationNumber) {
        fetchNextRegNumber();
      }
    }
  }, [modalOpen, editingBooking]);

  // Fetch Bookings
  const { data: bookingsRes, isLoading } = useQuery({
    queryKey: ['bookings', searchQuery],
    queryFn: () =>
      api.get(`/bookings?q=${searchQuery}`).then((res) => res.data),
  });

  // Fetch Available Rooms for Dropdown
  const { data: roomsRes } = useQuery({
    queryKey: ['available-rooms-dropdown'],
    queryFn: () => api.get('/rooms?status=AVAILABLE').then((res) => res.data),
  });

  const bookings: Booking[] = bookingsRes?.data || [];
  const rooms: Room[] = roomsRes?.data || [];

  // Create Booking Mutation
  const createBookingMutation = useMutation({
    mutationFn: (newBooking: any) => api.post('/bookings', newBooking),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['payment-ledger'] });
      closeModal();
    },
    onError: (err: any) => {
      setValidationError(err.response?.data?.error || 'Failed to create booking.');
    }
  });

  // Update Booking Mutation
  const updateBookingMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      api.put(`/bookings/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['payment-ledger'] });
      closeModal();
    },
    onError: (err: any) => {
      setValidationError(err.response?.data?.error || 'Failed to update booking.');
    }
  });

  // Cancel Booking Mutation
  const cancelBookingMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['payment-ledger'] });
    },
  });

  const openEditModal = (booking: Booking) => {
    setEditingBooking(booking);
    setCustomerId(booking.customerId);
    setCustomerName(booking.customer.fullName || '');
    setMobileNumber(booking.customer.mobileNumber || '');
    setAddress(booking.customer.address || '');
    setCity(booking.customer.city || '');
    setState(booking.customer.state || '');
    setCountry(booking.customer.country || '');
    setPincode(booking.customer.pincode || '');
    setSelectedRoomIds([booking.roomId]);

    const getLocalDateString = (dateTimeStr?: string | Date | null) => {
      if (!dateTimeStr) return '';
      const d = new Date(dateTimeStr);
      if (isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const getTimeString = (dateTimeStr?: string | null) => {
      if (!dateTimeStr) return '12:00';
      const d = new Date(dateTimeStr);
      if (isNaN(d.getTime())) return '12:00';
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    };

    const checkInDateTime = booking.checkInRecord?.checkInTime;
    const checkOutDateTime = booking.checkInRecord?.actualCheckOutTime;

    if (checkInDateTime) {
      setCheckInDate(getLocalDateString(checkInDateTime));
      setCheckInTime(getTimeString(checkInDateTime));
    } else {
      setCheckInDate(booking.checkInDate ? booking.checkInDate.split('T')[0] : '');
      setCheckInTime('12:00');
    }

    if (checkOutDateTime) {
      setCheckOutDate(getLocalDateString(checkOutDateTime));
      setCheckOutTime(getTimeString(checkOutDateTime));
    } else {
      setCheckOutDate(booking.checkOutDate ? booking.checkOutDate.split('T')[0] : '');
      setCheckOutTime('12:00');
    }

    setNumberOfGuests(booking.numberOfGuests);
    setPrice(booking.price);
    setAdvancePayment(booking.advancePayment);
    setNotes(booking.notes || '');
    setStatus(booking.status);
    setRegistrationNumber(booking.registrationNumber || '');

    if (booking.customer.documents && booking.customer.documents.length > 0) {
      const doc = booking.customer.documents[0];
      setIdType(doc.idType || 'Aadhaar Card');
      setIdNumber(doc.idNumber || '');
      setFrontImageUrl(doc.frontImageUrl || '');
      setBackImageUrl(doc.backImageUrl || '');
      setPhotoUrl(doc.customerPhotoUrl || '');
    } else {
      setIdType('Aadhaar Card');
      setIdNumber('');
      setFrontImageUrl('');
      setBackImageUrl('');
      setPhotoUrl('');
    }

    setValidationError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingBooking(null);
    setCustomerId(null);
    setCustomerName('');
    setMobileNumber('');
    setAddress('');
    setCity('');
    setState('');
    setCountry('');
    setPincode('');
    setSelectedRoomIds([]);
    setCheckInDate('');
    setCheckInTime('12:00');
    setCheckOutDate('');
    setCheckOutTime('12:00');
    setNumberOfGuests(1);
    setPrice(80);
    setAdvancePayment(0);
    setNotes('');
    setStatus('CONFIRMED');
    setRegistrationNumber('');
    setIdType('Aadhaar Card');
    setIdNumber('');
    setFrontImageUrl('');
    setBackImageUrl('');
    setPhotoUrl('');
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);



    const checkInDateTimeParsed = new Date(`${checkInDate}T${checkInTime || '12:00'}:00`);
    const checkOutDateTimeParsed = new Date(`${checkOutDate}T${checkOutTime || '12:00'}:00`);

    if (checkOutDateTimeParsed <= checkInDateTimeParsed) {
      setValidationError('Check-out date and time must be after check-in date and time.');
      return;
    }

    const finalCheckInPayload = editingBooking && (editingBooking.status === 'CHECKED_IN' || editingBooking.status === 'CHECKED_OUT')
      ? new Date(`${checkInDate}T${checkInTime || '12:00'}:00`).toISOString()
      : checkInDate;

    const finalCheckOutPayload = editingBooking && editingBooking.status === 'CHECKED_OUT'
      ? new Date(`${checkOutDate}T${checkOutTime || '12:00'}:00`).toISOString()
      : checkOutDate;

    const payload: any = {
      customerName: (customerName || '').toUpperCase(),
      mobileNumber,
      address: (address || '').toUpperCase(),
      city: (city || '').toUpperCase(),
      state: (state || '').toUpperCase(),
      country: (country || '').toUpperCase(),
      pincode: (pincode || '').toUpperCase(),
      checkInDate: finalCheckInPayload,
      checkOutDate: finalCheckOutPayload,
      numberOfGuests: Number(numberOfGuests),
      price: Number(price),
      advancePayment: Number(advancePayment),
      notes: (notes || '').toUpperCase(),
      status,
      registrationNumber: (registrationNumber || '').toUpperCase(),
      document: {
        idType: (idType || '').toUpperCase(),
        idNumber: (idNumber || '').toUpperCase(),
        frontImageUrl: frontImageUrl || undefined,
        backImageUrl: backImageUrl || undefined,
        customerPhotoUrl: photoUrl || undefined,
      },
    };

    if (editingBooking) {
      payload.roomId = selectedRoomIds[0];
    } else {
      payload.roomIds = selectedRoomIds;
    }

    if (customerId) {
      payload.customerId = customerId;
    }

    const performBooking = async () => {
      if (editingBooking) {
        updateBookingMutation.mutate({ id: editingBooking.id, payload });
      } else {
        createBookingMutation.mutate(payload);
      }
    };
    performBooking();
  };

  const handleCancel = (id: string) => {
    if (confirm('Are you sure you want to cancel this reservation?')) {
      cancelBookingMutation.mutate(id);
    }
  };

  const handlePreviewPDF = (booking: Booking) => {
    const doc = booking.customer.documents?.[0];
    if (!doc) {
      alert("No documents uploaded for this guest.");
      return;
    }

    const formatImgUrl = (url?: string) => {
      if (!url) return '';
      return url.startsWith('/')
        ? `${getBackendUrl()}${url}`
        : url;
    };

    const photo = formatImgUrl(doc.customerPhotoUrl);
    const front = formatImgUrl(doc.frontImageUrl);
    const back = formatImgUrl(doc.backImageUrl);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to preview the document.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Guest Dossier - ${booking.customer.fullName}</title>
          <style>
            body {
              font-family: 'Inter', sans-serif;
              color: #1e293b;
              background-color: #ffffff;
              margin: 40px;
              padding: 0;
            }
            .header {
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
              margin-bottom: 30px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .title {
              font-size: 24px;
              font-weight: 800;
              color: #1e3a8a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .subtitle {
              font-size: 12px;
              color: #64748b;
              margin-top: 5px;
            }
            .metadata-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin-bottom: 40px;
              background-color: #f8fafc;
              padding: 20px;
              border-radius: 12px;
              border: 1px solid #e2e8f0;
            }
            .metadata-item {
              font-size: 14px;
            }
            .metadata-label {
              font-weight: 700;
              color: #475569;
              text-transform: uppercase;
              font-size: 11px;
              letter-spacing: 0.5px;
              margin-bottom: 4px;
            }
            .metadata-value {
              font-weight: 600;
              color: #0f172a;
            }
            .section-title {
              font-size: 16px;
              font-weight: 800;
              color: #1e3a8a;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 8px;
              margin-top: 30px;
              margin-bottom: 20px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .images-container {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
            }
            .image-card {
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 10px;
              background-color: #f8fafc;
              text-align: center;
            }
            .image-title {
              font-size: 12px;
              font-weight: 700;
              color: #475569;
              margin-bottom: 8px;
            }
            .img-wrapper {
              height: 250px;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: #ffffff;
              border-radius: 6px;
              overflow: hidden;
              border: 1px dashed #cbd5e1;
            }
            img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
            }
            .photo-card {
              grid-column: span 2;
              max-width: 200px;
              margin: 0 auto 30px auto;
            }
            .photo-card .img-wrapper {
              height: 180px;
              width: 180px;
              border-radius: 50%;
              margin: 0 auto;
            }
            .no-print-actions {
              position: fixed;
              bottom: 20px;
              right: 20px;
              display: flex;
              gap: 10px;
              z-index: 10;
            }
            .no-print-btn {
              background-color: #2563eb;
              color: #ffffff;
              border: none;
              padding: 12px 24px;
              font-size: 14px;
              font-weight: 700;
              border-radius: 8px;
              cursor: pointer;
              box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
              transition: background-color 0.2s;
            }
            .no-print-btn:hover {
              background-color: #1d4ed8;
            }
            .no-print-btn.secondary {
              background-color: #0f172a;
              box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
            }
            .no-print-btn.secondary:hover {
              background-color: #1e293b;
            }
            
            /* Responsive styles for mobile devices */
            @media (max-width: 640px) {
              body {
                margin: 16px;
              }
              .header {
                flex-direction: column;
                align-items: flex-start;
                gap: 10px;
              }
              .title {
                font-size: 20px;
              }
              .metadata-grid {
                grid-template-columns: 1fr;
                gap: 12px;
                padding: 16px;
              }
              .images-container {
                grid-template-columns: 1fr;
                gap: 16px;
              }
              .img-wrapper {
                height: 180px;
              }
              .photo-card {
                grid-column: span 1;
              }
              .no-print-actions {
                position: fixed;
                left: 16px;
                right: 16px;
                bottom: 16px;
                flex-direction: column;
              }
              .no-print-btn {
                width: calc(100% - 32px);
                box-sizing: border-box;
                text-align: center;
              }
            }

            @media print {
              .no-print {
                display: none !important;
              }
              body {
                margin: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">Guest Identity Dossier</div>
              <div class="subtitle">Hotel stay customer profile report</div>
            </div>
            <div style="font-weight: 800; font-size: 18px; color: #475569;">EazyCheck</div>
          </div>

          <div class="metadata-grid">
            <div class="metadata-item">
              <div class="metadata-label">Guest Name</div>
              <div class="metadata-value">${booking.customer.fullName}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">Mobile Number</div>
              <div class="metadata-value">${booking.customer.mobileNumber}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">Room Number</div>
              <div class="metadata-value">Room ${booking.room?.roomNumber || 'N/A'} (${booking.room?.roomType || ''})</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">Stay Reference / Reg Number</div>
              <div class="metadata-value">${booking.registrationNumber || booking.bookingNumber}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">Check-In Date</div>
              <div class="metadata-value">${new Date(booking.checkInDate).toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
            </div>
            <div class="metadata-item">
              <div class="metadata-label">Check-Out Date</div>
              <div class="metadata-value">${new Date(booking.checkOutDate).toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
            </div>
          </div>

          ${photo ? `
            <div class="section-title">Customer Photograph</div>
            <div class="image-card photo-card">
              <div class="image-title">Passport Photo</div>
              <div class="img-wrapper">
                <img src="${photo}" alt="Customer Photo" />
              </div>
            </div>
          ` : ''}

          <div class="section-title">Government Identity Proof (${doc.idType})</div>
          <div style="font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 15px; background: #f1f5f9; padding: 10px; border-radius: 6px; border-left: 4px solid #1e3a8a;">
            ID Document Reference Number: <span style="font-family: monospace; font-size: 14px;">${doc.idNumber}</span>
          </div>

          <div class="images-container">
            ${front ? `
              <div class="image-card">
                <div class="image-title">ID Front View</div>
                <div class="img-wrapper">
                  <img src="${front}" alt="ID Front Image" />
                </div>
              </div>
            ` : ''}
            
            ${back ? `
              <div class="image-card">
                <div class="image-title">ID Back View</div>
                <div class="img-wrapper">
                  <img src="${back}" alt="ID Back Image" />
                </div>
              </div>
            ` : ''}
          </div>

          <div class="no-print no-print-actions">
            <button class="no-print-btn secondary" onclick="window.close()">Back to EazyCheck</button>
            <button class="no-print-btn" onclick="window.print()">Print / Save as PDF</button>
          </div>

          <script>
            // Auto open the print dialog when images load
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Split bookings into active booked list and stay history list
  const bookedReservations = bookings.filter((b) => b.status === 'CONFIRMED');
  const stayRecords = bookings.filter((b) => b.status !== 'CONFIRMED');

  const selectRooms = React.useMemo(() => {
    if (editingBooking) {
      // If editingBooking has rooms, add the ones not in `rooms`
      const assignedRooms = (editingBooking as any).rooms || [];
      const newAssigned = assignedRooms.filter((ar: any) => !rooms.some((r) => r.id === ar.id)).map((ar: any) => ({
        id: ar.id,
        roomNumber: ar.roomNumber,
        roomType: ar.roomType,
        status: 'CURRENTLY ASSIGNED'
      }));
      if (newAssigned.length > 0) {
        return [...newAssigned, ...rooms];
      }
    }
    return rooms;
  }, [rooms, editingBooking]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/20">Booked</span>;
      case 'CHECKED_IN':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/20">Checked In</span>;
      case 'CHECKED_OUT':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">Checked Out</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/20">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  const renderBookingTable = (list: Booking[], showCancelAction: boolean) => {
    if (list.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500 text-xs">
          No records found in this section.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-850/50 text-slate-450 text-[10px] uppercase tracking-wider font-bold">
                <th className="p-4">Ref Number</th>
                <th className="p-4">Guest Info</th>
                <th className="p-4">Room Allocation</th>
                <th className="p-4">Stay Dates</th>
                <th className="p-4">Room Price</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs text-slate-250">
              {list.map((booking) => (
                <tr key={booking.id} className="hover:bg-slate-850/20 transition-colors">
                  <td className="p-4 font-mono font-semibold text-blue-400">
                    {booking.registrationNumber && (
                      <div className="text-[10px] text-emerald-400 font-bold mt-0.5">
                        Reg: {booking.registrationNumber}
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <p className="font-semibold text-white">{booking.customer.fullName}</p>
                    <p className="text-[11px] text-slate-450 flex items-center mt-0.5">
                      <Phone className="w-3 h-3 mr-1 text-slate-500" />
                      {booking.customer.mobileNumber}
                    </p>
                    {booking.customer.city && (
                      <p className="text-[10px] text-slate-500 flex items-center mt-1">
                        <MapPin className="w-2.5 h-2.5 mr-0.5" />
                        {booking.customer.city}, {booking.customer.state}
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <p className="font-mono font-bold text-white">Room {booking.room?.roomNumber}</p>
                    <p className="text-[10px] text-slate-500 font-mono capitalize">{booking.room?.roomType}</p>
                  </td>
                  <td className="p-4 space-y-0.5">
                    <p><span className="text-slate-500 font-medium">Arrival:</span> {formatDate(booking.checkInDate)}</p>
                    <p><span className="text-slate-500 font-medium">Departure:</span> {formatDate(booking.checkOutDate)}</p>
                  </td>
                  <td className="p-4 font-semibold text-emerald-400">₹{booking.price}</td>
                  <td className="p-4">{getStatusBadge(booking.status)}</td>
                  <td className="p-4 text-right space-x-2">
                    {booking.customer.documents && booking.customer.documents.length > 0 && (
                      <button
                        onClick={() => handlePreviewPDF(booking)}
                        className="p-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-700 text-emerald-400 hover:text-emerald-300 rounded-lg transition-colors cursor-pointer inline-flex"
                        title="Preview PDF Dossier"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {hasPermission('bookings.update') && (
                      <button
                        onClick={() => openEditModal(booking)}
                        className="p-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer inline-flex"
                        title="Edit Details"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {showCancelAction && booking.status === 'CONFIRMED' && hasPermission('bookings.cancel') && (
                      <button
                        onClick={() => handleCancel(booking.id)}
                        className="p-1.5 bg-rose-950/20 hover:bg-rose-950/50 text-rose-400 hover:text-rose-200 rounded-lg transition-colors cursor-pointer inline-flex"
                        title="Cancel Booking"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden space-y-4">
          {list.map((booking) => (
            <div key={booking.id} className="bg-slate-950/30 border border-slate-800 p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-mono font-bold text-blue-400 text-xs">
                  {booking.registrationNumber ? ` (${booking.registrationNumber})` : ''}
                </span>
                {getStatusBadge(booking.status)}
              </div>

              <div>
                <p className="font-bold text-white text-sm">{booking.customer.fullName}</p>
                <p className="text-xs text-slate-400 flex items-center mt-1">
                  <Phone className="w-3 h-3 mr-1.5 text-slate-500" />
                  {booking.customer.mobileNumber}
                </p>
                {booking.customer.city && (
                  <p className="text-[10px] text-slate-450 flex items-center mt-0.5">
                    <MapPin className="w-2.5 h-2.5 mr-1 text-slate-500" />
                    {booking.customer.city}, {booking.customer.state}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800/80 pt-2.5">
                <div>
                  <span className="block text-[10px] uppercase text-slate-500 tracking-wider">Room Assigned</span>
                  <span className="font-mono font-bold text-white">Room {booking.room?.roomNumber}</span>
                  <span className="block text-[10px] text-slate-500">({booking.room?.roomType})</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-500 tracking-wider">Room Price</span>
                  <span className="font-bold text-emerald-400">₹{booking.price}</span>
                </div>
              </div>

              <div className="flex justify-between items-end border-t border-slate-800/80 pt-2.5">
                <div className="text-[10px] space-y-0.5 text-slate-450">
                  <p><span className="text-slate-500">Check-in:</span> {formatDate(booking.checkInDate)}</p>
                  <p><span className="text-slate-500">Check-out:</span> {formatDate(booking.checkOutDate)}</p>
                </div>

                <div className="flex space-x-1.5">
                  {booking.customer.documents && booking.customer.documents.length > 0 && (
                    <button
                      onClick={() => handlePreviewPDF(booking)}
                      className="p-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-700 text-emerald-400 hover:text-emerald-300 rounded-lg transition-colors cursor-pointer"
                      title="Preview PDF Dossier"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {hasPermission('bookings.update') && (
                    <button
                      onClick={() => openEditModal(booking)}
                      className="p-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Edit Details"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {showCancelAction && booking.status === 'CONFIRMED' && hasPermission('bookings.cancel') && (
                    <button
                      onClick={() => handleCancel(booking.id)}
                      className="p-1.5 bg-rose-950/20 hover:bg-rose-950/55 text-rose-455 hover:text-rose-255 rounded-lg transition-colors cursor-pointer"
                      title="Cancel Booking"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-slate-900/40 p-4 rounded-2xl border border-slate-850">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4.5 h-4.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Guest, Mobile, or Room..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-550 outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {hasPermission('bookings.create') && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/10 text-xs tracking-wide transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2" />
            Book Future Room
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-slate-500 text-sm">Loading stay and booking records...</div>
      ) : (
        <div className="space-y-8 animate-fade-in">
          {/* Section 1: Booked Reservations */}
          <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center tracking-wide uppercase">
                <BookmarkCheck className="w-4.5 h-4.5 text-blue-500 mr-2" />
                Booked Reservations (Future Stays)
                <span className="ml-2.5 px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-mono">
                  {bookedReservations.length}
                </span>
              </h3>
            </div>
            {renderBookingTable(bookedReservations, true)}
          </div>

          {/* Section 2: Stays History & Records */}
          <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center tracking-wide uppercase">
                <History className="w-4.5 h-4.5 text-emerald-500 mr-2" />
                Stay Records & History (Check-In / Check-Out)
                <span className="ml-2.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono">
                  {stayRecords.length}
                </span>
              </h3>
            </div>
            {renderBookingTable(stayRecords, false)}
          </div>
        </div>
      )}

      {/* Reservation Form / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={closeModal} />

          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-850 rounded-2xl shadow-2xl p-6 z-10 my-8 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5">
              <h3 className="text-lg font-bold text-white">
                {editingBooking ? `Edit Details (${editingBooking.bookingNumber})` : 'Add Future Stay Reservation'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {validationError && (
              <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl">
                {validationError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="space-y-4 md:max-h-[60vh] md:overflow-y-auto md:pr-2">
                {/* Registration Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-450 mb-1.5">Registration Number</label>
                  <input
                    type="text"
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    placeholder="e.g. REG-101 (Leave blank to auto-generate)"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-slate-650 outline-none transition-colors"
                  />
                </div>

                {/* Primary Guest Identity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-450 mb-1.5">Guest Full Name</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomerName(val);
                        setCustomerId(null);
                        fetchSuggestions(val, 'name');
                      }}
                      onBlur={() => setShowSuggestions(false)}
                      placeholder="e.g. Samuel Jackson"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
                    />
                    {showSuggestions && suggestionField === 'name' && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-[99] bg-slate-950 border border-slate-850 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-900">
                        {suggestions.map((cust) => (
                          <div
                            key={cust.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectCustomer(cust);
                            }}
                            className="p-3 hover:bg-slate-900 cursor-pointer transition-colors text-left"
                          >
                            <div className="flex justify-between items-start">
                              <p className="font-semibold text-white text-xs">{cust.fullName}</p>
                              <span className="text-[11px] text-slate-400 font-mono">{cust.mobileNumber}</span>
                            </div>
                            <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500">
                              <span>{cust.city ? `${cust.city}, ${cust.state || ''}` : 'No address info'}</span>
                              {cust.documents && cust.documents.length > 0 && (
                                <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[9px] text-blue-400 border border-slate-800 font-mono">
                                  {cust.documents[0].idType}: {cust.documents[0].idNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <label className="block text-xs font-semibold text-slate-450 mb-1.5">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      value={mobileNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMobileNumber(val);
                        setCustomerId(null);
                        fetchSuggestions(val, 'mobile');
                      }}
                      onBlur={() => setShowSuggestions(false)}
                      placeholder="e.g. 9876543210"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
                    />
                    {showSuggestions && suggestionField === 'mobile' && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-[99] bg-slate-950 border border-slate-850 rounded-xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-900">
                        {suggestions.map((cust) => (
                          <div
                            key={cust.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectCustomer(cust);
                            }}
                            className="p-3 hover:bg-slate-900 cursor-pointer transition-colors text-left"
                          >
                            <div className="flex justify-between items-start">
                              <p className="font-semibold text-white text-xs">{cust.fullName}</p>
                              <span className="text-[11px] text-slate-400 font-mono">{cust.mobileNumber}</span>
                            </div>
                            <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500">
                              <span>{cust.city ? `${cust.city}, ${cust.state || ''}` : 'No address info'}</span>
                              {cust.documents && cust.documents.length > 0 && (
                                <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[9px] text-blue-400 border border-slate-800 font-mono">
                                  {cust.documents[0].idType}: {cust.documents[0].idNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Guest Address details */}
                <div className="bg-slate-950/45 p-4 rounded-xl border border-slate-850 space-y-3">
                  <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                    Address & Stay Details
                  </span>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-450 mb-1">Street Address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. 123 Main St, Apt 4B"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-1.5 px-3 text-xs text-white outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 mb-1">City</label>
                      <input
                        type="text"
                        list="cities-datalist-booking"
                        value={city}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCity(val);
                          const found = citiesData.find(c => c.name.toLowerCase() === val.trim().toLowerCase());
                          if (found) {
                            setState(found.state);
                          }
                        }}
                        placeholder="e.g. Mumbai"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-1.5 px-3 text-xs text-white outline-none"
                      />
                      <datalist id="cities-datalist-booking">
                        {filteredCities.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 mb-1">State</label>
                      <input
                        type="text"
                        list="states-datalist-booking"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="e.g. Maharashtra"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-1.5 px-3 text-xs text-white outline-none"
                      />
                      <datalist id="states-datalist-booking">
                        {indianStates.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 mb-1">Zip/Pincode</label>
                      <input
                        type="text"
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        placeholder="10001"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-1.5 px-3 text-xs text-white outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-450 mb-1 flex items-center">
                      <Globe className="w-3 h-3 mr-1 text-slate-500" />
                      Nationality / Country
                    </label>
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. Indian"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-1.5 px-3 text-xs text-white outline-none"
                    />
                  </div>
                </div>

                {/* Document/Images upload */}
                <div className="bg-slate-950/45 p-4 rounded-xl border border-slate-850 space-y-4">
                  <span className="text-[10px] font-bold text-slate-455 uppercase tracking-wider flex items-center">
                    <BookmarkCheck className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                    ID Proof & Images
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 mb-1">ID Document Type</label>
                      <select
                        value={idType}
                        onChange={(e) => setIdType(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-1.5 px-3 text-xs text-white outline-none"
                      >
                        <option value="Aadhaar Card">Aadhaar Card</option>
                        <option value="Passport">Passport</option>
                        <option value="Driving License">Driving License</option>
                        <option value="Voter ID">Voter ID</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 mb-1">ID Number</label>
                      <input
                        type="text"
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value)}
                        placeholder="e.g. 1234-5678-9012"
                        className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-1.5 px-3 text-xs text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 mb-1">ID Front Image</label>
                      <div className="relative flex flex-col items-center justify-center border border-dashed border-slate-800 bg-slate-950/40 rounded-xl p-3 hover:border-slate-700 transition-colors">
                        {frontImageUrl ? (
                          <div className="w-full space-y-2 text-center">
                            <img
                              src={frontImageUrl.startsWith('/') ? `${getBackendUrl()}${frontImageUrl}` : frontImageUrl}
                              alt="ID Front"
                              className="h-20 mx-auto rounded-lg object-cover border border-slate-805 cursor-zoom-in hover:opacity-90 transition-opacity"
                              onClick={() => setPreviewImage(frontImageUrl.startsWith('/') ? `${getBackendUrl()}${frontImageUrl}` : frontImageUrl)}
                            />
                            <button
                              type="button"
                              onClick={() => setFrontImageUrl('')}
                              className="text-[10px] text-rose-400 hover:text-rose-355 transition-colors font-medium cursor-pointer"
                            >
                              Remove Image
                            </button>
                          </div>
                        ) : (
                          <div className="w-full text-center py-2 flex flex-col items-center justify-center space-y-2">
                            <span className="text-[10px] text-slate-400 block font-medium">
                              {frontImageLoading ? 'Uploading...' : 'Select Front ID Image'}
                            </span>
                            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 rounded-lg text-[10px] font-semibold text-white cursor-pointer transition-colors">
                              <Upload className="w-3 h-3 text-blue-500" />
                              <span>Upload File</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleFileUpload(e.target.files[0], 'documents', setFrontImageUrl, setFrontImageLoading);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-450 mb-1">ID Back Image</label>
                      <div className="relative flex flex-col items-center justify-center border border-dashed border-slate-800 bg-slate-950/40 rounded-xl p-3 hover:border-slate-700 transition-colors">
                        {backImageUrl ? (
                          <div className="w-full space-y-2 text-center">
                            <img
                              src={backImageUrl.startsWith('/') ? `${getBackendUrl()}${backImageUrl}` : backImageUrl}
                              alt="ID Back"
                              className="h-20 mx-auto rounded-lg object-cover border border-slate-805 cursor-zoom-in hover:opacity-90 transition-opacity"
                              onClick={() => setPreviewImage(backImageUrl.startsWith('/') ? `${getBackendUrl()}${backImageUrl}` : backImageUrl)}
                            />
                            <button
                              type="button"
                              onClick={() => setBackImageUrl('')}
                              className="text-[10px] text-rose-400 hover:text-rose-355 transition-colors font-medium cursor-pointer"
                            >
                              Remove Image
                            </button>
                          </div>
                        ) : (
                          <div className="w-full text-center py-2 flex flex-col items-center justify-center space-y-2">
                            <span className="text-[10px] text-slate-400 block font-medium">
                              {backImageLoading ? 'Uploading...' : 'Select Back ID Image'}
                            </span>
                            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 rounded-lg text-[10px] font-semibold text-white cursor-pointer transition-colors">
                              <Upload className="w-3 h-3 text-blue-500" />
                              <span>Upload File</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    handleFileUpload(e.target.files[0], 'documents', setBackImageUrl, setBackImageLoading);
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-450 mb-1">Customer Photo (Passport Size)</label>
                    <div className="relative flex flex-col items-center justify-center border border-dashed border-slate-800 bg-slate-950/40 rounded-xl p-3 hover:border-slate-700 transition-colors">
                      {photoUrl ? (
                        <div className="w-full space-y-2 text-center flex flex-col items-center">
                          <img
                            src={photoUrl.startsWith('/') ? `${getBackendUrl()}${photoUrl}` : photoUrl}
                            alt="Customer Photo"
                            className="h-20 w-20 rounded-full object-cover border border-slate-805 cursor-zoom-in hover:opacity-90 transition-opacity"
                            onClick={() => setPreviewImage(photoUrl.startsWith('/') ? `${getBackendUrl()}${photoUrl}` : photoUrl)}
                          />
                          <button
                            type="button"
                            onClick={() => setPhotoUrl('')}
                            className="text-[10px] text-rose-400 hover:text-rose-355 transition-colors font-medium cursor-pointer"
                          >
                            Remove Photo
                          </button>
                        </div>
                      ) : (
                        <div className="w-full text-center py-2 flex flex-col items-center justify-center space-y-2">
                          <span className="text-[10px] text-slate-400 block font-medium">
                            {photoLoading ? 'Uploading...' : 'Select Customer Photo'}
                          </span>
                          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 rounded-lg text-[10px] font-semibold text-white cursor-pointer transition-colors">
                            <Upload className="w-3 h-3 text-blue-500" />
                            <span>Upload File</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleFileUpload(e.target.files[0], 'customers', setPhotoUrl, setPhotoLoading);
                                }
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Booking dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-450 mb-1.5">Check-In Date</label>
                    <input
                      type="date"
                      required
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
                    />
                    {editingBooking && (editingBooking.status === 'CHECKED_IN' || editingBooking.status === 'CHECKED_OUT') && (
                      <div className="mt-2.5 p-3.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl space-y-2 animate-fade-in">
                        <div className="flex justify-between items-center">
                          <label className="block text-[11px] font-semibold text-emerald-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            Actual Check-In Time
                          </label>
                          <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded">
                            {formatTime12h(`${checkInDate}T${checkInTime}`)}
                          </span>
                        </div>
                        <input
                          type="time"
                          required
                          value={checkInTime}
                          onChange={(e) => setCheckInTime(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-white outline-none transition-colors"
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-450 mb-1.5">Check-Out Date</label>
                    <input
                      type="date"
                      required
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
                    />
                    {editingBooking && editingBooking.status === 'CHECKED_OUT' && (
                      <div className="mt-2.5 p-3.5 bg-blue-500/5 border border-blue-500/10 rounded-xl space-y-2 animate-fade-in">
                        <div className="flex justify-between items-center">
                          <label className="block text-[11px] font-semibold text-blue-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            Actual Check-Out Time
                          </label>
                          <span className="text-[10px] text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded">
                            {formatTime12h(`${checkOutDate}T${checkOutTime}`)}
                          </span>
                        </div>
                        <input
                          type="time"
                          required
                          value={checkOutTime}
                          onChange={(e) => setCheckOutTime(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3 text-xs text-white outline-none transition-colors"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Room assignment & guests */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative" ref={dropdownRef}>
                    <label className="block text-xs font-semibold text-slate-450 mb-1.5">Assign Rooms</label>
                    <div
                      onClick={() => setRoomDropdownOpen(!roomDropdownOpen)}
                      className="w-full min-h-[44px] bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none cursor-pointer flex items-center justify-between flex-wrap gap-1.5"
                    >
                      <div className="flex flex-wrap gap-1.5">
                        {selectedRoomIds.length > 0 ? (
                          selectedRoomIds.map((id) => {
                            const room = selectRooms.find((r) => r.id === id);
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center px-2 py-0.5 rounded bg-blue-600/20 border border-blue-500/30 text-xs font-semibold text-blue-300"
                              >
                                Room {room?.roomNumber || id}
                                {!editingBooking && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedRoomIds(selectedRoomIds.filter((x) => x !== id));
                                    }}
                                    className="ml-1 text-blue-400 hover:text-blue-200 focus:outline-none"
                                  >
                                    &times;
                                  </button>
                                )}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-slate-500 text-sm">Select Rooms...</span>
                        )}
                      </div>
                      <span className="text-slate-400 text-xs">&#9662;</span>
                    </div>
                    {roomDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-[99] bg-slate-950 border border-slate-850 rounded-xl shadow-2xl max-h-60 overflow-y-auto p-2 space-y-1">
                        {editingBooking ? (
                          selectRooms.map((room) => {
                            const isSelected = selectedRoomIds.includes(room.id);
                            return (
                              <label
                                key={room.id}
                                className="flex items-center space-x-2.5 p-2 rounded-lg hover:bg-slate-900 cursor-pointer text-slate-350 hover:text-white transition-colors"
                              >
                                <input
                                  type="radio"
                                  name="single-room-select"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelectedRoomIds([room.id]);
                                    setRoomDropdownOpen(false);
                                  }}
                                  className="w-4 h-4 rounded-full border-slate-800 bg-slate-950 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium">
                                  Room {room.roomNumber} ({room.roomType}) {(room as any).status ? `[${(room as any).status}]` : ''}
                                </span>
                              </label>
                            );
                          })
                        ) : selectRooms.length > 0 ? (
                          selectRooms.map((room) => {
                            const isSelected = selectedRoomIds.includes(room.id);
                            return (
                              <label
                                key={room.id}
                                className="flex items-center space-x-2.5 p-2 rounded-lg hover:bg-slate-900 cursor-pointer text-slate-350 hover:text-white transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    if (isSelected) {
                                      setSelectedRoomIds(selectedRoomIds.filter((x) => x !== room.id));
                                    } else {
                                      setSelectedRoomIds([...selectedRoomIds, room.id]);
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs font-medium">
                                  Room {room.roomNumber} ({room.roomType})
                                </span>
                              </label>
                            );
                          })
                        ) : (
                          <div className="p-2 text-xs text-slate-500 text-center">No available rooms</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-450 mb-1.5">Number of Guests</label>
                    <input
                      type="number"
                      min={1}
                      value={numberOfGuests}
                      onChange={(e) => setNumberOfGuests(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
                    />
                  </div>
                </div>

                {/* Financial values & status */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-450 mb-1.5">Stay Cost/Night (₹)</label>
                    <input
                      type="number"
                      required
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-450 mb-1.5">Advance Paid (₹)</label>
                    <input
                      type="number"
                      value={advancePayment}
                      onChange={(e) => setAdvancePayment(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-450 mb-1.5">Reservation Status</label>
                    <select
                      disabled={true}
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 disabled:opacity-70 disabled:bg-slate-955 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
                    >
                      <option value="CONFIRMED">Booked</option>
                      <option value="CHECKED_IN">Checked In</option>
                      <option value="CHECKED_OUT">Checked Out</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>
                  </div>
                </div>

                {/* Stay Notes */}
                <div>
                  <label className="block text-xs font-semibold text-slate-450 mb-1.5">Stay / Reservation Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special requests or instructions..."
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-slate-200 font-semibold rounded-xl text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-blue-500/10 transition-colors cursor-pointer"
                >
                  {editingBooking ? 'Save Changes' : 'Confirm Reservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {previewImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-350 hover:text-white rounded-full transition-all shadow-md cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage}
              alt="Fullscreen Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-slate-800 shadow-2xl animate-scale-in"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Bookings;
