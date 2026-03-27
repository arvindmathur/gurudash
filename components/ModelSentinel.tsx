'use client';

import { ModelSentinelData } from '@/lib/types';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { ModuleCard } from './ModuleCard';

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

const getFriendlyModelName = (model: string): string => {
  if (model.includes('claude-sonnet-4-6')) return 'Sonnet 4.6';
  if (model.includes('claude-sonnet')) return 'Claude Sonnet';
  if (model.includes('claude-opus')) return 'Claude Opus';
  if (model.includes('gpt-4')) return 'GPT-4';
  return model;
};

export default function ModelSentinel() {
  const { data, error, lastFetchedAt, refresh } = useAutoRefresh<ModelSentinelData>('/api/sentinel', 60000);

  return (
    <ModuleCard
      title="Model Sentinel"
      lastFetched={lastFetchedAt}
      error={!!error}
      onRefresh={refresh}
    >
      <div className="space-y-4">
        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-sm font-semibold mb-2">Current Model</div>
          <div className="text-xs text-gray-300 mb-2">
            {getFriendlyModelName(data?.currentModel || '')}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded ${
              data?.sentinelMode === 'protection' ? 'bg-yellow-600' : 'bg-green-600'
            }`}>
              {data?.sentinelMode || 'normal'}
            </span>
          </div>
        </div>

        {data?.lastSwitch && (
          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-sm font-semibold mb-2">Last Switch</div>
            <div className="text-xs text-gray-400">
              {data.lastSwitch.reason} • {getRelativeTime(data.lastSwitch.switchedAt)}
            </div>
          </div>
        )}

        {data?.fallbackHistory7d && data.fallbackHistory7d.length > 0 && (
          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-sm font-semibold mb-2">Fallback History (7d)</div>
            <div className="space-y-2">
              {data.fallbackHistory7d.map((event, idx) => (
                <div key={idx} className="text-xs text-gray-400">
                  <div>{new Date(event.date).toLocaleDateString()}</div>
                  <div>{event.reason}</div>
                  <div className="text-gray-500">
                    {getFriendlyModelName(event.fromModel)} → {getFriendlyModelName(event.toModel)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-sm font-semibold mb-2">OpenRouter Cost</div>
          {data?.openrouterCost.available ? (
            <div className="text-xs text-gray-400">
              Today: ${data.openrouterCost.today.toFixed(2)} • Last 7d: ${data.openrouterCost.last7d.toFixed(2)}
            </div>
          ) : (
            <div className="text-xs text-gray-400">Cost data unavailable</div>
          )}
        </div>
      </div>
    </ModuleCard>
  );
}
