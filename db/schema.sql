CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 소셜 로그인 유저
CREATE TABLE users (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    VARCHAR(20)  NOT NULL,
  provider_id VARCHAR(100) NOT NULL,
  email       VARCHAR(255),
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(provider, provider_id)
);

-- 정적 프로필: 골격 길이(BFS용), 통증/기구/목표 등 준정적 설정
CREATE TABLE profiles (
  user_id           UUID     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  age               INT,
  height            NUMERIC,
  gender            VARCHAR(10),
  upper_arm         NUMERIC,        -- 상완골 길이 (cm), BFS 골격 스코어 입력값
  forearm           NUMERIC,        -- 전완 길이 (cm)
  thigh             NUMERIC,        -- 대퇴골 길이 (cm)
  shin              NUMERIC,        -- 경골 길이 (cm)
  pain_areas        TEXT[],
  pain_areas_slight TEXT[],
  equipment         TEXT[],
  goal              VARCHAR(50),
  strength_exp      VARCHAR(50),
  gym_exp           VARCHAR(50),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 시계열 측정값: 주 단위로 INSERT, 히스토리 보존
CREATE TABLE measurements (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  weight      NUMERIC,
  body_fat    NUMERIC,
  muscle_mass NUMERIC,
  rm_squat    NUMERIC,
  rm_bench    NUMERIC,
  rm_deadlift NUMERIC,
  rm_row      NUMERIC,
  rm_ohp      NUMERIC
);

-- 최신 측정값 조회용 인덱스
CREATE INDEX measurements_user_time ON measurements (user_id, recorded_at DESC);

-- 1RM 기록 (신체 측정과 분리된 퍼포먼스 시계열)
CREATE TABLE IF NOT EXISTS rm_records (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  rm_squat    NUMERIC,
  rm_bench    NUMERIC,
  rm_deadlift NUMERIC,
  rm_row      NUMERIC,
  rm_ohp      NUMERIC
);
CREATE INDEX IF NOT EXISTS rm_records_user_time ON rm_records (user_id, recorded_at DESC);

-- 운동 체크인: 날짜별 1회 기록
CREATE TABLE workout_logs (
  user_id      UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_date DATE  NOT NULL DEFAULT CURRENT_DATE,
  PRIMARY KEY (user_id, workout_date)
);

-- 사용자 루틴
CREATE TABLE IF NOT EXISTS routines (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 루틴 내 운동 목록
CREATE TABLE IF NOT EXISTS routine_exercises (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id    UUID NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id   TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  sets          INT NOT NULL DEFAULT 3,
  reps_target   INT NOT NULL DEFAULT 10,
  weight_target DECIMAL(6,2)
);

-- 운동 세션 (시작~끝)
CREATE TABLE IF NOT EXISTS workout_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  routine_id   UUID REFERENCES routines(id) ON DELETE SET NULL,
  routine_name TEXT,
  started_at   TIMESTAMPTZ DEFAULT now(),
  ended_at     TIMESTAMPTZ,
  date         DATE DEFAULT CURRENT_DATE
);

-- 세트별 기록
CREATE TABLE IF NOT EXISTS session_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  set_number  INT NOT NULL,
  reps_done   INT NOT NULL,
  weight_done DECIMAL(6,2),
  logged_at   TIMESTAMPTZ DEFAULT now()
);

-- 운동별 피드백 (RPE + 만족도)
CREATE TABLE IF NOT EXISTS exercise_feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id  TEXT NOT NULL,
  rpe          INT CHECK(rpe BETWEEN 1 AND 10),
  satisfaction INT CHECK(satisfaction BETWEEN 1 AND 5),
  created_at   TIMESTAMPTZ DEFAULT now()
);
