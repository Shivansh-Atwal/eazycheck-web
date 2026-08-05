export * from './booking';
export * from './room';
export * from './sync';

export interface MasterDataCache {
  key: string;
  data: string;
  cachedAt: number;
}

export interface UserCache {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  cachedAt: number;
}

export interface AppConfig {
  key: string;
  value: string;
  updatedAt: number;
}
