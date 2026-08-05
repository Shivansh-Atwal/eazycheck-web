import { Capacitor } from '@capacitor/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import { DB_NAME } from '../constants';
import { SCHEMA_STATEMENTS } from './schema';
import { AppError } from '../utils/errors';

export class DatabaseService {
  private static instance: DatabaseService | null = null;
  private sqlite = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;
  private initPromise: Promise<void> | null = null;

  static getInstance(): DatabaseService {
    if (!this.instance) {
      this.instance = new DatabaseService();
    }
    return this.instance;
  }

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      const platform = Capacitor.getPlatform();

      if (platform === 'web') {
        await customElements.whenDefined('jeep-sqlite');
        const jeepEl = document.querySelector('jeep-sqlite');
        if (jeepEl) {
          await this.sqlite.initWebStore();
        }
      }

      const consistency = await this.sqlite.checkConnectionsConsistency();
      const isConn = (await this.sqlite.isConnection(DB_NAME, false)).result;

      if (consistency.result && isConn) {
        this.db = await this.sqlite.retrieveConnection(DB_NAME, false);
      } else {
        this.db = await this.sqlite.createConnection(
          DB_NAME,
          false,
          'no-encryption',
          1,
          false
        );
      }

      await this.db.open();

      for (const statement of SCHEMA_STATEMENTS) {
        await this.db.execute(statement);
      }
    } catch (error) {
      throw new AppError(
        `Database initialization failed: ${(error as Error).message}`,
        'DB_INIT_ERROR',
        true
      );
    }
  }

  private ensureDb(): SQLiteDBConnection {
    if (!this.db) {
      throw new AppError('Database not initialized', 'DB_NOT_READY', true);
    }
    return this.db;
  }

  async run(sql: string, values: unknown[] = []): Promise<void> {
    const db = this.ensureDb();
    await db.run(sql, values);
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    values: unknown[] = []
  ): Promise<T[]> {
    const db = this.ensureDb();
    const result = await db.query(sql, values);
    return (result.values ?? []) as T[];
  }

  async getConfig(key: string): Promise<string | null> {
    const rows = await this.query<{ config_value: string }>(
      'SELECT config_value FROM app_config WHERE config_key = ?',
      [key]
    );
    return rows[0]?.config_value ?? null;
  }

  async setConfig(key: string, value: string): Promise<void> {
    await this.run(
      `INSERT INTO app_config (config_key, config_value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, updated_at = excluded.updated_at`,
      [key, value, Date.now()]
    );
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.sqlite.closeConnection(DB_NAME, false);
      this.db = null;
      this.initPromise = null;
    }
  }
}
