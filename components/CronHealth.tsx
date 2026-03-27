'use client';

import { CronHealthData } from '@/lib/types';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { ModuleCard } from './ModuleCard';
import { StatusBadge } from './StatusBadge';
import { Sparkline } from './Sparkline';

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

export default function CronHealth() {
  const { data, error, lastFetchedAt, refresh } = useAutoRefresh<CronHealthData>('/api/crons', 60000);

  const groupedCrons = data?.crons.reduce((acc, cron) => {
    if (!acc[cron.category]) acc[cron.category] = [];
    acc[cron.category].push(cron);
    return acc;
  }, {} as Record<string, typeof data.crons>);

  const alertCount = data?.crons.filter(c => c.status === 'error').length || 0;

  return (
    <ModuleCard
      title="Cron Health"
      lastFetched={lastFetchedAt}
      error={!!error}
      onRefresh={refresh}
    >
      {data?.hasAlerts && (
        <div className="bg-red-900/30 border border-red-700 rounded p-3 mb-4">
          ⚠️ {alertCount} crons with errors
        </div>
      )}

      {groupedCrons && Object.entries(groupedCrons).map(([category, crons]) => (
        <div key={category} className="mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-2">{category}</h3>
          <div className="space-y-2">
            {crons.map(cron => (
              <div key={cron.id} className="bg-gray-800/50 rounded p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{cron.name}</span>
                  <StatusBadge status={cron.status} />
                </div>
                <div className="text-xs text-gray-400 flex flex-col gap-1">
                  <div>Last: {getRelativeTime(cron.lastRun)}</div>
                  <div>Next: {getRelativeTime(cron.nextRun)}</div>
                </div>
                {cron.errorHistory7d.length > 0 && (
                  <Sparkline data={cron.errorHistory7d} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </ModuleCard>
  );
}
