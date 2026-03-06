import { STEP_DEFS } from '../constants';

const TIPS: Record<number, { head: string; body: string }> = {
  1: { head: '💡 TIP', body: '정확한 나이와 체중은 운동 강도 계산에 직접 사용됩니다.' },
  2: { head: '💡 인바디가 없다면?', body: '없어도 괜찮아요. 체지방률 미입력 시 몸무게·성별 기반으로 자동 추정되며, 해당 서브스코어는 Scoring에서 제외됩니다.' },
  3: { head: '💡 통증이 없다면?', body: '통증 부위를 선택하지 않아도 됩니다. 사용 가능한 기구만 선택해주세요.' },
  4: { head: '💡 경력 선택 팁', body: '헬스 경력은 헬스장 이용 경험 전반이고, 근력 운동 경력은 웨이트 트레이닝 경력입니다.' },
  5: { head: '💡 1RM이란?', body: '1회 최대 반복 중량입니다. 모르면 건너뛰어도 됩니다 — 숙련도 기반 추정치가 자동 적용됩니다. (*추정값 표시)' },
};

interface Props {
  current: number; // 1-5
}

export default function Sidebar({ current }: Props) {
  const pct = Math.round((current - 1) / 5 * 100);
  const tip = TIPS[current];

  return (
    <aside className="onb-side">
      <div className="side-logo">MuscleTailors</div>
      <div className="progress-strip">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="progress-label">STEP {current} / 5 — {pct}% 완료</div>
      <div className="step-track">
        {STEP_DEFS.map((s, i) => {
          const n = i + 1;
          const cls = n < current ? 'done' : n === current ? 'now' : 'wait';
          return (
            <div key={n} className={`step-item${n === current ? ' step-now' : ''}`}>
              <div className={`s-num ${cls}`}>{cls === 'done' ? '✓' : n}</div>
              <div className="s-info">
                <div className="s-name">{s.name}</div>
                <div className="s-desc">{s.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
      {tip && (
        <div className="side-tip">
          <div className="tip-head">{tip.head}</div>
          <div className="tip-body">{tip.body}</div>
        </div>
      )}
    </aside>
  );
}
