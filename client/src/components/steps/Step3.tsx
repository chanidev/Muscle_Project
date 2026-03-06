import { useState } from 'react';
import Sidebar from '../Sidebar';
import type { StepProps } from '../../types';
import { PAIN_AREAS, PAIN_EQUIP_DISABLE, EQUIPMENT } from '../../constants';

function disabledEquipment(painAreas: string[]): Set<string> {
  const out = new Set<string>();
  for (const pain of painAreas) {
    for (const eq of (PAIN_EQUIP_DISABLE[pain] ?? [])) out.add(eq);
  }
  return out;
}

type PainLevel = 'none' | 'slight' | 'yes';

const LEVEL_LABELS: Record<PainLevel, string> = {
  none: '없음', slight: '약간있음', yes: '있음',
};

export default function Step3({ state, onUpdate, onNext, onBack }: StepProps) {
  const [activePainId, setActivePainId] = useState<string | null>(null);
  const disabled = disabledEquipment(state.painAreas);

  const getPainLevel = (id: string): PainLevel => {
    if (state.painAreas.includes(id)) return 'yes';
    if (state.painAreasSlight.includes(id)) return 'slight';
    return 'none';
  };

  const setLevel = (painId: string, level: PainLevel) => {
    const newAreas = state.painAreas.filter(p => p !== painId);
    const newSlight = state.painAreasSlight.filter(p => p !== painId);
    if (level === 'yes') newAreas.push(painId);
    if (level === 'slight') newSlight.push(painId);

    // Remove disabled equipment from selection
    const newDisabled = disabledEquipment(newAreas);
    const newEquipment = state.equipment.filter(e => !newDisabled.has(e));

    onUpdate({ painAreas: newAreas, painAreasSlight: newSlight, equipment: newEquipment });
  };

  const toggleEquip = (id: string) => {
    if (disabled.has(id)) return;
    const next = state.equipment.includes(id)
      ? state.equipment.filter(e => e !== id)
      : [...state.equipment, id];
    onUpdate({ equipment: next });
  };

  const activeArea = PAIN_AREAS.find(p => p.id === activePainId);

  return (
    <div className="onb-layout">
      <Sidebar current={3} />
      <main className="onb-main">
        <div className="step-badge">STEP 03 · 통증 &amp; 기구</div>
        <h1 className="onb-h1">통증 부위와<br />사용 가능 기구를 선택해주세요</h1>
        <p className="onb-sub">통증 부위를 선택하면 관련 기구가 자동으로 비활성화됩니다.<br />통증이 없으면 기구만 선택해주세요.</p>

        <div className="form-grid">
          <div className="fsub">통증 부위 <span className="fopt-badge">선택사항</span></div>
          <div className="chip-grid">
            {PAIN_AREAS.map(p => {
              const lvl = getPainLevel(p.id);
              const isActive = activePainId === p.id;
              const cls = [
                'pain-chip',
                lvl === 'yes' ? 'on' : lvl === 'slight' ? 'slight' : '',
                isActive ? 'active' : '',
              ].filter(Boolean).join(' ');
              const text = lvl === 'yes'    ? `${p.label} · 있음`
                         : lvl === 'slight' ? `${p.label} · 약간있음`
                         : p.label;
              return (
                <button
                  key={p.id}
                  className={cls}
                  onClick={() => setActivePainId(isActive ? null : p.id)}
                >{text}</button>
              );
            })}
          </div>

          {activePainId && activeArea && (
            <div className="pain-picker" style={{ display: 'flex' }}>
              <span className="pain-picker-label">{activeArea.label}</span>
              <div className="pain-picker-btns">
                {(['none', 'slight', 'yes'] as PainLevel[]).map(lvl => (
                  <button
                    key={lvl}
                    className={`pain-lvl-btn${getPainLevel(activePainId) === lvl ? ' on' : ''}`}
                    data-lvl={lvl}
                    onClick={() => setLevel(activePainId, lvl)}
                  >{LEVEL_LABELS[lvl]}</button>
                ))}
              </div>
            </div>
          )}

          <div className="fsub" style={{ marginTop: 16 }}>사용 가능 기구 <sup>*</sup></div>
          <div className="equip-grid">
            {EQUIPMENT.map(eq => {
              const isDisabled = disabled.has(eq.id);
              const isOn = !isDisabled && state.equipment.includes(eq.id);
              return (
                <div
                  key={eq.id}
                  className={`equip-card${isOn ? ' on' : ''}${isDisabled ? ' disabled' : ''}`}
                  onClick={() => toggleEquip(eq.id)}
                >
                  <span className="equip-icon">{eq.icon}</span>
                  <span>{eq.label}</span>
                  {isDisabled && <span className="disabled-reason">통증 제약</span>}
                </div>
              );
            })}
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
