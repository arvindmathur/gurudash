'use client';

import { MemoryPipelineData } from '@/lib/types';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { ModuleCard } from './ModuleCard';
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

export default function MemoryPipeline() {
  const { data, error, lastFetchedAt, refresh } = useAutoRefresh<MemoryPipelineData>('/api/memory', 60000);

  const topContexts = data ? Object.entries(data.chunksByContext)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5) : [];

  return (
    <ModuleCard
      title="Memory Pipeline"
      lastFetched={lastFetchedAt}
      error={!!error}
      onRefresh={refresh}
    >
      <div className="space-y-4">
        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-sm font-semibold mb-2">📥 Capture</div>
          <div className="text-xs text-gray-400 flex items-center gap-2">
            Last: {getRelativeTime(data?.lastCapture || null)}
            <StalenessFlag isStale={data?.staleFlags.capture || false} lastUpdated={data?.lastCapture || null} label="Capture" />
          </div>
        </div>

        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-sm font-semibold mb-2">🔄 T4 Extraction</div>
          <div className="text-xs text-gray-400 flex items-center gap-2">
            Last: {getRelativeTime(data?.lastT4Run || null)}
            <StalenessFlag isStale={data?.staleFlags.t4 || false} lastUpdated={data?.lastT4Run || null} label="T4" />
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Pending: {data?.pendingT4 || 0}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-sm font-semibold mb-2">🧠 Embedding</div>
          <div className="text-xs text-gray-400 flex items-center gap-2">
            Last: {getRelativeTime(data?.lastEmbedding || null)}
            <StalenessFlag isStale={data?.staleFlags.embedding || false} lastUpdated={data?.lastEmbedding || null} label="Embedding" />
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Pending: {data?.pendingEmbedding || 0}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-sm font-semibold mb-2">📊 Chunk Breakdown</div>
          <div className="text-xs text-gray-400">
            {data?.totalChunks || 0} total chunks
            {topContexts.length > 0 && (
              <span> ({topContexts.map(([ctx, count]) => `${ctx}: ${count}`).join(', ')})</span>
            )}
          </div>
        </div>
      </div>
    </ModuleCard>
  );
}
