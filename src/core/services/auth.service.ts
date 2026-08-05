import { Preferences } from '@capacitor/preferences';
import { STORAGE_KEYS } from '../constants';
import { DatabaseService } from '../database/database.service';
import { ApiService } from './api.service';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  tenantId?: string;
}

export interface LoginResult {
  token: string;
  refreshToken: string;
  tenantId: string;
  user: AuthUser;
}

export class AuthService {
  private static instance: AuthService | null = null;
  private db = DatabaseService.getInstance();
  private api = ApiService.getInstance();

  static getInstance(): AuthService {
    if (!this.instance) {
      this.instance = new AuthService();
    }
    return this.instance;
  }

  async login(credentials: LoginCredentials): Promise<LoginResult> {
    const response = await this.api.post<LoginResult>('/auth/login', credentials);

    if (!response.success || !response.data) {
      throw new Error(response.error || response.message || 'Login failed');
    }

    const { token, refreshToken, tenantId, user } = response.data;
    await this.persistAuth(token, refreshToken, tenantId, user);
    return { token, refreshToken, tenantId, user };
  }

  async persistAuth(
    token: string,
    refreshToken: string,
    tenantId: string,
    user: AuthUser
  ): Promise<void> {
    await Preferences.set({ key: STORAGE_KEYS.AUTH_TOKEN, value: token });
    await Preferences.set({ key: STORAGE_KEYS.REFRESH_TOKEN, value: refreshToken });
    await Preferences.set({ key: STORAGE_KEYS.TENANT_ID, value: tenantId });
    await Preferences.set({ key: STORAGE_KEYS.USER, value: JSON.stringify(user) });

    await this.db.run(
      `INSERT INTO user_cache (id, email, name, role, tenant_id, cached_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         role = excluded.role,
         tenant_id = excluded.tenant_id,
         cached_at = excluded.cached_at`,
      [user.id, user.email, user.name, user.role ?? '', tenantId, Date.now()]
    );
  }

  async logout(): Promise<void> {
    await Preferences.remove({ key: STORAGE_KEYS.AUTH_TOKEN });
    await Preferences.remove({ key: STORAGE_KEYS.REFRESH_TOKEN });
    await Preferences.remove({ key: STORAGE_KEYS.TENANT_ID });
    await Preferences.remove({ key: STORAGE_KEYS.USER });
  }

  async getToken(): Promise<string | null> {
    const result = await Preferences.get({ key: STORAGE_KEYS.AUTH_TOKEN });
    return result.value;
  }

  async getUser(): Promise<AuthUser | null> {
    const result = await Preferences.get({ key: STORAGE_KEYS.USER });
    if (result.value) {
      try {
        return JSON.parse(result.value) as AuthUser;
      } catch {
        return null;
      }
    }

    const cached = await this.db.query<{
      id: string;
      email: string;
      name: string;
      role: string;
    }>('SELECT id, email, name, role FROM user_cache ORDER BY cached_at DESC LIMIT 1');
    if (cached[0]) {
      return {
        id: cached[0].id,
        email: cached[0].email,
        name: cached[0].name,
        role: cached[0].role,
      };
    }
    return null;
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    if (token) return true;
    const user = await this.getUser();
    return user !== null;
  }
}
