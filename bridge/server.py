from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
import os
import json
import subprocess
import sqlite3
import glob
import re
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
import pytz

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://dash.gurudev.online", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

WORKSPACE = Path(os.environ.get('OPENCLAW_WORKSPACE', '/home/admin/.openclaw/workspace'))
API_TOKEN = os.getenv('GURUDASH_API_TOKEN')

def verify_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Missing or invalid Authorization header')
    token = authorization.split(' ')[1]
    if token != API_TOKEN:
        raise HTTPException(status_code=403, detail='Invalid token')
    return token

@app.get('/health')
def health():
    return {"status": "ok"}

@app.get('/crons', dependencies=[Depends(verify_token)])
def get_crons():
    try:
        result = subprocess.run(['openclaw', 'cron', 'list', '--json'], capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            result = subprocess.run(['openclaw', 'cron', 'list'], capture_output=True, text=True, timeout=10)
            crons_raw = parse_plain_text_crons(result.stdout)
        else:
            parsed = json.loads(result.stdout)
            # OpenClaw returns {"jobs": [...], "total": ...} not a bare array
            raw_jobs = parsed.get('jobs', parsed) if isinstance(parsed, dict) else parsed
            crons_raw = []
            for j in raw_jobs:
                state = j.get('state', {})
                payload = j.get('payload', {})
                # Convert ms timestamps to ISO strings
                last_ms = state.get('lastRunAtMs')
                next_ms = state.get('nextRunAtMs')
                from datetime import timezone
                last_iso = datetime.fromtimestamp(last_ms/1000, tz=timezone.utc).isoformat() if last_ms else None
                next_iso = datetime.fromtimestamp(next_ms/1000, tz=timezone.utc).isoformat() if next_ms else None
                crons_raw.append({
                    'id': j.get('id', j.get('name', '')),
                    'name': j.get('name', ''),
                    'status': state.get('lastRunStatus', 'ok'),
                    'consecutiveErrors': state.get('consecutiveErrors', 0),
                    'lastRun': last_iso,
                    'nextRun': next_iso,
                    'model': payload.get('model') if isinstance(payload, dict) else None,
                })
        
        history_file = Path.home() / '.openclaw' / 'cron-history.json'
        if history_file.exists():
            with open(history_file) as f:
                history = json.load(f)
        else:
            history = {}
        
        crons = []
        has_alerts = False
        for cron in crons_raw:
            cron_id = str(cron.get('id', cron.get('name', '')))
            name = cron.get('name', '')
            
            category = 'Other'
            if name.startswith(('gurutrade', 'mr_', 'te_', 'ep_')):
                category = 'Trading'
            elif name.startswith(('memory_', 'living_files_', 'inactivity_')):
                category = 'Memory'
            elif name.startswith(('morning_', 'claude_max_', 'openrouter_', 'weekly_workspace_', 'daily_openclaw_', 'session_size_', 'travel_sync', 'daily-memory')):
                category = 'Infra'
            elif name.startswith('college_'):
                category = 'College'
            elif name.startswith('hifi_'):
                category = 'HiFi'
            
            cron_history = history.get(cron_id, {'errorHistory7d': [0]*7, 'consecutiveErrors': 0})
            status = cron.get('status', 'ok')
            if status == 'error':
                cron_history['errorHistory7d'][-1] = 1
                cron_history['consecutiveErrors'] = cron_history.get('consecutiveErrors', 0) + 1
                has_alerts = True
            else:
                cron_history['consecutiveErrors'] = 0
                cron_history['errorHistory7d'][-1] = 0
            
            crons.append({
                'id': cron_id,
                'name': name,
                'category': category,
                'lastRun': cron.get('lastRun'),
                'nextRun': cron.get('nextRun'),
                'status': status,
                'consecutiveErrors': cron_history['consecutiveErrors'],
                'errorHistory7d': cron_history['errorHistory7d']
            })
            
            history[cron_id] = cron_history
        
        history_file.parent.mkdir(exist_ok=True)
        with open(history_file, 'w') as f:
            json.dump(history, f)
        
        return {
            'crons': crons,
            'hasAlerts': has_alerts,
            'fetchedAt': datetime.utcnow().isoformat() + 'Z'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def parse_plain_text_crons(output):
    lines = output.strip().split('\n')
    crons = []
    for line in lines[1:]:
        parts = line.split()
        if len(parts) >= 3:
            crons.append({
                'id': parts[0],
                'name': parts[1],
                'status': parts[5] if len(parts) > 5 else 'ok',
                'lastRun': parts[4] if len(parts) > 4 else None,
                'nextRun': parts[3] if len(parts) > 3 else None
            })
    return crons

@app.get('/memory', dependencies=[Depends(verify_token)])
def get_memory():
    try:
        sentinel_file = WORKSPACE / 'memory' / 'sentinel-state.json'
        last_capture = None
        if sentinel_file.exists():
            with open(sentinel_file) as f:
                sentinel = json.load(f)
            last_capture = sentinel.get('last_memory_capture')
        
        capture_log = WORKSPACE / 'memory' / 'capture_log.jsonl'
        last_t4 = None
        last_embedding = None
        pending_t4 = 0
        pending_embedding = 0
        
        if capture_log.exists():
            with open(capture_log) as f:
                for line in f:
                    if line.strip():
                        entry = json.loads(line.strip())
                        if entry.get('t4_processed'):
                            last_t4 = entry.get('captured_at')
                        else:
                            pending_t4 += 1
                        
                        if entry.get('embedded'):
                            last_embedding = entry.get('captured_at')
                        else:
                            pending_embedding += 1
        
        db_path = Path.home() / '.openclaw' / 'memory.db'
        chunks_by_context = {}
        total_chunks = 0
        
        if db_path.exists():
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            cursor.execute('SELECT context, COUNT(*) as count FROM chunks GROUP BY context')
            for row in cursor.fetchall():
                chunks_by_context[row[0]] = row[1]
                total_chunks += row[1]
            conn.close()
        
        now = datetime.utcnow()
        stale_threshold = timedelta(hours=25)
        
        def is_stale(timestamp):
            if not timestamp:
                return True
            try:
                ts = datetime.fromisoformat(timestamp.replace('Z', ''))
                return (now - ts) > stale_threshold
            except:
                return True
        
        stale_flags = {
            'capture': is_stale(last_capture),
            't4': is_stale(last_t4),
            'embedding': is_stale(last_embedding)
        }
        
        return {
            'lastCapture': last_capture,
            'lastT4Run': last_t4,
            'lastEmbedding': last_embedding,
            'pendingT4': pending_t4,
            'pendingEmbedding': pending_embedding,
            'chunksByContext': chunks_by_context,
            'totalChunks': total_chunks,
            'staleFlags': stale_flags,
            'fetchedAt': now.isoformat() + 'Z'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/trading', dependencies=[Depends(verify_token)])
def get_trading():
    try:
        result = subprocess.run(['openclaw', 'cron', 'list', '--json'], capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            result = subprocess.run(['openclaw', 'cron', 'list'], capture_output=True, text=True, timeout=10)
            crons_raw = parse_plain_text_crons(result.stdout)
        else:
            parsed = json.loads(result.stdout)
            # OpenClaw returns {"jobs": [...], "total": ...} not a bare array
            raw_jobs = parsed.get('jobs', parsed) if isinstance(parsed, dict) else parsed
            crons_raw = []
            for j in raw_jobs:
                state = j.get('state', {})
                payload = j.get('payload', {})
                # Convert ms timestamps to ISO strings
                last_ms = state.get('lastRunAtMs')
                next_ms = state.get('nextRunAtMs')
                from datetime import timezone
                last_iso = datetime.fromtimestamp(last_ms/1000, tz=timezone.utc).isoformat() if last_ms else None
                next_iso = datetime.fromtimestamp(next_ms/1000, tz=timezone.utc).isoformat() if next_ms else None
                crons_raw.append({
                    'id': j.get('id', j.get('name', '')),
                    'name': j.get('name', ''),
                    'status': state.get('lastRunStatus', 'ok'),
                    'consecutiveErrors': state.get('consecutiveErrors', 0),
                    'lastRun': last_iso,
                    'nextRun': next_iso,
                    'model': payload.get('model') if isinstance(payload, dict) else None,
                })
        
        trading_cron_names = [
            'mr_daily', 'te_daily', 'ep_daily',
            'mr_fill_check', 'te_fill_check', 'ep_fill_check',
            'gurutrade_te_observer', 'gurutrade_mr_observer',
            'gurutrade_monthly_retest', 'mr_signal_update'
        ]
        
        crons_map = {c['name']: c for c in crons_raw if c.get('name') in trading_cron_names}
        
        daily_runs = {}
        for name in ['mr_daily', 'te_daily', 'ep_daily']:
            cron = crons_map.get(name, {})
            status = cron.get('status', 'skipped')
            exit_code = 0 if status == 'ok' else (1 if status == 'error' else -1)
            daily_runs[name] = {
                'lastRun': cron.get('lastRun'),
                'status': status,
                'exitCode': exit_code
            }
        
        fill_checks = {}
        for name in ['mr_fill_check', 'te_fill_check', 'ep_fill_check']:
            cron = crons_map.get(name, {})
            fill_checks[name] = {
                'lastRun': cron.get('lastRun'),
                'status': cron.get('status', 'skipped')
            }
        
        observers = {}
        for name in ['gurutrade_te_observer', 'gurutrade_mr_observer']:
            cron = crons_map.get(name, {})
            key = 'te' if 'te' in name else 'mr'
            observers[key] = {
                'lastRun': cron.get('lastRun'),
                'status': cron.get('status', 'unknown'),
                'model': cron.get('model', 'unknown')
            }
        
        monthly_retest = {
            'lastRun': crons_map.get('gurutrade_monthly_retest', {}).get('lastRun'),
            'nextScheduled': crons_map.get('gurutrade_monthly_retest', {}).get('nextRun')
        }
        
        signal_freshness = {'lastUpdated': None, 'isStale': False}
        supabase_url = os.environ.get('SUPABASE_URL', '')
        supabase_key = os.environ.get('SUPABASE_ANON_KEY', '')
        
        if supabase_url and supabase_key:
            try:
                from supabase import create_client
                supabase = create_client(supabase_url, supabase_key)
                response = supabase.table('ow_system_events').select('created_at').eq('event_type', 'signal_update').order('created_at', desc=True).limit(1).execute()
                if response.data:
                    last_updated = response.data[0]['created_at']
                    signal_freshness['lastUpdated'] = last_updated
                    ts = datetime.fromisoformat(last_updated.replace('Z', ''))
                    signal_freshness['isStale'] = (datetime.utcnow() - ts) > timedelta(hours=26)
            except:
                pass
        
        return {
            'dailyRuns': daily_runs,
            'fillChecks': fill_checks,
            'signalFreshness': signal_freshness,
            'observers': observers,
            'monthlyRetest': monthly_retest,
            'fetchedAt': datetime.utcnow().isoformat() + 'Z'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/mission', dependencies=[Depends(verify_token)])
def get_mission():
    try:
        active_file = WORKSPACE / 'docs' / 'plans' / 'missions' / 'active.json'
        mission = None
        has_mission = False
        
        if active_file.exists():
            with open(active_file) as f:
                mission_data = json.load(f)
            
            if mission_data.get('status') in ['in_progress']:
                has_mission = True
                total_steps = len(mission_data.get('steps', []))
                completed_steps = sum(1 for s in mission_data.get('steps', []) if s.get('status') == 'completed')
                percent_complete = round((completed_steps / total_steps * 100)) if total_steps > 0 else 0
                
                last_activity = mission_data.get('lastActivityAt')
                is_idle = False
                if last_activity:
                    try:
                        last_activity_dt = datetime.fromisoformat(last_activity.replace('Z', ''))
                        is_idle = (datetime.utcnow() - last_activity_dt) > timedelta(minutes=30)
                    except:
                        pass
                
                steps = []
                for step in mission_data.get('steps', []):
                    desc = step.get('description', '')
                    steps.append({
                        **step,
                        'description': desc[:80] + '...' if len(desc) > 80 else desc
                    })
                
                mission = {
                    'missionId': mission_data.get('mission_id') or mission_data.get('missionId'),
                    'name': mission_data.get('mission_name') or mission_data.get('name'),
                    'status': mission_data.get('status'),
                    'percentComplete': percent_complete,
                    'totalSteps': total_steps,
                    'completedSteps': completed_steps,
                    'createdAt': mission_data.get('createdAt'),
                    'lastActivityAt': last_activity,
                    'isIdle': is_idle,
                    'steps': steps
                }
        
        last_completed = None
        archive_dir = WORKSPACE / 'docs' / 'plans' / 'missions' / 'archive'
        if archive_dir.exists():
            archive_files = sorted(archive_dir.glob('*.json'), key=lambda p: p.stat().st_mtime, reverse=True)
            if archive_files:
                with open(archive_files[0]) as f:
                    last_mission = json.load(f)
                last_completed = {
                    'missionId': last_mission.get('missionId'),
                    'name': last_mission.get('name'),
                    'completedAt': last_mission.get('completedAt')
                }
        
        return {
            'hasMission': has_mission,
            'mission': mission,
            'lastCompleted': last_completed,
            'fetchedAt': datetime.utcnow().isoformat() + 'Z'
        }
    except Exception as e:
        return {
            'hasMission': False,
            'mission': None,
            'lastCompleted': None,
            'fetchedAt': datetime.utcnow().isoformat() + 'Z'
        }

@app.get('/projects', dependencies=[Depends(verify_token)])
def get_projects():
    try:
        projects_file = WORKSPACE / 'docs' / 'living-files-v2' / 'PROJECTS.md'
        
        if not projects_file.exists():
            raise HTTPException(status_code=404, detail='PROJECTS.md not found')
        
        with open(projects_file) as f:
            content = f.read()
        
        # PROJECTS.md uses ### headers with status embedded in name: "### Name — STATUS"
        sections = re.split(r'\n### ', content)
        projects = []
        
        # Map name-embedded status to standard values
        status_map = {
            'ACTIVE': 'Active', 'Active': 'Active',
            'PENDING': 'Pending', 'Pending': 'Pending',
            'FUTURE': 'Future', 'Future': 'Future',
            'BACKLOG': 'Backlog', 'Backlog': 'Backlog',
            'COMPLETE': 'Backlog', 'DONE': 'Backlog',
            'BLOCKED': 'Pending', 'KIV': 'Backlog',
        }
        
        for section in sections[1:]:
            lines = section.split('\n')
            name_line = lines[0].strip()
            if not name_line or name_line.startswith('#'):
                continue
            
            # Extract status from name suffix "Name — STATUS"
            status = 'Backlog'
            name = name_line
            status_suffix = re.search(r' —\s*(\w+)\s*$', name_line)
            if status_suffix:
                raw_status = status_suffix.group(1)
                status = status_map.get(raw_status, 'Backlog')
                name = name_line[:status_suffix.start()].strip()
            
            section_text = '\n'.join(lines[1:])
            
            # Also check **Status:** field if present (overrides name suffix)
            status_match = re.search(r'\*\*Status:\*\*\s*(\w+)', section_text)
            if status_match:
                mapped = status_map.get(status_match.group(1))
                if mapped:
                    status = mapped
            
            priority_match = re.search(r'\*\*Priority:\*\*\s*(\w+)', section_text)
            priority = priority_match.group(1) if priority_match else None
            
            tags_match = re.search(r'\*\*Tags:\*\*\s*(.+)', section_text)
            tags = [t.strip() for t in tags_match.group(1).split(',')] if tags_match else []
            
            # Next step: look for **Next:** inline or first bullet after it
            next_step = None
            next_match = re.search(r'\*\*Next:\*\*\s*(.+)', section_text)
            if next_match:
                next_step = next_match.group(1).strip().lstrip('1) ').lstrip('- ')
            
            github_url = 'https://github.com/arvindmathur/Guru-OpenClaw/blob/master/docs/living-files-v2/PROJECTS.md'
            
            projects.append({
                'name': name,
                'status': status,
                'priority': priority,
                'nextStep': next_step,
                'tags': tags,
                'githubUrl': github_url
            })
        
        grouped = {'Active': [], 'Pending': [], 'Future': [], 'Backlog': []}
        for project in projects:
            if project['status'] in grouped:
                grouped[project['status']].append(project)
            else:
                grouped['Backlog'].append(project)
        
        return {
            'projects': projects,
            'grouped': grouped,
            'fetchedAt': datetime.utcnow().isoformat() + 'Z'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/sentinel', dependencies=[Depends(verify_token)])
def get_sentinel():
    try:
        sentinel_file = WORKSPACE / 'memory' / 'sentinel-state.json'
        
        if not sentinel_file.exists():
            raise HTTPException(status_code=404, detail='sentinel-state.json not found')
        
        with open(sentinel_file) as f:
            sentinel = json.load(f)
        
        mode = sentinel.get('mode', 'normal')
        current_model = 'anthropic/claude-sonnet-4-6' if mode == 'normal' else sentinel.get('lastSwitchTo', 'openrouter/deepseek/deepseek-v3.2')
        protection_until = sentinel.get('protectionUntil')
        last_switch_reason = sentinel.get('lastSwitchReason')
        last_switch_at = sentinel.get('lastSwitchAt')
        
        is_default = mode == 'normal'
        if last_switch_at:
            try:
                last_switch_dt = datetime.fromisoformat(last_switch_at.replace('Z', ''))
                is_default = is_default and (datetime.utcnow() - last_switch_dt) > timedelta(hours=3)
            except:
                pass
        
        last_switch = None
        if last_switch_reason and last_switch_at:
            last_switch = {
                'reason': last_switch_reason,
                'switchedAt': last_switch_at
            }
        
        fallback_history = []
        memory_dir = WORKSPACE / 'memory'
        for i in range(7):
            date = (datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d')
            log_file = memory_dir / f'{date}.md'
            
            if log_file.exists():
                with open(log_file) as f:
                    for line in f:
                        if re.search(r'\[DECISION\].*sentinel|\[FACT\].*model.*switch|\[FACT\].*fallback', line, re.IGNORECASE):
                            fallback_history.append({
                                'date': date,
                                'reason': line.strip(),
                                'fromModel': 'unknown',
                                'toModel': 'unknown'
                            })
                            if len(fallback_history) >= 10:
                                break
            if len(fallback_history) >= 10:
                break
        
        cost_file = Path.home() / '.openclaw' / 'logs' / 'openrouter_usage.json'
        openrouter_cost = {'today': 0, 'last7d': 0, 'available': False}
        
        if cost_file.exists():
            try:
                with open(cost_file) as f:
                    cost_data = json.load(f)
                openrouter_cost = {
                    'today': cost_data.get('today', 0),
                    'last7d': cost_data.get('last7d', 0),
                    'available': True
                }
            except:
                pass
        
        return {
            'currentModel': current_model,
            'isDefault': is_default,
            'sentinelMode': mode,
            'protectionUntil': protection_until,
            'lastSwitch': last_switch,
            'fallbackHistory7d': fallback_history,
            'openrouterCost': openrouter_cost,
            'fetchedAt': datetime.utcnow().isoformat() + 'Z'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/activity', dependencies=[Depends(verify_token)])
def get_activity():
    try:
        sg_tz = pytz.timezone('Asia/Singapore')
        today = datetime.now(sg_tz).strftime('%Y-%m-%d')
        
        log_file = WORKSPACE / 'memory' / f'{today}.md'
        
        if not log_file.exists():
            return {
                'date': today,
                'recentItems': [],
                'openPlans': [],
                'totalItems': {'decisions': 0, 'facts': 0, 'learnings': 0, 'plans': 0},
                'memoryTest': {'lastResult': None, 'lastRun': None},
                'fetchedAt': datetime.utcnow().isoformat() + 'Z'
            }
        
        with open(log_file) as f:
            lines = f.readlines()
        
        recent_items = []
        open_plans = []
        totals = {'decisions': 0, 'facts': 0, 'learnings': 0, 'plans': 0}
        
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith('- '):
                stripped = stripped[2:].strip()
            
            if stripped.startswith('[DECISION]'):
                totals['decisions'] += 1
                recent_items.append({'type': 'decision', 'text': stripped[11:].strip(), 'lineNumber': i})
            elif stripped.startswith('[FACT]'):
                totals['facts'] += 1
                recent_items.append({'type': 'fact', 'text': stripped[6:].strip(), 'lineNumber': i})
            elif stripped.startswith('[LEARNING]'):
                totals['learnings'] += 1
                recent_items.append({'type': 'learning', 'text': stripped[10:].strip(), 'lineNumber': i})
            elif stripped.startswith('[PLAN]'):
                totals['plans'] += 1
                plan_item = {'text': stripped[6:].strip(), 'lineNumber': i}
                recent_items.append({'type': 'plan', 'text': stripped[6:].strip(), 'lineNumber': i})
                open_plans.append(plan_item)
        
        recent_items = recent_items[-10:]
        
        test_file = WORKSPACE / 'memory' / 'memory-test-state.json'
        memory_test = {'lastResult': None, 'lastRun': None}
        
        if test_file.exists():
            try:
                with open(test_file) as f:
                    test_data = json.load(f)
                memory_test = {
                    'lastResult': test_data.get('lastResult'),
                    'lastRun': test_data.get('lastRun')
                }
            except:
                pass
        
        return {
            'date': today,
            'recentItems': recent_items,
            'openPlans': open_plans,
            'totalItems': totals,
            'memoryTest': memory_test,
            'fetchedAt': datetime.utcnow().isoformat() + 'Z'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
