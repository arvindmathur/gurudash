'use client';

import { useState, useEffect } from 'react';
import { RefreshButton } from './RefreshButton';

interface ModuleCardProps {
  title: string;
  lastFetched: string | null;
  error: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}

export function ModuleCard({ title, lastFetched, error, onRefresh, children }: ModuleCardProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  const getRelativeTime = () => {
    if (!lastFetched) return 'Never';
    const then = new Date(lastFetched).getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-100">{title}</h2>
          {error && (
            <p className="text-xs text-gray-500 mt-0.5">
              Last updated: {getRelativeTime()}
            </p>
          )}
        </div>
        <RefreshButton onRefresh={onRefresh} />
      </div>
      {children}
    </div>
  );
}
