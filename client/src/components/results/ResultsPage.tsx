import { useState } from 'react';
import type { ExerciseScore } from '../../types';

const GROUPS = [
  { id: 'chest',     label: '가슴' },
  { id: 'back',      label: '등' },
  { id: 'shoulders', label: '어깨' },
  { id: 'arms',      label: '팔' },
  { id: 'legs',      label: '하체' },
];

interface Props {
  results: ExerciseScore[];
  loading: boolean;
  error: string | null;
  hasRm: boolean;
  onRetry: () => void;
  onGoBack: () => void;
  onEdit: () => void;
  onStartExercise: (id: string) => void;
}

export default function ResultsPage({ results, loading, error, hasRm, onRetry, onGoBack, onEdit, onStartExercise }: Props) {
  const [activeGroup, setActiveGroup] = useState('chest');

  if (loading) {
    return (
      <div className="results-loading">
        <div className="spinner" />
        <p>BFS 분석 중…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results-error">
        <p className="err-msg">⚠️ {error}</p>
        <button className="btn-retry" onClick={onRetry}>다시 시도</button>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="results-error">
        <p className="err-msg">선택한 기구로 수행 가능한 운동이 없습니다.</p>
        <button className="btn-retry" onClick={onGoBack}>← 기구 다시 선택</button>
      </div>
    );
  }

  const filtered = results.filter(r => r.muscle_group === activeGroup);

  return (
    <div className="results-page">
      <div className="login-noise" />
      <div className="results-header">
        <div className="res-logo">MuscleTailors</div>
        <h1 className="res-title">맞춤 운동 랭킹</h1>
        <p className="res-meta">{results.length}개 운동 분석 완료</p>
        <button
          onClick={onEdit}
          style={{ background: 'none', border: '1px solid var(--primary-bright, #D4523E)', color: 'var(--primary-bright, #D4523E)', borderRadius: 6, padding: '4px 12px', fontSize: 13, cursor: 'pointer', marginTop: 8 }}
        >마이페이지</button>
      </div>

      {!hasRm && (
        <div className="rm-notice">
          💡 5대 운동 1RM을 입력하면 부상 위험도와 운동 강도를 더 정확하게 분석할 수 있습니다.
          <button className="rm-notice-btn" onClick={onEdit}>마이페이지에서 입력하기 →</button>
        </div>
      )}

      <div className="grp-tabs">
        {GROUPS.map(g => (
          <button
            key={g.id}
            className={`grp-tab${activeGroup === g.id ? ' on' : ''}`}
            onClick={() => setActiveGroup(g.id)}
          >{g.label}</button>
        ))}
      </div>

      <div className="ex-list">
        {filtered.slice(0, 20).map((r, i) => {
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
                <div className="ex-bar-wrap">
                  <div className="ex-bar" style={{ width: `${Math.round(r.score)}%` }} />
                </div>
                <div className="ex-subs">
                  <span className="sub-chip">근력 {s.strength}</span>
                  <span className="sub-chip">안전 {s.injury}</span>
                  <span className="sub-chip">골격 {s.skeleton}</span>
                  <span className="sub-chip">목표 {s.goal}</span>
                </div>
              </div>
              <div className="ex-score-badge">{r.score.toFixed(1)}</div>
              <button
                onClick={() => onStartExercise(r.exercise_id)}
                style={{ marginLeft: 8, padding: '6px 12px', background: 'var(--primary-bright, #D4523E)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >시작</button>
            </div>
          );
        })}
      </div>

    </div>
  );
}
