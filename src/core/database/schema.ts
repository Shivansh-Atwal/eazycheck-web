export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY NOT NULL,
    temp_registration_number TEXT NOT NULL,
    registration_number TEXT,
    customer_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    address TEXT DEFAULT '',
    aadhaar_number_encrypted TEXT DEFAULT '',
    booking_status TEXT NOT NULL,
    selected_rooms TEXT NOT NULL DEFAULT '[]',
    guests INTEGER NOT NULL DEFAULT 1,
    check_in_date TEXT NOT NULL,
    check_in_time TEXT NOT NULL,
    check_out_date TEXT,
    check_out_time TEXT,
    sync_status TEXT NOT NULL DEFAULT 'Pending',
    sync_error TEXT,
    backend_id TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_sync_status ON bookings(sync_status)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_is_deleted ON bookings(is_deleted)`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at)`,

  `CREATE TABLE IF NOT EXISTS room_checklist (
    room_number TEXT PRIMARY KEY NOT NULL,
    checked INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sync_queue (
    id TEXT PRIMARY KEY NOT NULL,
    operation TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at)`,

  `CREATE TABLE IF NOT EXISTS rooms_cache (
    id TEXT PRIMARY KEY NOT NULL,
    room_number TEXT NOT NULL,
    floor_number INTEGER NOT NULL DEFAULT 0,
    room_type TEXT NOT NULL DEFAULT '',
    capacity INTEGER NOT NULL DEFAULT 1,
    price_per_night REAL NOT NULL DEFAULT 0,
    amenities TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'AVAILABLE',
    cached_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_rooms_cache_number ON rooms_cache(room_number)`,

  `CREATE TABLE IF NOT EXISTS master_data_cache (
    cache_key TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL,
    cached_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS user_cache (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT '',
    tenant_id TEXT NOT NULL,
    cached_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS app_config (
    config_key TEXT PRIMARY KEY NOT NULL,
    config_value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS dashboard_stats_cache (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    total INTEGER NOT NULL DEFAULT 0,
    available INTEGER NOT NULL DEFAULT 0,
    occupied INTEGER NOT NULL DEFAULT 0,
    booked INTEGER NOT NULL DEFAULT 0,
    cached_at INTEGER NOT NULL
  )`,
];
