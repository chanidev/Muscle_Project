import { useState } from 'react';
import type { ExerciseScore, Routine, RoutineExercise } from '../../types';

const GROUPS = [
  { id: 'chest',     label: '가슴' },
  { id: 'back',      label: '등' },
  { id: 'shoulders', label: '어깨' },
  { id: 'arms',      label: '팔' },
  { id: 'legs',      label: '하체' },
];

interface Props {
  initial?: Routine | null;
  rankResults: ExerciseScore[];
  onSave: (name: string, exercises: RoutineExercise[]) => void;
  onCancel: () => void;
}

export default function RoutineEditor({ initial, rankResults, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [selected, setSelected] = useState<RoutineExercise[]>(
    initial?.exercises.map(e => ({
      ...e,
      name: e.name || rankResults.find(r => r.exercise_id === e.exercise_id)?.name || e.exercise_id,
    })) ?? []
  );
  const [filterGroup, setFilterGroup] = useState('chest');

  const filtered = rankResults.filter(r => r.muscle_group === filterGroup);

  const isAdded = (exId: string) => selected.some(s => s.exercise_id === exId);

  const addExercise = (ex: ExerciseScore) => {
    if (isAdded(ex.exercise_id)) return;
    setSelected(prev => [
      ...prev,
      {
        exercise_id: ex.exercise_id,
        name: ex.name,
        display_order: prev.length,
        sets: 3,
        reps_target: 10,
        weight_target: null,
      },
    ]);
  };

  const removeExercise = (idx: number) => {
    setSelected(prev => prev.filter((_, i) => i !== idx).map((e, i) => ({ ...e, display_order: i })));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setSelected(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next.map((e, i) => ({ ...e, display_order: i }));
    });
  };

  const moveDown = (idx: number) => {
    setSelected(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next.map((e, i) => ({ ...e, display_order: i }));
    });
  };

  const updateField = (idx: number, field: 'sets' | 'reps_target' | 'weight_target', value: number | null) => {
    setSelected(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  return (
    <div className="routine-editor">
      <div className="re-header">
        <input
          className="re-name-input"
          placeholder="루틴 이름"
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </div>

      <div className="re-body">
        <div className="re-pick-panel">
          <p className="re-panel-title">운동 추가</p>
          <div className="grp-tabs" style={{ marginBottom: '0.75rem' }}>
            {GROUPS.map(g => (
              <button
                key={g.id}
                className={`grp-tab${filterGroup === g.id ? ' on' : ''}`}
                onClick={() => setFilterGroup(g.id)}
              >{g.label}</button>
            ))}
          </div>
          <div className="ex-pick-list">
            {filtered.map(ex => (
              <button
                key={ex.exercise_id}
                className={`ex-pick-item${isAdded(ex.exercise_id) ? ' added' : ''}`}
                onClick={() => addExercise(ex)}
                disabled={isAdded(ex.exercise_id)}
              >
                <span className="ex-pick-name">{ex.name}</span>
                <span className="ex-pick-score">{ex.score.toFixed(1)}</span>
                {isAdded(ex.exercise_id) && <span className="ex-pick-check">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="re-selected-panel">
          <p className="re-panel-title">선택된 운동 ({selected.length})</p>
          {selected.length === 0 && (
            <p className="chart-empty">왼쪽에서 운동을 선택하세요</p>
          )}
          <div className="re-selected-list">
            {selected.map((ex, idx) => (
              <div key={ex.exercise_id} className="re-selected-item">
                <div className="re-item-top">
                  <span className="re-item-name">{ex.name}</span>
                  <div className="re-item-actions">
                    <button className="re-btn" onClick={() => moveUp(idx)}>↑</button>
                    <button className="re-btn" onClick={() => moveDown(idx)}>↓</button>
                    <button className="re-btn danger" onClick={() => removeExercise(idx)}>×</button>
                  </div>
                </div>
                <div className="re-item-fields">
                  <label className="re-field-label">세트
                    <input type="number" className="set-input" value={ex.sets}
                      onChange={e => updateField(idx, 'sets', parseInt(e.target.value) || 1)} />
                  </label>
                  <label className="re-field-label">횟수
                    <input type="number" className="set-input" value={ex.reps_target}
                      onChange={e => updateField(idx, 'reps_target', parseInt(e.target.value) || 1)} />
                  </label>
                  <label className="re-field-label">무게
                    <input type="number" className="set-input" value={ex.weight_target ?? ''}
                      placeholder="-"
                      onChange={e => updateField(idx, 'weight_target', e.target.value ? parseFloat(e.target.value) : null)} />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="re-footer">
        <button className="btn-skip" onClick={onCancel}>취소</button>
        <button
          className="btn-next"
          disabled={!name.trim() || selected.length === 0}
          onClick={() => onSave(name.trim(), selected)}
        >저장</button>
      </div>
    </div>
  );
}
