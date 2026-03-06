import { useState, useCallback, useEffect, useRef } from 'react';
import type { RoutineExercise, SetLog, WorkoutSession } from '../../types';
import { logSet, submitFeedback, finishSession } from '../../api';
import FeedbackModal from './FeedbackModal';
import SessionSummary from './SessionSummary';

interface Props {
  session: WorkoutSession;
  exercises: RoutineExercise[];
  onClose: () => void;
}

export default function ActiveSession({ session, exercises, onClose }: Props) {
  const [exIdx, setExIdx] = useState(0);
  const [setLogs, setSetLogs] = useState<Record<string, SetLog[]>>(() =>
    Object.fromEntries(exercises.map(ex => [
      ex.exercise_id,
      Array.from({ length: ex.sets }, (_, i) => ({
        set_number: i + 1,
        reps_done: ex.reps_target,
        weight_done: ex.weight_target,
        completed: false,
      })),
    ]))
  );
  const [showFeedback, setShowFeedback] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [finishedSession, setFinishedSession] = useState<WorkoutSession>(session);
  const [restDuration, setRestDuration] = useState(90);
  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (restRemaining === null) return;
    if (restRemaining <= 0) {
      setRestRemaining(null);
      return;
    }
    restRef.current = setInterval(() => {
      setRestRemaining(prev => (prev !== null && prev > 0 ? prev - 1 : null));
    }, 1000);
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, [restRemaining]);

  const currentEx = exercises[exIdx];
  const logs = setLogs[currentEx?.exercise_id] ?? [];

  const updateLog = useCallback((setNum: number, field: 'reps_done' | 'weight_done', value: number | null) => {
    setSetLogs(prev => ({
      ...prev,
      [currentEx.exercise_id]: prev[currentEx.exercise_id].map(s =>
        s.set_number === setNum ? { ...s, [field]: value } : s
      ),
    }));
  }, [currentEx]);

  const toggleComplete = useCallback(async (setNum: number) => {
    const log = logs.find(s => s.set_number === setNum);
    if (!log) return;
    const nowCompleted = !log.completed;
    setSetLogs(prev => ({
      ...prev,
      [currentEx.exercise_id]: prev[currentEx.exercise_id].map(s =>
        s.set_number === setNum ? { ...s, completed: nowCompleted } : s
      ),
    }));
    if (nowCompleted) {
      await logSet(session.id, currentEx.exercise_id, setNum, log.reps_done, log.weight_done);
      setRestRemaining(restDuration);
    }
  }, [currentEx, logs, session.id, restDuration]);

  const addSet = useCallback(() => {
    setSetLogs(prev => ({
      ...prev,
      [currentEx.exercise_id]: [
        ...prev[currentEx.exercise_id],
        {
          set_number: prev[currentEx.exercise_id].length + 1,
          reps_done: currentEx.reps_target,
          weight_done: currentEx.weight_target,
          completed: false,
        },
      ],
    }));
  }, [currentEx]);

  const handleExerciseDone = () => setShowFeedback(true);

  const handleFeedback = async (rpe: number, satisfaction: number) => {
    await submitFeedback(session.id, currentEx.exercise_id, rpe, satisfaction);
    goNext();
  };

  const goNext = async () => {
    setShowFeedback(false);
    if (exIdx + 1 < exercises.length) {
      setExIdx(exIdx + 1);
    } else {
      await finishSession(session.id);
      setFinishedSession({ ...session, ended_at: new Date().toISOString() });
      setShowSummary(true);
    }
  };

  const handleAbort = async () => {
    if (confirm('운동을 중단하시겠습니까?')) {
      await finishSession(session.id);
      onClose();
    }
  };

  if (showSummary) {
    return (
      <SessionSummary
        session={finishedSession}
        exercises={exercises}
        setLogs={setLogs}
        onClose={onClose}
      />
    );
  }

  const progress = ((exIdx + (logs.some(s => s.completed) ? 1 : 0)) / exercises.length) * 100;

  return (
    <div className="session-overlay">
      {showFeedback && (
        <FeedbackModal
          exerciseName={currentEx.name}
          onConfirm={handleFeedback}
          onSkip={goNext}
        />
      )}

      <div className="session-header">
        <button className="btn-skip" onClick={handleAbort}>← 중단</button>
        <span className="session-ex-name">{currentEx?.name}</span>
        <span className="session-progress-label">{exIdx + 1} / {exercises.length}</span>
      </div>

      <div className="session-progress-bar">
        <div className="session-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {restRemaining !== null && (
        <div className="rest-timer">
          <div className="rest-timer-bar">
            <div className="rest-timer-fill" style={{ width: `${(restRemaining / restDuration) * 100}%` }} />
          </div>
          <div className="rest-timer-info">
            <span className="rest-timer-label">휴식</span>
            <span className="rest-timer-count">{restRemaining}s</span>
            <button className="rest-timer-skip" onClick={() => setRestRemaining(null)}>건너뛰기</button>
          </div>
        </div>
      )}

      <div className="rest-duration-btns">
        {[60, 90, 120, 180].map(d => (
          <button
            key={d}
            className={`rest-dur-btn${restDuration === d ? ' on' : ''}`}
            onClick={() => setRestDuration(d)}
          >{d}s</button>
        ))}
      </div>

      <div className="session-body">
        <table className="sets-table">
          <thead>
            <tr>
              <th>세트</th>
              <th>목표</th>
              <th>무게(kg)</th>
              <th>횟수</th>
              <th>✓</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(s => (
              <tr key={s.set_number} className={s.completed ? 'set-done' : ''}>
                <td>{s.set_number}</td>
                <td className="set-target">
                  {currentEx.weight_target ? `${currentEx.weight_target}kg×` : ''}{currentEx.reps_target}
                </td>
                <td>
                  <input
                    className="set-input"
                    type="number"
                    value={s.weight_done ?? ''}
                    onChange={e => updateLog(s.set_number, 'weight_done', e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </td>
                <td>
                  <input
                    className="set-input"
                    type="number"
                    value={s.reps_done}
                    onChange={e => updateLog(s.set_number, 'reps_done', parseInt(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <button
                    className={`set-check${s.completed ? ' on' : ''}`}
                    onClick={() => toggleComplete(s.set_number)}
                  >✓</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button className="btn-skip add-set-btn" onClick={addSet}>+ 세트 추가</button>
      </div>

      <div className="session-footer">
        <button className="btn-next" onClick={handleExerciseDone}>
          {exIdx + 1 < exercises.length ? '이 운동 완료 →' : '운동 종료'}
        </button>
      </div>
    </div>
  );
}
