'use client';

import { useState, useEffect } from 'react';
import CronHealth from '@/components/CronHealth';
import MemoryPipeline from '@/components/MemoryPipeline';
import TradingOps from '@/components/TradingOps';
import ActiveMission from '@/components/ActiveMission';
import ProjectBoard from '@/components/ProjectBoard';
import ModelSentinel from '@/components/ModelSentinel';
import TodayActivity from '@/components/TodayActivity';
import TradingPerformance from '@/components/TradingPerformance';

export default function Dashboard() {
  const [lastUpdated, setLastUpdated] = useState<string>('');
  
  useEffect(() => {
    const updateTime = () => {
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4 md:p-6">
      {/* Header */}
      <header className="mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">GuruDash</h1>
            <p className="text-gray-400 text-sm md:text-base">
              Real-time monitoring for OpenClaw infrastructure
            </p>
          </div>
          <div className="text-xs md:text-sm text-gray-500">
            Last updated: <span className="text-gray-300 font-mono">{lastUpdated || 'Loading...'}</span>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          Auto-refreshes every 60s • Bridge: <span className="text-green-400">Connected</span>
        </div>
      </header>

      {/* Main Dashboard Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {/* Column 1: System Health */}
        <div className="space-y-4 md:space-y-6">
          <CronHealth />
          <MemoryPipeline />
          <ModelSentinel />
        </div>

        {/* Column 2: Operations */}
        <div className="space-y-4 md:space-y-6">
          <TradingOps />
          <TradingPerformance />
          <ActiveMission />
          <TodayActivity />
        </div>

        {/* Column 3: Projects */}
        <div className="lg:col-span-2 xl:col-span-1 space-y-4 md:space-y-6">
          <ProjectBoard />
          
          {/* Footer note */}
          <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">About GuruDash</h3>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• 7 modules showing real-time system state</li>
              <li>• Auto-refresh every 60 seconds</li>
              <li>• Bridge server on Lenovo (port 18799)</li>
              <li>• Mobile-first responsive design</li>
              <li>• Built with Next.js 15 + TypeScript</li>
            </ul>
            <div className="mt-4 pt-3 border-t border-gray-800 text-xs text-gray-500">
              Data sourced from OpenClaw workspace • {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile warning for large screens */}
      <div className="hidden md:block mt-8 text-center text-xs text-gray-500">
        Tip: Use <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-300">R</kbd> to force refresh all modules
      </div>

      {/* Mobile-only note */}
      <div className="md:hidden mt-6 text-center text-xs text-gray-500">
        Swipe horizontally to see all columns
      </div>
    </div>
  );
}