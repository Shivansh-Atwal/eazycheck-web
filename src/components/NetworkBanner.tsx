import { useApp } from '../context/AppContext';

export function NetworkBanner() {
  const { networkStatus } = useApp();
  const { isConnected, isInternetReachable, state, syncMessage } = networkStatus;

  if (state === 'syncing') {
    return (
      <div className="network-banner syncing">
        🔄 {syncMessage || 'Synchronizing...'}
      </div>
    );
  }

  if (!isConnected || !isInternetReachable || state === 'offline') {
    return (
      <div className="network-banner offline">
        🔴 OFFLINE MODE — Working with local data. All changes will automatically synchronize when internet returns.
      </div>
    );
  }

  if (syncMessage?.includes('synchronized')) {
    return (
      <div className="network-banner online">
        🟢 Online — {syncMessage}
      </div>
    );
  }

  return null;
}
