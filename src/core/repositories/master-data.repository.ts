import { DatabaseService } from '../database/database.service';
import { ApiService } from '../services/api.service';
import { NetworkService } from '../network/network.service';

const MASTER_DATA_KEYS = [
  'room_types',
  'categories',
  'room_status',
  'customer_types',
  'identity_types',
  'pricing',
] as const;

const MASTER_DATA_TTL_MS = 6 * 60 * 60 * 1000;

export type MasterDataKey = (typeof MASTER_DATA_KEYS)[number];

export class MasterDataRepository {
  private db = DatabaseService.getInstance();
  private api = ApiService.getInstance();
  private network = NetworkService.getInstance();

  private endpoints: Record<MasterDataKey, string> = {
    room_types: '/master/room-types',
    categories: '/master/categories',
    room_status: '/master/room-status',
    customer_types: '/master/customer-types',
    identity_types: '/master/identity-types',
    pricing: '/master/pricing',
  };

  async get<T = unknown>(key: MasterDataKey): Promise<T[]> {
    if (this.network.isOnline() && !(await this.isFresh(key))) {
      try {
        await this.refresh(key);
      } catch {
        // Use cache
      }
    }
    return this.getFromCache<T>(key);
  }

  async getFromCache<T>(key: MasterDataKey): Promise<T[]> {
    const rows = await this.db.query<{ data: string }>(
      'SELECT data FROM master_data_cache WHERE cache_key = ?',
      [key]
    );
    if (!rows[0]) return [];
    try {
      return JSON.parse(rows[0].data) as T[];
    } catch {
      return [];
    }
  }

  async refresh(key: MasterDataKey): Promise<void> {
    const endpoint = this.endpoints[key];
    const response = await this.api.get<unknown[]>(endpoint);

    if (response.success && response.data) {
      await this.db.run(
        `INSERT INTO master_data_cache (cache_key, data, cached_at)
         VALUES (?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET data = excluded.data, cached_at = excluded.cached_at`,
        [key, JSON.stringify(response.data), Date.now()]
      );
    }
  }

  async refreshAll(): Promise<void> {
    if (!this.network.isOnline()) return;

    for (const key of MASTER_DATA_KEYS) {
      try {
        if (await this.isFresh(key)) {
          continue;
        }
        await this.refresh(key);
      } catch {
        // Continue with other keys
      }
    }
  }

  private async isFresh(key: MasterDataKey): Promise<boolean> {
    const rows = await this.db.query<{ cached_at: number }>(
      'SELECT cached_at FROM master_data_cache WHERE cache_key = ?',
      [key]
    );
    const cachedAt = rows[0]?.cached_at;
    return typeof cachedAt === 'number' && Date.now() - cachedAt < MASTER_DATA_TTL_MS;
  }
}
