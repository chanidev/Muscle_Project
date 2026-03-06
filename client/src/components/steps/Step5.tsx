import Sidebar from '../Sidebar';
import type { StepProps, OnboardingState } from '../../types';

type RmKey = 'rm_squat' | 'rm_bench' | 'rm_deadlift' | 'rm_row' | 'rm_ohp';

const RM_FIELDS: { id: string; label: string; key: RmKey }[] = [
  { id: 'f-squat',    label: '스쿼트',      key: 'rm_squat' },
  { id: 'f-bench',    label: '벤치 프레스', key: 'rm_bench' },
  { id: 'f-deadlift', label: '데드리프트',  key: 'rm_deadlift' },
  { id: 'f-row',      label: '바벨 로우',   key: 'rm_row' },
  { id: 'f-ohp',      label: 'OHP',         key: 'rm_ohp' },
];

export default function Step5({ state, onUpdate, onNext, onBack, onSkip }: StepProps) {
  return (
    <div className="onb-layout">
      <Sidebar current={5} />
      <main className="onb-main">
        <div className="step-badge">STEP 05 · 근력 정보</div>
        <h1 className="onb-h1">5대 운동 1RM을<br />입력해주세요 <span className="fopt-badge">선택사항</span></h1>
        <p className="onb-sub">
          미입력 시 숙련도 기반 추정치가 자동으로 사용됩니다.
          <span style={{ color: 'var(--text-dim)' }}>(*추정값으로 표시)</span>
        </p>

        <div className="form-grid">
          {RM_FIELDS.map(f => (
            <div key={f.id} className="fg">
              <div className="fl">{f.label}</div>
              <div className="fi-wrap">
                <input
                  className="fi" id={f.id} type="number" step="0.5"
                  placeholder="미입력 시 추정값 사용"
                  value={state[f.key as keyof OnboardingState] as string}
                  onChange={e => onUpdate({ [f.key]: e.target.value })}
                />
                <span className="fi-unit">kg</span>
              </div>
            </div>
          ))}
        </div>

        <div className="rm-fallback">
          <div className="rm-fallback-h">📊 미입력 시 적용되는 추정치 (체중 배수 기준)</div>
          <table className="rm-table">
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

        <div className="form-actions">
          <button className="btn-skip" onClick={onSkip}>건너뛰기</button>
          <button className="btn-back" onClick={onBack}>← 이전</button>
          <button className="btn-next" onClick={onNext}>완료 →</button>
        </div>
      </main>
    </div>
  );
}
