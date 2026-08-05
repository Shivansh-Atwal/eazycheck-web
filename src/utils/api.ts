import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { db } from '../db/db';
import { enqueueOperation, applyOptimisticUpdate } from '../db/offlineQueue';

export const getBackendUrl = (): string => {
  const envApiUrl = import.meta.env.VITE_API_URL || 'https://checkin-backend-70km.onrender.com/api';
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      try {
        const url = new URL(envApiUrl);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          url.hostname = hostname;
        }
        return url.origin;
      } catch (e) {
        console.error('Failed to parse VITE_API_URL:', e);
      }
    }
  }
  return envApiUrl.replace(/\/api$/, '').replace(/\/api\/$/, '');
};

const getQueryParam = (url: string, key: string): string => {
  try {
    const params = new URLSearchParams(url.split('?')[1] || '');
    return (params.get(key) || '').trim().toLowerCase();
  } catch {
    return '';
  }
};

const includesQuery = (values: Array<unknown>, query: string): boolean => {
  if (!query) return true;
  return values
    .filter((value) => value !== undefined && value !== null)
    .some((value) => String(value).toLowerCase().includes(query));
};

const calculateBednights = (checkInTime?: string | null, checkOutTime?: string | null): number => {
  if (!checkInTime) return 0;
  const start = new Date(checkInTime).getTime();
  const end = checkOutTime ? new Date(checkOutTime).getTime() : Date.now();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 1;
  return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
};

const buildLocalStayRecords = async () => {
  const [checkins, customers, rooms] = await Promise.all([
    db.checkins.toArray(),
    db.customers.toArray(),
    db.rooms.toArray(),
  ]);

  const customersById = new Map(customers.map((customer: any) => [customer.id, customer]));
  const roomsById = new Map(rooms.map((room: any) => [room.id, room]));

  return checkins
    .map((checkin: any) => {
      const customer: any = customersById.get(checkin.customerId) || {};
      const room: any = roomsById.get(checkin.roomId) || {};
      const document = customer.documents?.[0] || checkin.document || {};
      const completeAddress = [
        customer.address,
        customer.city,
        customer.state,
        customer.pincode,
        customer.country,
      ].filter(Boolean).join(', ');

      return {
        id: checkin.id,
        checkInTime: checkin.checkInTime,
        actualCheckOutTime: checkin.actualCheckOutTime || null,
        status: checkin.status,
        customerName: customer.fullName || checkin.customerName || 'N/A',
        mobileNumber: customer.mobileNumber || checkin.mobileNumber || 'N/A',
        completeAddress: completeAddress || customer.address || checkin.address || 'N/A',
        idCardType: document.idType || checkin.idCardType || 'N/A',
        idCardNumber: document.idNumber || checkin.idCardNumber || 'N/A',
        state: customer.state || checkin.state || 'N/A',
        nationality: customer.country || checkin.country || checkin.nationality || 'N/A',
        roomNumber: room.roomNumber || checkin.roomNumber || 'N/A',
        roomPrice: Number(checkin.pricePerNight || checkin.roomPrice || 0),
        numberOfGuests: Number(checkin.numberOfGuests || 0),
        bednights: calculateBednights(checkin.checkInTime, checkin.actualCheckOutTime),
        registrationNumber: checkin.registrationNumber || 'N/A',
      };
    })
    .sort((a, b) => new Date(b.checkInTime || 0).getTime() - new Date(a.checkInTime || 0).getTime());
};

const buildLocalActiveCheckins = async () => {
  const [checkins, customers, rooms] = await Promise.all([
    db.checkins.where('status').equals('ACTIVE').toArray(),
    db.customers.toArray(),
    db.rooms.toArray(),
  ]);

  const customersById = new Map(customers.map((customer: any) => [customer.id, customer]));
  const roomsById = new Map(rooms.map((room: any) => [room.id, room]));

  return checkins.map((checkin: any) => ({
    ...checkin,
    customer: customersById.get(checkin.customerId) || {
      fullName: checkin.customerName || 'Offline Guest',
      mobileNumber: checkin.mobileNumber || '',
    },
    room: roomsById.get(checkin.roomId) || {
      roomNumber: checkin.roomNumber || 'N/A',
      roomType: checkin.roomType || 'Room',
    },
  }));
};

const buildLocalCheckoutPreview = async (url: string) => {
  const cleanUrl = url.split('?')[0];
  const checkInId = cleanUrl.split('/').pop() || '';
  const params = new URLSearchParams(url.split('?')[1] || '');
  const checkoutTime =
    params.get('checkoutTimeISO') ||
    (params.get('checkoutDate') && params.get('checkoutTime')
      ? new Date(`${params.get('checkoutDate')}T${params.get('checkoutTime')}`).toISOString()
      : new Date().toISOString());

  const [checkin, customers, rooms] = await Promise.all([
    db.checkins.get(checkInId),
    db.customers.toArray(),
    db.rooms.toArray(),
  ]);

  if (!checkin) {
    return {
      checkIn: null,
      calculations: {
        nights: 0,
        roomCharges: 0,
        additionalCharges: 0,
        subtotal: 0,
        taxAmount: 0,
        finalAmount: 0,
        advancePaid: 0,
        stayDetails: [],
      },
    };
  }

  const checkinAny: any = checkin;
  const customersById = new Map(customers.map((customer: any) => [customer.id, customer]));
  const roomsById = new Map(rooms.map((room: any) => [room.id, room]));
  const customer = customersById.get(checkin.customerId) || {
    fullName: checkinAny.customerName || 'Offline Guest',
    mobileNumber: checkinAny.mobileNumber || '',
  };
  const room = roomsById.get(checkin.roomId) || {
    roomNumber: checkinAny.roomNumber || 'N/A',
    roomType: checkinAny.roomType || 'Room',
  };
  const nights = calculateBednights(checkin.checkInTime, checkoutTime);
  const roomCharges = Number(checkin.pricePerNight || 0) * nights;
  const additionalCharges = Number(params.get('additionalCharges') || 0);
  const discount = Number(params.get('discount') || 0);
  const taxRate = Number(params.get('taxRate') || 0);
  const subtotal = Math.max(0, roomCharges + additionalCharges - discount);
  const taxAmount = subtotal * taxRate;
  const finalAmount = subtotal + taxAmount;

  return {
    checkIn: {
      ...checkin,
      customer,
      room,
    },
    calculations: {
      nights,
      roomCharges,
      additionalCharges,
      discount,
      subtotal,
      taxAmount,
      finalAmount,
      advancePaid: Number(checkin.advancePaid || 0),
      stayDetails: [
        {
          roomNumber: room.roomNumber,
          roomType: room.roomType,
          pricePerNight: Number(checkin.pricePerNight || 0),
          checkInTime: checkin.checkInTime,
          extraCharges: [],
        },
      ],
    },
  };
};

const buildLocalBookings = async (query: string) => {
  const [bookings, customers, rooms, checkins] = await Promise.all([
    db.bookings.toArray(),
    db.customers.toArray(),
    db.rooms.toArray(),
    db.checkins.toArray(),
  ]);

  const customersById = new Map(customers.map((customer: any) => [customer.id, customer]));
  const roomsById = new Map(rooms.map((room: any) => [room.id, room]));
  const checkinsByBookingId = new Map(
    checkins
      .filter((checkin: any) => checkin.bookingId)
      .map((checkin: any) => [checkin.bookingId, checkin])
  );

  return bookings
    .map((booking: any) => {
      const customer: any = customersById.get(booking.customerId) || {};
      const room: any = roomsById.get(booking.roomId) || {};
      const checkInRecord = checkinsByBookingId.get(booking.id) || null;

      return {
        ...booking,
        customer,
        room,
        checkInRecord,
        registrationNumber: booking.registrationNumber || (checkInRecord as any)?.registrationNumber,
      };
    })
    .filter((booking: any) => includesQuery([
      booking.bookingNumber,
      booking.registrationNumber,
      booking.customer?.fullName,
      booking.customer?.mobileNumber,
      booking.room?.roomNumber,
      booking.status,
    ], query));
};

const searchLocalCustomers = async (query: string) => {
  const customers = await db.customers.toArray();
  return customers.filter((customer: any) => {
    const document = customer.documents?.[0] || {};
    return includesQuery([
      customer.fullName,
      customer.mobileNumber,
      customer.alternateNumber,
      customer.email,
      customer.address,
      customer.city,
      customer.state,
      customer.country,
      customer.pincode,
      document.idType,
      document.idNumber,
    ], query);
  });
};

const resolveLocalGet = async (url: string): Promise<any> => {
  const cleanUrl = url.split('?')[0];
  const query = getQueryParam(url, 'q');

  if (cleanUrl.endsWith('/admin/reports')) {
    return { detailedRecords: await buildLocalStayRecords() };
  }
  if (cleanUrl.endsWith('/rooms')) {
    const status = getQueryParam(url, 'status');
    const rooms = await db.rooms.toArray();
    return status ? rooms.filter((room) => room.status?.toLowerCase() === status) : rooms;
  }
  if (cleanUrl.includes('/rooms/')) {
    const id = cleanUrl.split('/').pop() || '';
    return await db.rooms.get(id);
  }
  if (cleanUrl.endsWith('/stay/checkins')) {
    return await buildLocalActiveCheckins();
  }
  if (cleanUrl.includes('/stay/checkout/preview/')) {
    return await buildLocalCheckoutPreview(url);
  }
  if (cleanUrl.endsWith('/customers/search')) {
    return await searchLocalCustomers(query);
  }
  if (cleanUrl.endsWith('/customers')) {
    return await searchLocalCustomers(query);
  }
  if (cleanUrl.includes('/customers/')) {
    const id = cleanUrl.split('/').pop() || '';
    return await db.customers.get(id);
  }
  if (cleanUrl.endsWith('/bookings')) {
    return await buildLocalBookings(query);
  }
  if (cleanUrl.includes('/bookings/')) {
    const id = cleanUrl.split('/').pop() || '';
    return await db.bookings.get(id);
  }
  if (cleanUrl.endsWith('/checkins') || cleanUrl.endsWith('/check-in')) {
    return await db.checkins.toArray();
  }
  if (cleanUrl.includes('/checkins/') || cleanUrl.includes('/check-in/')) {
    const id = cleanUrl.split('/').pop() || '';
    return await db.checkins.get(id);
  }
  if (cleanUrl.endsWith('/inventory')) {
    return await db.inventory.toArray();
  }
  if (cleanUrl.endsWith('/auditlogs') || cleanUrl.endsWith('/logs')) {
    return await db.auditlogs.toArray();
  }

  return [];
};

const api = axios.create({
  baseURL: `${getBackendUrl()}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<string> | null = null;

// Inject Headers, handle proactive silent token refreshes, and intercept offline state queries
api.interceptors.request.use(
  async (config) => {
    const tenantId = localStorage.getItem('tenantId') || 'public';
    if (config.headers) {
      config.headers['X-Tenant-Id'] = tenantId;
    }

    let token = useAuthStore.getState().token;
    const refreshToken = useAuthStore.getState().refreshToken;

    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          window.atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(jsonPayload);

        // Proactively refresh if token expires within 30 seconds
        if (payload.exp && payload.exp * 1000 < Date.now() + 30 * 1000) {
          if (refreshToken) {
            if (!refreshPromise) {
              refreshPromise = (async () => {
                try {
                  const tenantId = localStorage.getItem('tenantId') || 'public';
                  const refreshUrl = `${getBackendUrl()}/api/auth/refresh`;
                  const res = await axios.post(refreshUrl, { refreshToken }, {
                    headers: { 'X-Tenant-Id': tenantId }
                  });
                  if (res.data && res.data.success) {
                    const newAccessToken = res.data.data.accessToken;
                    const user = useAuthStore.getState().user;
                    if (user) {
                      useAuthStore.getState().login(user, newAccessToken, refreshToken);
                    }
                    return newAccessToken;
                  }
                  throw new Error('Proactive refresh failed');
                } catch (err) {
                  useAuthStore.getState().logout();
                  window.location.href = '/login';
                  throw err;
                } finally {
                  refreshPromise = null;
                }
              })();
            }
            token = await refreshPromise;
          }
        }
      } catch (e) {
        console.error('Failed to parse or proactively refresh token:', e);
      }
    }

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Intercept requests if offline
    const isOnline = navigator.onLine;
    if (!isOnline) {
      const { url, method, data } = config;
      const cleanUrl = url || '';

      if (method === 'get' || method === 'GET') {
        console.log(`[Offline API] Mocking GET from IndexedDB cache: ${cleanUrl}`);
        const localData = await resolveLocalGet(cleanUrl);
        config.adapter = async () => {
          return {
            data: { success: true, data: localData },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          };
        };
      } else {
        console.log(`[Offline API] Mocking Mutation to Sync Queue: ${method} ${cleanUrl}`);
        const uniqueId = 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        let opType: 'CREATE' | 'UPDATE' | 'DELETE' = 'CREATE';
        if (method === 'put' || method === 'PUT') opType = 'UPDATE';
        if (method === 'delete' || method === 'DELETE') opType = 'DELETE';

        await enqueueOperation(opType, cleanUrl, method?.toUpperCase() as any, data, uniqueId);
        await applyOptimisticUpdate({
          operationType: opType,
          endpoint: cleanUrl,
          method: method?.toUpperCase() as any,
          payload: data,
          uniqueSyncId: uniqueId,
        });

        config.adapter = async () => {
          return {
            data: { success: true, message: 'Offline request enqueued.', data: { id: uniqueId, ...data } },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          };
        };
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Catch 401 Session expirations and refresh tokens silently (Reactive Fallback)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthRoute = originalRequest.url && (
      originalRequest.url.includes('/auth/login') ||
      originalRequest.url.includes('/auth/register-tenant') ||
      originalRequest.url.includes('/auth/refresh')
    );

    if (error.response && error.response.status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (!originalRequest.headers) {
              originalRequest.headers = {};
            }
            originalRequest.headers.Authorization = `Bearer ${token}`;
            originalRequest._retry = true;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const tenantId = localStorage.getItem('tenantId') || 'public';
          const refreshUrl = `${getBackendUrl()}/api/auth/refresh`;
          const res = await axios.post(refreshUrl, { refreshToken }, {
            headers: { 'X-Tenant-Id': tenantId }
          });

          if (res.data && res.data.success) {
            const newAccessToken = res.data.data.accessToken;
            const user = useAuthStore.getState().user;

            if (user) {
              useAuthStore.getState().login(user, newAccessToken, refreshToken);
            }

            processQueue(null, newAccessToken);
            isRefreshing = false;

            if (!originalRequest.headers) {
              originalRequest.headers = {};
            }
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          processQueue(refreshError, null);
          isRefreshing = false;
          useAuthStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      } else {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
