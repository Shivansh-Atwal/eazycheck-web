import type { SyncStatus } from '@core/index';

const BADGE_CLASS: Record<SyncStatus, string> = {
  Pending: 'badge-pending',
  Syncing: 'badge-syncing',
  Synced: 'badge-synced',
  Failed: 'badge-failed',
  Conflict: 'badge-conflict',
};

export function SyncBadge({ status }: { status: SyncStatus }) {
  return <span className={`badge ${BADGE_CLASS[status]}`}>{status}</span>;
}
