'use client';

import { ActiveMissionData } from '@/lib/types';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { ModuleCard } from './ModuleCard';
import { StatusBadge } from './StatusBadge';

const getRoleBadgeColor = (role: string): string => {
  switch (role) {
    case 'builder': return 'bg-blue-600';
    case 'verifier': return 'bg-green-600';
    case 'planner': return 'bg-purple-600';
    case 'research': return 'bg-orange-600';
    default: return 'bg-gray-600';
  }
};

const formatTime = (timestamp: string | null): string => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ActiveMission() {
  const { data, error, lastFetchedAt, refresh } = useAutoRefresh<ActiveMissionData>('/api/mission', 60000);

  return (
    <ModuleCard
      title="Active Mission"
      lastFetched={lastFetchedAt}
      error={!!error}
      onRefresh={refresh}
    >
      {!data?.hasMission ? (
        <div>
          <div className="text-gray-400 mb-4">No active mission</div>
          {data?.lastCompleted && (
            <div className="bg-gray-800/50 rounded p-3">
              <div className="text-sm font-medium">{data.lastCompleted.name}</div>
              <div className="text-xs text-gray-400 mt-1">
                Completed: {formatTime(data.lastCompleted.completedAt)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {data.mission?.isIdle && (
            <div className="bg-yellow-900/30 border border-yellow-700 rounded p-3">
              ⚠️ Mission idle &gt;30 min
            </div>
          )}

          <div>
            <div className="text-sm font-medium mb-2">{data.mission?.name}</div>
            <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${data.mission?.percentComplete || 0}%` }}
              />
            </div>
            <div className="text-xs text-gray-400">
              {data.mission?.completedSteps}/{data.mission?.totalSteps} steps ({data.mission?.percentComplete}%)
            </div>
          </div>

          <div className="space-y-2">
            {data.mission?.steps.map(step => (
              <div key={step.stepId} className="bg-gray-800/50 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">Step {step.stepId}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${getRoleBadgeColor(step.role)}`}>
                      {step.role}
                    </span>
                    <StatusBadge status={step.status} />
                  </div>
                </div>
                <div className="text-xs text-gray-300 mb-2">
                  {step.description.length > 80 ? `${step.description.slice(0, 80)}...` : step.description}
                </div>
                <div className="text-xs text-gray-400">
                  {step.startedAt && (
                    <>
                      {formatTime(step.startedAt)}
                      {step.completedAt ? ` → ${formatTime(step.completedAt)}` : ' (in progress)'}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ModuleCard>
  );
}
