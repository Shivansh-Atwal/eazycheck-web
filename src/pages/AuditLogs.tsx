import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { Terminal, ChevronDown, ChevronUp } from 'lucide-react';

interface AuditLog {
  id: string;
  userName: string;
  action: string;
  timestamp: string;
  ipAddress: string;
  details: string;
}

const renderFullDetails = (detailsStr: string | null | undefined) => {
  if (!detailsStr) return null;
  try {
    const details = JSON.parse(detailsStr);
    if (typeof details !== 'object' || details === null || Object.keys(details).length === 0) {
      return <div className="text-slate-500 text-xs italic">No additional details recorded.</div>;
    }

    const isIdKey = (key: string) => {
      const lower = key.toLowerCase();
      return lower === 'id' || lower.endsWith('id') || lower.endsWith('ids');
    };

    const prettifyKey = (key: string) => {
      const result = key.replace(/([A-Z])/g, " $1");
      return result.charAt(0).toUpperCase() + result.slice(1);
    };

    const renderValue = (val: any): React.ReactNode => {
      if (Array.isArray(val)) {
        return <span className="text-slate-300 font-semibold">{val.join(', ')}</span>;
      }
      if (typeof val === 'object' && val !== null) {
        return (
          <pre className="text-slate-400 font-mono text-[11px] bg-slate-950 p-2 rounded border border-slate-800 overflow-x-auto max-w-full">
            {JSON.stringify(val, null, 2)}
          </pre>
        );
      }
      const valStr = String(val);
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valStr);
      if (isUuid) {
        return <code className="text-indigo-400 font-mono text-xs bg-slate-950 px-1.5 py-0.5 rounded select-all border border-slate-800">{valStr}</code>;
      }
      return <span className="text-slate-300 font-medium">{valStr}</span>;
    };

    return (
      <div className="mt-4 p-4 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-4 text-xs">
        {/* Render updates if any */}
        {details.updates && typeof details.updates === 'object' && Object.keys(details.updates).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-emerald-450 uppercase tracking-wider">Changed Values / Updates</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800/50">
              {Object.entries(details.updates)
                .filter(([k]) => !isIdKey(k))
                .map(([k, v]) => (
                  <div key={k} className="space-y-1">
                    <span className="text-slate-500 font-semibold block">{prettifyKey(k)}</span>
                    <div className="truncate">{renderValue(v)}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Render other keys */}
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Properties & Identifiers</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(details)
              .filter(([k]) => k !== 'updates' && !isIdKey(k))
              .map(([k, v]) => (
                <div key={k} className="space-y-1 bg-slate-900/50 p-2.5 rounded-lg border border-slate-850">
                  <span className="text-slate-500 font-semibold block">{prettifyKey(k)}</span>
                  <div className="overflow-hidden text-ellipsis">{renderValue(v)}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  } catch (e) {
    return (
      <div className="mt-4 p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs font-mono text-slate-400 whitespace-pre-wrap break-all">
        {detailsStr}
      </div>
    );
  }
};

const AuditLogs: React.FC = () => {
  const [expandedLogs, setExpandedLogs] = React.useState<Record<string, boolean>>({});

  // Fetch logs
  const { data: logsRes, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => api.get('/admin/audit-logs').then((res) => res.data),
  });

  const logs: AuditLog[] = logsRes?.data || [];

  const toggleLog = (id: string) => {
    setExpandedLogs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-white tracking-tight">Audit Logs</h1>
        <p className="text-sm text-slate-400 mt-1">Timeline history tracking of all system-wide admin and employee actions</p>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-slate-550 text-sm">Fetching system audit records...</div>
      ) : (
        <div className="space-y-4">
          {/* Desktop List View */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="min-w-full">
              <div className="p-5 border-b border-slate-800 bg-slate-850/45 grid grid-cols-12 gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span className="col-span-6">Action Taken</span>
                <span className="col-span-3 text-left">By Whom</span>
                <span className="col-span-3 text-right pr-7">Time & Date</span>
              </div>
              
              <div className="divide-y divide-slate-800">
                {logs.length === 0 ? (
                  <div className="text-center py-20 text-slate-500 text-sm">No action logs found in database.</div>
                ) : (
                  logs.map((log) => {
                    const isExpanded = !!expandedLogs[log.id];
                    return (
                      <div key={log.id} className="border-b border-slate-800 last:border-b-0">
                        {/* Header Row */}
                        <div 
                          onClick={() => log.details && toggleLog(log.id)}
                          className={`p-4 hover:bg-slate-850/30 transition-colors grid grid-cols-12 gap-4 items-center text-sm ${log.details ? 'cursor-pointer select-none' : ''}`}
                        >
                          <div className="col-span-6 flex items-center space-x-3">
                            <div className="p-2 bg-slate-800/80 text-emerald-400 border border-slate-700/50 rounded-lg shrink-0">
                              <Terminal className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-slate-200 leading-tight">{log.action}</span>
                          </div>

                          <div className="col-span-3 text-left">
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-slate-350 bg-slate-800/60 border border-slate-700/30 max-w-full truncate">
                              {log.userName}
                            </span>
                          </div>

                          <div className="col-span-3 flex items-center justify-end space-x-3 text-xs text-slate-400 font-medium">
                            <span>
                              {new Date(log.timestamp).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}
                            </span>
                            {log.details ? (
                              isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-slate-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              )
                            ) : (
                              <div className="w-4" />
                            )}
                          </div>
                        </div>

                        {/* Expanded Details Pane */}
                        {isExpanded && log.details && (
                          <div className="px-6 pb-5 pt-1 bg-slate-900/45 border-t border-slate-800/20">
                            {renderFullDetails(log.details)}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-4">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl text-sm">
                No action logs found in database.
              </div>
            ) : (
              logs.map((log) => {
                const isExpanded = !!expandedLogs[log.id];
                return (
                  <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-xl shadow-md overflow-hidden">
                    {/* Header Card Area */}
                    <div 
                      onClick={() => log.details && toggleLog(log.id)}
                      className={`p-4 space-y-3 ${log.details ? 'cursor-pointer active:bg-slate-850/20 select-none' : ''}`}
                    >
                      <div className="flex items-start justify-between space-x-2">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-slate-800/80 text-emerald-450 border border-slate-700/50 rounded-lg shrink-0 mt-0.5">
                            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-semibold text-slate-200 text-sm leading-snug">{log.action}</p>
                          </div>
                        </div>
                        {log.details && (
                          <div className="text-slate-500 pt-1 shrink-0">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center text-xs border-t border-slate-800/80 pt-2.5 text-slate-400">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-0.5">By Whom</span>
                          <span className="font-semibold text-slate-300">{log.userName}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-0.5">Time & Date</span>
                          <span className="text-slate-400 font-medium">
                            {new Date(log.timestamp).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details Pane for Mobile */}
                    {isExpanded && log.details && (
                      <div className="px-4 pb-4 pt-1 bg-slate-950/30 border-t border-slate-800/60">
                        {renderFullDetails(log.details)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
