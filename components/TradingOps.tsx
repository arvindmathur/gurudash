'use client';

import { TradingOpsData } from '@/lib/types';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { ModuleCard } from './ModuleCard';
import { StatusBadge } from './StatusBadge';
import { StalenessFlag } from './StalenessFlag';

const getRelativeTime = (timestamp: string | null): string => {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor(diff / (1000 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)}d ago`;
  if (hours > 0) return `${hours}h ago`;
  return `${minutes}m ago`;
};

export default function TradingOps() {
  const { data, error, lastFetchedAt, refresh } = useAutoRefresh<TradingOpsData>('/api/trading', 60000);

  return (
    <ModuleCard
      title="Trading Operations"
      lastFetched={lastFetchedAt}
      error={!!error}
      onRefresh={refresh}
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Daily Runs</h3>
          <div className="space-y-2">
            {data && ['mr_daily', 'te_daily', 'ep_daily'].map(key => {
              const run = data.dailyRuns[key];
              return run ? (
                <div key={key} className="bg-gray-800/50 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{key}</span>
                    <StatusBadge status={run.status} />
                  </div>
                  <div className="text-xs text-gray-400">
                    Last: {getRelativeTime(run.lastRun)} • Exit: {run.exitCode}
                  </div>
                </div>
              ) : null;
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Fill Checks</h3>
          <div className="space-y-2">
            {data && ['mr_fill_check', 'te_fill_check', 'ep_fill_check'].map(key => {
              const check = data.fillChecks[key];
              return check ? (
                <div key={key} className="bg-gray-800/50 rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{key}</span>
                    <StatusBadge status={check.status} />
                  </div>
                  <div className="text-xs text-gray-400">
                    Last: {getRelativeTime(check.lastRun)}
                  </div>
                </div>
              ) : null;
            })}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Observers</h3>
          <div className="space-y-2">
            {data && Object.entries(data.observers).map(([key, obs]) => (
              <div key={key} className="bg-gray-800/50 rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{key}</span>
                  <StatusBadge status={obs.status} />
                </div>
                <div className="text-xs text-gray-400">
                  Model: {obs.model} • Last: {getRelativeTime(obs.lastRun)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-sm font-semibold mb-1 flex items-center gap-2">
            Signal Freshness
            <StalenessFlag isStale={data?.signalFreshness.isStale || false} lastUpdated={data?.signalFreshness.lastUpdated || null} label="Signals" />
          </div>
          <div className="text-xs text-gray-400">
            Signals: {getRelativeTime(data?.signalFreshness.lastUpdated || null)}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-sm font-semibold mb-1">Monthly Retest</div>
          <div className="text-xs text-gray-400">
            {data?.monthlyRetest.lastRun ? (
              <>Last: {getRelativeTime(data.monthlyRetest.lastRun)}</>
            ) : data?.monthlyRetest.nextScheduled ? (
              <>Next: {getRelativeTime(data.monthlyRetest.nextScheduled)}</>
            ) : (
              'Not scheduled'
            )}
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}
