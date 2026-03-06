import Sidebar from '../Sidebar';
import type { StepProps } from '../../types';

const GOALS = [
  { id: 'diet',        icon: '🔥', name: '다이어트',  desc: '체지방 감량 & 체형 개선' },
  { id: 'strength',    icon: '💪', name: '근력 향상',  desc: '최대 근력 & 파워 증가' },
  { id: 'hypertrophy', icon: '📈', name: '근비대',     desc: '근육량 증가 & 근육 발달' },
];

const EXP_OPTS = [
  { id: 'beginner',     label: '초보',  sub: '< 1년' },
  { id: 'intermediate', label: '중급',  sub: '1 ~ 3년' },
  { id: 'advanced',     label: '고급',  sub: '3년 이상' },
];

export default function Step4({ state, onUpdate, onNext, onBack }: StepProps) {
  return (
    <div className="onb-layout">
      <Sidebar current={4} />
      <main className="onb-main">
        <div className="step-badge">STEP 04 · 목표 설정</div>
        <h1 className="onb-h1">운동 목표와<br />경력을 선택해주세요</h1>
        <p className="onb-sub">목표에 맞는 운동 볼륨과 강도로 추천이 최적화됩니다.</p>

        <div className="form-grid">
          <div className="fsub">운동 목적 <sup>*</sup></div>
          <div className="goal-grid">
            {GOALS.map(g => (
              <div
                key={g.id}
                className={`goal-card${state.goal === g.id ? ' on' : ''}`}
                onClick={() => onUpdate({ goal: g.id })}
              >
                <div className="goal-ico">{g.icon}</div>
                <div className="goal-name">{g.name}</div>
                <div className="goal-desc">{g.desc}</div>
              </div>
            ))}
          </div>

          <div className="fsub" style={{ marginTop: 16 }}>근력 운동 경력 <sup>*</sup></div>
          <div className="exp-row">
            {EXP_OPTS.map(e => (
              <button
                key={e.id}
                className={`exp-btn${state.strengthExp === e.id ? ' on' : ''}`}
                onClick={() => onUpdate({ strengthExp: e.id })}
              >{e.label}<span className="exp-sublabel">{e.sub}</span></button>
            ))}
          </div>

          <div className="fsub" style={{ marginTop: 8 }}>헬스 경력 <sup>*</sup></div>
          <div className="exp-row">
            {EXP_OPTS.map(e => (
              <button
                key={e.id}
                className={`exp-btn${state.gymExp === e.id ? ' on' : ''}`}
                onClick={() => onUpdate({ gymExp: e.id })}
              >{e.label}<span className="exp-sublabel">{e.sub}</span></button>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-back" onClick={onBack}>← 이전</button>
          <button className="btn-next" onClick={onNext}>다음 →</button>
        </div>
      </main>
    </div>
  );
}
