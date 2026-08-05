import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { Preferences } from '@capacitor/preferences';
import { SYNC_CONFIG, STORAGE_KEYS } from '../constants';
import { AppError, getErrorMessage, isConflictStatus, isNetworkError, isRetryableStatus } from '../utils/errors';
import { NetworkService } from '../network/network.service';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class ApiService {
  private static instance: ApiService | null = null;
  private client: AxiosInstance;

  private constructor() {
    let baseURL =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
      'https://api.hotel.shivatech.me/api';

    if (!baseURL.endsWith('/api') && !baseURL.endsWith('/api/')) {
      baseURL = baseURL.endsWith('/') ? `${baseURL}api` : `${baseURL}/api`;
    }

    this.client = axios.create({
      baseURL,
      timeout: SYNC_CONFIG.API_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use(async (config) => {
      const network = NetworkService.getInstance();
      if (!network.isOnline()) {
        throw new AppError('Device is offline', 'NETWORK_ERROR', true);
      }

      const token = await Preferences.get({ key: STORAGE_KEYS.AUTH_TOKEN });
      const tenantId = await Preferences.get({ key: STORAGE_KEYS.TENANT_ID });

      if (token.value) {
        config.headers.Authorization = `Bearer ${token.value}`;
      }
      if (tenantId.value) {
        config.headers['X-Tenant-Id'] = tenantId.value;
      }
      return config;
    });
  }

  static getInstance(): ApiService {
    if (!this.instance) {
      this.instance = new ApiService();
    }
    return this.instance;
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  async request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.request<ApiResponse<T>>(config);
      return response.data;
    } catch (error) {
      if (isNetworkError(error)) {
        throw new AppError(getErrorMessage(error), 'NETWORK_ERROR', true);
      }

      const status = (error as { response?: { status?: number } }).response?.status;
      if (status && isConflictStatus(status)) {
        throw new AppError(getErrorMessage(error), 'CONFLICT', true);
      }
      if (status && isRetryableStatus(status)) {
        throw new AppError(getErrorMessage(error), 'RETRYABLE', true);
      }
      throw new AppError(getErrorMessage(error), 'API_ERROR', false);
    }
  }

  async rawRequest<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    const response = await this.client.request<T>(config);
    return response.data;
  }
}
