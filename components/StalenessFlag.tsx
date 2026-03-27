'use client';

import { useState, useEffect } from 'react';

interface StalenessFlagProps {
  isStale: boolean;
  lastUpdated: string | null;
  label?: string;
}

export function StalenessFlag({ isStale, lastUpdated, label }: StalenessFlagProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  if (!isStale) return null;

  const getTooltipText = () => {
    if (!lastUpdated) return `${label || 'Stage'} stale — last updated unknown`;
    const then = new Date(lastUpdated).getTime();
    const diff = Math.floor((now - then) / 1000);
    let relativeTime;
    if (diff < 60) relativeTime = `${diff}s ago`;
    else if (diff < 3600) relativeTime = `${Math.floor(diff / 60)}m ago`;
    else if (diff < 86400) relativeTime = `${Math.floor(diff / 3600)}h ago`;
    else relativeTime = `${Math.floor(diff / 86400)}d ago`;
    return `${label || 'Stage'} stale — last updated ${relativeTime}`;
  };

  return (
    <span className="text-yellow-400" title={getTooltipText()}>
      ⚠️
    </span>
  );
}
