import { DatabaseService } from '../database/database.service';
import type { SyncQueueItem, QueueOperation } from '../models/sync';
import { generateId } from '../utils/errors';

interface QueueRow {
  id: string;
  operation: string;
  entity_type: string;
  entity_id: string;
  endpoint: string;
  method: string;
  payload: string;
  status: string;
  retry_count: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

export class SyncQueueRepository {
  private db = DatabaseService.getInstance();

  private mapRow(row: QueueRow): SyncQueueItem {
    return {
      id: row.id,
      operation: row.operation as QueueOperation,
      entityType: row.entity_type as SyncQueueItem['entityType'],
      entityId: row.entity_id,
      endpoint: row.endpoint,
      method: row.method as SyncQueueItem['method'],
      payload: row.payload,
      status: row.status as SyncQueueItem['status'],
      retryCount: row.retry_count,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async enqueue(input: {
    operation: QueueOperation;
    entityType: SyncQueueItem['entityType'];
    entityId: string;
    endpoint: string;
    method: SyncQueueItem['method'];
    payload: unknown;
  }): Promise<SyncQueueItem> {
    const item: SyncQueueItem = {
      id: generateId('sync'),
      operation: input.operation,
      entityType: input.entityType,
      entityId: input.entityId,
      endpoint: input.endpoint,
      method: input.method,
      payload: JSON.stringify(input.payload),
      status: 'queued',
      retryCount: 0,
      lastError: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.db.run(
      `INSERT INTO sync_queue (
        id, operation, entity_type, entity_id, endpoint, method,
        payload, status, retry_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.operation,
        item.entityType,
        item.entityId,
        item.endpoint,
        item.method,
        item.payload,
        item.status,
        item.retryCount,
        item.createdAt,
        item.updatedAt,
      ]
    );

    return item;
  }

  async getPending(): Promise<SyncQueueItem[]> {
    const rows = await this.db.query<QueueRow>(
      `SELECT * FROM sync_queue
       WHERE status IN ('queued', 'failed')
       ORDER BY created_at ASC`
    );
    return rows.map((r) => this.mapRow(r));
  }

  async getAll(): Promise<SyncQueueItem[]> {
    const rows = await this.db.query<QueueRow>(
      'SELECT * FROM sync_queue ORDER BY created_at ASC'
    );
    return rows.map((r) => this.mapRow(r));
  }

  async updateStatus(
    id: string,
    status: SyncQueueItem['status'],
    error?: string
  ): Promise<void> {
    await this.db.run(
      `UPDATE sync_queue SET status = ?, last_error = ?, updated_at = ?,
       retry_count = retry_count + CASE WHEN ? IN ('failed', 'conflict') THEN 1 ELSE 0 END
       WHERE id = ?`,
      [status, error ?? null, Date.now(), status, id]
    );
  }

  async markCompleted(id: string): Promise<void> {
    await this.db.run(
      'DELETE FROM sync_queue WHERE id = ?',
      [id]
    );
  }

  async getPendingCount(): Promise<number> {
    const rows = await this.db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('queued', 'failed', 'conflict')`
    );
    return rows[0]?.count ?? 0;
  }
}
