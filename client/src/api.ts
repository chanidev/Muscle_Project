import type { OnboardingState, ExerciseScore, Routine, WorkoutSession } from './types';

export async function saveProfile(state: OnboardingState): Promise<void> {
  await fetch('/api/onboarding/save', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  // fire-and-forget: 실패해도 랭킹 결과에 영향 없음
}

export async function rankExercises(state: OnboardingState): Promise<ExerciseScore[]> {
  const payload = {
    user: {
      weight:      parseFloat(state.weight) || 70,
      strength_exp: state.strengthExp,
      gym_exp:     state.gymExp,
      goal:        state.goal,
      pain_areas:       state.painAreas,
      pain_areas_slight: state.painAreasSlight,
      equipment:   state.equipment,
      upper_arm:   state.upperArm   ? parseFloat(state.upperArm)   : null,
      forearm:     state.forearm    ? parseFloat(state.forearm)     : null,
      thigh:       state.thigh      ? parseFloat(state.thigh)       : null,
      shin:        state.shin       ? parseFloat(state.shin)        : null,
      rm_squat:    state.rm_squat    ? parseFloat(state.rm_squat)    : null,
      rm_bench:    state.rm_bench    ? parseFloat(state.rm_bench)    : null,
      rm_deadlift: state.rm_deadlift ? parseFloat(state.rm_deadlift) : null,
      rm_row:      state.rm_row      ? parseFloat(state.rm_row)      : null,
      rm_ohp:      state.rm_ohp      ? parseFloat(state.rm_ohp)      : null,
    },
    muscle_group: null,
  };

  const res = await fetch('/api/rank', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
  return res.json();
}

// ── Routines ──────────────────────────────────────────────────────
export async function getRoutines(): Promise<Routine[]> {
  const res = await fetch('/api/routines', { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export async function createRoutine(name: string, exercises: Routine['exercises']): Promise<string> {
  const res = await fetch('/api/routines', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, exercises }),
  });
  const data = await res.json() as { id: string };
  return data.id;
}

export async function updateRoutine(id: string, name: string, exercises: Routine['exercises']): Promise<void> {
  await fetch(`/api/routines/${id}`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, exercises }),
  });
}

export async function deleteRoutine(id: string): Promise<void> {
  await fetch(`/api/routines/${id}`, { method: 'DELETE', credentials: 'include' });
}

// ── Sessions ──────────────────────────────────────────────────────
export async function startSession(routineId?: string): Promise<WorkoutSession> {
  const res = await fetch('/api/sessions', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routine_id: routineId ?? null }),
  });
  return res.json();
}

export async function finishSession(sessionId: string): Promise<void> {
  await fetch(`/api/sessions/${sessionId}/finish`, { method: 'PUT', credentials: 'include' });
}

export async function getSessions(): Promise<WorkoutSession[]> {
  const res = await fetch('/api/sessions', { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export async function getSessionDetail(sessionId: string): Promise<{
  logs: { exercise_id: string; set_number: number; reps_done: number; weight_done: number | null }[];
  feedback: { exercise_id: string; rpe: number | null; satisfaction: number | null }[];
}> {
  const res = await fetch(`/api/sessions/${sessionId}/detail`, { credentials: 'include' });
  if (!res.ok) return { logs: [], feedback: [] };
  return res.json();
}

export async function logSet(
  sessionId: string,
  exerciseId: string,
  setNumber: number,
  repsDone: number,
  weightDone: number | null,
): Promise<void> {
  await fetch(`/api/sessions/${sessionId}/logs`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exercise_id: exerciseId, set_number: setNumber, reps_done: repsDone, weight_done: weightDone }),
  });
}

export async function submitFeedback(
  sessionId: string,
  exerciseId: string,
  rpe: number,
  satisfaction: number,
): Promise<void> {
  await fetch(`/api/sessions/${sessionId}/feedback`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ exercise_id: exerciseId, rpe, satisfaction }),
  });
}

// ── Stats ─────────────────────────────────────────────────────────
export async function getWeeklyVolume(): Promise<Record<string, number>> {
  const res = await fetch('/api/stats/weekly', { credentials: 'include' });
  if (!res.ok) return {};
  return res.json();
}

export async function getExerciseVolume(exerciseId: string): Promise<Array<{ date: string; max_weight: number }>> {
  const res = await fetch(`/api/stats/volume/${exerciseId}`, { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export async function getFeedbackAdjustments(): Promise<Record<string, number>> {
  const res = await fetch('/api/feedback-adjustments', { credentials: 'include' });
  if (!res.ok) return {};
  return res.json();
}
