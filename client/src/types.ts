export interface OnboardingState {
  age: string;
  height: string;
  gender: string;
  weight: string;
  bodyFat: string;
  muscleMass: string;
  upperArm: string;
  forearm: string;
  thigh: string;
  shin: string;
  painAreas: string[];
  painAreasSlight: string[];
  equipment: string[];
  goal: string;
  strengthExp: string;
  gymExp: string;
  rm_squat: string;
  rm_bench: string;
  rm_deadlift: string;
  rm_row: string;
  rm_ohp: string;
}

export interface SubScores {
  strength: number;
  injury: number;
  skeleton: number;
  goal: number;
}

export interface ExerciseScore {
  exercise_id: string;
  name: string;
  score: number;
  rank: number;
  muscle_group: string;
  sub_scores: SubScores;
  rm_used: boolean;
}

export interface RoutineExercise {
  id?: string;
  exercise_id: string;
  name: string;
  display_order: number;
  sets: number;
  reps_target: number;
  weight_target: number | null;
}

export interface Routine {
  id: string;
  name: string;
  exercises: RoutineExercise[];
  created_at: string;
}

export interface SetLog {
  set_number: number;
  reps_done: number;
  weight_done: number | null;
  completed: boolean;
}

export interface WorkoutSession {
  id: string;
  routine_name: string | null;
  started_at: string;
  ended_at: string | null;
  date: string;
}

export interface StepProps {
  state: OnboardingState;
  onUpdate: (updates: Partial<OnboardingState>) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
}
