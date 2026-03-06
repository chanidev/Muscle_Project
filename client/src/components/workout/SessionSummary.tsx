import type { WorkoutSession, RoutineExercise, SetLog } from '../../types';

interface Props {
  session: WorkoutSession;
  exercises: RoutineExercise[];
  setLogs: Record<string, SetLog[]>;
  onClose: () => void;
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  const ms = (endedAt ? new Date(endedAt) : new Date()).getTime() - new Date(startedAt).getTime();
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}분 ${sec}초`;
}

export default function SessionSummary({ session, exercises, setLogs, onClose }: Props) {
  const totalVolume = Object.values(setLogs)
    .flat()
    .filter(s => s.completed && s.weight_done)
    .reduce((sum, s) => sum + (s.weight_done ?? 0) * s.reps_done, 0);

  const completedCount = exercises.filter(ex => setLogs[ex.exercise_id]?.some(s => s.completed)).length;

  return (
    <div className="session-overlay">
      <div className="summary-wrap">
        <p className="summary-title">운동 완료!</p>

        <div className="summary-stats">
          <div className="stat-card">
            <div className="stat-value">{formatDuration(session.started_at, session.ended_at)}</div>
            <div className="stat-sub">소요 시간</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{Math.round(totalVolume).toLocaleString()}<span className="stat-unit">kg</span></div>
            <div className="stat-sub">총 볼륨</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{completedCount}</div>
            <div className="stat-sub">완료 운동</div>
          </div>
        </div>

        <div className="summary-list">
          {exercises.map(ex => {
            const logs = setLogs[ex.exercise_id]?.filter(s => s.completed) ?? [];
            if (!logs.length) return null;
            const maxWeight = Math.max(...logs.map(s => s.weight_done ?? 0));
            return (
              <div key={ex.exercise_id} className="summary-row">
                <span className="summary-exname">{ex.name}</span>
                <span className="summary-sets">{logs.length}세트</span>
                {maxWeight > 0 && <span className="summary-weight">최대 {maxWeight}kg</span>}
              </div>
            );
          })}
        </div>

        <button className="btn-next" style={{ marginTop: '2rem', width: '100%' }} onClick={onClose}>
          마이페이지로
        </button>
      </div>
    </div>
  );
}
