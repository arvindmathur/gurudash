'use client';

import { PerformanceData, PhaseRow, WeeklyRow } from '@/lib/types';
import { useAutoRefresh } from '@/lib/hooks/useAutoRefresh';
import { ModuleCard } from './ModuleCard';

function pct(v: number, bold = false) {
  const color = v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-gray-400';
  const sign = v > 0 ? '+' : '';
  return <span className={`${color} ${bold ? 'font-bold' : ''}`}>{sign}{v.toFixed(2)}%</span>;
}

function pp(v: number) {
  const color = v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-gray-400';
  const sign = v > 0 ? '+' : '';
  return <span className={color}>{sign}{v.toFixed(2)}pp</span>;
}

export default function TradingPerformance() {
  const { data, error, lastFetchedAt, refresh } = useAutoRefresh<PerformanceData>('/api/performance', 300000);

  if (!data?.available) {
    return (
      <ModuleCard title="MR Paper Trade Performance" lastFetched={lastFetchedAt} error={!!error} onRefresh={refresh}>
        <div className="text-sm text-gray-500 py-4 text-center">
          {error ? 'Bridge unreachable' : 'No performance data yet'}
        </div>
      </ModuleCard>
    );
  }

  const s = data.summary;
  const [view, setView] = (typeof window !== 'undefined'
    ? require('react').useState
    : (v: string) => [v, () => {}])('phases') as [string, (v: string) => void];

  return (
    <ModuleCard title="MR Paper Trade Performance" lastFetched={lastFetchedAt} error={!!error} onRefresh={refresh}>
      <div className="space-y-4">

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-800/60 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">MR Return</div>
            <div className="text-xl font-bold">{pct(s.mr, true)}</div>
            <div className="text-xs text-gray-500">${s.currentEquity.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">vs SPY</div>
            <div className="text-xl font-bold">{pp(s.vsSpy)}</div>
            <div className="text-xs text-gray-500">SPY {pct(s.spy)}</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">vs QQQ</div>
            <div className="text-xl font-bold">{pp(s.vsQqq)}</div>
            <div className="text-xs text-gray-500">QQQ {pct(s.qqq)}</div>
          </div>
          <div className="bg-gray-800/60 rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Max Drawdown</div>
            <div className="text-xl font-bold text-red-400">{s.mrMaxDrawdown.toFixed(2)}%</div>
            <div className="text-xs text-gray-500">SPY {s.spyMaxDrawdown.toFixed(2)}%</div>
          </div>
        </div>

        {/* Mini equity sparkline (SVG) */}
        <MiniChart data={data.equityCurve} />

        {/* Tab toggle */}
        <div className="flex gap-2">
          {['phases', 'weekly'].map(tab => (
            <button
              key={tab}
              onClick={() => view !== tab && refresh()}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                view === tab
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
              // use data attr trick to toggle without useState import issues
              data-tab={tab}
              id={`perf-tab-${tab}`}
            >
              {tab === 'phases' ? 'Phases' : 'Weekly'}
            </button>
          ))}
        </div>

        {/* Phase table */}
        <PhasesTable phases={data.phases} startDate={data.startDate} endDate={data.endDate} />

        {/* Weekly table */}
        <WeeklyTable weekly={data.weekly} />

        <div className="text-xs text-gray-600 pt-1">
          {data.tradingDays} trading days · {data.startDate} → {data.endDate}
          {data.generatedAt && <> · refreshed {new Date(data.generatedAt).toLocaleDateString()}</>}
        </div>
      </div>
    </ModuleCard>
  );
}

function MiniChart({ data }: { data: PerformanceData['equityCurve'] }) {
  if (!data?.length) return null;
  const base = 100000;
  const vals = data.map(d => d.mr);
  const spyVals = data.map(d => d.spy);
  const qqqVals = data.map(d => d.qqq);
  const allVals = [...vals, ...spyVals, ...qqqVals];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;
  const W = 300, H = 60;

  function toPath(series: number[]) {
    return series.map((v, i) => {
      const x = (i / (series.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  return (
    <div className="bg-gray-800/40 rounded-lg p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 60 }}>
        <path d={toPath(spyVals)} fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,2" opacity="0.7" />
        <path d={toPath(qqqVals)} fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="3,2" opacity="0.7" />
        <path d={toPath(vals)} fill="none" stroke="#818cf8" strokeWidth="2" />
      </svg>
      <div className="flex gap-3 mt-1 text-xs text-gray-500">
        <span><span className="inline-block w-3 h-0.5 bg-indigo-400 mr-1 align-middle"></span>MR</span>
        <span><span className="inline-block w-3 h-0.5 bg-amber-400 mr-1 align-middle" style={{borderTop:'1px dashed'}}></span>SPY</span>
        <span><span className="inline-block w-3 h-0.5 bg-emerald-400 mr-1 align-middle" style={{borderTop:'1px dashed'}}></span>QQQ</span>
      </div>
    </div>
  );
}

function PhasesTable({ phases, startDate, endDate }: { phases: PhaseRow[]; startDate: string; endDate: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Phase Analysis</div>
      <div className="space-y-1">
        {phases.map(p => {
          const isFull = p.name === 'Full Period';
          return (
            <div key={p.name} className={`rounded-lg p-2.5 ${isFull ? 'bg-indigo-900/30 border border-indigo-800/50' : 'bg-gray-800/50'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs ${isFull ? 'font-bold text-gray-200' : 'font-medium text-gray-300'}`}>{p.name}</span>
                <span className="text-xs text-gray-500">{p.start} → {p.end}</span>
              </div>
              <div className="grid grid-cols-5 gap-1 text-xs">
                <div><span className="text-gray-500">MR </span>{pct(p.mr)}</div>
                <div><span className="text-gray-500">SPY </span>{pct(p.spy)}</div>
                <div><span className="text-gray-500">QQQ </span>{pct(p.qqq)}</div>
                <div><span className="text-gray-500">vS </span>{pp(p.vs_spy)}</div>
                <div><span className="text-gray-500">vQ </span>{pp(p.vs_qqq)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyTable({ weekly }: { weekly: WeeklyRow[] }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Weekly Returns</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left pb-1 pr-2">Week</th>
              <th className="text-right pb-1 pr-2">MR</th>
              <th className="text-right pb-1 pr-2">SPY</th>
              <th className="text-right pb-1 pr-2">QQQ</th>
              <th className="text-right pb-1">vs SPY</th>
            </tr>
          </thead>
          <tbody>
            {[...weekly].reverse().map(w => (
              <tr key={w.week} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-1 pr-2 text-gray-400">{w.week}</td>
                <td className="py-1 pr-2 text-right">{pct(w.mr)}</td>
                <td className="py-1 pr-2 text-right">{pct(w.spy)}</td>
                <td className="py-1 pr-2 text-right">{pct(w.qqq)}</td>
                <td className="py-1 text-right">{pp(w.vs_spy)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
