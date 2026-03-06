import { useState, useEffect, useCallback } from 'react';
import Login from './components/Login';
import Step1 from './components/steps/Step1';
import Step2 from './components/steps/Step2';
import Step3 from './components/steps/Step3';
import Step4 from './components/steps/Step4';
import Step5 from './components/steps/Step5';
import ResultsPage from './components/results/ResultsPage';
import MyPage from './components/MyPage';
import { rankExercises, saveProfile, getFeedbackAdjustments } from './api';
import type { OnboardingState, ExerciseScore } from './types';
import { STORAGE_KEY, INITIAL_STATE } from './constants';

function loadSaved(): OnboardingState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...INITIAL_STATE, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...INITIAL_STATE };
}

// Supabase profiles 레코드 → OnboardingState 매핑
function mapProfileToState(p: Record<string, unknown>): OnboardingState {
  return {
    age:             p.age          ? String(p.age)          : '',
    height:          p.height       ? String(p.height)       : '',
    gender:          (p.gender      as string) || '',
    weight:          p.weight       ? String(p.weight)       : '',
    bodyFat:         p.body_fat     ? String(p.body_fat)     : '',
    muscleMass:      p.muscle_mass  ? String(p.muscle_mass)  : '',
    upperArm:        p.upper_arm    ? String(p.upper_arm)    : '',
    forearm:         p.forearm      ? String(p.forearm)      : '',
    thigh:           p.thigh        ? String(p.thigh)        : '',
    shin:            p.shin         ? String(p.shin)         : '',
    painAreas:       (p.pain_areas        as string[]) || [],
    painAreasSlight: (p.pain_areas_slight as string[]) || [],
    equipment:       (p.equipment   as string[]) || [],
    goal:            (p.goal        as string) || '',
    strengthExp:     (p.strength_exp as string) || '',
    gymExp:          (p.gym_exp     as string) || '',
    rm_squat:        p.rm_squat    ? String(p.rm_squat)    : '',
    rm_bench:        p.rm_bench    ? String(p.rm_bench)    : '',
    rm_deadlift:     p.rm_deadlift ? String(p.rm_deadlift) : '',
    rm_row:          p.rm_row      ? String(p.rm_row)      : '',
    rm_ohp:          p.rm_ohp      ? String(p.rm_ohp)      : '',
  };
}

export default function App() {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<OnboardingState>(loadSaved);
  const [rankResults, setRankResults] = useState<ExerciseScore[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [rankError, setRankError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchRanking = useCallback(async (currentState: OnboardingState) => {
    setRankLoading(true);
    setRankError(null);
    setRankResults([]);
    try {
      const [raw, adjs] = await Promise.all([
        rankExercises(currentState),
        getFeedbackAdjustments(),
      ]);
      const adjusted = raw
        .map(r => ({ ...r, score: Math.min(100, Math.max(0, r.score * (1 + (adjs[r.exercise_id] ?? 0)))) }))
        .sort((a, b) => b.score - a.score)
        .map((r, i) => ({ ...r, rank: i + 1 }));
      setRankResults(adjusted);
    } catch (e) {
      setRankError(e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setRankLoading(false);
    }
  }, []);

  // 마운트 시 세션 확인 → 있으면 프로필 조회
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('auth_error')) {
      window.history.replaceState({}, '', window.location.pathname);
      return; // step 0 유지
    }
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(async user => {
        if (!user) return;
        const pr = await fetch('/api/profiles', { credentials: 'include' });
        const profile = pr.ok ? await pr.json() : null;
        if (profile) {
          const s = mapProfileToState(profile as Record<string, unknown>);
          setState(s);
          fetchRanking(s);
          setStep(7);
        } else {
          setStep(prev => prev === 0 ? 1 : prev);
        }
      });
  }, [fetchRanking]);

  // Persist onboarding state (not results)
  useEffect(() => {
    if (step < 6) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, step]);

  const update = useCallback((updates: Partial<OnboardingState>) => {
    setState(s => ({ ...s, ...updates }));
  }, []);

  const validate = (s: number): boolean => {
    if (s === 1 && (!state.age || !state.height || !state.gender || !state.weight)) {
      showToast('필수 항목(나이, 키, 성별, 몸무게)을 모두 입력해주세요.');
      return false;
    }
    if (s === 3 && state.equipment.length === 0) {
      showToast('사용 가능한 기구를 하나 이상 선택해주세요.');
      return false;
    }
    if (s === 4 && (!state.goal || !state.strengthExp || !state.gymExp)) {
      showToast('운동 목적과 경력을 모두 선택해주세요.');
      return false;
    }
    return true;
  };

  const goTo = (s: number) => {
    setStep(s);
    window.scrollTo(0, 0);
  };

  const next = () => { if (validate(step)) goTo(step + 1); };
  const back = () => goTo(step - 1);
  const skip = () => goTo(step + 1);

  // Step 5 → 6: trigger ranking + save profile
  const finish = () => {
    if (!validate(step)) return;
    goTo(6);
    fetchRanking(state);
    saveProfile(state).catch(() => {}); // fire-and-forget
  };


  const stepProps = { state, onUpdate: update, onNext: next, onBack: back, onSkip: skip };

  return (
    <>
      {step === 0 && <Login onGuest={() => goTo(1)} />}
      {step === 1 && <Step1 {...stepProps} />}
      {step === 2 && <Step2 {...stepProps} />}
      {step === 3 && <Step3 {...stepProps} />}
      {step === 4 && <Step4 {...stepProps} />}
      {step === 5 && <Step5 {...stepProps} onNext={finish} onSkip={finish} />}
      {step === 6 && (
        <ResultsPage
          results={rankResults}
          loading={rankLoading}
          error={rankError}
          hasRm={!!(state.rm_squat && state.rm_bench && state.rm_deadlift && state.rm_row && state.rm_ohp)}
          onRetry={() => fetchRanking(state)}
          onGoBack={() => goTo(3)}
          onEdit={() => goTo(7)}
          onStartExercise={(id) => showToast(`${id} — 운동 세션 기능 준비 중입니다`)}
        />
      )}
      {step === 7 && (
        <MyPage
          state={state}
          onUpdate={update}
          rankResults={rankResults}
          onRefreshRanking={() => fetchRanking(state)}
          onBack={() => goTo(6)}
          onLogout={async () => {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.reload();
          }}
        />
      )}
      {toast && <div className="error-toast">{toast}</div>}
    </>
  );
}
