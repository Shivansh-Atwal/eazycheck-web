import { db, type QueuedOperation } from './db';

// Helper to generate UUIDs on the client
export const generateUUID = (): string => {
  return 'client_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
};

export const enqueueOperation = async (
  operationType: 'CREATE' | 'UPDATE' | 'DELETE',
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE',
  payload: any,
  uniqueSyncId: string
): Promise<string> => {
  let queuedPayload = payload;

  if (endpoint.startsWith('/checkouts') || endpoint.startsWith('/stay/checkout')) {
    queuedPayload = await buildCheckoutPayloadSnapshot(payload);
  }

  const id = generateUUID();
  const operation: QueuedOperation = {
    id,
    operationType,
    endpoint,
    method,
    payload: queuedPayload,
    timestamp: Date.now(),
    status: 'PENDING',
    uniqueSyncId,
  };

  await db.offlineQueue.put(operation);
  console.log(`[Offline Queue] Enqueued: ${method} ${endpoint}`, operation);
  return id;
};

const splitIsoDateTime = (value?: string | null) => {
  if (!value) return { date: undefined, time: undefined };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: undefined, time: undefined };
  return {
    date: parsed.toISOString().split('T')[0],
    time: parsed.toTimeString().slice(0, 5),
  };
};

const buildCheckoutPayloadSnapshot = async (payload: any) => {
  if (!payload?.checkInId) return payload;

  const checkin: any = await db.checkins.get(payload.checkInId);
  if (!checkin) return payload;

  const [customer, room] = await Promise.all([
    checkin.customerId ? db.customers.get(checkin.customerId) : undefined,
    checkin.roomId ? db.rooms.get(checkin.roomId) : undefined,
  ]);

  const checkInParts = splitIsoDateTime(checkin.checkInTime);

  return {
    ...payload,
    offlineHistoricalCheckout: true,
    originalCheckInId: checkin.id,
    customerId: checkin.customerId,
    customerName: (customer as any)?.fullName || checkin.customerName,
    mobileNumber: (customer as any)?.mobileNumber || checkin.mobileNumber,
    address: (customer as any)?.address || checkin.address,
    city: (customer as any)?.city || checkin.city,
    state: (customer as any)?.state || checkin.state,
    country: (customer as any)?.country || checkin.country,
    pincode: (customer as any)?.pincode || checkin.pincode,
    document: (customer as any)?.documents?.[0] || checkin.document,
    roomId: checkin.roomId,
    roomIds: checkin.roomId ? [checkin.roomId] : [],
    roomNumber: (room as any)?.roomNumber || checkin.roomNumber,
    numberOfGuests: checkin.numberOfGuests || 1,
    checkInTime: checkin.checkInTime,
    arrivalDate: payload.arrivalDate || checkInParts.date,
    arrivalTime: payload.arrivalTime || checkInParts.time,
    expectedCheckOutDate: payload.checkoutTimeISO || payload.expectedCheckOutDate,
    advancePaid: Number(checkin.advancePaid || 0),
    remainingAmount: Number(checkin.remainingAmount || 0),
    pricePerNight: Number(checkin.pricePerNight || payload.pricePerNight || 0),
    registrationNumber: checkin.registrationNumber || payload.registrationNumber,
  };
};

// Optimistically update the local IndexedDB state based on the queued operation
export const applyOptimisticUpdate = async (op: Omit<QueuedOperation, 'id' | 'timestamp' | 'status'>) => {
  const { operationType, endpoint, payload, uniqueSyncId } = op;

  try {
    if (endpoint.startsWith('/rooms')) {
      if (operationType === 'CREATE') {
        await db.rooms.put({ ...payload, id: uniqueSyncId, status: payload.status || 'AVAILABLE' });
      } else if (operationType === 'UPDATE') {
        const id = endpoint.split('/')[2] || uniqueSyncId;
        await db.rooms.update(id, payload);
      } else if (operationType === 'DELETE') {
        const id = endpoint.split('/')[2];
        await db.rooms.delete(id);
      }
    } else if (endpoint.startsWith('/customers')) {
      if (operationType === 'CREATE') {
        await db.customers.put({ ...payload, id: uniqueSyncId });
      } else if (operationType === 'UPDATE') {
        const id = endpoint.split('/')[2] || uniqueSyncId;
        await db.customers.update(id, payload);
      }
    } else if (endpoint.startsWith('/bookings')) {
      if (operationType === 'CREATE') {
        await db.bookings.put({ ...payload, id: uniqueSyncId, status: 'CONFIRMED' });
      } else if (operationType === 'UPDATE') {
        const id = endpoint.split('/')[2] || uniqueSyncId;
        await db.bookings.update(id, payload);
      } else if (operationType === 'DELETE') {
        const id = endpoint.split('/')[2];
        await db.bookings.delete(id);
      }
    } else if (
      endpoint.startsWith('/checkins') ||
      endpoint.startsWith('/check-in') ||
      endpoint.startsWith('/stay/checkin')
    ) {
      if (operationType === 'CREATE') {
        const checkInTime =
          payload.checkInTime ||
          (payload.arrivalDate && payload.arrivalTime
            ? new Date(`${payload.arrivalDate}T${payload.arrivalTime}`).toISOString()
            : new Date().toISOString());
        const roomIds: string[] = Array.isArray(payload.roomIds)
          ? payload.roomIds
          : payload.roomId
            ? [payload.roomId]
            : [];
        const customerId = payload.customerId || `${uniqueSyncId}_customer`;

        if (!payload.customerId) {
          await db.customers.put({
            id: customerId,
            fullName: payload.customerName || 'Offline Guest',
            mobileNumber: payload.mobileNumber || '',
            address: payload.address || null,
            city: payload.city || null,
            state: payload.state || null,
            country: payload.country || null,
            pincode: payload.pincode || null,
            createdAt: checkInTime,
            updatedAt: checkInTime,
          });
        }

        const checkinRows = roomIds.length > 0 ? roomIds : [''];
        for (const [index, roomId] of checkinRows.entries()) {
          const checkinId = index === 0 ? uniqueSyncId : `${uniqueSyncId}_room_${index}`;
          const roomPrice = Number(payload.roomPrices?.[roomId] || payload.pricePerNight || 0);

          await db.checkins.put({
            ...payload,
            id: checkinId,
            customerId,
            roomId,
            numberOfGuests: Number(payload.numberOfGuests || 1),
            checkInTime,
            expectedCheckOutDate: payload.expectedCheckOutDate || payload.arrivalDate || checkInTime,
            advancePaid: Number(payload.advancePaid || 0),
            remainingAmount: Number(payload.remainingAmount || 0),
            pricePerNight: roomPrice,
            status: 'ACTIVE',
            createdAt: checkInTime,
            updatedAt: checkInTime,
          });

          if (roomId) {
            await db.rooms.update(roomId, {
              status: 'OCCUPIED',
              updatedAt: checkInTime,
            });
          }
        }
      } else if (operationType === 'UPDATE') {
        const id = endpoint.split('/')[2] || uniqueSyncId;
        await db.checkins.update(id, payload);
      }
    } else if (endpoint.startsWith('/checkouts') || endpoint.startsWith('/stay/checkout')) {
      if (operationType === 'CREATE') {
        const checkoutTime =
          payload.checkoutTimeISO ||
          (payload.checkoutDate && payload.checkoutTime
            ? new Date(`${payload.checkoutDate}T${payload.checkoutTime}`).toISOString()
            : new Date().toISOString());

        await db.checkouts.put({
          ...payload,
          id: uniqueSyncId,
          checkInId: payload.checkInId,
          roomCharges: Number(payload.roomCharges || 0),
          additionalCharges: Number(payload.additionalCharges || 0),
          discount: Number(payload.discount || 0),
          taxAmount: Number(payload.taxAmount || 0),
          finalAmount: Number(payload.finalAmount || 0),
          billingStatus: 'PAID',
          createdAt: checkoutTime,
        });

        if (payload.checkInId) {
          const checkin = await db.checkins.get(payload.checkInId);
          if (checkin) {
            await db.checkins.update(payload.checkInId, {
              status: 'CHECKED_OUT',
              actualCheckOutTime: checkoutTime,
              remainingAmount: 0,
              updatedAt: checkoutTime,
            });

            if (checkin.roomId) {
              await db.rooms.update(checkin.roomId, {
                status: 'AVAILABLE',
                updatedAt: checkoutTime,
              });
            }
          }
        }
      }
    } else if (endpoint.startsWith('/payments')) {
      if (operationType === 'CREATE') {
        await db.payments.put({ ...payload, id: uniqueSyncId, paymentStatus: 'SUCCESS' });
      }
    } else if (endpoint.startsWith('/inventory')) {
      if (operationType === 'CREATE') {
        await db.inventory.put({ ...payload, id: uniqueSyncId });
      } else if (operationType === 'UPDATE') {
        const id = endpoint.split('/')[2] || uniqueSyncId;
        await db.inventory.update(id, payload);
      }
    }
    console.log(`[Offline Queue] Optimistic state updated for ${endpoint}`);
  } catch (err) {
    console.error(`[Offline Queue] Failed to apply optimistic update for ${endpoint}:`, err);
  }
};
