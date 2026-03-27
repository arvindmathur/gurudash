'use client';

import { useState } from 'react';
import { TodayActivityData } from '@/lib/types';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { ModuleCard } from './ModuleCard';

const getTypeIcon = (type: string): string => {
  switch (type) {
    case 'decision': return '✅';
    case 'fact': return '📝';
    case 'learning': return '💡';
    case 'plan': return '📋';
    default: return '•';
  }
};

export default function TodayActivity() {
  const { data, error, lastFetchedAt, refresh } = useAutoRefresh<TodayActivityData>('/api/activity', 60000);
  const [showPlans, setShowPlans] = useState(false);

  const dateStr = data?.date ? new Date(data.date).toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  }) : '';

  return (
    <ModuleCard
      title="Today's Activity"
      lastFetched={lastFetchedAt}
      error={!!error}
      onRefresh={refresh}
    >
      <div className="space-y-4">
        <div className="text-sm font-semibold text-gray-300">{dateStr}</div>

        <div className="bg-gray-800/50 rounded p-3">
          <div className="text-xs text-gray-400">
            {data?.totalItems.decisions || 0} decisions, {data?.totalItems.facts || 0} facts, {data?.totalItems.learnings || 0} learnings, {data?.totalItems.plans || 0} plans
          </div>
        </div>

        {data?.recentItems && data.recentItems.length > 0 && (
          <div>
            <div className="text-sm font-semibold text-gray-400 mb-2">Recent Items</div>
            <div className="space-y-2">
              {data.recentItems.slice(0, 5).map((item, idx) => (
                <div key={idx} className="bg-gray-800/50 rounded p-2 text-xs">
                  <span className="mr-2">{getTypeIcon(item.type)}</span>
                  <span className="text-gray-300">
                    {item.text.length > 60 ? `${item.text.slice(0, 60)}...` : item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data?.openPlans && data.openPlans.length > 0 && (
          <div>
            <button
              onClick={() => setShowPlans(!showPlans)}
              className="text-sm font-semibold text-gray-400 mb-2 hover:text-gray-300"
            >
              Open Plans ({data.openPlans.length}) {showPlans ? '▼' : '▶'}
            </button>
            {showPlans && (
              <div className="space-y-2">
                {data.openPlans.map((plan, idx) => (
                  <div key={idx} className="bg-gray-800/50 rounded p-2 text-xs text-gray-300">
                    {plan.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {data?.memoryTest && (
          <div className="bg-gray-800/50 rounded p-3">
            <div className="text-sm font-semibold mb-1">Memory Test</div>
            <div className="text-xs text-gray-400">
              {data.memoryTest.lastResult ? (
                <>
                  Last: {data.memoryTest.lastResult === 'pass' ? '✅ Pass' : '❌ Fail'}
                  {data.memoryTest.lastRun && (
                    <> • {new Date(data.memoryTest.lastRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
                  )}
                </>
              ) : (
                'No test results'
              )}
            </div>
          </div>
        )}
      </div>
    </ModuleCard>
  );
}
