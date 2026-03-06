import { type ChangeEvent } from 'react';
import Sidebar from '../Sidebar';
import type { StepProps } from '../../types';

function calcBMI(height: string, weight: string): string {
  const h = parseFloat(height);
  const w = parseFloat(weight);
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

const GENDERS = [
  { value: 'male',   label: '남성' },
  { value: 'female', label: '여성' },
  { value: 'other',  label: '기타' },
];

export default function Step1({ state, onUpdate, onNext, onBack }: StepProps) {
  const bmi = calcBMI(state.height, state.weight);

  const numField = (
    id: string, label: string, key: 'age' | 'height' | 'weight',
    placeholder: string, unit: string, extra?: React.InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <div className="fg">
      <div className="fl">{label} <sup>*</sup></div>
      <div className="fi-wrap">
        <input
          className="fi" id={id} type="number" placeholder={placeholder}
          value={state[key]}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdate({ [key]: e.target.value })}
          {...extra}
        />
        <span className="fi-unit">{unit}</span>
      </div>
    </div>
  );

  return (
    <div className="onb-layout">
      <Sidebar current={1} />
      <main className="onb-main">
        <div className="step-badge">STEP 01 · 기본 정보</div>
        <h1 className="onb-h1">기본 정보를<br />입력해주세요</h1>
        <p className="onb-sub">나이, 키, 성별, 몸무게는 운동 강도 및 볼륨 계산의 핵심 데이터입니다.</p>

        <div className="form-grid">
          {numField('f-age',    '나이',   'age',    '예: 28',    '세',  { min: 10, max: 100 })}
          {numField('f-height', '키',     'height', '예: 176.0', 'cm',  { step: 0.1 })}
          {numField('f-weight', '몸무게', 'weight', '예: 72.5',  'kg',  { step: 0.1 })}

          <div className="fg">
            <div className="fl">BMI <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(자동 계산)</span></div>
            <div className="bmi-display">
              <span className="bmi-val">{bmi}</span>
              <span className="bmi-cat">{bmiCategory(bmi)}</span>
            </div>
          </div>

          <div className="fg full">
            <div className="fl">성별 <sup>*</sup></div>
            <div className="gender-row">
              {GENDERS.map(g => (
                <button
                  key={g.value}
                  className={`gender-btn${state.gender === g.value ? ' on' : ''}`}
                  onClick={() => onUpdate({ gender: g.value })}
                >{g.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button className="btn-back" onClick={onBack}>← 로그인</button>
          <button className="btn-next" onClick={onNext}>다음 →</button>
        </div>
      </main>
    </div>
  );
}
