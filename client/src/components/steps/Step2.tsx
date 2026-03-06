import Sidebar from '../Sidebar';
import type { StepProps } from '../../types';

type MeasureKey = 'bodyFat' | 'muscleMass' | 'upperArm' | 'forearm' | 'thigh' | 'shin';

interface FieldDef {
  id: string;
  label: string;
  key: MeasureKey;
  unit: string;
  hint: string;
}

const FIELDS: FieldDef[] = [
  { id: 'f-bodyFat',    label: '체지방률',          key: 'bodyFat',    unit: '%',  hint: '인바디 결과지의 체지방률 항목' },
  { id: 'f-muscleMass', label: '골격근량',          key: 'muscleMass', unit: 'kg', hint: '인바디 결과지의 골격근량 항목' },
  { id: 'f-upperArm',   label: '상완 길이 (위팔)',   key: 'upperArm',   unit: 'cm', hint: '어깨 끝 → 팔꿈치 관절' },
  { id: 'f-forearm',    label: '전완 길이 (아래팔)', key: 'forearm',    unit: 'cm', hint: '팔꿈치 관절 → 손목 관절' },
  { id: 'f-thigh',      label: '대퇴 길이 (허벅지)', key: 'thigh',      unit: 'cm', hint: '고관절 → 무릎 관절' },
  { id: 'f-shin',       label: '경골 길이 (정강이)', key: 'shin',       unit: 'cm', hint: '무릎 관절 → 발목 관절' },
];

const SECTION_LABELS: Record<string, string> = {
  bodyFat: '인바디 데이터',
  upperArm: '팔 길이',
  thigh: '다리 길이',
};

export default function Step2({ state, onUpdate, onNext, onBack, onSkip }: StepProps) {
  return (
    <div className="onb-layout">
      <Sidebar current={2} />
      <main className="onb-main">
        <div className="step-badge">STEP 02 · 신체 측정</div>
        <h1 className="onb-h1">신체 측정값을<br />입력해주세요 <span className="fopt-badge">선택사항</span></h1>
        <p className="onb-sub">없어도 됩니다. 체지방률 미입력 시 Scoring에서 해당 서브스코어는 제외되고 가중치가 재분배됩니다.</p>

        <div className="form-grid">
          {FIELDS.map(f => (
            <>
              {SECTION_LABELS[f.key] && (
                <div key={`sec-${f.key}`} className="fsub">{SECTION_LABELS[f.key]}</div>
              )}
              <div key={f.id} className="fg">
                <div className="fl">{f.label}</div>
                <div className="fi-wrap">
                  <input
                    className="fi" id={f.id} type="number" step="0.1"
                    placeholder="미입력 가능"
                    value={state[f.key]}
                    onChange={e => onUpdate({ [f.key]: e.target.value })}
                  />
                  <span className="fi-unit">{f.unit}</span>
                </div>
                {f.hint && <div className="fhint">{f.hint}</div>}
              </div>
            </>
          ))}
        </div>

        <div className="form-actions">
          <button className="btn-skip" onClick={onSkip}>건너뛰기</button>
          <button className="btn-back" onClick={onBack}>← 이전</button>
          <button className="btn-next" onClick={onNext}>다음 →</button>
        </div>
      </main>
    </div>
  );
}
