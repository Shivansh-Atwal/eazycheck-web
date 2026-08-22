export const DB_NAME = 'eazycheck_db';
export const DB_VERSION = 1;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'token',
  REFRESH_TOKEN: 'refreshToken',
  TENANT_ID: 'tenantId',
  USER: 'user',
  TEMP_ID_COUNTER: 'temp_id_counter',
} as const;

export const SYNC_CONFIG = {
  STABILITY_DELAY_MS: 3000,
  MAX_RETRIES: 5,
  RETRY_BASE_DELAY_MS: 2000,
  SYNC_COOLDOWN_MS: 60_000,
  API_TIMEOUT_MS: 30_000,
} as const;

export const TXT_BACKUP = {
  DIRECTORY: 'EazyCheck',
  FILENAME: 'offline_backup.txt',
} as const;

export const BOOKING_STATUS = ['Booked', 'Check In', 'Check Out'] as const;

export const SYNC_STATUS = {
  PENDING: 'Pending',
  SYNCING: 'Syncing',
  SYNCED: 'Synced',
  FAILED: 'Failed',
  CONFLICT: 'Conflict',
} as const;

export const QUEUE_OPERATIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
} as const;

export const INDIAN_STATES_AND_UTS = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi (NCT)", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];
