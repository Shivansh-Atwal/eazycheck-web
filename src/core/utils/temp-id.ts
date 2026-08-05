import type { DatabaseService } from '../database/database.service';

export class TempIdGenerator {
  private static counter = 0;
  private static initialized = false;

  static async initialize(db: DatabaseService): Promise<void> {
    if (this.initialized) return;
    const stored = await db.getConfig('temp_id_counter');
    this.counter = stored ? parseInt(stored, 10) : 0;
    this.initialized = true;
  }

  static async next(db: DatabaseService): Promise<string> {
    await this.initialize(db);
    this.counter += 1;
    await db.setConfig('temp_id_counter', String(this.counter));
    return `TEMP-${this.counter}`;
  }
}
