// Module 1: Cron Health
export interface CronHealthData {
  crons: CronItem[];
  hasAlerts: boolean;
  fetchedAt: string;
}

export interface CronItem {
  id: string;
  name: string;
  category: 'Trading' | 'Memory' | 'Infra' | 'College' | 'HiFi' | 'Other';
  lastRun: string | null;
  nextRun: string | null;
  status: 'ok' | 'error' | 'warning';
  consecutiveErrors: number;
  errorHistory7d: number[];
}

// Module 2: Memory Pipeline
export interface MemoryPipelineData {
  lastCapture: string | null;
  lastT4Run: string | null;
  lastEmbedding: string | null;
  pendingT4: number;
  pendingEmbedding: number;
  chunksByContext: Record<string, number>;
  totalChunks: number;
  staleFlags: {
    capture: boolean;
    t4: boolean;
    embedding: boolean;
  };
  fetchedAt: string;
}

// Module 3: Trading Operations
export interface TradingOpsData {
  dailyRuns: Record<string, DailyRunStatus>;
  fillChecks: Record<string, FillCheckStatus>;
  signalFreshness: {
    lastUpdated: string | null;
    isStale: boolean;
  };
  observers: Record<string, ObserverStatus>;
  monthlyRetest: {
    lastRun: string | null;
    nextScheduled: string | null;
  };
  fetchedAt: string;
}

export interface DailyRunStatus {
  lastRun: string | null;
  status: 'ok' | 'error' | 'skipped';
  exitCode: number;
}

export interface FillCheckStatus {
  lastRun: string | null;
  status: 'ok' | 'error' | 'skipped';
}

export interface ObserverStatus {
  lastRun: string | null;
  status: 'ok' | 'error';
  model: string;
}

// Module 4: Active Mission
export interface ActiveMissionData {
  hasMission: boolean;
  mission: MissionDetails | null;
  lastCompleted: CompletedMission | null;
  fetchedAt: string;
}

export interface MissionDetails {
  missionId: string;
  name: string;
  status: 'in_progress' | 'completed' | 'failed' | 'abandoned';
  percentComplete: number;
  totalSteps: number;
  completedSteps: number;
  createdAt: string;
  lastActivityAt: string;
  isIdle: boolean;
  steps: MissionStep[];
}

export interface MissionStep {
  stepId: number;
  description: string;
  role: 'builder' | 'verifier' | 'planner' | 'research';
  status: 'completed' | 'in_progress' | 'pending' | 'failed' | 'needs_review';
  startedAt: string | null;
  completedAt: string | null;
  agentSessionId: string | null;
}

export interface CompletedMission {
  missionId: string;
  name: string;
  completedAt: string;
}

// Module 5: Project Board
export interface ProjectBoardData {
  projects: Project[];
  grouped: Record<string, Project[]>;
  fetchedAt: string;
}

export interface Project {
  name: string;
  status: 'Active' | 'Pending' | 'Future' | 'Backlog';
  priority: 'High' | 'Medium' | 'Low' | null;
  nextStep: string | null;
  tags: string[];
  githubUrl: string;
}

// Module 6: Model Sentinel
export interface ModelSentinelData {
  currentModel: string;
  isDefault: boolean;
  sentinelMode: 'normal' | 'protection';
  protectionUntil: string | null;
  lastSwitch: {
    reason: string;
    switchedAt: string;
  } | null;
  fallbackHistory7d: FallbackEvent[];
  openrouterCost: {
    today: number;
    last7d: number;
    available: boolean;
  };
  fetchedAt: string;
}

export interface FallbackEvent {
  date: string;
  reason: string;
  fromModel: string;
  toModel: string;
}

// Module 7: Today's Activity
export interface TodayActivityData {
  date: string;
  recentItems: MemoryItem[];
  openPlans: PlanItem[];
  totalItems: {
    decisions: number;
    facts: number;
    learnings: number;
    plans: number;
  };
  memoryTest: {
    lastResult: 'pass' | 'fail' | null;
    lastRun: string | null;
  };
  fetchedAt: string;
}

export interface MemoryItem {
  type: 'decision' | 'fact' | 'learning' | 'plan';
  text: string;
  lineNumber: number;
}

export interface PlanItem {
  text: string;
  lineNumber: number;
}

// Module 8: Trading Performance
export interface PerformanceData {
  available: boolean;
  reason?: string;
  generatedAt: string;
  startDate: string;
  endDate: string;
  tradingDays: number;
  summary: {
    mr: number; spy: number; qqq: number;
    vsSpy: number; vsQqq: number;
    mrMaxDrawdown: number; spyMaxDrawdown: number; qqqMaxDrawdown: number;
    currentEquity: number;
  };
  phases: PhaseRow[];
  weekly: WeeklyRow[];
  equityCurve: EquityPoint[];
  fetchedAt: string;
}

export interface PhaseRow {
  name: string; start: string; end: string;
  mr: number; spy: number; qqq: number;
  vs_spy: number; vs_qqq: number;
}

export interface WeeklyRow {
  week: string; mr: number; spy: number; qqq: number; vs_spy: number;
}

export interface EquityPoint {
  date: string; mr: number; spy: number; qqq: number;
}

// Helper types
export type RelativeTime = string; // for human-readable time strings
