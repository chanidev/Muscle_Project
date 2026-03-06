import { useState } from 'react';

interface Props {
  exerciseName: string;
  onConfirm: (rpe: number, satisfaction: number) => void;
  onSkip: () => void;
}

export default function FeedbackModal({ exerciseName, onConfirm, onSkip }: Props) {
  const [rpe, setRpe] = useState(5);
  const [satisfaction, setSatisfaction] = useState(3);

  return (
    <div className="feedback-overlay">
      <div className="feedback-modal">
        <p className="feedback-title">{exerciseName} 피드백</p>

        <div className="feedback-section">
          <p className="feedback-label">운동 강도 (RPE)</p>
          <div className="rpe-row">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button
                key={n}
                className={`rpe-btn${rpe === n ? ' on' : ''}`}
                onClick={() => setRpe(n)}
              >{n}</button>
            ))}
          </div>
        </div>

        <div className="feedback-section">
          <p className="feedback-label">만족도</p>
          <div className="star-row">
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                className={`star-btn${satisfaction >= n ? ' on' : ''}`}
                onClick={() => setSatisfaction(n)}
              >★</button>
            ))}
          </div>
        </div>

        <div className="feedback-actions">
          <button className="btn-skip" onClick={onSkip}>건너뛰기</button>
          <button className="btn-next" onClick={() => onConfirm(rpe, satisfaction)}>확인</button>
        </div>
      </div>
    </div>
  );
}
