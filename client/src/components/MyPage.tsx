import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { OnboardingState, ExerciseScore, WorkoutSession } from '../types';
import { EQUIPMENT } from '../constants';
import { saveProfile, getSessions, getWeeklyVolume } from '../api';
import WorkoutTab from './workout/WorkoutTab';

interface Measurement {
  recorded_at: string;
  weight: number | null;
  body_fat: number | null;
  muscle_mass: number | null;
}

interface Props {
  state: OnboardingState;
  onUpdate: (u: Partial<OnboardingState>) => void;
  rankResults: ExerciseScore[];
  onRefreshRanking: () => void;
  onBack: () => void;
  onLogout: () => void;
}

const RANK_GROUPS = [
  { id: 'chest',     label: '가슴' },
  { id: 'back',      label: '등' },
  { id: 'shoulders', label: '어깨' },
  { id: 'arms',      label: '팔' },
  { id: 'legs',      label: '하체' },
];

const GOALS = [
  { id: 'diet',        name: '다이어트' },
  { id: 'strength',    name: '근력 향상' },
  { id: 'hypertrophy', name: '근비대' },
];

const EXP_OPTS = [
  { id: 'beginner',     label: '초보', sub: '< 1년' },
  { id: 'intermediate', label: '중급', sub: '1~3년' },
  { id: 'advanced',     label: '고급', sub: '3년+' },
];

// 경력별 주간 분할
const SPLITS: Record<string, { label: string; groups: string[] }[]> = {
  beginner: [
    { label: 'Day 1', groups: ['chest', 'shoulders'] },
    { label: 'Day 2', groups: ['legs'] },
    { label: 'Day 3', groups: ['back', 'arms'] },
  ],
  intermediate: [
    { label: 'Day 1', groups: ['chest', 'shoulders'] },
    { label: 'Day 2', groups: ['legs'] },
    { label: 'Day 3', groups: ['back'] },
    { label: 'Day 4', groups: ['arms', 'shoulders'] },
  ],
  advanced: [
    { label: 'Day 1', groups: ['chest'] },
    { label: 'Day 2', groups: ['back'] },
    { label: 'Day 3', groups: ['legs'] },
    { label: 'Day 4', groups: ['shoulders'] },
    { label: 'Day 5', groups: ['arms'] },
  ],
};

const WEEK_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekDates(): string[] {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localDateStr(d);
  });
}

function todayStr(): string {
  return localDateStr(new Date());
}

function calcBmi(weight: string, height: string): string {
  const w = parseFloat(weight);
  const h = parseFloat(height) / 100;
  if (!w || !h) return '--';
  return (w / (h * h)).toFixed(1);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function buildRoutine(gymExp: string, rankResults: ExerciseScore[]) {
  const split = SPLITS[gymExp] ?? SPLITS.beginner;
  return split.map(day => ({
    label: day.label,
    groupLabel: day.groups.map(g => RANK_GROUPS.find(r => r.id === g)?.label ?? g).join(' + '),
    exercises: day.groups.flatMap(group =>
      rankResults
        .filter(r => r.muscle_group === group)
        .slice(0, day.groups.length === 1 ? 4 : 2)
        .map(r => r.name),
    ),
  }));
}

export default function MyPage({ state, onUpdate, rankResults, onRefreshRanking, onBack, onLogout }: Props) {
  const [tab, setTab] = useState<'body' | 'info' | 'rank' | 'workout'>('body');
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [workoutDates, setWorkoutDates] = useState<string[]>([]);
  const [recentSessions, setRecentSessions] = useState<WorkoutSession[]>([]);
  const [weeklyVolume, setWeeklyVolume] = useState<Record<string, number>>({});
  const [newWeight, setNewWeight] = useState('');
  const [newBodyFat, setNewBodyFat] = useState('');
  const [newMuscleMass, setNewMuscleMass] = useState('');
  const [saving, setSaving] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [rankGroup, setRankGroup] = useState('chest');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadMeasurements = () => {
    fetch('/api/measurements', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Measurement[]) => setMeasurements(data))
      .catch(() => {});
  };

  const loadWorkoutLogs = () => {
    fetch('/api/workout-logs', { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then((dates: string[]) => setWorkoutDates(dates))
      .catch(() => {});
  };

  useEffect(() => {
    loadMeasurements();
    loadWorkoutLogs();
    getSessions().then(setRecentSessions);
    getWeeklyVolume().then(setWeeklyVolume);
  }, []);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await fetch('/api/workout-logs', { method: 'POST', credentials: 'include' });
      loadWorkoutLogs();
      showToast('오늘 운동 기록이 저장되었습니다!');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleAddMeasurement = async () => {
    if (!newWeight && !newBodyFat && !newMuscleMass) {
      showToast('최소 하나의 수치를 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      await fetch('/api/measurements', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weight: newWeight ? parseFloat(newWeight) : null,
          body_fat: newBodyFat ? parseFloat(newBodyFat) : null,
          muscle_mass: newMuscleMass ? parseFloat(newMuscleMass) : null,
        }),
      });
      setNewWeight(''); setNewBodyFat(''); setNewMuscleMass('');
      loadMeasurements();
      showToast('저장되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveInfo = async () => {
    setSaving(true);
    try {
      await saveProfile(state);
      onRefreshRanking();
      showToast('정보가 저장되었습니다. 운동 추천을 다시 계산합니다.');
    } catch {
      showToast('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const bmi = calcBmi(state.weight, state.height);
  const latestMeasurement = measurements[measurements.length - 1];
  const weekDates = getWeekDates();
  const today = todayStr();
  const todayDone = workoutDates.includes(today);
  const weekCount = weekDates.filter(d => workoutDates.includes(d)).length;
  const routine = buildRoutine(state.gymExp, rankResults);
  const targetDays = (SPLITS[state.gymExp] ?? SPLITS.beginner).length;

  const chartData = measurements.map(m => ({
    date: fmtDate(m.recorded_at),
    체중: m.weight,
    체지방: m.body_fat,
    근육량: m.muscle_mass,
  }));

  // 주간 볼륨 차트용 (최근 7일 날짜 레이블)
  const volumeChartData = weekDates.map(d => ({
    day: WEEK_LABELS[weekDates.indexOf(d)],
    볼륨: Math.round(weeklyVolume[d] ?? 0),
  }));

  const filteredRank = rankResults.filter(r => r.muscle_group === rankGroup);

  return (
    <div className="mypage-layout">
      <div className="login-noise" />

      {/* ── 왼쪽 사이드바 ─────────────────────── */}
      <aside className="mp-sidebar">
        <button className="mp-back-btn" onClick={onBack}>← 돌아가기</button>
        <button className="mp-logout-btn" onClick={onLogout}>로그아웃</button>

        <button className="btn-sidebar-workout" onClick={() => setTab('workout')}>
          ▶ 운동 시작
        </button>

        {/* 주간 체크인 */}
        <div className="mp-widget">
          <div className="mp-widget-title">이번 주 기록</div>
          <div className="week-dots">
            {weekDates.map((d, i) => (
              <div key={d} className="week-dot-col">
                <div className={`week-dot${workoutDates.includes(d) ? ' done' : ''}${d === today ? ' today' : ''}`} />
                <span className="week-label">{WEEK_LABELS[i]}</span>
              </div>
            ))}
          </div>
          <div className="week-count">
            <span className="week-count-num">{weekCount}</span>
            <span className="week-count-total"> / {targetDays}일 목표</span>
          </div>
          <button
            className={`btn-checkin${todayDone ? ' done' : ''}`}
            onClick={handleCheckIn}
            disabled={todayDone || checkingIn}
          >
            {todayDone ? '✓ 오늘 완료' : checkingIn ? '저장 중…' : '오늘 운동 완료'}
          </button>
        </div>

        {/* 최근 세션 */}
        {recentSessions.length > 0 && (
          <div className="mp-widget">
            <div className="mp-widget-title">최근 운동</div>
            {recentSessions.slice(0, 2).map(s => {
              const dur = s.ended_at
                ? Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)
                : null;
              return (
                <div key={s.id} className="session-history-row">
                  <span className="session-history-name">{s.routine_name ?? '자유 운동'}</span>
                  <span className="session-history-meta">
                    {s.date ? `${parseInt(s.date.slice(5,7))}월 ${parseInt(s.date.slice(8,10))}일` : ''}
                    {dur ? ` · ${dur}분` : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 주간 루틴 */}
        <div className="mp-widget">
          <div className="mp-widget-title">주간 루틴 추천</div>
          {rankResults.length === 0 ? (
            <div className="routine-empty">운동 추천 결과가 없습니다.</div>
          ) : (
            routine.map((day, i) => (
              <div key={i} className="routine-day">
                <div className="routine-day-header">
                  <span className="routine-day-label">{day.label}</span>
                  <span className="routine-day-group">{day.groupLabel}</span>
                </div>
                {day.exercises.map((ex, j) => (
                  <div key={j} className="routine-ex">· {ex}</div>
                ))}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── 오른쪽 메인 ───────────────────────── */}
      <main className="mp-main">
        <div className="mp-main-header">
          <div className="mp-title">마이페이지</div>
        </div>

        <div className="mp-tabs">
          {([['body', '신체 변화'], ['info', '내 정보'], ['rank', '운동 추천'], ['workout', '루틴 관리']] as const).map(([id, label]) => (
            <button
              key={id}
              className={`mp-tab${tab === id ? ' on' : ''}`}
              onClick={() => setTab(id)}
            >{label}</button>
          ))}
        </div>

        {/* ── 신체 변화 탭 */}
        {tab === 'body' && (
          <div className="mp-content">
            <div className="stat-grid">
              <div className="stat-card">
                <div className="stat-label">BMI</div>
                <div className="stat-value">{bmi}</div>
                <div className="stat-sub">체중 / 키²</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">체중</div>
                <div className="stat-value">{(latestMeasurement?.weight ?? state.weight) || '--'}<span className="stat-unit">kg</span></div>
                <div className="stat-sub">최근 측정</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">체지방률</div>
                <div className="stat-value">{(latestMeasurement?.body_fat ?? state.bodyFat) || '--'}<span className="stat-unit">%</span></div>
                <div className="stat-sub">최근 측정</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">골격근량</div>
                <div className="stat-value">{(latestMeasurement?.muscle_mass ?? state.muscleMass) || '--'}<span className="stat-unit">kg</span></div>
                <div className="stat-sub">최근 측정</div>
              </div>
            </div>

            <div className="mp-section">
              <div className="mp-section-title">새 측정값 입력</div>
              <div className="measure-row">
                <div className="measure-field">
                  <label>체중 (kg)</label>
                  <input type="number" step="0.1" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="예) 75.5" className="fi" />
                </div>
                <div className="measure-field">
                  <label>체지방률 (%)</label>
                  <input type="number" step="0.1" value={newBodyFat} onChange={e => setNewBodyFat(e.target.value)} placeholder="예) 18.3" className="fi" />
                </div>
                <div className="measure-field">
                  <label>골격근량 (kg)</label>
                  <input type="number" step="0.1" value={newMuscleMass} onChange={e => setNewMuscleMass(e.target.value)} placeholder="예) 32.1" className="fi" />
                </div>
              </div>
              <button className="btn-mp-save" onClick={handleAddMeasurement} disabled={saving}>
                {saving ? '저장 중…' : '+ 측정값 저장'}
              </button>
            </div>

            <div className="mp-section">
              <div className="mp-section-title">이번 주 운동 볼륨</div>
              {volumeChartData.every(d => d.볼륨 === 0) ? (
                <div className="chart-empty">운동 세션을 완료하면 볼륨 차트가 표시됩니다.</div>
              ) : (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={volumeChartData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                      <XAxis dataKey="day" stroke="#5C4030" tick={{ fill: '#A08070', fontSize: 11 }} />
                      <YAxis stroke="#5C4030" tick={{ fill: '#A08070', fontSize: 11 }} width={48} />
                      <Tooltip
                        contentStyle={{ background: '#1A1210', border: '1px solid #3D2820', borderRadius: 6 }}
                        labelStyle={{ color: '#A08070' }}
                        itemStyle={{ color: '#F0E8E0' }}
                        formatter={(v: number | undefined) => v != null ? [`${v.toLocaleString()}kg`, '볼륨'] : ['', '볼륨']}
                      />
                      <Bar dataKey="볼륨" fill="#D4523E" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="mp-section">
              <div className="mp-section-title">체성분 변화 추이</div>
              {chartData.length < 2 ? (
                <div className="chart-empty">측정값을 2회 이상 입력하면 변화 추이 차트가 표시됩니다.</div>
              ) : (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                      <XAxis dataKey="date" stroke="#5C4030" tick={{ fill: '#A08070', fontSize: 11 }} />
                      <YAxis stroke="#5C4030" tick={{ fill: '#A08070', fontSize: 11 }} width={36} />
                      <Tooltip
                        contentStyle={{ background: '#1A1210', border: '1px solid #3D2820', borderRadius: 6 }}
                        labelStyle={{ color: '#A08070' }}
                        itemStyle={{ color: '#F0E8E0' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: '#A08070' }} />
                      <Line type="monotone" dataKey="체중" stroke="#D4523E" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="체지방" stroke="#C87941" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                      <Line type="monotone" dataKey="근육량" stroke="#6AAF6A" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 내 정보 탭 */}
        {tab === 'info' && (
          <div className="mp-content">
            <div className="mp-section">
              <div className="mp-section-title">기본 정보</div>
              <div className="info-grid">
                <div className="fg">
                  <div className="fl">나이</div>
                  <input className="fi" type="number" value={state.age} onChange={e => onUpdate({ age: e.target.value })} placeholder="세" />
                </div>
                <div className="fg">
                  <div className="fl">키 (cm)</div>
                  <input className="fi" type="number" value={state.height} onChange={e => onUpdate({ height: e.target.value })} placeholder="cm" />
                </div>
                <div className="fg">
                  <div className="fl">성별</div>
                  <select className="fi" value={state.gender} onChange={e => onUpdate({ gender: e.target.value })}>
                    <option value="">선택</option>
                    <option value="male">남성</option>
                    <option value="female">여성</option>
                  </select>
                </div>
                <div className="fg">
                  <div className="fl">체중 (kg)</div>
                  <input className="fi" type="number" step="0.1" value={state.weight} onChange={e => onUpdate({ weight: e.target.value })} placeholder="kg" />
                </div>
              </div>
            </div>

            <div className="mp-section">
              <div className="mp-section-title">신체 측정 <span className="fopt-badge">선택</span></div>
              <div className="info-grid">
                <div className="fg"><div className="fl">체지방률 (%)</div><input className="fi" type="number" step="0.1" value={state.bodyFat} onChange={e => onUpdate({ bodyFat: e.target.value })} placeholder="%" /></div>
                <div className="fg"><div className="fl">골격근량 (kg)</div><input className="fi" type="number" step="0.1" value={state.muscleMass} onChange={e => onUpdate({ muscleMass: e.target.value })} placeholder="kg" /></div>
                <div className="fg"><div className="fl">상완골 (cm)</div><input className="fi" type="number" step="0.1" value={state.upperArm} onChange={e => onUpdate({ upperArm: e.target.value })} placeholder="cm" /></div>
                <div className="fg"><div className="fl">전완 (cm)</div><input className="fi" type="number" step="0.1" value={state.forearm} onChange={e => onUpdate({ forearm: e.target.value })} placeholder="cm" /></div>
                <div className="fg"><div className="fl">대퇴골 (cm)</div><input className="fi" type="number" step="0.1" value={state.thigh} onChange={e => onUpdate({ thigh: e.target.value })} placeholder="cm" /></div>
                <div className="fg"><div className="fl">경골 (cm)</div><input className="fi" type="number" step="0.1" value={state.shin} onChange={e => onUpdate({ shin: e.target.value })} placeholder="cm" /></div>
              </div>
            </div>

            <div className="mp-section">
              <div className="mp-section-title">사용 가능 기구</div>
              <div className="equip-grid">
                {EQUIPMENT.map(eq => {
                  const isOn = state.equipment.includes(eq.id);
                  return (
                    <div
                      key={eq.id}
                      className={`equip-card${isOn ? ' on' : ''}`}
                      onClick={() => {
                        const next = isOn ? state.equipment.filter(e => e !== eq.id) : [...state.equipment, eq.id];
                        onUpdate({ equipment: next });
                      }}
                    >
                      <span className="equip-icon">{eq.icon}</span>
                      <span>{eq.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mp-section">
              <div className="mp-section-title">운동 목표</div>
              <div className="goal-grid">
                {GOALS.map(g => (
                  <div key={g.id} className={`goal-card${state.goal === g.id ? ' on' : ''}`} onClick={() => onUpdate({ goal: g.id })}>
                    <div className="goal-name">{g.name}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <div className="fl" style={{ marginBottom: 6 }}>근력 운동 경력</div>
                <div className="exp-row">
                  {EXP_OPTS.map(e => (
                    <button key={e.id} className={`exp-btn${state.strengthExp === e.id ? ' on' : ''}`} onClick={() => onUpdate({ strengthExp: e.id })}>
                      {e.label}<span className="exp-sublabel">{e.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                <div className="fl" style={{ marginBottom: 6 }}>헬스 경력</div>
                <div className="exp-row">
                  {EXP_OPTS.map(e => (
                    <button key={e.id} className={`exp-btn${state.gymExp === e.id ? ' on' : ''}`} onClick={() => onUpdate({ gymExp: e.id })}>
                      {e.label}<span className="exp-sublabel">{e.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mp-section">
              <div className="mp-section-title">5대 운동 1RM <span className="fopt-badge">선택</span></div>
              <div className="info-grid">
                {([
                  ['rm_squat', '스쿼트'], ['rm_bench', '벤치 프레스'], ['rm_deadlift', '데드리프트'],
                  ['rm_row', '바벨 로우'], ['rm_ohp', 'OHP'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="fg">
                    <div className="fl">{label}</div>
                    <div className="fi-wrap">
                      <input className="fi" type="number" step="0.5" value={state[key]} onChange={e => onUpdate({ [key]: e.target.value })} placeholder="kg" />
                      <span className="fi-unit">kg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button className="btn-mp-save btn-mp-primary" onClick={handleSaveInfo} disabled={saving}>
              {saving ? '저장 중…' : '저장 및 랭킹 재계산'}
            </button>
          </div>
        )}

        {/* ── 운동 추천 탭 */}
        {tab === 'rank' && (
          <div className="mp-content">
            {!(state.rm_squat && state.rm_bench && state.rm_deadlift && state.rm_row && state.rm_ohp) && (
              <div className="rm-notice">
                💡 5대 운동 1RM을 입력하면 부상 위험도와 운동 강도를 더 정확하게 분석할 수 있습니다.
                <button className="rm-notice-btn" onClick={() => setTab('info')}>내 정보에서 입력하기 →</button>
              </div>
            )}
            <div className="grp-tabs" style={{ marginBottom: 16 }}>
              {RANK_GROUPS.map(g => (
                <button key={g.id} className={`grp-tab${rankGroup === g.id ? ' on' : ''}`} onClick={() => setRankGroup(g.id)}>{g.label}</button>
              ))}
            </div>
            {filteredRank.length === 0 ? (
              <div className="chart-empty">해당 부위 운동이 없습니다.</div>
            ) : (
              <div className="ex-list">
                {filteredRank.slice(0, 20).map((r, i) => {
                  const s = r.sub_scores;
                  return (
                    <div key={r.exercise_id} className="ex-card">
                      <div className="ex-rank">#{i + 1}</div>
                      <div className="ex-info">
                        <div className="ex-name-row">
                          <span className="ex-name">{r.name}</span>
                          {r.rm_used
                            ? <span className="rm-badge precise">정밀</span>
                            : <span className="rm-badge estimated">추정</span>
                          }
                        </div>
                        <div className="ex-bar-wrap"><div className="ex-bar" style={{ width: `${Math.round(r.score)}%` }} /></div>
                        <div className="ex-subs">
                          <span className="sub-chip">근력 {s.strength}</span>
                          <span className="sub-chip">안전 {s.injury}</span>
                          <span className="sub-chip">골격 {s.skeleton}</span>
                          <span className="sub-chip">목표 {s.goal}</span>
                        </div>
                      </div>
                      <div className="ex-score-badge">{r.score.toFixed(1)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 루틴 관리 탭 */}
        {tab === 'workout' && (
          <div className="mp-content">
            <WorkoutTab rankResults={rankResults} gymExp={state.gymExp} />
          </div>
        )}
      </main>

      {toast && <div className="error-toast">{toast}</div>}
    </div>
  );
}
