import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT ?? 3000;
const ENGINE_URL = process.env.ENGINE_URL ?? 'http://localhost:8000';
const CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET!;
const KAKAO_CLIENT_ID = process.env.KAKAO_CLIENT_ID!;
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET ?? '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const SERVER_URL = process.env.SERVER_URL ?? `http://localhost:${PORT}`;
const KAKAO_CALLBACK = `${SERVER_URL}/api/auth/kakao/callback`;
const GOOGLE_CALLBACK = `${SERVER_URL}/api/auth/google/callback`;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ── Helpers ─────────────────────────────────────────────────────
function setAuthCookie(res: express.Response, userId: string) {
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
}

async function upsertUser(provider: string, providerId: string, email: string | null): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO users (provider, provider_id, email)
     VALUES ($1, $2, $3)
     ON CONFLICT (provider, provider_id) DO UPDATE SET email = EXCLUDED.email
     RETURNING id`,
    [provider, providerId, email],
  );
  return rows[0].id as string;
}

// ── Auth guard ─────────────────────────────────────────────────
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = (req.cookies as Record<string, string>).token;
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    req.headers['x-user-id'] = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Health ──────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'muscle-tailors-bff' });
});

// ── Kakao OAuth ─────────────────────────────────────────────────
app.get('/api/auth/kakao', (_req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: KAKAO_CLIENT_ID,
    redirect_uri: KAKAO_CALLBACK,
  });
  res.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`);
});

app.get('/api/auth/kakao/callback', async (req, res) => {
  if (req.query.error || !req.query.code) {
    return res.redirect(`${CLIENT_URL}?auth_error=1`);
  }
  try {
    const { code } = req.query as { code: string };
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: KAKAO_CLIENT_ID,
        client_secret: KAKAO_CLIENT_SECRET,
        redirect_uri: KAKAO_CALLBACK,
        code,
      }),
    });
    const { access_token } = await tokenRes.json() as { access_token: string };
    const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const user = await userRes.json() as { id: number; kakao_account?: { email?: string } };
    const userId = await upsertUser('kakao', String(user.id), user.kakao_account?.email ?? null);
    setAuthCookie(res, userId);
    res.redirect(CLIENT_URL);
  } catch (e) {
    console.error('Kakao callback error:', e);
    res.redirect(`${CLIENT_URL}?auth_error=1`);
  }
});

// ── Google OAuth ────────────────────────────────────────────────
app.get('/api/auth/google', (_req, res) => {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK,
    response_type: 'code',
    scope: 'openid email profile',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get('/api/auth/google/callback', async (req, res) => {
  if (req.query.error || !req.query.code) {
    return res.redirect(`${CLIENT_URL}?auth_error=1`);
  }
  try {
    const { code } = req.query as { code: string };
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK,
        code,
      }),
    });
    const { access_token } = await tokenRes.json() as { access_token: string };
    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const user = await userRes.json() as { sub: string; email?: string };
    const userId = await upsertUser('google', user.sub, user.email ?? null);
    setAuthCookie(res, userId);
    res.redirect(CLIENT_URL);
  } catch (e) {
    console.error('Google callback error:', e);
    res.redirect(`${CLIENT_URL}?auth_error=1`);
  }
});

// ── Session ─────────────────────────────────────────────────────
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ userId: req.headers['x-user-id'] });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('token').json({ ok: true });
});

// ── Profiles ────────────────────────────────────────────────────
// 정적 프로필 + 최신 측정값을 병합해서 반환
app.get('/api/profiles', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { rows } = await pool.query(
    `SELECT p.*, m.weight, m.body_fat, m.muscle_mass,
            r.rm_squat, r.rm_bench, r.rm_deadlift, r.rm_row, r.rm_ohp
     FROM profiles p
     LEFT JOIN LATERAL (
       SELECT weight, body_fat, muscle_mass FROM measurements
       WHERE user_id = $1
       ORDER BY recorded_at DESC LIMIT 1
     ) m ON true
     LEFT JOIN LATERAL (
       SELECT rm_squat, rm_bench, rm_deadlift, rm_row, rm_ohp FROM rm_records
       WHERE user_id = $1
       ORDER BY recorded_at DESC LIMIT 1
     ) r ON true
     WHERE p.user_id = $1`,
    [userId],
  );
  res.json(rows[0] ?? null);
});

// ── Onboarding save ─────────────────────────────────────────────
// 정적 데이터 → profiles upsert, 변화 데이터 → measurements INSERT
app.post('/api/onboarding/save', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const s = req.body;

  await pool.query(
    `INSERT INTO profiles (
       user_id, age, height, gender,
       upper_arm, forearm, thigh, shin,
       pain_areas, pain_areas_slight, equipment,
       goal, strength_exp, gym_exp, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       age=$2, height=$3, gender=$4,
       upper_arm=$5, forearm=$6, thigh=$7, shin=$8,
       pain_areas=$9, pain_areas_slight=$10, equipment=$11,
       goal=$12, strength_exp=$13, gym_exp=$14,
       updated_at=NOW()`,
    [
      userId,
      s.age        ? parseInt(s.age)          : null,
      s.height     ? parseFloat(s.height)     : null,
      s.gender     || null,
      s.upperArm   ? parseFloat(s.upperArm)   : null,
      s.forearm    ? parseFloat(s.forearm)    : null,
      s.thigh      ? parseFloat(s.thigh)      : null,
      s.shin       ? parseFloat(s.shin)       : null,
      s.painAreas        ?? [],
      s.painAreasSlight  ?? [],
      s.equipment        ?? [],
      s.goal       || null,
      s.strengthExp || null,
      s.gymExp     || null,
    ],
  );

  // 신체 측정값 (인바디)
  const hasBodyMeasurement = s.weight || s.bodyFat || s.muscleMass;
  if (hasBodyMeasurement) {
    await pool.query(
      `INSERT INTO measurements (user_id, weight, body_fat, muscle_mass)
       VALUES ($1,$2,$3,$4)`,
      [
        userId,
        s.weight     ? parseFloat(s.weight)     : null,
        s.bodyFat    ? parseFloat(s.bodyFat)    : null,
        s.muscleMass ? parseFloat(s.muscleMass) : null,
      ],
    );
  }

  // 1RM 기록 (퍼포먼스 — 신체 측정과 별도 시계열)
  const hasRm = s.rm_squat || s.rm_bench || s.rm_deadlift || s.rm_row || s.rm_ohp;
  if (hasRm) {
    await pool.query(
      `INSERT INTO rm_records (user_id, rm_squat, rm_bench, rm_deadlift, rm_row, rm_ohp)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        userId,
        s.rm_squat    ? parseFloat(s.rm_squat)    : null,
        s.rm_bench    ? parseFloat(s.rm_bench)    : null,
        s.rm_deadlift ? parseFloat(s.rm_deadlift) : null,
        s.rm_row      ? parseFloat(s.rm_row)      : null,
        s.rm_ohp      ? parseFloat(s.rm_ohp)      : null,
      ],
    );
  }

  res.json({ ok: true });
});

// ── Measurements (time-series) ──────────────────────────────────
app.get('/api/measurements', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { rows } = await pool.query(
    `SELECT recorded_at, weight, body_fat, muscle_mass
     FROM measurements WHERE user_id=$1 ORDER BY recorded_at ASC`,
    [userId],
  );
  res.json(rows);
});

app.post('/api/measurements', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { weight, body_fat, muscle_mass } = req.body as Record<string, number | null>;
  await pool.query(
    `INSERT INTO measurements (user_id, weight, body_fat, muscle_mass) VALUES ($1,$2,$3,$4)`,
    [userId, weight ?? null, body_fat ?? null, muscle_mass ?? null],
  );
  res.json({ ok: true });
});

// ── Workout logs (check-in) ─────────────────────────────────────
app.get('/api/workout-logs', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { rows } = await pool.query(
    `SELECT TO_CHAR(workout_date, 'YYYY-MM-DD') AS workout_date FROM workout_logs WHERE user_id=$1 ORDER BY workout_date ASC`,
    [userId],
  );
  res.json(rows.map((r: { workout_date: string }) => r.workout_date));
});

app.post('/api/workout-logs', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  await pool.query(
    `INSERT INTO workout_logs (user_id, workout_date) VALUES ($1, CURRENT_DATE) ON CONFLICT DO NOTHING`,
    [userId],
  );
  res.json({ ok: true });
});

// ── Routines ────────────────────────────────────────────────────
app.get('/api/routines', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { rows: routineRows } = await pool.query(
    `SELECT id, name, created_at FROM routines WHERE user_id=$1 ORDER BY created_at DESC`,
    [userId],
  );
  const { rows: exRows } = await pool.query(
    `SELECT re.*, r.user_id FROM routine_exercises re
     JOIN routines r ON re.routine_id = r.id
     WHERE r.user_id = $1 ORDER BY re.routine_id, re.display_order`,
    [userId],
  );
  const result = routineRows.map((r: Record<string, unknown>) => ({
    ...r,
    exercises: exRows.filter((e: Record<string, unknown>) => e.routine_id === r.id),
  }));
  res.json(result);
});

app.post('/api/routines', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { name, exercises } = req.body as { name: string; exercises: Array<Record<string, unknown>> };
  const { rows } = await pool.query(
    `INSERT INTO routines (user_id, name) VALUES ($1,$2) RETURNING id`,
    [userId, name],
  );
  const routineId = rows[0].id as string;
  if (exercises?.length) {
    for (const [i, ex] of exercises.entries()) {
      await pool.query(
        `INSERT INTO routine_exercises (routine_id, exercise_id, display_order, sets, reps_target, weight_target)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [routineId, ex.exercise_id, i, ex.sets ?? 3, ex.reps_target ?? 10, ex.weight_target ?? null],
      );
    }
  }
  res.json({ id: routineId });
});

app.put('/api/routines/:id', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { id } = req.params;
  const { name, exercises } = req.body as { name: string; exercises: Array<Record<string, unknown>> };
  await pool.query(`UPDATE routines SET name=$1 WHERE id=$2 AND user_id=$3`, [name, id, userId]);
  await pool.query(`DELETE FROM routine_exercises WHERE routine_id=$1`, [id]);
  if (exercises?.length) {
    for (const [i, ex] of exercises.entries()) {
      await pool.query(
        `INSERT INTO routine_exercises (routine_id, exercise_id, display_order, sets, reps_target, weight_target)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, ex.exercise_id, i, ex.sets ?? 3, ex.reps_target ?? 10, ex.weight_target ?? null],
      );
    }
  }
  res.json({ ok: true });
});

app.delete('/api/routines/:id', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  await pool.query(`DELETE FROM routines WHERE id=$1 AND user_id=$2`, [req.params.id, userId]);
  res.json({ ok: true });
});

// ── Workout Sessions ─────────────────────────────────────────────
app.post('/api/sessions', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { routine_id } = req.body as { routine_id?: string };
  let routineName: string | null = null;
  if (routine_id) {
    const { rows } = await pool.query(`SELECT name FROM routines WHERE id=$1`, [routine_id]);
    routineName = rows[0]?.name ?? null;
  }
  const { rows } = await pool.query(
    `INSERT INTO workout_sessions (user_id, routine_id, routine_name) VALUES ($1,$2,$3) RETURNING *`,
    [userId, routine_id ?? null, routineName],
  );
  res.json(rows[0]);
});

app.put('/api/sessions/:id/finish', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  await pool.query(
    `UPDATE workout_sessions SET ended_at=now() WHERE id=$1 AND user_id=$2`,
    [req.params.id, userId],
  );
  // 체크인도 함께 기록
  await pool.query(
    `INSERT INTO workout_logs (user_id, workout_date) VALUES ($1, CURRENT_DATE) ON CONFLICT DO NOTHING`,
    [userId],
  );
  res.json({ ok: true });
});

app.get('/api/sessions', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { rows } = await pool.query(
    `SELECT id, routine_name, started_at, ended_at, TO_CHAR(date, 'YYYY-MM-DD') AS date
     FROM workout_sessions WHERE user_id=$1 ORDER BY started_at DESC LIMIT 20`,
    [userId],
  );
  res.json(rows);
});

app.get('/api/sessions/:id/detail', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const sessionId = req.params.id;
  const [logsResult, feedbackResult] = await Promise.all([
    pool.query(
      `SELECT exercise_id, set_number, reps_done, weight_done
       FROM session_logs WHERE session_id=$1 ORDER BY exercise_id, set_number`,
      [sessionId],
    ),
    pool.query(
      `SELECT exercise_id, rpe, satisfaction
       FROM exercise_feedback WHERE session_id=$1 AND user_id=$2`,
      [sessionId, userId],
    ),
  ]);
  res.json({ logs: logsResult.rows, feedback: feedbackResult.rows });
});

// ── Session Logs & Feedback ──────────────────────────────────────
app.post('/api/sessions/:id/logs', requireAuth, async (req, res) => {
  const { exercise_id, set_number, reps_done, weight_done } =
    req.body as { exercise_id: string; set_number: number; reps_done: number; weight_done?: number };
  await pool.query(
    `INSERT INTO session_logs (session_id, exercise_id, set_number, reps_done, weight_done)
     VALUES ($1,$2,$3,$4,$5)`,
    [req.params.id, exercise_id, set_number, reps_done, weight_done ?? null],
  );
  res.json({ ok: true });
});

app.post('/api/sessions/:id/feedback', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { exercise_id, rpe, satisfaction } =
    req.body as { exercise_id: string; rpe: number; satisfaction: number };
  await pool.query(
    `INSERT INTO exercise_feedback (session_id, user_id, exercise_id, rpe, satisfaction)
     VALUES ($1,$2,$3,$4,$5)`,
    [req.params.id, userId, exercise_id, rpe, satisfaction],
  );
  res.json({ ok: true });
});

// ── Stats ────────────────────────────────────────────────────────
app.get('/api/stats/weekly', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { rows } = await pool.query(
    `SELECT sl.session_id,
            ws.date,
            SUM(sl.weight_done * sl.reps_done) AS volume
     FROM session_logs sl
     JOIN workout_sessions ws ON sl.session_id = ws.id
     WHERE ws.user_id=$1 AND ws.date >= CURRENT_DATE - 6
     GROUP BY sl.session_id, ws.date
     ORDER BY ws.date ASC`,
    [userId],
  );
  // 날짜별 합산
  const byDate: Record<string, number> = {};
  for (const r of rows as Array<{ date: Date; volume: string }>) {
    const d = r.date.toISOString().slice(0, 10);
    byDate[d] = (byDate[d] ?? 0) + parseFloat(r.volume ?? '0');
  }
  res.json(byDate);
});

app.get('/api/stats/volume/:exId', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { rows } = await pool.query(
    `SELECT ws.date, MAX(sl.weight_done) AS max_weight
     FROM session_logs sl
     JOIN workout_sessions ws ON sl.session_id = ws.id
     WHERE ws.user_id=$1 AND sl.exercise_id=$2 AND sl.weight_done IS NOT NULL
     GROUP BY ws.date ORDER BY ws.date ASC`,
    [userId, req.params.exId],
  );
  res.json(rows.map((r: { date: Date; max_weight: string }) => ({
    date: r.date.toISOString().slice(0, 10),
    max_weight: parseFloat(r.max_weight),
  })));
});

app.get('/api/feedback-adjustments', requireAuth, async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  const { rows } = await pool.query(
    `SELECT exercise_id, AVG(satisfaction) AS avg_sat
     FROM exercise_feedback WHERE user_id=$1
     GROUP BY exercise_id`,
    [userId],
  );
  const result: Record<string, number> = {};
  for (const r of rows as Array<{ exercise_id: string; avg_sat: string }>) {
    result[r.exercise_id] = (parseFloat(r.avg_sat) - 3) * 0.05;
  }
  res.json(result);
});

// ── Rank (no auth) ──────────────────────────────────────────────
app.post('/api/rank', async (req, res) => {
  try {
    const upstream = await fetch(`${ENGINE_URL}/api/scoring/rank`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-user-id': 'guest' },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch {
    res.status(502).json({ error: 'Engine unavailable' });
  }
});

// ── Engine proxy (auth required) ────────────────────────────────
app.use(
  '/api/engine',
  requireAuth,
  createProxyMiddleware({
    target: ENGINE_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/engine': '/api' },
  }),
);

// ── Export for Vercel ────────────────────────────────────────────
export default app;

// 로컬 개발 시에만 직접 실행
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`BFF server → http://localhost:${PORT}`);
  });
}
