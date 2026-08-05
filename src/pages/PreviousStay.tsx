import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getBackendUrl } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckSquare, Clock, Calendar, ShieldAlert, Loader2, Camera, Upload, X, RotateCw } from 'lucide-react';
import citiesData from '../utils/cities.json';

const indianStates = Array.from(new Set(citiesData.map((c: any) => c.state))).sort();

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

const PreviousStay: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
      console.error('Failed to fetch customer suggestions:', err);
    }
  };

  const handleSelectCustomer = (cust: any) => {
    setCustomerId(cust.id);
    setCustomerName(cust.fullName);
    setMobileNumber(cust.mobileNumber);
    setAddress(cust.address || '');
    setCity(cust.city || '');
    setState(cust.state || '');
    setCountry(cust.country || 'Indian');
    setPincode(cust.pincode || '');

    if (cust.documents && cust.documents.length > 0) {
      const doc = cust.documents[0];
      setIdType(doc.idType || 'Aadhaar Card');
      setIdNumber(doc.idNumber || '');
      setFrontImageUrl(doc.frontImageUrl || '');
      setBackImageUrl(doc.backImageUrl || '');
      setPhotoUrl(doc.customerPhotoUrl || '');
    }
    setShowSuggestions(false);
  };

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('Indian');
  const [pincode, setPincode] = useState('');

  const [idType, setIdType] = useState('Aadhaar Card');
  const [idNumber, setIdNumber] = useState('');
  const [frontImageUrl, setFrontImageUrl] = useState('');
  const [backImageUrl, setBackImageUrl] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [frontImageLoading, setFrontImageLoading] = useState(false);
  const [backImageLoading, setBackImageLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [roomDropdownOpen, setRoomDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [numberOfGuests, setNumberOfGuests] = useState(1);

  const [arrivalDate, setArrivalDate] = useState('');
  const [arrivalTime, setArrivalTime] = useState('12:00');
  const [checkoutDate, setCheckoutDate] = useState('');
  const [checkoutTime, setCheckoutTime] = useState('11:00');

  const [priceCost, setPriceCost] = useState(1000);
  const [extraBedsCount, setExtraBedsCount] = useState(0);
  const [extraBedPrice, setExtraBedPrice] = useState(0);
  const [roomPrices, setRoomPrices] = useState<{ [roomId: string]: number }>({});
  const sumOfRoomPrices = selectedRoomIds.length > 0
    ? selectedRoomIds.reduce((sum, id) => sum + (roomPrices[id] !== undefined ? roomPrices[id] : priceCost), 0)
    : priceCost;

  const [advancePaid, setAdvancePaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [registrationNumber, setRegistrationNumber] = useState('');

  // Camera states
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraActiveTarget, setCameraActiveTarget] = useState<{
    type: 'documents' | 'customers';
    setUrl: (url: string) => void;
    setLoad: (val: boolean) => void;
    label: string;
  } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRoomDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch all rooms (for historical record we list all rooms, not just AVAILABLE ones)
  const { data: roomsRes } = useQuery({
    queryKey: ['rooms-all-previous-stay'],
    queryFn: () => api.get('/rooms').then((res) => res.data),
  });

  const rooms: Room[] = roomsRes?.data || [];

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

  // Next registration number lookup
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
    fetchNextRegNumber();
  }, []);

  const getRoomNumber = (id: string) => {
    const r = rooms.find((x) => x.id === id);
    return r ? r.roomNumber : 'Prefilled';
  };

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

  // Camera API integration
  const openCamera = async (
    type: 'documents' | 'customers',
    setUrl: (url: string) => void,
    setLoad: (load: boolean) => void,
    label: string
  ) => {
    setCameraActiveTarget({ type, setUrl, setLoad, label });
    setCameraOpen(true);
    setCapturedPhoto(null);
    setCameraError(null);

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoIn = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(videoIn);
      if (videoIn.length > 0) {
        const defaultDev = videoIn.find((d) => d.label.toLowerCase().includes('back')) || videoIn[0];
        setSelectedCameraId(defaultDev.deviceId);
        await startCamera(defaultDev.deviceId);
      } else {
        setCameraError('No video camera devices found.');
      }
    } catch (err) {
      setCameraError('Permission to access camera was denied.');
    }
  };

  const startCamera = async (deviceId: string) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      // Fallback if exact constraints fail
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (inner) {
        setCameraError('Failed to initialize webcam.');
      }
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCameraActiveTarget(null);
    setCapturedPhoto(null);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedPhoto(dataUrl);
      }
    }
  };

  const confirmCapturedPhoto = async () => {
    if (capturedPhoto && cameraActiveTarget) {
      const { type, setUrl, setLoad } = cameraActiveTarget;
      closeCamera();
      setLoad(true);

      try {
        const response = await fetch(capturedPhoto);
        const blob = await response.blob();
        const file = new File([blob], `${type}-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        await handleFileUpload(file, type, setUrl, setLoad);
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

  const createStayMutation = useMutation({
    mutationFn: (payload: any) => api.post('/stay/checkin/previous', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['payment-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      navigate('/records');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to add historical stay record.');
      setLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedRoomIds.length === 0) {
      setError('Please allocate at least one room.');
      return;
    }

    const checkInTimeObj = new Date(`${arrivalDate}T${arrivalTime}`);
    const checkOutTimeObj = new Date(`${checkoutDate}T${checkoutTime}`);

    if (checkOutTimeObj.getTime() <= checkInTimeObj.getTime()) {
      setError('Check-out date and time must be after check-in date and time.');
      return;
    }

    setLoading(true);
    setError(null);

    const diffMs = checkOutTimeObj.getTime() - checkInTimeObj.getTime();
    const nights = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    let totalEstimate = 0;
    const totalExtraBedsCost = Number(extraBedsCount) * Number(extraBedPrice);
    selectedRoomIds.forEach((id) => {
      const pr = roomPrices[id] !== undefined ? roomPrices[id] : priceCost;
      totalEstimate += pr * nights;
    });
    totalEstimate += totalExtraBedsCost * nights;

    const payload: any = {
      customerId,
      customerName: (customerName || '').toUpperCase(),
      mobileNumber,
      numberOfGuests: Number(numberOfGuests),
      arrivalDate,
      arrivalTime,
      checkoutDate,
      checkoutTime,
      advancePaid: Number(advancePaid),
      remainingAmount: Math.max(0, totalEstimate - advancePaid),
      paymentMethod,
      registrationNumber: (registrationNumber || '').toUpperCase(),
      pricePerNight: Number(priceCost),
      roomPrices,
      extraBedsCount: Number(extraBedsCount),
      extraBedPrice: Number(extraBedPrice),
      pincode: (pincode || '').toUpperCase(),
      state: (state || '').toUpperCase(),
      country: (country || '').toUpperCase(),
      address: (address || '').toUpperCase(),
      city: (city || '').toUpperCase(),
      roomIds: selectedRoomIds,
      document: {
        idType: (idType || '').toUpperCase(),
        idNumber: (idNumber || '').toUpperCase(),
        frontImageUrl,
        backImageUrl,
        customerPhotoUrl: photoUrl,
      },
    };

    createStayMutation.mutate(payload);
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/records')}
          className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-350 hover:text-white rounded-xl transition-all cursor-pointer shadow-md"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-100 flex items-center">
            <CheckSquare className="w-5.5 h-5.5 text-blue-500 mr-2 shrink-0" />
            Add Missed Stay Record
          </h2>
          <p className="text-xs text-slate-450 mt-0.5">Manually record completed past check-ins and payments</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs rounded-xl flex items-start animate-shake">
          <ShieldAlert className="w-5 h-5 mr-3 mt-0.5 shrink-0" />
          <p className="font-semibold leading-relaxed">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
        {/* Registration Number at the top */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-slate-800/60">
          <div>
            <label className="block text-xs font-semibold text-slate-450 mb-1.5">Registration Number</label>
            <input
              type="text"
              required
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none font-mono"
            />
          </div>
        </div>
        {/* Customer Profile Section */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Guest Profile Search / Creation</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
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
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Address details */}
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
                list="cities-datalist-previous"
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
              <datalist id="cities-datalist-previous">
                {filteredCities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-450 mb-1.5">State</label>
              <input
                type="text"
                list="states-datalist-previous"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Maharashtra"
                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
              />
              <datalist id="states-datalist-previous">
                {indianStates.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
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

        {/* ID type and uploads */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/60 pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-450 mb-1.5">Government ID Type</label>
            <select
              value={idType}
              onChange={(e) => setIdType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none cursor-pointer"
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

        {/* Document Images */}
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
                    className="text-xs text-rose-400 hover:text-rose-350 transition-colors font-medium cursor-pointer"
                  >
                    Remove Image
                  </button>
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
                            handleFileUpload(e.target.files[0], 'documents', setFrontImageUrl, setFrontImageLoading);
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => openCamera('documents', setFrontImageUrl, setFrontImageLoading, 'ID Front Image')}
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
                    className="text-xs text-rose-400 hover:text-rose-350 transition-colors font-medium cursor-pointer"
                  >
                    Remove Image
                  </button>
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
                            handleFileUpload(e.target.files[0], 'documents', setBackImageUrl, setBackImageLoading);
                          }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => openCamera('documents', setBackImageUrl, setBackImageLoading, 'ID Back Image')}
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

        {/* Customer Photo */}
        <div className="grid grid-cols-1 gap-4 pt-2 border-b border-slate-800/60 pb-6">
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
                    className="text-xs text-rose-400 hover:text-rose-350 transition-colors font-medium block mx-auto cursor-pointer"
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

        {/* Room Allocations & Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <span className="text-slate-550 text-sm">Select Rooms...</span>
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
                          className="w-4 h-4 rounded border-slate-800 bg-slate-950 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-xs font-medium">
                          Room {room.roomNumber} ({room.roomType})
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <div className="p-2 text-xs text-slate-500 text-center">No rooms configured</div>
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
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none font-mono"
            />
          </div>
        </div>

        {/* Arrival Date and Time */}
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

        {/* Check-Out Date and Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/60 pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-450 mb-1.5 flex items-center">
              <Calendar className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
              Check-Out Date
            </label>
            <input
              type="date"
              required
              value={checkoutDate}
              onChange={(e) => setCheckoutDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-450 mb-1.5 flex items-center">
              <Clock className="w-3.5 h-3.5 text-slate-500 mr-1.5" />
              Check-Out Time
            </label>
            <input
              type="time"
              required
              value={checkoutTime}
              onChange={(e) => setCheckoutTime(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
            />
          </div>
        </div>

        {/* Extra Bed Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800/60 pt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-450 mb-1.5">Extra Beds Quantity</label>
            <input
              type="number"
              min="0"
              value={extraBedsCount}
              onChange={(e) => setExtraBedsCount(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-450 mb-1.5">Price per Extra Bed (₹)</label>
            <input
              type="number"
              min="0"
              value={extraBedPrice}
              onChange={(e) => setExtraBedPrice(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none font-mono"
            />
          </div>
        </div>

        {/* Financial info */}
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

        {/*billing summary*/}
        <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl space-y-2 mt-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Billing Summary / Night</h4>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Total Room Charges / Night:</span>
            <span className="font-mono text-white font-semibold">₹{sumOfRoomPrices}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">Extra Beds Cost / Night:</span>
            <span className="font-mono text-white font-semibold">₹{extraBedsCount * extraBedPrice}</span>
          </div>
          <div className="flex justify-between items-center border-t border-slate-800/80 pt-2 text-sm font-bold">
            <span className="text-blue-400">Total Rate / Night:</span>
            <span className="font-mono text-white">₹{sumOfRoomPrices + (extraBedsCount * extraBedPrice)}</span>
          </div>
        </div>


        {/* Form Submit */}
        <div className="flex justify-end pt-4 border-t border-slate-800 mt-6">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/10 text-xs transition-colors cursor-pointer flex items-center disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Recording Stays...
              </>
            ) : (
              'Save Stay Record & Invoice'
            )}
          </button>
        </div>
      </form>

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
                  <div className="absolute inset-4 border border-dashed border-white/30 rounded-lg pointer-events-none flex items-center justify-center">
                    <span className="text-[9px] bg-slate-950/80 px-2 py-0.5 rounded text-slate-350 tracking-wider uppercase font-black">
                      Align document borders
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Footer Control panel */}
            <div className="p-4 bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-3">
              {capturedPhoto ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCapturedPhoto(null)}
                    className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-755 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={confirmCapturedPhoto}
                    className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Use Photo
                  </button>
                </>
              ) : (
                <>
                  {videoDevices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const curIdx = videoDevices.findIndex((d) => d.deviceId === selectedCameraId);
                        const nextIdx = (curIdx + 1) % videoDevices.length;
                        switchCamera(videoDevices[nextIdx].deviceId);
                      }}
                      className="p-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-white border border-slate-800 transition-colors cursor-pointer"
                      title="Switch Camera"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={!!cameraError}
                    className="flex-grow py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Capture Snapshot</span>
                  </button>
                </>
              )}
            </div>
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

export default PreviousStay;
