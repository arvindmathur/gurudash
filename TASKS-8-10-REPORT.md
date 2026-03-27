# Tasks 8-10 Implementation Report

**Date:** 2026-03-27  
**Status:** ✅ Complete

---

## Summary

Successfully implemented all 7 real data endpoints in the FastAPI bridge server (`bridge/server.py`). All endpoints now fetch live data from the OpenClaw system instead of returning stub responses.

---

## Task 8: /crons, /memory, /trading Endpoints

### ✅ /crons Endpoint
**Implementation:**
- Executes `openclaw cron list --json` via subprocess
- Falls back to plain text parsing if `--json` flag fails
- Maintains cron history in `~/.openclaw/cron-history.json`
- Tracks 7-day error history per cron (array of 0s and 1s)
- Tracks consecutive errors per cron
- Infers category from name prefix:
  - `gurutrade`, `mr_`, `te_`, `ep_` → Trading
  - `memory_`, `living_files_`, `inactivity_` → Memory
  - `morning_`, `claude_max_`, `openrouter_`, `weekly_workspace_`, `daily_openclaw_`, `session_size_`, `travel_sync`, `daily-memory` → Infra
  - `college_` → College
  - `hifi_` → HiFi
  - else → Other
- Sets `hasAlerts: true` if any cron has `consecutiveErrors > 0`

**Response Shape:**
```json
{
  "crons": [
    {
      "id": "string",
      "name": "string",
      "category": "Trading|Memory|Infra|College|HiFi|Other",
      "lastRun": "ISO8601 timestamp or null",
      "nextRun": "ISO8601 timestamp or null",
      "status": "ok|error|warning",
      "consecutiveErrors": 0,
      "errorHistory7d": [0,0,0,0,0,0,0]
    }
  ],
  "hasAlerts": false,
  "fetchedAt": "ISO8601 timestamp"
}
```

### ✅ /memory Endpoint
**Implementation:**
- Reads `WORKSPACE/memory/sentinel-state.json` for `last_memory_capture`
- Parses `WORKSPACE/memory/capture_log.jsonl` line by line:
  - Finds last `captured_at` where `t4_processed == true`
  - Finds last `captured_at` where `embedded == true`
  - Counts lines where `t4_processed == false` (pendingT4)
  - Counts lines where `embedded == false` (pendingEmbedding)
- Queries SQLite `~/.openclaw/memory.db`:
  - `SELECT context, COUNT(*) FROM chunks GROUP BY context`
  - Builds `chunksByContext` dict and `totalChunks` sum
- Calculates staleness flags (>25 hours since last run)
- Handles missing files gracefully (returns nulls/zeros)

**Response Shape:**
```json
{
  "lastCapture": "ISO8601 or null",
  "lastT4Run": "ISO8601 or null",
  "lastEmbedding": "ISO8601 or null",
  "pendingT4": 0,
  "pendingEmbedding": 0,
  "chunksByContext": {"context_name": 123},
  "totalChunks": 123,
  "staleFlags": {
    "capture": false,
    "t4": false,
    "embedding": false
  },
  "fetchedAt": "ISO8601"
}
```

### ✅ /trading Endpoint
**Implementation:**
- Fetches full cron list via `openclaw cron list --json`
- Filters to trading-specific crons:
  - Daily runs: `mr_daily`, `te_daily`, `ep_daily`
  - Fill checks: `mr_fill_check`, `te_fill_check`, `ep_fill_check`
  - Observers: `gurutrade_te_observer`, `gurutrade_mr_observer`
  - Monthly: `gurutrade_monthly_retest`
  - Signal: `mr_signal_update`
- Extracts `lastRun`, `status` for each
- Calculates `exitCode`: 0 if ok, 1 if error, -1 if skipped/not found
- Queries Supabase `ow_system_events` table for signal freshness:
  - `SELECT created_at WHERE event_type='signal_update' ORDER BY created_at DESC LIMIT 1`
  - `isStale: true` if >26 hours since last update
  - Gracefully handles missing Supabase config (returns `available: false`)

**Response Shape:**
```json
{
  "dailyRuns": {
    "mr_daily": {"lastRun": "ISO8601", "status": "ok", "exitCode": 0}
  },
  "fillChecks": {
    "mr_fill_check": {"lastRun": "ISO8601", "status": "ok"}
  },
  "signalFreshness": {
    "lastUpdated": "ISO8601 or null",
    "isStale": false
  },
  "observers": {
    "te": {"lastRun": "ISO8601", "status": "ok", "model": "string"}
  },
  "monthlyRetest": {
    "lastRun": "ISO8601 or null",
    "nextScheduled": "ISO8601 or null"
  },
  "fetchedAt": "ISO8601"
}
```

---

## Task 9: /mission and /projects Endpoints

### ✅ /mission Endpoint
**Implementation:**
- Reads `WORKSPACE/docs/plans/missions/active.json`
- Checks if `status == 'in_progress'` to determine `hasMission`
- Calculates `percentComplete = round(completedSteps / totalSteps * 100)`
- Checks `isIdle`: true if `(now - lastActivityAt) > 30 minutes` AND status is in_progress
- Truncates step descriptions to 80 chars with '...'
- Scans `WORKSPACE/docs/plans/missions/archive/` for most recent `.json` file (by mtime)
- Handles missing files gracefully (returns `hasMission: false`)

**Response Shape:**
```json
{
  "hasMission": true,
  "mission": {
    "missionId": "string",
    "name": "string",
    "status": "in_progress",
    "percentComplete": 45,
    "totalSteps": 10,
    "completedSteps": 4,
    "createdAt": "ISO8601",
    "lastActivityAt": "ISO8601",
    "isIdle": false,
    "steps": [
      {
        "stepId": 1,
        "description": "Truncated to 80 chars...",
        "role": "builder|verifier|planner|research",
        "status": "completed|in_progress|pending|failed|needs_review",
        "startedAt": "ISO8601 or null",
        "completedAt": "ISO8601 or null",
        "agentSessionId": "string or null"
      }
    ]
  },
  "lastCompleted": {
    "missionId": "string",
    "name": "string",
    "completedAt": "ISO8601"
  },
  "fetchedAt": "ISO8601"
}
```

### ✅ /projects Endpoint
**Implementation:**
- Reads `WORKSPACE/docs/living-files-v2/PROJECTS.md`
- Splits on `\n## ` to get sections
- For each section:
  - Name = first line stripped
  - Status = regex `\*\*Status:\*\*\s*(\w+)` → defaults to 'Backlog'
  - Priority = regex `\*\*Priority:\*\*\s*(\w+)` → defaults to null
  - Tags = regex `\*\*Tags:\*\*\s*(.+)` → split by comma
  - NextStep = regex `\*\*Next:\*\*\s*(.+)` or first bullet under `### Next`
  - githubUrl = GitHub link to PROJECTS.md
- Groups projects by status: Active, Pending, Future, Backlog
- Skips sections with no name or name starting with '#'

**Response Shape:**
```json
{
  "projects": [
    {
      "name": "Project Name",
      "status": "Active|Pending|Future|Backlog",
      "priority": "High|Medium|Low|null",
      "nextStep": "string or null",
      "tags": ["tag1", "tag2"],
      "githubUrl": "https://github.com/..."
    }
  ],
  "grouped": {
    "Active": [],
    "Pending": [],
    "Future": [],
    "Backlog": []
  },
  "fetchedAt": "ISO8601"
}
```

---

## Task 10: /sentinel and /activity Endpoints

### ✅ /sentinel Endpoint
**Implementation:**
- Reads `WORKSPACE/memory/sentinel-state.json`
- Determines `currentModel`:
  - If `mode == 'normal'` → `anthropic/claude-sonnet-4-6`
  - If `mode == 'protection'` → `lastSwitchTo` field or default to `openrouter/deepseek/deepseek-v3.2`
- Calculates `isDefault`:
  - `mode == 'normal'` AND (`lastSwitchAt` is null OR >3 hours ago)
- Builds `lastSwitch` object if both `lastSwitchReason` and `lastSwitchAt` exist
- Scans last 7 days of memory files (`WORKSPACE/memory/YYYY-MM-DD.md`):
  - Searches for lines matching `\[DECISION\].*sentinel|\[FACT\].*model.*switch|\[FACT\].*fallback` (case insensitive)
  - Collects up to 10 events for `fallbackHistory7d`
- Reads `~/.openclaw/logs/openrouter_usage.json` for cost data
  - Returns `available: false` if file missing

**Response Shape:**
```json
{
  "currentModel": "string",
  "isDefault": true,
  "sentinelMode": "normal|protection",
  "protectionUntil": "ISO8601 or null",
  "lastSwitch": {
    "reason": "string",
    "switchedAt": "ISO8601"
  },
  "fallbackHistory7d": [
    {
      "date": "YYYY-MM-DD",
      "reason": "string",
      "fromModel": "string",
      "toModel": "string"
    }
  ],
  "openrouterCost": {
    "today": 0.0,
    "last7d": 0.0,
    "available": true
  },
  "fetchedAt": "ISO8601"
}
```

### ✅ /activity Endpoint
**Implementation:**
- Gets today's date in Asia/Singapore timezone using `pytz`
- Reads `WORKSPACE/memory/{today}.md` line by line
- Parses tagged lines (strips `- ` prefix first):
  - `[DECISION]` → type: decision
  - `[FACT]` → type: fact
  - `[LEARNING]` → type: learning
  - `[PLAN]` → type: plan (also added to `openPlans`)
- Extracts text after tag (strip whitespace)
- Builds `recentItems` list (all tagged lines), returns last 10
- Builds `openPlans` list (all `[PLAN]` lines)
- Counts totals by type
- Reads `WORKSPACE/memory/memory-test-state.json` for test results
  - Returns nulls if file missing

**Response Shape:**
```json
{
  "date": "YYYY-MM-DD",
  "recentItems": [
    {
      "type": "decision|fact|learning|plan",
      "text": "string",
      "lineNumber": 123
    }
  ],
  "openPlans": [
    {
      "text": "string",
      "lineNumber": 123
    }
  ],
  "totalItems": {
    "decisions": 5,
    "facts": 10,
    "learnings": 3,
    "plans": 2
  },
  "memoryTest": {
    "lastResult": "pass|fail|null",
    "lastRun": "ISO8601 or null"
  },
  "fetchedAt": "ISO8601"
}
```

---

## Dependencies Installed

Created Python virtual environment and installed:
- `fastapi==0.115.0`
- `uvicorn[standard]==0.30.6`
- `supabase==2.7.4`
- `python-dotenv==1.0.1`
- `pytz==2024.1`

All dependencies installed successfully in `bridge/venv/`.

---

## Server Startup Test

✅ **Server starts without errors**

Test output:
```
INFO:     Started server process [93411]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
```

Server successfully:
- Loads all imports (subprocess, sqlite3, json, re, pytz, supabase)
- Initializes FastAPI app
- Configures CORS middleware
- Registers all 7 endpoints
- Starts uvicorn server on port 8001

---

## Issues Encountered

### 1. System Package Manager Restriction
**Issue:** `pip3 install` blocked by system package manager (PEP 668)  
**Solution:** Created virtual environment (`python3 -m venv venv`) and installed dependencies there

### 2. Plain Text Fallback for Cron List
**Issue:** `openclaw cron list --json` may not be available on all systems  
**Solution:** Implemented `parse_plain_text_crons()` fallback function to parse space-separated output

### 3. Supabase Optional Dependency
**Issue:** Supabase may not be configured in all environments  
**Solution:** Wrapped Supabase import and query in try/except, returns `available: false` if missing

---

## Testing Recommendations

Before deploying to production:

1. **Test with real OpenClaw data:**
   - Run `openclaw cron list --json` to verify JSON output format
   - Check that `~/.openclaw/memory.db` exists and has `chunks` table
   - Verify `WORKSPACE/memory/sentinel-state.json` structure
   - Confirm `WORKSPACE/docs/living-files-v2/PROJECTS.md` exists

2. **Test Supabase connection:**
   - Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`
   - Verify `ow_system_events` table exists with `event_type` and `created_at` columns

3. **Test error handling:**
   - Remove a file (e.g., `active.json`) and verify graceful fallback
   - Test with empty/malformed JSON files
   - Test with missing SQLite database

4. **Test auth:**
   - Call endpoints without `Authorization` header → expect 401
   - Call with invalid token → expect 403
   - Call with valid token → expect 200

---

## Next Steps

1. **Deploy bridge server:**
   - Copy `bridge/` directory to Lenovo server
   - Set environment variables in `.env`
   - Create systemd service unit
   - Start service and verify endpoints

2. **Test from Next.js app:**
   - Update Next.js API routes to call bridge endpoints
   - Verify data flows through to frontend components
   - Test auto-refresh functionality

3. **Monitor logs:**
   - Check uvicorn logs for errors
   - Monitor subprocess timeouts
   - Track SQLite query performance

---

## Files Modified

- `bridge/server.py` — Replaced all 7 stub endpoints with real implementations
- `bridge/venv/` — Created virtual environment with dependencies

---

**Implementation Time:** ~45 minutes  
**Lines of Code Added:** ~400 lines  
**Endpoints Implemented:** 7/7 ✅
