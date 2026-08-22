import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getBackendUrl } from '../utils/api';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckSquare, Clock, Calendar, ShieldAlert, Loader2, Camera, Upload, X, RotateCw, Flashlight } from 'lucide-react';
import citiesData from '../utils/cities.json';
import { INDIAN_STATES_AND_UTS as indianStates } from '@core/constants';

interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
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

const CheckIn: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [bookingId, setBookingId] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
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
    setCountry(customer.country || 'Indian');
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

  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRoomDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLocalDateString = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [numberOfGuests, setNumberOfGuests] = useState(1);
  const [arrivalDate, setArrivalDate] = useState(getLocalDateString(new Date()));
  const [arrivalTime, setArrivalTime] = useState(new Date().toTimeString().slice(0, 5));
  const [advancePaid, setAdvancePaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [idType, setIdType] = useState('Aadhaar Card');
  const [idNumber, setIdNumber] = useState('');
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

  const [country, setCountry] = useState('Indian'); // Nationality
  const [pincode, setPincode] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');

  // Image Upload states
  const [frontImageLoading, setFrontImageLoading] = useState(false);
  const [frontImageUrl, setFrontImageUrl] = useState('');
  const [backImageLoading, setBackImageLoading] = useState(false);
  const [backImageUrl, setBackImageUrl] = useState('');
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // OCR states
  const [ocrScanningFront, setOcrScanningFront] = useState(false);
  const [ocrScanningBack, setOcrScanningBack] = useState(false);

  // Camera Modal states
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraActiveTarget, setCameraActiveTarget] = useState<{
    type: 'documents' | 'customers';
    setUrl: (url: string) => void;
    setLoading: (load: boolean) => void;
    label: string;
    side: 'front' | 'back' | 'none';
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  const startCamera = async (deviceId?: string) => {
    setCameraError(null);
    setCapturedPhoto(null);

    // Stop existing stream first
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setTorchSupported(false);
    setTorchOn(false);

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'environment' }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      const videoTrack = stream.getVideoTracks()[0] as MediaStreamTrack & {
        getCapabilities?: () => MediaTrackCapabilities & { torch?: boolean };
      };
      const capabilities = videoTrack?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      setTorchSupported(Boolean(capabilities?.torch));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Enumerate other camera devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devices.filter((d) => d.kind === 'videoinput');
      setCameraDevices(videoDevs);

      if (!deviceId && stream.getVideoTracks().length > 0) {
        const activeTrack = stream.getVideoTracks()[0];
        const activeSettings = activeTrack.getSettings();
        if (activeSettings.deviceId) {
          setSelectedCameraId(activeSettings.deviceId);
        }
      } else if (deviceId) {
        setSelectedCameraId(deviceId);
      }
    } catch (err: any) {
      console.error('Error starting camera stream:', err);
      setCameraError('Could not open camera. Please verify device permissions.');
    }
  };

  const toggleTorch = async () => {
    const track = cameraStream?.getVideoTracks()[0] as MediaStreamTrack & {
      applyConstraints?: (constraints: MediaTrackConstraints & { advanced?: Array<{ torch?: boolean }> }) => Promise<void>;
    };
    if (!track || !torchSupported) return;

    const nextTorchState = !torchOn;
    try {
      await track.applyConstraints?.({ advanced: [{ torch: nextTorchState }] });
      setTorchOn(nextTorchState);
    } catch (err) {
      console.error('Torch toggle failed:', err);
      setTorchSupported(false);
      setTorchOn(false);
    }
  };

  const openCamera = (
    type: 'documents' | 'customers',
    setUrl: (url: string) => void,
    setLoading: (load: boolean) => void,
    label: string,
    side: 'front' | 'back' | 'none' = 'none'
  ) => {
    setCameraActiveTarget({ type, setUrl, setLoading, label, side });
    setCameraOpen(true);
    setTimeout(() => {
      startCamera();
    }, 150);
  };

  const closeCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setCameraOpen(false);
    setCameraActiveTarget(null);
    setCapturedPhoto(null);
    setTorchSupported(false);
    setTorchOn(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedPhoto(dataUrl);
      }
    }
  };

  const savePhoto = async () => {
    if (capturedPhoto && cameraActiveTarget) {
      try {
        const response = await fetch(capturedPhoto);
        const blob = await response.blob();
        const file = new File([blob], `${cameraActiveTarget.label.replace(/\s+/g, '_')}_captured.jpg`, {
          type: 'image/jpeg',
        });
        handleFileUpload(file, cameraActiveTarget.type, cameraActiveTarget.setUrl, cameraActiveTarget.setLoading, cameraActiveTarget.side);
        closeCamera();
      } catch (err) {
        console.error('Error processing captured photo:', err);
        alert('Failed to process captured image.');
      }
    }
  };

  const switchCamera = (deviceId: string) => {
    setSelectedCameraId(deviceId);
    startCamera(deviceId);
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (
    file: File,
    type: 'documents' | 'customers',
    setUrl: (url: string) => void,
    setLoading: (load: boolean) => void,
    side: 'front' | 'back' | 'none' = 'none'
  ) => {
    setLoading(true);
    let uploadedUrl = '';
    
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
      
      uploadedUrl = res.data.data.fileUrl;
      setUrl(uploadedUrl); // Instantly update UI with uploaded image
      setLoading(false); // Stop image loading spinner
      
      // Fire async OCR if it's an ID side
      if (side !== 'none') {
        runAsyncOCR(fileToUpload, side);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'File upload failed.');
      setLoading(false);
    }
  };

  const runAsyncOCR = async (file: File, side: 'front' | 'back') => {
    if (side === 'front') setOcrScanningFront(true);
    else setOcrScanningBack(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('imageSide', side);
      
      const res = await api.post('/ocr/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const { data } = res.data;
      if (data) {
        if (side === 'front') {
          if (data.name && !customerName) setCustomerName(data.name);
          if (data.idNumber && !idNumber) setIdNumber(data.idNumber);
          if (data.mobileNumber && !mobileNumber) setMobileNumber(data.mobileNumber);
        } else if (side === 'back') {
          if (data.pincode && !pincode) setPincode(data.pincode);
          if (data.address && !address) setAddress(data.address);
          if (data.state && !state) setState(data.state);
        }
        console.log(`[OCR] Extracted data for ${side}:`, data);
      }
    } catch (err) {
      console.error('Async OCR Failed:', err);
    } finally {
      if (side === 'front') setOcrScanningFront(false);
      else setOcrScanningBack(false);
    }
  };

  // Pre-fill triggers
  useEffect(() => {
    if (location.state) {
      if (location.state.bookingId) {
        setBookingId(location.state.bookingId);
      }
      if (location.state.roomId) {
        setSelectedRoomIds([location.state.roomId]);
      }
    }
  }, [location.state]);

  // Fetch booking details if converting
  const { data: bookingRes } = useQuery({
    queryKey: ['booking-prefill', bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}`).then((res) => res.data),
    enabled: !!bookingId,
  });

  // Fetch Available Rooms
  const { data: roomsRes } = useQuery({
    queryKey: ['available-rooms-checkin'],
    queryFn: () => api.get('/rooms?status=AVAILABLE').then((res) => res.data),
  });

  const rooms: Room[] = roomsRes?.data || [];
  const bookingRoomInRooms = bookingRes?.data?.rooms?.some((br: any) => rooms.some((r) => r.id === br.id));
  const freeRoomsCount = rooms.length + (bookingId && !bookingRoomInRooms ? (bookingRes?.data?.rooms?.length || 1) : 0);

  // Pre-fill form from booking when fetched
  useEffect(() => {
    if (bookingRes?.data) {
      const b = bookingRes.data;
      setCustomerName(b.customer.fullName);
      setMobileNumber(b.customer.mobileNumber);
      setSelectedRoomIds(b.rooms?.map((r: any) => r.id) || []);
      setNumberOfGuests(b.numberOfGuests);
      setPriceCost(b.price);
      setAdvancePaid(0); // Additional paid on arrival

      // Prefill address details if they exist
      setAddress(b.customer.address || '');
      setCity(b.customer.city || '');
      setState(b.customer.state || '');
      setCountry(b.customer.country || 'Indian');
      setPincode(b.customer.pincode || '');

      // Prefill document details if they exist
      if (b.customer.documents && b.customer.documents.length > 0) {
        const doc = b.customer.documents[0];
        setIdType(doc.idType || 'Aadhaar Card');
        setIdNumber(doc.idNumber || '');
        setFrontImageUrl(doc.frontImageUrl || '');
        setBackImageUrl(doc.backImageUrl || '');
        setPhotoUrl(doc.customerPhotoUrl || '');
      }

      if (b.registrationNumber) {
        setRegistrationNumber(b.registrationNumber);
      }
    }
  }, [bookingRes]);

  useEffect(() => {
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

    if (!bookingId) {
      fetchNextRegNumber();
    } else if (bookingRes?.data && !bookingRes.data.registrationNumber) {
      fetchNextRegNumber();
    }
  }, [bookingId, bookingRes]);

  const [priceCost, setPriceCost] = useState(1000);
  const [roomPrices, setRoomPrices] = useState<{ [roomId: string]: number }>({});
  const sumOfRoomPrices = selectedRoomIds.length > 0
    ? selectedRoomIds.reduce((sum, id) => sum + (roomPrices[id] !== undefined ? roomPrices[id] : priceCost), 0)
    : priceCost;

  const getRoomNumber = (id: string) => {
    const r = rooms.find((x) => x.id === id);
    if (r) return r.roomNumber;
    if (bookingRes?.data?.rooms) {
      const brRoom = bookingRes.data.rooms.find((br: any) => br.id === id);
      if (brRoom) return brRoom.roomNumber;
    }
    return 'Prefilled';
  };

  useEffect(() => {
    setRoomPrices((prev) => {
      const next = { ...prev };
      let changed = false;
      selectedRoomIds.forEach((id) => {
        if (selectedRoomIds.length === 1) {
          if (next[id] !== priceCost) {
            next[id] = priceCost;
            changed = true;
          }
        } else {
          if (next[id] === undefined) {
            next[id] = priceCost;
            changed = true;
          }
        }
      });
      Object.keys(next).forEach((id) => {
        if (!selectedRoomIds.includes(id)) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [selectedRoomIds, priceCost]);

  // Submit Mutation
  const checkinMutation = useMutation({
    mutationFn: (payload: any) => {
      const endpoint = bookingId ? '/stay/checkin/booking' : '/stay/checkin/walkin';
      return api.post(endpoint, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['payment-ledger'] });
      navigate('/');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Check-in failed.');
      setLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Secondary validation block
    if (selectedRoomIds.length > freeRoomsCount) {
      setError(`Requested ${selectedRoomIds.length} rooms but only ${freeRoomsCount} rooms are currently free.`);
      return;
    }

    setLoading(true);
    setError(null);

    // Default stay calculations to 1 base night since check-out isn't scheduled
    const nights = 1;
    let totalEstimate = 0;
    selectedRoomIds.forEach((id) => {
      const pr = roomPrices[id] !== undefined ? roomPrices[id] : priceCost;
      totalEstimate += pr * nights;
    });
    const remainingAmount = Math.max(0, totalEstimate - advancePaid);

    const payload: any = {
      numberOfGuests: Number(numberOfGuests),
      arrivalDate,
      arrivalTime,
      checkInTime: new Date(`${arrivalDate}T${arrivalTime}`).toISOString(),
      advancePaid: Number(advancePaid),
      remainingAmount,
      paymentMethod,
      registrationNumber: (registrationNumber || '').toUpperCase(),
      pricePerNight: Number(priceCost),
      roomPrices,
      extraBedsCount: 0,
      extraBedPrice: 0,
    };

    if (selectedRoomIds.length > 0) {
      payload.roomIds = selectedRoomIds;
    }

    if (bookingId) {
      payload.bookingId = bookingId;
      // Send document and address details for pre-existing booking arrivals too
      payload.address = (address || '').toUpperCase();
      payload.city = (city || '').toUpperCase();
      payload.state = (state || '').toUpperCase();
      payload.country = (country || '').toUpperCase();
      payload.pincode = (pincode || '').toUpperCase();
      payload.document = {
        idType: (idType || '').toUpperCase(),
        idNumber: (idNumber || '').toUpperCase(),
        frontImageUrl: frontImageUrl || undefined,
        backImageUrl: backImageUrl || undefined,
        customerPhotoUrl: photoUrl || undefined,
      };
    } else {
      if (customerId) {
        payload.customerId = customerId;
      }
      payload.customerName = (customerName || '').toUpperCase();
      payload.mobileNumber = mobileNumber;
      payload.address = (address || '').toUpperCase();
      payload.city = (city || '').toUpperCase();
      payload.state = (state || '').toUpperCase();
      payload.country = (country || '').toUpperCase();
      payload.pincode = (pincode || '').toUpperCase();
      payload.document = {
        idType: (idType || '').toUpperCase(),
        idNumber: (idNumber || '').toUpperCase(),
        frontImageUrl: frontImageUrl || undefined,
        backImageUrl: backImageUrl || undefined,
        customerPhotoUrl: photoUrl || undefined,
      };
    }

    checkinMutation.mutate(payload);
  };

  const isOvercapacity = selectedRoomIds.length > freeRoomsCount;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Dashboard
      </button>

      {error && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-xl text-sm text-rose-200">
          {error}
        </div>
      )}

      {/* Main card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-5 flex items-center">
          <CheckSquare className="w-5 h-5 text-blue-500 mr-2.5" />
          {bookingId ? 'Booking Arrival Check-In' : 'Walk-In Customer Check-In'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-5">
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

          {/* Guest Identity */}
          {!bookingId ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-450 mb-1.5">Guest Name</label>
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
                  placeholder="e.g. SHIVANSH ATWAL"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
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
          ) : (
            <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl text-sm space-y-1">
              <span className="text-xs text-slate-500">Reserved Guest Profile</span>
              <p className="font-semibold text-white">{customerName}</p>
              <p className="text-xs text-slate-400">{mobileNumber}</p>
            </div>
          )}

          {/* Customer Address Details */}
          <div className="border-t border-slate-800/60 pt-4 space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Address Details</h4>
            <div>
              <label className="block text-xs font-semibold text-slate-450 mb-1.5">Street Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 123 Main St, Apartment 4B"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5">City</label>
                <input
                  type="text"
                  list="cities-datalist-checkin"
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
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
                />
                <datalist id="cities-datalist-checkin">
                  {filteredCities.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5">State</label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none appearance-none cursor-pointer"
                >
                  <option value="">Select State</option>
                  {indianStates.map((s: string) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5">Pincode / Zip Code</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 10001"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5">Nationality</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. Indian"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* ID upload inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/60 pt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-450 mb-1.5">Government ID Type</label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
              >
                <option value="Aadhaar Card">Aadhaar Card</option>
                <option value="Passport">Passport</option>
                <option value="Driving License">Driving License</option>
                <option value="Voter ID">Voter ID</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-450 mb-1.5">ID Number</label>
              <input
                type="text"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                placeholder="Document reference number"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
              />
            </div>
          </div>

          {/* Government ID Image Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-450 mb-1.5">ID Front Image</label>
              <div className="relative flex flex-col items-center justify-center border border-dashed border-slate-800 bg-slate-950/40 rounded-xl p-4 hover:border-slate-700 transition-colors">
                {frontImageUrl ? (
                  <div className="w-full space-y-2 text-center">
                    <img
                      src={frontImageUrl.startsWith('/') ? `${getBackendUrl()}${frontImageUrl}` : frontImageUrl}
                      alt="ID Front"
                      className="h-28 mx-auto rounded-lg object-cover border border-slate-800 cursor-zoom-in hover:opacity-90 transition-opacity"
                      onClick={() => setPreviewImage(frontImageUrl.startsWith('/') ? `${getBackendUrl()}${frontImageUrl}` : frontImageUrl)}
                    />
                    <button
                      type="button"
                      onClick={() => setFrontImageUrl('')}
                      className="text-xs text-rose-400 hover:text-rose-350 transition-colors font-medium"
                    >
                      Remove Image
                    </button>
                    {ocrScanningFront && (
                      <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-blue-400 font-medium animate-pulse">
                        <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                        Scanning ID for details...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full text-center py-4 flex flex-col items-center justify-center space-y-3">
                    <span className="text-xs text-slate-400 block font-medium">
                      {frontImageLoading ? 'Uploading Front Image...' : 'Select Source for Front ID'}
                    </span>
                    <div className="flex items-center gap-2.5">
                      <label className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 rounded-xl text-xs font-semibold text-white cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5 text-blue-500" />
                        <span>Gallery</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(e.target.files[0], 'documents', setFrontImageUrl, setFrontImageLoading, 'front');
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => openCamera('documents', setFrontImageUrl, setFrontImageLoading, 'ID Front Image', 'front')}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 rounded-xl text-xs font-semibold text-white cursor-pointer transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5 text-blue-500" />
                        <span>Camera</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-450 mb-1.5">ID Back Image</label>
              <div className="relative flex flex-col items-center justify-center border border-dashed border-slate-800 bg-slate-950/40 rounded-xl p-4 hover:border-slate-700 transition-colors">
                {backImageUrl ? (
                  <div className="w-full space-y-2 text-center">
                    <img
                      src={backImageUrl.startsWith('/') ? `${getBackendUrl()}${backImageUrl}` : backImageUrl}
                      alt="ID Back"
                      className="h-28 mx-auto rounded-lg object-cover border border-slate-800 cursor-zoom-in hover:opacity-90 transition-opacity"
                      onClick={() => setPreviewImage(backImageUrl.startsWith('/') ? `${getBackendUrl()}${backImageUrl}` : backImageUrl)}
                    />
                    <button
                      type="button"
                      onClick={() => setBackImageUrl('')}
                      className="text-xs text-rose-400 hover:text-rose-350 transition-colors font-medium"
                    >
                      Remove Image
                    </button>
                    {ocrScanningBack && (
                      <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-blue-400 font-medium animate-pulse">
                        <div className="w-3 h-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
                        Scanning Back ID for address...
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full text-center py-4 flex flex-col items-center justify-center space-y-3">
                    <span className="text-xs text-slate-400 block font-medium">
                      {backImageLoading ? 'Uploading Back Image...' : 'Select Source for Back ID'}
                    </span>
                    <div className="flex items-center gap-2.5">
                      <label className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 rounded-xl text-xs font-semibold text-white cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5 text-blue-500" />
                        <span>Gallery</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleFileUpload(e.target.files[0], 'documents', setBackImageUrl, setBackImageLoading, 'back');
                            }
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => openCamera('documents', setBackImageUrl, setBackImageLoading, 'ID Back Image', 'back')}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 rounded-xl text-xs font-semibold text-white cursor-pointer transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5 text-blue-500" />
                        <span>Camera</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Passport Photo Upload */}
          <div className="grid grid-cols-1 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-450 mb-1.5">Customer Photo (Passport Size)</label>
              <div className="relative flex flex-col items-center justify-center border border-dashed border-slate-800 bg-slate-950/40 rounded-xl p-4 hover:border-slate-700 transition-colors">
                {photoUrl ? (
                  <div className="w-full space-y-2 text-center">
                    <img
                      src={photoUrl.startsWith('/') ? `${getBackendUrl()}${photoUrl}` : photoUrl}
                      alt="Customer Photo"
                      className="h-28 w-28 mx-auto rounded-full object-cover border border-slate-800 cursor-zoom-in hover:opacity-90 transition-opacity"
                      onClick={() => setPreviewImage(photoUrl.startsWith('/') ? `${getBackendUrl()}${photoUrl}` : photoUrl)}
                    />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="text-xs text-rose-400 hover:text-rose-350 transition-colors font-medium block mx-auto"
                    >
                      Remove Photo
                    </button>
                  </div>
                ) : (
                  <div className="w-full text-center py-4 flex flex-col items-center justify-center space-y-3">
                    <span className="text-xs text-slate-400 block font-medium">
                      {photoLoading ? 'Uploading Photo...' : 'Select Source for Customer Photo'}
                    </span>
                    <div className="flex items-center gap-2.5">
                      <label className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 rounded-xl text-xs font-semibold text-white cursor-pointer transition-colors">
                        <Upload className="w-3.5 h-3.5 text-blue-500" />
                        <span>Gallery</span>
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
                      <button
                        type="button"
                        onClick={() => openCamera('customers', setPhotoUrl, setPhotoLoading, 'Customer Photo')}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 rounded-xl text-xs font-semibold text-white cursor-pointer transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5 text-blue-500" />
                        <span>Camera</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Allocation details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/60 pt-4">
            <div>
              {bookingId ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-450 mb-1.5">Room Allocation</label>
                  <div className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 px-3.5 text-sm text-slate-350 flex flex-wrap gap-1.5">
                    {selectedRoomIds.map((id) => {
                      const room = rooms.find((r) => r.id === id);
                      return (
                        <span key={id} className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-white">
                          Room {room?.roomNumber || 'Prefilled'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="relative" ref={dropdownRef}>
                  <label className="block text-xs font-semibold text-slate-450 mb-1.5">Room Allocation</label>
                  <div
                    onClick={() => setRoomDropdownOpen(!roomDropdownOpen)}
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none cursor-pointer flex items-center justify-between flex-wrap gap-1.5"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {selectedRoomIds.length > 0 ? (
                        selectedRoomIds.map((id) => {
                          const room = rooms.find((r) => r.id === id);
                          return (
                            <span
                              key={id}
                              className="inline-flex items-center px-2 py-0.5 rounded bg-blue-600/20 border border-blue-500/30 text-xs font-semibold text-blue-300"
                            >
                              Room {room?.roomNumber || id}
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
                      {rooms.length > 0 ? (
                        rooms.map((room) => {
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
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-450 mb-1.5">Number of Guests</label>
              <input
                type="number"
                min={1}
                value={numberOfGuests}
                onChange={(e) => setNumberOfGuests(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
              />
            </div>
          </div>

          {/* Rooms requested info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/60 pt-4">
            <div className="flex flex-col justify-end">
              <span className="text-xs text-slate-500 mb-1">Status of Free Rooms</span>
              <span className="text-sm font-semibold text-slate-350 px-1 py-2 font-mono">
                {freeRoomsCount} rooms are currently free
              </span>
            </div>
          </div>

          {/* Overcapacity Warnings */}
          {isOvercapacity && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-start">
              <ShieldAlert className="w-4.5 h-4.5 mr-2.5 mt-0.5 shrink-0" />
              <p>
                Cannot proceed: You requested {selectedRoomIds.length} rooms, but only {freeRoomsCount} rooms are currently free (available).
              </p>
            </div>
          )}



          {/* Arrival Date & Arrival Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/60 pt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-450 mb-1.5 flex items-center">
                <Calendar className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
                Arrival Date
              </label>
              <input
                type="date"
                required
                value={arrivalDate}
                onChange={(e) => setArrivalDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-450 mb-1.5 flex items-center">
                <Clock className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
                Arrival Time
              </label>
              <input
                type="time"
                required
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
              />
            </div>
          </div>



          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-800/60 pt-4">
            {selectedRoomIds.length <= 1 && (
              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5">Stay Cost/Night (₹)</label>
                <input
                  type="number"
                  required
                  value={priceCost}
                  onChange={(e) => setPriceCost(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none font-mono"
                />
              </div>
            )}
            <div className={selectedRoomIds.length > 1 ? "md:col-span-1" : ""}>
              <label className="block text-xs font-semibold text-slate-450 mb-1.5">Deposit Advance Paid (₹)</label>
              <input
                type="number"
                value={advancePaid}
                onChange={(e) => setAdvancePaid(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none font-mono"
              />
            </div>
            <div className={selectedRoomIds.length > 1 ? "md:col-span-2" : ""}>
              <label className="block text-xs font-semibold text-slate-450 mb-1.5">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none cursor-pointer"
              >
                <option value="Cash">Cash</option>
                <option value="UPI">UPI / QR Scan</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>
          </div>

          {/* Stay Billing Summary */}
          <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl space-y-2 mt-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Billing Summary / Night</h4>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Total Room Charges / Night:</span>
              <span className="font-mono text-white font-semibold">₹{sumOfRoomPrices}</span>
            </div>
            <div className="flex justify-between items-center border-t border-slate-800/80 pt-2 text-sm font-bold">
              <span className="text-blue-400">Total Rate / Night:</span>
              <span className="font-mono text-white">₹{sumOfRoomPrices}</span>
            </div>
          </div>

          {selectedRoomIds.length > 1 && (
            <div className="border-t border-slate-800/60 pt-4 space-y-3.5">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Custom Price per Room</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedRoomIds.map((id) => {
                  const roomNum = getRoomNumber(id);
                  return (
                    <div key={id} className="flex items-center justify-between bg-slate-950/40 p-3 border border-slate-850 rounded-xl">
                      <span className="text-xs font-semibold text-slate-300">Room {roomNum}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">₹</span>
                        <input
                          type="number"
                          required
                          min={0}
                          value={roomPrices[id] !== undefined ? roomPrices[id] : priceCost}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setRoomPrices((prev) => ({
                              ...prev,
                              [id]: val,
                            }));
                          }}
                          className="w-24 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-1 px-2 text-xs text-white outline-none text-right font-mono"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form Submit */}
          <div className="flex justify-end pt-4 border-t border-slate-800 mt-6">
            <button
              type="submit"
              disabled={loading || isOvercapacity}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/10 text-xs transition-colors cursor-pointer flex items-center disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Allocating Stays...
                </>
              ) : (
                'Confirm Arrival & Check-In'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Camera Capture Modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-500" />
                  Capture {cameraActiveTarget?.label || 'Image'}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Position the image inside the frame</p>
              </div>
              <button
                type="button"
                onClick={closeCamera}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video / Preview Body */}
            <div className="relative aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden border-b border-slate-800">
              {cameraError ? (
                <div className="p-6 text-center space-y-2">
                  <p className="text-sm text-rose-400 font-semibold">{cameraError}</p>
                  <button
                    type="button"
                    onClick={() => startCamera(selectedCameraId)}
                    className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white rounded-lg transition-colors cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : capturedPhoto ? (
                <img
                  src={capturedPhoto}
                  alt="Captured Preview"
                  className="w-full h-full object-cover animate-fade-in"
                />
              ) : (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Camera toggle Overlay if multiple devices exist */}
                  {cameraDevices.length > 1 && (
                    <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5">
                      <RotateCw className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                      <select
                        value={selectedCameraId}
                        onChange={(e) => switchCamera(e.target.value)}
                        className="bg-transparent text-[11px] text-white font-semibold outline-none cursor-pointer border-none py-0.5"
                      >
                        {cameraDevices.map((device, idx) => (
                          <option key={device.deviceId} value={device.deviceId} className="bg-slate-900 text-white text-xs">
                            {device.label || `Camera ${idx + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* Stream Starting Indicator */}
                  {!cameraStream && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 gap-2">
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      <span className="text-xs text-slate-400">Initializing Camera...</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-slate-900/50 flex items-center justify-end gap-2.5">
              {capturedPhoto ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCapturedPhoto(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                  >
                    Retake Photo
                  </button>
                  <button
                    type="button"
                    onClick={savePhoto}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white rounded-xl shadow-lg shadow-emerald-600/10 transition-colors cursor-pointer"
                  >
                    Use Photo
                  </button>
                </>
              ) : (
                <>
                  {torchSupported && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 border ${
                        torchOn
                          ? 'bg-amber-500/15 border-amber-400/40 text-amber-200 hover:bg-amber-500/25'
                          : 'bg-slate-800 border-slate-700 text-slate-350 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <Flashlight className="w-3.5 h-3.5" />
                      {torchOn ? 'Flash On' : 'Flash'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-350 hover:text-white rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={!cameraStream}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none text-xs font-semibold text-white rounded-xl shadow-lg shadow-blue-500/10 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Capture
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Hidden canvas for video captures */}
      <canvas ref={canvasRef} className="hidden" />

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

export default CheckIn;
