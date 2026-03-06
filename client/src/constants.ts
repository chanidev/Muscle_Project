export const STEP_DEFS = [
  { name: '기본 정보',   desc: '나이 · 키 · 성별 · 몸무게' },
  { name: '신체 측정',   desc: '인바디 · 팔다리 길이' },
  { name: '통증 & 기구', desc: '통증 부위 → 기구 선택' },
  { name: '목표 설정',   desc: '운동 목적 · 숙련도' },
  { name: '근력 정보',   desc: '5대 운동 1RM' },
];

export const EQUIPMENT = [
  { id: 'barbell',       label: '바벨',        icon: '🏋️' },
  { id: 'dumbbell',      label: '덤벨',        icon: '💪' },
  { id: 'cable',         label: '케이블',       icon: '🔗' },
  { id: 'leg_press',     label: '레그 프레스',  icon: '🦵' },
  { id: 'smith_machine', label: '스미스 머신',  icon: '🔩' },
  { id: 'pull_up_bar',   label: '철봉',        icon: '🏗️' },
  { id: 'dip_bar',       label: '딥바',        icon: '⬇️' },
  { id: 'bench',         label: '벤치',        icon: '🛏️' },
  { id: 'kettlebell',    label: '케틀벨',       icon: '⚫' },
];

export const PAIN_AREAS = [
  { id: 'shoulder',   label: '어깨' },
  { id: 'elbow',      label: '팔꿈치' },
  { id: 'wrist',      label: '손목' },
  { id: 'knee',       label: '무릎' },
  { id: 'lower_back', label: '허리' },
  { id: 'ankle',      label: '발목' },
  { id: 'neck',       label: '목' },
  { id: 'hip',        label: '고관절' },
];

export const PAIN_EQUIP_DISABLE: Record<string, string[]> = {
  wrist:      ['barbell', 'smith_machine'],
  knee:       ['leg_press'],
  shoulder:   [],
  elbow:      [],
  lower_back: [],
  ankle:      [],
  neck:       [],
  hip:        [],
};

export const STORAGE_KEY = 'mt_onboarding_v1';

export const INITIAL_STATE = {
  age: '', height: '', gender: '', weight: '',
  bodyFat: '', muscleMass: '', upperArm: '', forearm: '', thigh: '', shin: '',
  painAreas: [] as string[], painAreasSlight: [] as string[], equipment: [] as string[],
  goal: '', strengthExp: '', gymExp: '',
  rm_squat: '', rm_bench: '', rm_deadlift: '', rm_row: '', rm_ohp: '',
};
