import { useState } from 'react';

interface Props {
  onGuest: () => void;
}

export default function Login({ onGuest }: Props) {
  const [loading, setLoading] = useState<'kakao' | 'google' | null>(null);

  const signIn = (provider: 'kakao' | 'google') => {
    setLoading(provider);
    window.location.href = `/api/auth/${provider}`;
  };

  return (
    <div className="login-page">
      <div className="login-noise" />
      <div className="login-glow" />
      <div className="login-glow2" />
      <div className="login-grid" />
      <div className="login-body">
        <div className="login-eyebrow">골격 비례 기반 맞춤 운동 추천</div>
        <div className="login-logo">MUSCLE<br /><em>TAILORS</em></div>
        <p className="login-tagline">
          당신의 <strong>뼈대 비례</strong>가 최고의 운동을 결정합니다.<br />
          인바디 데이터와 골격 측정으로 <strong>나만의 운동 랭킹</strong>을 만드세요.
        </p>
        <div className="login-actions">
          <button className="btn-kakao" onClick={() => signIn('kakao')} disabled={!!loading}>
            <span>💬</span> {loading === 'kakao' ? '연결 중...' : '카카오로 시작하기'}
          </button>
          <button className="btn-google" onClick={() => signIn('google')} disabled={!!loading}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>G</span> {loading === 'google' ? '연결 중...' : '구글로 시작하기'}
          </button>
          <button
            onClick={onGuest}
            disabled={!!loading}
            style={{ background: 'none', border: 'none', color: 'var(--text-dim, #888)', cursor: 'pointer', marginTop: 8, fontSize: 13, textDecoration: 'underline' }}
          >
            로그인 없이 체험하기
          </button>
        </div>
      </div>
    </div>
  );
}
