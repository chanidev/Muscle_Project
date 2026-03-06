import './style.css';

// ── Types ─────────────────────────────────────────────────────
interface SubScores { strength: number; mobility: number; injury: number; skeleton: number; goal: number; }
interface ExerciseScore { exercise_id: string; name: string; score: number; rank: number; muscle_group: string; sub_scores: SubScores; }

interface State {
  [key: string]: string | string[] | number;
  step: number; // 0=login, 1-5=onboarding, 6=complete
  // Step 1: Basic info (required)
  age: string;
  height: string;
  gender: string; // male | female | other
  weight: string;
  // Step 2: Body measurements (optional)
  bodyFat: string;
  muscleMass: string;
  upperArm: string;
  forearm: string;
  thigh: string;
  shin: string;
  // Step 3: Pain & equipment
  painAreas: string[];      // 있음 → equipment disabled
  painAreasSlight: string[]; // 약간있음 → no restriction
  equipment: string[];
  // Step 4: Goals (required)
  goal: string;       // diet | strength | hypertrophy
  strengthExp: string; // beginner | intermediate | advanced
  gymExp: string;
  // Step 5: 1RM (optional)
  rm_squat: string;
  rm_bench: string;
  rm_deadlift: string;
  rm_row: string;
  rm_ohp: string;
}

// ── Constants ─────────────────────────────────────────────────
const STEP_DEFS = [
  { name: '기본 정보',  desc: '나이 · 키 · 성별 · 몸무게' },
  { name: '신체 측정',  desc: '인바디 · 팔다리 길이' },
  { name: '통증 & 기구', desc: '통증 부위 → 기구 선택' },
  { name: '목표 설정',  desc: '운동 목적 · 숙련도' },
  { name: '근력 정보',  desc: '5대 운동 1RM' },
];

const EQUIPMENT = [
  { id: 'barbell',      label: '바벨',       icon: '🏋️' },
  { id: 'dumbbell',     label: '덤벨',       icon: '💪' },
  { id: 'cable',        label: '케이블',      icon: '🔗' },
  { id: 'leg_press',    label: '레그 프레스', icon: '🦵' },
  { id: 'smith_machine',label: '스미스 머신', icon: '🔩' },
  { id: 'pull_up_bar',  label: '철봉',       icon: '🏗️' },
  { id: 'dip_bar',      label: '딥바',       icon: '⬇️' },
  { id: 'bench',        label: '벤치',       icon: '🛏️' },
  { id: 'kettlebell',   label: '케틀벨',      icon: '⚫' },
  { id: 'bodyweight',   label: '맨몸',       icon: '🤸' },
];

const PAIN_AREAS = [
  { id: 'shoulder',   label: '어깨' },
  { id: 'elbow',      label: '팔꿈치' },
  { id: 'wrist',      label: '손목' },
  { id: 'knee',       label: '무릎' },
  { id: 'lower_back', label: '허리' },
  { id: 'ankle',      label: '발목' },
  { id: 'neck',       label: '목' },
  { id: 'hip',        label: '고관절' },
];

// Equipment disabled when pain area is selected (docs §3)
const PAIN_EQUIP_DISABLE: Record<string, string[]> = {
  wrist:      ['barbell', 'smith_machine'], // barbell 계열 전체
  knee:       ['leg_press'],
  shoulder:   [],
  elbow:      [],
  lower_back: [],
  ankle:      [],
  neck:       [],
  hip:        [],
};

const STORAGE_KEY = 'mt_onboarding_v1';

// ── State ─────────────────────────────────────────────────────
let state: State = {
  step: 0,
  age: '', height: '', gender: '', weight: '',
  bodyFat: '', muscleMass: '', upperArm: '', forearm: '', thigh: '', shin: '',
  painAreas: [], painAreasSlight: [], equipment: [],
  goal: '', strengthExp: '', gymExp: '',
  rm_squat: '', rm_bench: '', rm_deadlift: '', rm_row: '', rm_ohp: '',
};

let rankResults: ExerciseScore[] = [];
let rankLoading = false;
let rankError: string | null = null;
let activeGroup = 'all';

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { state = { ...state, ...JSON.parse(raw) }; } catch { /* ignore */ }
  }
}

// ── Navigation ────────────────────────────────────────────────
function goTo(step: number) {
  state.step = step;
  saveState();
  if (step === 6) { rankLoading = true; rankError = null; rankResults = []; activeGroup = 'all'; }
  render();
  window.scrollTo(0, 0);
  if (step === 6) startRanking();
}

function nextStep() {
  if (!validateStep(state.step)) return;
  goTo(state.step + 1);
}

function prevStep() {
  goTo(state.step - 1);
}

// ── Validation ────────────────────────────────────────────────
function validateStep(step: number): boolean {
  if (step === 1) {
    if (!state.age || !state.height || !state.gender || !state.weight) {
      showToast('필수 항목(나이, 키, 성별, 몸무게)을 모두 입력해주세요.');
      return false;
    }
  }
  if (step === 3) {
    if (state.equipment.length === 0) {
      showToast('사용 가능한 기구를 하나 이상 선택해주세요.');
      return false;
    }
  }
  if (step === 4) {
    if (!state.goal || !state.strengthExp || !state.gymExp) {
      showToast('운동 목적과 경력을 모두 선택해주세요.');
      return false;
    }
  }
  return true;
}

function showToast(msg: string) {
  document.querySelector('.error-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'error-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Helpers ───────────────────────────────────────────────────
function disabledEquipment(): Set<string> {
  const out = new Set<string>();
  for (const pain of state.painAreas) {
    for (const eq of (PAIN_EQUIP_DISABLE[pain] ?? [])) out.add(eq);
  }
  return out;
}

function calcBMI(): string {
  const h = parseFloat(state.height);
  const w = parseFloat(state.weight);
  if (!h || !w) return '—';
  return (w / ((h / 100) ** 2)).toFixed(1);
}

function bmiCategory(bmi: string): string {
  if (bmi === '—') return '';
  const v = parseFloat(bmi);
  if (v < 18.5) return '저체중';
  if (v < 23)   return '정상';
  if (v < 25)   return '과체중';
  return '비만';
}

function getPainLevel(id: string): 'yes' | 'slight' | 'none' {
  if (state.painAreas.includes(id)) return 'yes';
  if (state.painAreasSlight.includes(id)) return 'slight';
  return 'none';
}

// ── BFS Ranking API ───────────────────────────────────────────
async function startRanking() {
  const payload = {
    user: {
      weight: parseFloat(state.weight) || 70,
      strength_exp: state.strengthExp,
      gym_exp: state.gymExp,
      goal: state.goal,
      pain_areas: state.painAreas,
      pain_areas_slight: state.painAreasSlight,
      equipment: state.equipment,
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
  try {
    const res = await fetch('/api/rank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    rankResults = await res.json() as ExerciseScore[];
  } catch (e) {
    rankError = e instanceof Error ? e.message : '알 수 없는 오류';
  } finally {
    rankLoading = false;
    render();
  }
}

// ── Sidebar ───────────────────────────────────────────────────
function sidebar(current: number): string {
  const pct = Math.round((current - 1) / 5 * 100);

  const stepItems = STEP_DEFS.map((s, i) => {
    const n = i + 1;
    const cls = n < current ? 'done' : n === current ? 'now' : 'wait';
    return `
      <div class="step-item ${cls === 'now' ? 'step-now' : ''}">
        <div class="s-num ${cls}">${cls === 'done' ? '✓' : n}</div>
        <div class="s-info">
          <div class="s-name">${s.name}</div>
          <div class="s-desc">${s.desc}</div>
        </div>
      </div>`;
  }).join('');

  const tips: Record<number, string> = {
    1: '<div class="tip-head">💡 TIP</div><div class="tip-body">정확한 나이와 체중은 운동 강도 계산에 직접 사용됩니다.</div>',
    2: '<div class="tip-head">💡 인바디가 없다면?</div><div class="tip-body">없어도 괜찮아요. 체지방률 미입력 시 몸무게·성별 기반으로 자동 추정되며, 해당 서브스코어는 Scoring에서 제외됩니다.</div>',
    3: '<div class="tip-head">💡 통증이 없다면?</div><div class="tip-body">통증 부위를 선택하지 않아도 됩니다. 사용 가능한 기구만 선택해주세요.</div>',
    4: '<div class="tip-head">💡 경력 선택 팁</div><div class="tip-body">헬스 경력은 헬스장 이용 경험 전반이고, 근력 운동 경력은 웨이트 트레이닝 경력입니다.</div>',
    5: '<div class="tip-head">💡 1RM이란?</div><div class="tip-body">1회 최대 반복 중량입니다. 모르면 건너뛰어도 됩니다 — 숙련도 기반 추정치가 자동 적용됩니다. (*추정값 표시)</div>',
  };

  return `
    <aside class="onb-side">
      <div class="side-logo">MuscleTailors</div>
      <div class="progress-strip"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="progress-label">STEP ${current} / 5 — ${pct}% 완료</div>
      <div class="step-track">${stepItems}</div>
      <div class="side-tip">${tips[current] ?? ''}</div>
    </aside>`;
}

// ── Step 0: Login ─────────────────────────────────────────────
function renderLogin(): string {
  return `
    <div class="login-page">
      <div class="login-noise"></div>
      <div class="login-glow"></div>
      <div class="login-glow2"></div>
      <div class="login-grid"></div>
      <div class="login-body">
        <div class="login-eyebrow">골격 비례 기반 맞춤 운동 추천</div>
        <div class="login-logo">MUSCLE<br><em>TAILORS</em></div>
        <p class="login-tagline">
          당신의 <strong>뼈대 비례</strong>가 최고의 운동을 결정합니다.<br>
          인바디 데이터와 골격 측정으로 <strong>나만의 운동 랭킹</strong>을 만드세요.
        </p>
        <div class="login-actions">
          <button class="btn-kakao" id="btn-kakao">
            <span>💬</span> 카카오로 시작하기
          </button>
          <button class="btn-google" id="btn-google">
            <span style="font-weight:700;font-size:16px">G</span> 구글로 시작하기
          </button>
        </div>
      </div>
    </div>`;
}

// ── Step 1: Basic Info ────────────────────────────────────────
function renderStep1(): string {
  const bmi = calcBMI();
  const genderBtn = (val: string, label: string) =>
    `<button class="gender-btn ${state.gender === val ? 'on' : ''}" data-gender="${val}">${label}</button>`;

  return `
    <div class="onb-layout">
      ${sidebar(1)}
      <main class="onb-main">
        <div class="step-badge">STEP 01 · 기본 정보</div>
        <h1 class="onb-h1">기본 정보를<br>입력해주세요</h1>
        <p class="onb-sub">나이, 키, 성별, 몸무게는 운동 강도 및 볼륨 계산의 핵심 데이터입니다.</p>

        <div class="form-grid">
          <div class="fg">
            <div class="fl">나이 <sup>*</sup></div>
            <div class="fi-wrap">
              <input class="fi" id="f-age" type="number" min="10" max="100"
                placeholder="예: 28" value="${state.age}">
              <span class="fi-unit">세</span>
            </div>
          </div>
          <div class="fg">
            <div class="fl">키 <sup>*</sup></div>
            <div class="fi-wrap">
              <input class="fi" id="f-height" type="number" step="0.1"
                placeholder="예: 176.0" value="${state.height}">
              <span class="fi-unit">cm</span>
            </div>
          </div>
          <div class="fg">
            <div class="fl">몸무게 <sup>*</sup></div>
            <div class="fi-wrap">
              <input class="fi" id="f-weight" type="number" step="0.1"
                placeholder="예: 72.5" value="${state.weight}">
              <span class="fi-unit">kg</span>
            </div>
          </div>
          <div class="fg">
            <div class="fl">BMI <span style="font-weight:400;color:var(--text-dim)">(자동 계산)</span></div>
            <div class="bmi-display">
              <span class="bmi-val" id="bmi-val">${bmi}</span>
              <span class="bmi-cat" id="bmi-cat">${bmiCategory(bmi)}</span>
            </div>
          </div>
          <div class="fg full">
            <div class="fl">성별 <sup>*</sup></div>
            <div class="gender-row">
              ${genderBtn('male', '남성')}
              ${genderBtn('female', '여성')}
              ${genderBtn('other', '기타')}
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn-back" id="btn-back">← 로그인</button>
          <button class="btn-next" id="btn-next">다음 →</button>
        </div>
      </main>
    </div>`;
}

// ── Step 2: Body Measurements ─────────────────────────────────
function renderStep2(): string {
  const field = (id: string, label: string, val: string, unit: string, hint: string) => `
    <div class="fg">
      <div class="fl">${label}</div>
      <div class="fi-wrap">
        <input class="fi" id="${id}" type="number" step="0.1"
          placeholder="미입력 가능" value="${val}">
        <span class="fi-unit">${unit}</span>
      </div>
      ${hint ? `<div class="fhint">${hint}</div>` : ''}
    </div>`;

  return `
    <div class="onb-layout">
      ${sidebar(2)}
      <main class="onb-main">
        <div class="step-badge">STEP 02 · 신체 측정</div>
        <h1 class="onb-h1">신체 측정값을<br>입력해주세요 <span class="fopt-badge">선택사항</span></h1>
        <p class="onb-sub">없어도 됩니다. 체지방률 미입력 시 Scoring에서 해당 서브스코어는 제외되고 가중치가 재분배됩니다.</p>

        <div class="form-grid">
          <div class="fsub">인바디 데이터</div>
          ${field('f-bodyFat',    '체지방률',  state.bodyFat,    '%',   '인바디 결과지의 체지방률 항목')}
          ${field('f-muscleMass', '골격근량',  state.muscleMass, 'kg',  '인바디 결과지의 골격근량 항목')}

          <div class="fsub">팔 길이</div>
          ${field('f-upperArm', '상완 길이 (위팔)', state.upperArm, 'cm', '어깨 끝 → 팔꿈치 관절')}
          ${field('f-forearm',  '전완 길이 (아래팔)', state.forearm, 'cm', '팔꿈치 관절 → 손목 관절')}

          <div class="fsub">다리 길이</div>
          ${field('f-thigh', '대퇴 길이 (허벅지)', state.thigh, 'cm', '고관절 → 무릎 관절')}
          ${field('f-shin',  '경골 길이 (정강이)', state.shin,  'cm', '무릎 관절 → 발목 관절')}
        </div>

        <div class="form-actions">
          <button class="btn-skip" id="btn-skip">건너뛰기</button>
          <button class="btn-back" id="btn-back">← 이전</button>
          <button class="btn-next" id="btn-next">다음 →</button>
        </div>
      </main>
    </div>`;
}

// ── Step 3: Pain & Equipment ──────────────────────────────────
function renderStep3(): string {
  const disabled = disabledEquipment();

  const painChips = PAIN_AREAS.map(p => {
    const lvl = getPainLevel(p.id);
    const cls  = lvl === 'yes' ? 'on' : lvl === 'slight' ? 'slight' : '';
    const text = lvl === 'yes'    ? `${p.label} · 있음`
               : lvl === 'slight' ? `${p.label} · 약간있음`
               : p.label;
    return `<button class="pain-chip ${cls}" data-pain="${p.id}">${text}</button>`;
  }).join('');

  const equipCards = EQUIPMENT.map(eq => {
    const isDisabled = disabled.has(eq.id);
    const isOn = !isDisabled && state.equipment.includes(eq.id);
    return `
      <div class="equip-card ${isOn ? 'on' : ''} ${isDisabled ? 'disabled' : ''}"
        data-equip="${eq.id}">
        <span class="equip-icon">${eq.icon}</span>
        <span>${eq.label}</span>
        ${isDisabled ? '<span class="disabled-reason">통증 제약</span>' : ''}
      </div>`;
  }).join('');

  return `
    <div class="onb-layout">
      ${sidebar(3)}
      <main class="onb-main">
        <div class="step-badge">STEP 03 · 통증 & 기구</div>
        <h1 class="onb-h1">통증 부위와<br>사용 가능 기구를 선택해주세요</h1>
        <p class="onb-sub">통증 부위를 선택하면 관련 기구가 자동으로 비활성화됩니다.<br>통증이 없으면 기구만 선택해주세요.</p>

        <div class="form-grid">
          <div class="fsub">통증 부위 <span class="fopt-badge">선택사항</span></div>
          <div class="chip-grid">${painChips}</div>
          <div class="pain-picker" id="pain-picker" style="display:none">
            <span class="pain-picker-label" id="pain-picker-label"></span>
            <div class="pain-picker-btns">
              <button class="pain-lvl-btn" data-lvl="none">없음</button>
              <button class="pain-lvl-btn" data-lvl="slight">약간있음</button>
              <button class="pain-lvl-btn" data-lvl="yes">있음</button>
            </div>
          </div>

          <div class="fsub" style="margin-top:16px">사용 가능 기구 <sup>*</sup></div>
          <div class="equip-grid">${equipCards}</div>
        </div>

        <div class="form-actions">
          <button class="btn-back" id="btn-back">← 이전</button>
          <button class="btn-next" id="btn-next">다음 →</button>
        </div>
      </main>
    </div>`;
}

// ── Step 4: Goals ─────────────────────────────────────────────
function renderStep4(): string {
  const goals = [
    { id: 'diet',        icon: '🔥', name: '다이어트',  desc: '체지방 감량 & 체형 개선' },
    { id: 'strength',    icon: '💪', name: '근력 향상', desc: '최대 근력 & 파워 증가' },
    { id: 'hypertrophy', icon: '📈', name: '근비대',    desc: '근육량 증가 & 근육 발달' },
  ];

  const goalCards = goals.map(g => `
    <div class="goal-card ${state.goal === g.id ? 'on' : ''}" data-goal="${g.id}">
      <div class="goal-ico">${g.icon}</div>
      <div class="goal-name">${g.name}</div>
      <div class="goal-desc">${g.desc}</div>
    </div>`).join('');

  const expOpts = [
    { id: 'beginner',     label: '초보',  sub: '< 1년' },
    { id: 'intermediate', label: '중급',  sub: '1 ~ 3년' },
    { id: 'advanced',     label: '고급',  sub: '3년 이상' },
  ];

  const strExpBtns = expOpts.map(e => `
    <button class="exp-btn ${state.strengthExp === e.id ? 'on' : ''}" data-str-exp="${e.id}">
      ${e.label}<span class="exp-sublabel">${e.sub}</span>
    </button>`).join('');

  const gymExpBtns = expOpts.map(e => `
    <button class="exp-btn ${state.gymExp === e.id ? 'on' : ''}" data-gym-exp="${e.id}">
      ${e.label}<span class="exp-sublabel">${e.sub}</span>
    </button>`).join('');

  return `
    <div class="onb-layout">
      ${sidebar(4)}
      <main class="onb-main">
        <div class="step-badge">STEP 04 · 목표 설정</div>
        <h1 class="onb-h1">운동 목표와<br>경력을 선택해주세요</h1>
        <p class="onb-sub">목표에 맞는 운동 볼륨과 강도로 추천이 최적화됩니다.</p>

        <div class="form-grid">
          <div class="fsub">운동 목적 <sup>*</sup></div>
          <div class="goal-grid">${goalCards}</div>

          <div class="fsub" style="margin-top:16px">근력 운동 경력 <sup>*</sup></div>
          <div class="exp-row">${strExpBtns}</div>

          <div class="fsub" style="margin-top:8px">헬스 경력 <sup>*</sup></div>
          <div class="exp-row">${gymExpBtns}</div>
        </div>

        <div class="form-actions">
          <button class="btn-back" id="btn-back">← 이전</button>
          <button class="btn-next" id="btn-next">다음 →</button>
        </div>
      </main>
    </div>`;
}

// ── Step 5: Strength (1RM) ────────────────────────────────────
function renderStep5(): string {
  type RmKey = 'rm_squat' | 'rm_bench' | 'rm_deadlift' | 'rm_row' | 'rm_ohp';
  const exercises: { id: string; label: string; key: RmKey }[] = [
    { id: 'squat',    label: '스쿼트',      key: 'rm_squat' },
    { id: 'bench',    label: '벤치 프레스', key: 'rm_bench' },
    { id: 'deadlift', label: '데드리프트',  key: 'rm_deadlift' },
    { id: 'row',      label: '바벨 로우',   key: 'rm_row' },
    { id: 'ohp',      label: 'OHP',         key: 'rm_ohp' },
  ];

  const inputs = exercises.map(e => `
    <div class="fg">
      <div class="fl">${e.label}</div>
      <div class="fi-wrap">
        <input class="fi" id="f-${e.id}" type="number" step="0.5"
          placeholder="미입력 시 추정값 사용" value="${state[e.key]}">
        <span class="fi-unit">kg</span>
      </div>
    </div>`).join('');

  return `
    <div class="onb-layout">
      ${sidebar(5)}
      <main class="onb-main">
        <div class="step-badge">STEP 05 · 근력 정보</div>
        <h1 class="onb-h1">5대 운동 1RM을<br>입력해주세요 <span class="fopt-badge">선택사항</span></h1>
        <p class="onb-sub">
          미입력 시 숙련도 기반 추정치가 자동으로 사용됩니다.
          <span style="color:var(--text-dim)">(*추정값으로 표시)</span>
        </p>

        <div class="form-grid">${inputs}</div>

        <div class="rm-fallback">
          <div class="rm-fallback-h">📊 미입력 시 적용되는 추정치 (체중 배수 기준)</div>
          <table class="rm-table">
            <thead>
              <tr>
                <th>숙련도</th><th>스쿼트</th><th>벤치</th>
                <th>데드리프트</th><th>바벨 로우</th><th>OHP</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>초보</td><td>0.75× BW</td><td>0.5× BW</td><td>1.0× BW</td><td>0.5× BW</td><td>0.3× BW</td></tr>
              <tr><td>중급</td><td>1.25× BW</td><td>0.9× BW</td><td>1.5× BW</td><td>0.9× BW</td><td>0.6× BW</td></tr>
              <tr><td>고급</td><td>1.75× BW</td><td>1.25× BW</td><td>2.0× BW</td><td>1.25× BW</td><td>0.85× BW</td></tr>
            </tbody>
          </table>
        </div>

        <div class="form-actions">
          <button class="btn-skip" id="btn-skip">건너뛰기</button>
          <button class="btn-back" id="btn-back">← 이전</button>
          <button class="btn-next" id="btn-next">완료 →</button>
        </div>
      </main>
    </div>`;
}

// ── Step 6: Results ───────────────────────────────────────────
function renderComplete(): string {
  if (rankLoading) {
    return `
      <div class="results-loading">
        <div class="spinner"></div>
        <p>BFS 분석 중…</p>
      </div>`;
  }

  if (rankError) {
    return `
      <div class="results-error">
        <p class="err-msg">⚠️ ${rankError}</p>
        <button class="btn-retry" id="btn-retry">다시 시도</button>
      </div>`;
  }

  if (rankResults.length === 0) {
    return `
      <div class="results-error">
        <p class="err-msg">선택한 기구로 수행 가능한 운동이 없습니다.</p>
        <button class="btn-retry" id="btn-go-back">← 기구 다시 선택</button>
      </div>`;
  }

  const groups = [
    { id: 'all',       label: '전체' },
    { id: 'chest',     label: '가슴' },
    { id: 'back',      label: '등' },
    { id: 'shoulders', label: '어깨' },
    { id: 'arms',      label: '팔' },
    { id: 'legs',      label: '하체' },
  ];

  const filtered = activeGroup === 'all'
    ? rankResults
    : rankResults.filter(r => r.muscle_group === activeGroup);

  const tabs = groups.map(g =>
    `<button class="grp-tab ${activeGroup === g.id ? 'on' : ''}" data-grp="${g.id}">${g.label}</button>`
  ).join('');

  const cards = filtered.slice(0, 20).map((r, i) => {
    const s = r.sub_scores;
    return `
      <div class="ex-card">
        <div class="ex-rank">#${i + 1}</div>
        <div class="ex-info">
          <div class="ex-name">${r.name}</div>
          <div class="ex-bar-wrap">
            <div class="ex-bar" style="width:${Math.round(r.score)}%"></div>
          </div>
          <div class="ex-subs">
            <span class="sub-chip">근력 ${s.strength}</span>
            <span class="sub-chip">가동 ${s.mobility}</span>
            <span class="sub-chip">안전 ${s.injury}</span>
            <span class="sub-chip">골격 ${s.skeleton}</span>
            <span class="sub-chip">목표 ${s.goal}</span>
          </div>
        </div>
        <div class="ex-score-badge">${r.score.toFixed(1)}</div>
      </div>`;
  }).join('');

  return `
    <div class="results-page">
      <div class="login-noise"></div>
      <div class="results-header">
        <div class="res-logo">MuscleTailors</div>
        <h1 class="res-title">맞춤 운동 랭킹</h1>
        <p class="res-meta">${rankResults.length}개 운동 분석 완료</p>
      </div>
      <div class="grp-tabs">${tabs}</div>
      <div class="ex-list">${cards}</div>
      <button class="btn-restart" id="btn-restart">← 처음부터</button>
    </div>`;
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  switch (state.step) {
    case 0: app.innerHTML = renderLogin();    break;
    case 1: app.innerHTML = renderStep1();   break;
    case 2: app.innerHTML = renderStep2();   break;
    case 3: app.innerHTML = renderStep3();   break;
    case 4: app.innerHTML = renderStep4();   break;
    case 5: app.innerHTML = renderStep5();   break;
    case 6: app.innerHTML = renderComplete(); break;
    default: app.innerHTML = renderLogin();
  }
  bindEvents();
}

// ── Event Binding ─────────────────────────────────────────────
function bindEvents() {
  const step = state.step;

  // Common navigation
  document.getElementById('btn-next')?.addEventListener('click', nextStep);
  document.getElementById('btn-back')?.addEventListener('click', prevStep);
  document.getElementById('btn-skip')?.addEventListener('click', () => goTo(step + 1));

  // Login
  document.getElementById('btn-kakao')?.addEventListener('click', () => goTo(1));
  document.getElementById('btn-google')?.addEventListener('click', () => goTo(1));

  // ── Step 6 ──
  if (step === 6) {
    document.getElementById('btn-retry')?.addEventListener('click', () => {
      rankLoading = true; rankError = null; render(); startRanking();
    });
    document.getElementById('btn-go-back')?.addEventListener('click', () => goTo(3));
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      state = { step: 0, age: '', height: '', gender: '', weight: '', bodyFat: '', muscleMass: '', upperArm: '', forearm: '', thigh: '', shin: '', painAreas: [], painAreasSlight: [], equipment: [], goal: '', strengthExp: '', gymExp: '', rm_squat: '', rm_bench: '', rm_deadlift: '', rm_row: '', rm_ohp: '' };
      rankResults = []; rankLoading = false; rankError = null;
      render();
    });
    document.querySelectorAll<HTMLButtonElement>('.grp-tab').forEach(btn => {
      btn.addEventListener('click', () => { activeGroup = btn.dataset.grp ?? 'all'; render(); });
    });
  }

  // ── Step 1 ──
  if (step === 1) {
    const numInput = (id: string, key: keyof State) => {
      document.getElementById(id)?.addEventListener('input', (e) => {
        state[key] = (e.target as HTMLInputElement).value;
        saveState();
        const bmi = calcBMI();
        const el = document.getElementById('bmi-val');
        const cat = document.getElementById('bmi-cat');
        if (el) el.textContent = bmi;
        if (cat) cat.textContent = bmiCategory(bmi);
      });
    };
    numInput('f-age', 'age');
    numInput('f-height', 'height');
    numInput('f-weight', 'weight');

    document.querySelectorAll<HTMLButtonElement>('.gender-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.gender = btn.dataset.gender ?? '';
        saveState();
        document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
      });
    });
  }

  // ── Step 2 ──
  if (step === 2) {
    const fields: [string, keyof State][] = [
      ['f-bodyFat', 'bodyFat'], ['f-muscleMass', 'muscleMass'],
      ['f-upperArm', 'upperArm'], ['f-forearm', 'forearm'],
      ['f-thigh', 'thigh'], ['f-shin', 'shin'],
    ];
    fields.forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener('input', (e) => {
        state[key] = (e.target as HTMLInputElement).value;
        saveState();
      });
    });
  }

  // ── Step 3 ──
  if (step === 3) {
    let activePainId: string | null = null;

    const updateEquipCards = () => {
      const disabled = disabledEquipment();
      document.querySelectorAll<HTMLElement>('.equip-card').forEach(card => {
        const id = card.dataset.equip ?? '';
        if (disabled.has(id)) {
          card.classList.add('disabled');
          if (state.equipment.includes(id)) {
            state.equipment = state.equipment.filter(e => e !== id);
            card.classList.remove('on');
            saveState();
          }
          if (!card.querySelector('.disabled-reason')) {
            const span = document.createElement('span');
            span.className = 'disabled-reason';
            span.textContent = '통증 제약';
            card.appendChild(span);
          }
        } else {
          card.classList.remove('disabled');
          card.querySelector('.disabled-reason')?.remove();
        }
      });
    };

    document.querySelectorAll<HTMLButtonElement>('.pain-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const pain = btn.dataset.pain ?? '';
        const area = PAIN_AREAS.find(p => p.id === pain)!;

        // Set active chip
        document.querySelectorAll('.pain-chip').forEach(c => c.classList.remove('active'));
        activePainId = pain;
        btn.classList.add('active');

        // Show picker
        const picker = document.getElementById('pain-picker')!;
        const pickerLabel = document.getElementById('pain-picker-label')!;
        picker.style.display = 'flex';
        pickerLabel.textContent = area.label;

        // Highlight current level
        const lvl = getPainLevel(pain);
        document.querySelectorAll<HTMLButtonElement>('.pain-lvl-btn').forEach(b => {
          b.classList.toggle('on', b.dataset.lvl === lvl);
        });
      });
    });

    document.querySelectorAll<HTMLButtonElement>('.pain-lvl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!activePainId) return;
        const lvl = btn.dataset.lvl ?? 'none';
        const area = PAIN_AREAS.find(p => p.id === activePainId)!;

        // Update state
        state.painAreas = state.painAreas.filter(p => p !== activePainId);
        state.painAreasSlight = state.painAreasSlight.filter(p => p !== activePainId);
        if (lvl === 'yes') state.painAreas.push(activePainId!);
        if (lvl === 'slight') state.painAreasSlight.push(activePainId!);
        saveState();

        // Update chip visual
        const chip = document.querySelector<HTMLButtonElement>(`.pain-chip[data-pain="${activePainId}"]`)!;
        chip.className = `pain-chip active${lvl === 'yes' ? ' on' : lvl === 'slight' ? ' slight' : ''}`;
        chip.textContent = lvl === 'yes'    ? `${area.label} · 있음`
                         : lvl === 'slight' ? `${area.label} · 약간있음`
                         : area.label;

        // Highlight picker buttons
        document.querySelectorAll<HTMLButtonElement>('.pain-lvl-btn').forEach(b => {
          b.classList.toggle('on', b.dataset.lvl === lvl);
        });

        updateEquipCards();
      });
    });

    // Equipment cards (event delegation handles dynamic disabled state)
    document.querySelector('.equip-grid')?.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.equip-card');
      if (!card || card.classList.contains('disabled')) return;
      const id = card.dataset.equip ?? '';
      if (state.equipment.includes(id)) {
        state.equipment = state.equipment.filter(eq => eq !== id);
        card.classList.remove('on');
      } else {
        state.equipment.push(id);
        card.classList.add('on');
      }
      saveState();
    });
  }

  // ── Step 4 ──
  if (step === 4) {
    document.querySelectorAll<HTMLElement>('.goal-card').forEach(card => {
      card.addEventListener('click', () => {
        state.goal = card.dataset.goal ?? '';
        saveState();
        document.querySelectorAll('.goal-card').forEach(c => c.classList.remove('on'));
        card.classList.add('on');
      });
    });

    document.querySelectorAll<HTMLButtonElement>('[data-str-exp]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.strengthExp = btn.dataset.strExp ?? '';
        saveState();
        document.querySelectorAll('[data-str-exp]').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
      });
    });

    document.querySelectorAll<HTMLButtonElement>('[data-gym-exp]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.gymExp = btn.dataset.gymExp ?? '';
        saveState();
        document.querySelectorAll('[data-gym-exp]').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
      });
    });
  }

  // ── Step 5 ──
  if (step === 5) {
    const rms: [string, keyof State][] = [
      ['f-squat', 'rm_squat'], ['f-bench', 'rm_bench'],
      ['f-deadlift', 'rm_deadlift'], ['f-row', 'rm_row'], ['f-ohp', 'rm_ohp'],
    ];
    rms.forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener('input', (e) => {
        state[key] = (e.target as HTMLInputElement).value;
        saveState();
      });
    });
  }
}

// ── Entry Point ───────────────────────────────────────────────
loadState();
// If saved state was on complete screen, reset to login
if (state.step === 6) state.step = 0;
render();
