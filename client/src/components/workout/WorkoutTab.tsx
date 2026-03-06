import { useState, useEffect, useRef } from 'react';
import type { ExerciseScore, Routine, RoutineExercise, WorkoutSession } from '../../types';
import { getRoutines, createRoutine, updateRoutine, deleteRoutine, startSession, getSessions, getSessionDetail } from '../../api';
import RoutineEditor from './RoutineEditor';
import ActiveSession from './ActiveSession';

const SPLITS: Record<number, string[][]> = {
  1: [['chest', 'back', 'shoulders', 'arms', 'legs']],
  2: [['chest', 'shoulders', 'arms'], ['back', 'legs']],
  3: [['chest', 'shoulders'], ['back', 'arms'], ['legs']],
  4: [['chest'], ['back'], ['shoulders', 'arms'], ['legs']],
  5: [['chest'], ['back'], ['shoulders'], ['arms'], ['legs']],
};

function buildAiRoutines(rankResults: ExerciseScore[], gymExp: string, days: number) {
  const perGroup = gymExp === 'advanced' ? 3 : 2;
  return (SPLITS[days] ?? SPLITS[3]).map((groups, i) => {
    let order = 0;
    const exercises: RoutineExercise[] = [];
    for (const g of groups) {
      for (const ex of rankResults.filter(r => r.muscle_group === g).slice(0, perGroup)) {
        exercises.push({ exercise_id: ex.exercise_id, name: ex.name, display_order: order++, sets: 3, reps_target: 10, weight_target: null });
      }
    }
    return { name: `AI 추천 ${i + 1}일차`, exercises };
  });
}

function fmtDur(started: string, ended: string | null) {
  if (!ended) return '-';
  const m = Math.round((+new Date(ended) - +new Date(started)) / 60000);
  return m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

function fmtDate(dateStr: string) {
  const parts = dateStr.split('T')[0].split('-');
  return `${parseInt(parts[1])}월 ${parseInt(parts[2])}일`;
}

type DetailLog = { exercise_id: string; set_number: number; reps_done: number; weight_done: number | null };
type DetailFeedback = { exercise_id: string; rpe: number | null; satisfaction: number | null };
type SessionDetail = { logs: DetailLog[]; feedback: DetailFeedback[] };

interface Props {
  rankResults: ExerciseScore[];
  gymExp: string;
}

export default function WorkoutTab({ rankResults, gymExp }: Props) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editTarget, setEditTarget] = useState<Routine | null>(null);
  const [activeSession, setActiveSession] = useState<{ session: WorkoutSession; exercises: RoutineExercise[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAiPicker, setShowAiPicker] = useState(false);
  const [aiDays, setAiDays] = useState(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, SessionDetail>>({});
  const pendingRef = useRef<{ session: WorkoutSession; exercises: RoutineExercise[] } | null>(null);
  const nameMap = Object.fromEntries(rankResults.map(r => [r.exercise_id, r.name]));

  useEffect(() => {
    getRoutines().then(setRoutines).catch(() => {});
    getSessions().then(setSessions).catch(() => {});
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (pendingRef.current) { setActiveSession(pendingRef.current); pendingRef.current = null; }
      setCountdown(null);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c !== null ? c - 1 : null), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSave = async (name: string, exercises: RoutineExercise[]) => {
    setError(null);
    try {
      if (mode === 'create') {
        const id = await createRoutine(name, exercises);
        if (!id) throw new Error();
        setRoutines(prev => [{ id, name, exercises, created_at: new Date().toISOString() }, ...prev]);
      } else if (mode === 'edit' && editTarget) {
        await updateRoutine(editTarget.id, name, exercises);
        setRoutines(prev => prev.map(r => r.id === editTarget.id ? { ...r, name, exercises } : r));
      }
      setMode('list'); setEditTarget(null);
    } catch { setError('루틴 저장에 실패했습니다. 서버 연결을 확인해주세요.'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('루틴을 삭제하시겠습니까?')) return;
    try { await deleteRoutine(id); setRoutines(prev => prev.filter(r => r.id !== id)); }
    catch { setError('삭제에 실패했습니다.'); }
  };

  const handleStart = async (routine: Routine) => {
    try {
      const session = await startSession(routine.id);
      pendingRef.current = { session, exercises: routine.exercises };
      setCountdown(3);
    } catch { setError('운동 세션 시작에 실패했습니다. 서버 연결을 확인해주세요.'); }
  };

  const handleAiGenerate = async () => {
    const defs = buildAiRoutines(rankResults, gymExp, aiDays);
    if (defs.every(r => r.exercises.length === 0)) {
      setError('운동 추천 결과가 없습니다. 온보딩을 완료해주세요.');
      setShowAiPicker(false);
      return;
    }
    try {
      const created: Routine[] = [];
      for (const def of defs) {
        const id = await createRoutine(def.name, def.exercises);
        if (id) created.push({ id, name: def.name, exercises: def.exercises, created_at: new Date().toISOString() });
      }
      setRoutines(prev => [...created, ...prev]);
      setShowAiPicker(false);
    } catch { setError('AI 루틴 생성에 실패했습니다.'); }
  };

  const handleToggleDetail = async (sessionId: string) => {
    if (expandedId === sessionId) { setExpandedId(null); return; }
    setExpandedId(sessionId);
    if (!detailCache[sessionId]) {
      const detail = await getSessionDetail(sessionId);
      setDetailCache(prev => ({ ...prev, [sessionId]: detail }));
    }
  };

  const handleClose = () => {
    setActiveSession(null);
    getSessions().then(setSessions).catch(() => {});
  };

  if (activeSession) {
    return <ActiveSession session={activeSession.session} exercises={activeSession.exercises} onClose={handleClose} />;
  }

  if (mode === 'create' || mode === 'edit') {
    return (
      <RoutineEditor
        initial={editTarget}
        rankResults={rankResults}
        onSave={handleSave}
        onCancel={() => { setMode('list'); setEditTarget(null); }}
      />
    );
  }

  return (
    <div className="workout-tab">
      {countdown !== null && countdown > 0 && (
        <div className="countdown-overlay">
          <div className="countdown-number">{countdown}</div>
        </div>
      )}

      {error && <div className="workout-error" onClick={() => setError(null)}>{error}</div>}

      <div className="workout-tab-header">
        <button className="btn-ai-routine" onClick={() => setShowAiPicker(v => !v)}>AI 루틴 생성</button>
        <button className="btn-next" onClick={() => setMode('create')}>+ 새 루틴</button>
      </div>

      {showAiPicker && (
        <div className="ai-picker">
          <span className="ai-picker-label">분할 수</span>
          <div className="ai-picker-btns">
            {[1, 2, 3, 4, 5].map(d => (
              <button
                key={d}
                className={`rest-dur-btn${aiDays === d ? ' on' : ''}`}
                onClick={() => setAiDays(d)}
              >{d}일</button>
            ))}
          </div>
          <button className="btn-next ai-gen-btn" onClick={handleAiGenerate}>생성</button>
        </div>
      )}

      {routines.length === 0 ? (
        <p className="chart-empty">루틴이 없습니다. 새 루틴을 만들거나 AI 루틴을 생성하세요.</p>
      ) : (
        <div className="routine-list">
          {routines.map(r => (
            <div key={r.id} className="routine-card">
              <div className="routine-card-info">
                <p className="routine-name">{r.name}</p>
                <p className="routine-meta">{r.exercises.length}개 운동</p>
              </div>
              <div className="routine-card-actions">
                <button className="re-btn" onClick={() => { setEditTarget(r); setMode('edit'); }}>편집</button>
                <button className="re-btn danger" onClick={() => handleDelete(r.id)}>삭제</button>
                <button className="btn-start" onClick={() => handleStart(r)}>▶ 시작</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {sessions.length > 0 && (
        <div className="session-history">
          <p className="re-panel-title">운동 기록</p>
          {sessions.map(s => {
            const isOpen = expandedId === s.id;
            const detail = detailCache[s.id];
            // group logs by exercise_id (preserve insertion order)
            const exGroups: { exercise_id: string; sets: DetailLog[] }[] = [];
            if (detail) {
              for (const log of detail.logs) {
                const g = exGroups.find(e => e.exercise_id === log.exercise_id);
                if (g) g.sets.push(log);
                else exGroups.push({ exercise_id: log.exercise_id, sets: [log] });
              }
            }
            return (
              <div key={s.id} className={`session-history-card${isOpen ? ' open' : ''}`}>
                <button className="sh-header" onClick={() => handleToggleDetail(s.id)}>
                  <span className="sh-date">{fmtDate(s.date ?? s.started_at)}</span>
                  <span className="sh-name">{s.routine_name ?? 'AI 추천'}</span>
                  <span className="sh-dur">{fmtDur(s.started_at, s.ended_at)}</span>
                  <span className="sh-chevron">{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div className="sh-detail">
                    {!detail ? (
                      <p className="sh-loading">불러오는 중...</p>
                    ) : exGroups.length === 0 ? (
                      <p className="sh-loading">기록된 세트가 없습니다.</p>
                    ) : exGroups.map(({ exercise_id, sets }) => {
                      const fb = detail.feedback.find(f => f.exercise_id === exercise_id);
                      const maxW = Math.max(...sets.map(s => s.weight_done ?? 0));
                      const totalVol = sets.reduce((acc, s) => acc + s.reps_done * (s.weight_done ?? 0), 0);
                      return (
                        <div key={exercise_id} className="sh-ex-block">
                          <div className="sh-ex-header">
                            <span className="sh-ex-name">{nameMap[exercise_id] ?? exercise_id}</span>
                            <span className="sh-ex-meta">
                              {sets.length}세트
                              {maxW > 0 && ` · 최대 ${maxW}kg`}
                              {totalVol > 0 && ` · 볼륨 ${totalVol}kg`}
                            </span>
                            {fb && (
                              <span className="sh-ex-fb">
                                RPE {fb.rpe ?? '-'} · {'★'.repeat(fb.satisfaction ?? 0)}{'☆'.repeat(5 - (fb.satisfaction ?? 0))}
                              </span>
                            )}
                          </div>
                          <div className="sh-sets-row">
                            {sets.map(set => (
                              <span key={set.set_number} className="sh-set-chip">
                                {set.weight_done != null ? `${set.weight_done}kg×` : ''}{set.reps_done}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
