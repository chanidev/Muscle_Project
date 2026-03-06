from __future__ import annotations

from fastapi import APIRouter, Header
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

# ── 운동 유형별 가중치 (scoring.md 1.2) ───────────────────────────
TYPE_WEIGHTS: dict[str, dict[str, float]] = {
    # mobility 제거 → 나머지 4개 고루 재분배 (단관절은 부상 위험에 전량 이동)
    "compound":  {"strength": 0.35, "injury": 0.25, "skeleton": 0.25, "goal": 0.15},
    "isolation": {"strength": 0.20, "injury": 0.50, "skeleton": 0.15, "goal": 0.15},
    "hinge":     {"strength": 0.40, "injury": 0.25, "skeleton": 0.20, "goal": 0.15},
}

# ── 1RM 기준치 (BW 배수, Haff & Triplett 2016 / scoring.md 2.1) ──
RM_BENCHMARKS: dict[str, dict[str, float]] = {
    "beginner":     {"squat": 0.75, "bench": 0.50, "deadlift": 1.00, "row": 0.50, "ohp": 0.30},
    "intermediate": {"squat": 1.25, "bench": 0.90, "deadlift": 1.50, "row": 0.90, "ohp": 0.60},
    "advanced":     {"squat": 1.75, "bench": 1.25, "deadlift": 2.00, "row": 1.25, "ohp": 0.85},
}

# ── EXERCISE_PARAMS (scoring.md 3장 + 6장 + 7장 전체) ─────────────
# Fields:
#   name          : 한국어 표시명
#   type          : compound | isolation | hinge
#   base_risk     : 0.0–1.0  (scoring.md base_risk 산정 신뢰도 고지 참조)
#   pain_areas    : 겹칠 경우 Injury_score 감점 부위
#   skeleton_key  : forearm_ratio | femur_ratio | None
#   skeleton_adv  : short | long | neutral | None  (단완·단퇴=short, 장완·장퇴=long)
#   goal_match    : {diet, strength, hypertrophy} → 0.0–1.0
#   required_rom  : high | medium | low
#   equipment     : 필요 기구 ID 목록 (전부 보유해야 사용 가능)
#   primary_lift  : squat | bench | deadlift | row | ohp | None
#   muscle_group  : chest | back | shoulders | arms | legs
EXERCISE_PARAMS: dict[str, dict] = {

    # ════════════════════════════════════════ 가슴 (3.1)
    "incline_bench": {
        "name": "인클라인벤치프레스", "type": "compound", # "base_risk": 0.7,
        "pain_areas": ["shoulder", "elbow"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "short",
        "goal_match": {"strength": 0.8, "hypertrophy": 0.8, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["barbell", "bench"],
        "primary_lift": "bench", "muscle_group": "chest",
    },
    "bench_press": {
        "name": "벤치프레스", "type": "compound", # "base_risk": 0.8,
        "pain_areas": ["shoulder", "elbow"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "short",
        "goal_match": {"strength": 1.0, "hypertrophy": 0.7, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["barbell", "bench"],
        "primary_lift": "bench", "muscle_group": "chest",
    },
    "dumbbell_bench": {
        "name": "덤벨벤치프레스", "type": "compound", # "base_risk": 0.5,
        "pain_areas": ["shoulder", "elbow"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.7, "hypertrophy": 1.0, "diet": 0.6},
        # "required_rom": "",
        "equipment": ["dumbbell", "bench"],
        "primary_lift": "bench", "muscle_group": "chest",
    },
    "cable_press": {
        "name": "케이블프레스", "type": "compound", # "base_risk": 0.3,
        "pain_areas": ["shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.4, "hypertrophy": 0.9, "diet": 0.6},
        # "required_rom": "",
        "equipment": ["cable"],
        "primary_lift": "bench", "muscle_group": "chest",
    },
    "smith_bench": {
        "name": "스미스머신 벤치프레스", "type": "compound", # "base_risk": 0.5,
        "pain_areas": ["shoulder", "elbow", "wrist"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.6, "hypertrophy": 0.7, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["smith_machine", "bench"],
        "primary_lift": "bench", "muscle_group": "chest",
    },
    "decline_bench": {
        "name": "디클라인벤치프레스", "type": "compound", # "base_risk": 0.7,
        "pain_areas": ["shoulder", "elbow"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.7, "hypertrophy": 0.7, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["barbell", "bench"],
        "primary_lift": "bench", "muscle_group": "chest",
    },
    "dips_chest": {
        "name": "딥스", "type": "compound", # "base_risk": 0.8,
        "pain_areas": ["shoulder", "elbow"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "short",  # 장완 불리 → 단완 유리
        "goal_match": {"strength": 0.8, "hypertrophy": 0.8, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["dip_bar"],
        "primary_lift": "bench", "muscle_group": "chest",
    },
    "dumbbell_fly": {
        "name": "덤벨플라이", "type": "isolation", # "base_risk": 0.7,
        "pain_areas": ["shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "long",  # 장완 유리
        "goal_match": {"strength": 0.2, "hypertrophy": 1.0, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["dumbbell", "bench"],
        "primary_lift": "bench", "muscle_group": "chest",
    },
    "cable_crossover": {
        "name": "케이블크로스오버", "type": "isolation", # "base_risk": 0.3,
        "pain_areas": ["shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.2, "hypertrophy": 1.0, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["cable"],
        "primary_lift": "bench", "muscle_group": "chest",
    },
    "pec_deck": {
        "name": "펙덱머신", "type": "isolation", # "base_risk": 0.4,
        "pain_areas": ["shoulder"],
        "skeleton_key": None, "skeleton_adv": None,
        "goal_match": {"strength": 0.2, "hypertrophy": 1.0, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["cable"],  # 케이블 머신으로 대체
        "primary_lift": "bench", "muscle_group": "chest",
    },

    # ════════════════════════════════════════ 등 (3.2)
    "pull_up": {
        "name": "풀업", "type": "compound", # "base_risk": 0.6,
        "pain_areas": ["shoulder", "elbow"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "short",  # 단완 유리
        "goal_match": {"strength": 0.9, "hypertrophy": 0.8, "diet": 0.7},
        # "required_rom": "",
        "equipment": ["pull_up_bar"],
        "primary_lift": "row", "muscle_group": "back",
    },
    "chin_up": {
        "name": "친업", "type": "compound", # "base_risk": 0.5,
        "pain_areas": ["shoulder", "elbow"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.9, "hypertrophy": 0.9, "diet": 0.7},
        # "required_rom": "",
        "equipment": ["pull_up_bar"],
        "primary_lift": "row", "muscle_group": "back",
    },
    "lat_pulldown": {
        "name": "랫풀다운", "type": "compound", # "base_risk": 0.4,
        "pain_areas": ["shoulder", "elbow"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.7, "hypertrophy": 0.9, "diet": 0.6},
        # "required_rom": "",
        "equipment": ["cable"],
        "primary_lift": "row", "muscle_group": "back",
    },
    "barbell_row": {
        "name": "바벨로우", "type": "compound", # "base_risk": 0.7,
        "pain_areas": ["shoulder", "lower_back"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "short",  # 장퇴 → 요추 부하↑ → 단퇴 유리
        "goal_match": {"strength": 1.0, "hypertrophy": 0.8, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["barbell"],
        "primary_lift": "row", "muscle_group": "back",
    },
    "dumbbell_row": {
        "name": "덤벨로우", "type": "compound", # "base_risk": 0.4,
        "pain_areas": ["shoulder", "lower_back"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.8, "hypertrophy": 1.0, "diet": 0.6},
        # "required_rom": "",
        "equipment": ["dumbbell", "bench"],
        "primary_lift": "row", "muscle_group": "back",
    },
    "seated_cable_row": {
        "name": "시티드케이블로우", "type": "compound", # "base_risk": 0.3,
        "pain_areas": ["shoulder", "lower_back"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.6, "hypertrophy": 0.9, "diet": 0.6},
        # "required_rom": "",
        "equipment": ["cable"],
        "primary_lift": "row", "muscle_group": "back",
    },
    "inverted_row": {
        "name": "인버티드로우", "type": "compound", # "base_risk": 0.2,
        "pain_areas": ["shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.5, "hypertrophy": 0.7, "diet": 0.8},
        # "required_rom": "",
        "equipment": ["pull_up_bar"],
        "primary_lift": "row", "muscle_group": "back",
    },
    "deadlift": {
        "name": "데드리프트", "type": "hinge", # "base_risk": 0.9,
        "pain_areas": ["lower_back", "knee"],
        "skeleton_key": None, "skeleton_adv": None,  # 대퇴 길이보다 torso 비율이 관여 → 골격 판단 제외
        "goal_match": {"strength": 1.0, "hypertrophy": 0.7, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["barbell"],
        "primary_lift": "deadlift", "muscle_group": "back",
    },
    "rdl": {
        "name": "루마니안데드리프트", "type": "hinge", # "base_risk": 0.6,
        "pain_areas": ["lower_back", "knee"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "long",  # 장퇴형 강점 — 햄스트링 신장 극대화
        "goal_match": {"strength": 0.8, "hypertrophy": 1.0, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["barbell"],
        "primary_lift": "deadlift", "muscle_group": "back",
    },
    "face_pull": {
        "name": "페이스풀", "type": "isolation", # "base_risk": 0.2,
        "pain_areas": ["shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.3, "hypertrophy": 0.6, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["cable"],
        "primary_lift": "row", "muscle_group": "back",
    },
    "rear_delt_machine": {
        "name": "리어델트머신", "type": "isolation", # "base_risk": 0.2,
        "pain_areas": ["shoulder"],
        "skeleton_key": None, "skeleton_adv": None,
        "goal_match": {"strength": 0.2, "hypertrophy": 0.8, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["cable"],
        "primary_lift": "row", "muscle_group": "back",
    },

    # ════════════════════════════════════════ 어깨 (3.3)
    "front_raise": {
        "name": "프론트레이즈", "type": "isolation", # "base_risk": 0.6,
        "pain_areas": ["shoulder", "wrist"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.2, "hypertrophy": 0.7, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "ohp", "muscle_group": "shoulders",
    },
    "ohp_dumbbell": {
        "name": "오버헤드프레스 (덤벨)", "type": "compound", # "base_risk": 0.6,
        "pain_areas": ["shoulder", "wrist"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "short",  # 단완 유리
        "goal_match": {"strength": 0.9, "hypertrophy": 0.8, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "ohp", "muscle_group": "shoulders",
    },
    "lateral_raise": {
        "name": "사이드레터럴레이즈", "type": "isolation", # "base_risk": 0.5,
        "pain_areas": ["shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.2, "hypertrophy": 1.0, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "ohp", "muscle_group": "shoulders",
    },
    "cable_lateral": {
        "name": "케이블레터럴레이즈", "type": "isolation", # "base_risk": 0.3,
        "pain_areas": ["shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.2, "hypertrophy": 1.0, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["cable"],
        "primary_lift": "ohp", "muscle_group": "shoulders",
    },
    "rear_delt_raise": {
        "name": "리어델트레이즈", "type": "isolation", # "base_risk": 0.3,
        "pain_areas": ["shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.2, "hypertrophy": 0.9, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "ohp", "muscle_group": "shoulders",
    },
    "bent_over_lateral": {
        "name": "벤트오버레터럴레이즈", "type": "isolation", # "base_risk": 0.5,
        "pain_areas": ["shoulder", "lower_back"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "short",  # 장퇴 → 체간 경사↑ → 단퇴 유리
        "goal_match": {"strength": 0.2, "hypertrophy": 0.9, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "ohp", "muscle_group": "shoulders",
    },
    "shoulder_press_db": {
        "name": "숄더프레스 (덤벨)", "type": "compound", # "base_risk": 0.5,
        "pain_areas": ["shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.8, "hypertrophy": 0.9, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "ohp", "muscle_group": "shoulders",
    },
    "military_press": {
        "name": "밀리터리프레스 (바벨)", "type": "compound", # "base_risk": 0.8,
        "pain_areas": ["shoulder", "wrist"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "short",  # 단완 강점
        "goal_match": {"strength": 1.0, "hypertrophy": 0.6, "diet": 0.3},
        # "required_rom": "",
        "equipment": ["barbell"],
        "primary_lift": "ohp", "muscle_group": "shoulders",
    },
    "arnold_press": {
        "name": "아놀드프레스", "type": "compound", # "base_risk": 0.7,
        "pain_areas": ["shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.7, "hypertrophy": 1.0, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "ohp", "muscle_group": "shoulders",
    },
    "machine_shoulder_press": {
        "name": "머신숄더프레스", "type": "compound", # "base_risk": 0.4,
        "pain_areas": ["shoulder"],
        "skeleton_key": None, "skeleton_adv": None,
        "goal_match": {"strength": 0.6, "hypertrophy": 0.8, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["cable"],
        "primary_lift": "ohp", "muscle_group": "shoulders",
    },
    "shrug": {
        "name": "슈러그", "type": "isolation", # "base_risk": 0.5,
        "pain_areas": ["shoulder", "neck"],
        "skeleton_key": None, "skeleton_adv": None,
        "goal_match": {"strength": 0.7, "hypertrophy": 0.8, "diet": 0.3},
        # "required_rom": "",
        "equipment": ["barbell"],
        "primary_lift": "row", "muscle_group": "shoulders",
    },
    "upright_row": {
        "name": "업라이트로우", "type": "compound", # "base_risk": 0.8,
        "pain_areas": ["shoulder", "wrist"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.5, "hypertrophy": 0.6, "diet": 0.3},
        # "required_rom": "",
        "equipment": ["barbell"],
        "primary_lift": "row", "muscle_group": "shoulders",
    },

    # ════════════════════════════════════════ 팔 — 이두 (6.1)
    "barbell_curl": {
        "name": "바벨컬", "type": "isolation", # "base_risk": 0.5,
        "pain_areas": ["elbow", "wrist"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "long",  # 장완 유리
        "goal_match": {"strength": 0.7, "hypertrophy": 1.0, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["barbell"],
        "primary_lift": "row", "muscle_group": "arms",
    },
    "dumbbell_curl": {
        "name": "덤벨컬", "type": "isolation", # "base_risk": 0.3,
        "pain_areas": ["elbow", "wrist"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "long",
        "goal_match": {"strength": 0.6, "hypertrophy": 1.0, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "row", "muscle_group": "arms",
    },
    "hammer_curl": {
        "name": "해머컬", "type": "isolation", # "base_risk": 0.2,
        "pain_areas": ["elbow"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.5, "hypertrophy": 0.9, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "row", "muscle_group": "arms",
    },
    "incline_curl": {
        "name": "인클라인덤벨컬", "type": "isolation", # "base_risk": 0.4,
        "pain_areas": ["elbow", "shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "long",
        "goal_match": {"strength": 0.4, "hypertrophy": 1.0, "diet": 0.3},
        # "required_rom": "",
        "equipment": ["dumbbell", "bench"],
        "primary_lift": "row", "muscle_group": "arms",
    },
    "cable_curl": {
        "name": "케이블컬", "type": "isolation", # "base_risk": 0.2,
        "pain_areas": ["elbow"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.3, "hypertrophy": 1.0, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["cable"],
        "primary_lift": "row", "muscle_group": "arms",
    },
    "preacher_curl": {
        "name": "프리처컬", "type": "isolation", # "base_risk": 0.6,
        "pain_areas": ["elbow"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "short",  # 단완 유리 — 하강 구간 토크 제한
        "goal_match": {"strength": 0.3, "hypertrophy": 1.0, "diet": 0.3},
        # "required_rom": "",
        "equipment": ["barbell"],
        "primary_lift": "row", "muscle_group": "arms",
    },

    # ════════════════════════════════════════ 팔 — 삼두 (6.2)
    "skull_crusher": {
        "name": "라잉트라이셉스익스텐션", "type": "isolation", # "base_risk": 0.6,
        "pain_areas": ["elbow", "shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "short",  # 장완 불리 → 단완 유리
        "goal_match": {"strength": 0.4, "hypertrophy": 1.0, "diet": 0.3},
        # "required_rom": "",
        "equipment": ["barbell", "bench"],
        "primary_lift": "bench", "muscle_group": "arms",
    },
    "overhead_triceps": {
        "name": "오버헤드트라이셉스익스텐션", "type": "isolation", # "base_risk": 0.6,
        "pain_areas": ["elbow", "shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "long",  # 장완 유리
        "goal_match": {"strength": 0.3, "hypertrophy": 1.0, "diet": 0.3},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "bench", "muscle_group": "arms",
    },
    "triceps_pushdown": {
        "name": "트라이셉스푸시다운", "type": "isolation", # "base_risk": 0.2,
        "pain_areas": ["elbow", "wrist"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "short",  # 단완 유리
        "goal_match": {"strength": 0.4, "hypertrophy": 0.9, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["cable"],
        "primary_lift": "bench", "muscle_group": "arms",
    },
    "kickback": {
        "name": "킥백", "type": "isolation", # "base_risk": 0.3,
        "pain_areas": ["elbow", "shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.2, "hypertrophy": 0.7, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "bench", "muscle_group": "arms",
    },
    "dips_triceps": {
        "name": "딥스 (삼두)", "type": "compound", # "base_risk": 0.7,
        "pain_areas": ["elbow", "shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "short",  # 단완 유리
        "goal_match": {"strength": 0.9, "hypertrophy": 0.8, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["dip_bar"],
        "primary_lift": "bench", "muscle_group": "arms",
    },
    "close_grip_bench": {
        "name": "클로즈그립벤치프레스", "type": "compound", # "base_risk": 0.6,
        "pain_areas": ["elbow", "wrist", "shoulder"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "short",
        "goal_match": {"strength": 0.9, "hypertrophy": 0.8, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["barbell", "bench"],
        "primary_lift": "bench", "muscle_group": "arms",
    },

    # ════════════════════════════════════════ 팔 — 전완 (6.3)
    "wrist_curl": {
        "name": "리스트컬", "type": "isolation", # "base_risk": 0.5,
        "pain_areas": ["wrist"],
        "skeleton_key": None, "skeleton_adv": None,
        "goal_match": {"strength": 0.6, "hypertrophy": 0.8, "diet": 0.3},
        # "required_rom": "",
        "equipment": ["barbell"],
        "primary_lift": None, "muscle_group": "arms",
    },
    "reverse_curl": {
        "name": "리버스컬", "type": "isolation", # "base_risk": 0.4,
        "pain_areas": ["elbow", "wrist"],
        "skeleton_key": "forearm_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.5, "hypertrophy": 0.7, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["barbell"],
        "primary_lift": None, "muscle_group": "arms",
    },
    "farmers_carry": {
        "name": "파머스캐리", "type": "compound", # "base_risk": 0.4,
        "pain_areas": ["lower_back", "wrist", "shoulder"],
        "skeleton_key": None, "skeleton_adv": None,
        "goal_match": {"strength": 0.8, "hypertrophy": 0.5, "diet": 0.7},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": None, "muscle_group": "arms",
    },

    # ════════════════════════════════════════ 하체 — 대퇴사두 (7.1)
    "barbell_squat": {
        "name": "바벨스쿼트", "type": "compound", # "base_risk": 0.7,
        "pain_areas": ["knee", "lower_back"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "short",  # 단퇴형 유리
        "goal_match": {"strength": 1.0, "hypertrophy": 0.8, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["barbell"],
        "primary_lift": "squat", "muscle_group": "legs",
    },
    "goblet_squat": {
        "name": "고블릿스쿼트", "type": "compound", # "base_risk": 0.3,
        "pain_areas": ["knee"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "neutral",  # 장퇴형에도 상대적으로 유리
        "goal_match": {"strength": 0.4, "hypertrophy": 0.6, "diet": 0.7},
        # "required_rom": "",
        "equipment": ["kettlebell"],
        "primary_lift": "squat", "muscle_group": "legs",
    },
    "leg_press": {
        "name": "레그프레스", "type": "compound", # "base_risk": 0.4,
        "pain_areas": ["knee", "lower_back"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "long",  # 장퇴형 강점
        "goal_match": {"strength": 0.7, "hypertrophy": 1.0, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["leg_press"],
        "primary_lift": "squat", "muscle_group": "legs",
    },
    "leg_extension": {
        "name": "레그익스텐션", "type": "isolation", # "base_risk": 0.7,
        "pain_areas": ["knee"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "short",  # 장퇴형 불리 → 단퇴 유리
        "goal_match": {"strength": 0.3, "hypertrophy": 0.9, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["leg_press"],
        "primary_lift": "squat", "muscle_group": "legs",
    },
    "hack_squat": {
        "name": "핵스쿼트", "type": "compound", # "base_risk": 0.5,
        "pain_areas": ["knee"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.8, "hypertrophy": 0.9, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["leg_press"],
        "primary_lift": "squat", "muscle_group": "legs",
    },
    "bss": {
        "name": "불가리안스플릿스쿼트", "type": "compound", # "base_risk": 0.5,
        "pain_areas": ["knee", "lower_back"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.7, "hypertrophy": 1.0, "diet": 0.6},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "squat", "muscle_group": "legs",
    },

    # ════════════════════════════════════════ 하체 — 햄스트링 (7.2)
    "lying_leg_curl": {
        "name": "레그컬 (라잉)", "type": "isolation", # "base_risk": 0.4,
        "pain_areas": ["knee", "lower_back"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "long",  # 장퇴형 강점
        "goal_match": {"strength": 0.4, "hypertrophy": 1.0, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["leg_press"],
        "primary_lift": "squat", "muscle_group": "legs",
    },
    "seated_leg_curl": {
        "name": "레그컬 (시티드)", "type": "isolation", # "base_risk": 0.3,
        "pain_areas": ["knee"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "long",
        "goal_match": {"strength": 0.3, "hypertrophy": 1.0, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["leg_press"],
        "primary_lift": "squat", "muscle_group": "legs",
    },

    # ════════════════════════════════════════ 하체 — 둔근 (7.3)
    "hip_thrust": {
        "name": "힙쓰러스트", "type": "isolation", # "base_risk": 0.4,
        "pain_areas": ["lower_back"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "long",  # 장퇴형 강점
        "goal_match": {"strength": 0.7, "hypertrophy": 1.0, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["barbell", "bench"],
        "primary_lift": "squat", "muscle_group": "legs",
    },
    "cable_hip_extension": {
        "name": "케이블힙익스텐션", "type": "isolation", # "base_risk": 0.2,
        "pain_areas": ["lower_back"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.2, "hypertrophy": 0.8, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["cable"],
        "primary_lift": "squat", "muscle_group": "legs",
    },

    # ════════════════════════════════════════ 하체 — 종아리 (7.4)
    "seated_calf_raise": {
        "name": "시티드카프레이즈", "type": "isolation", # "base_risk": 0.2,
        "pain_areas": ["ankle"],
        "skeleton_key": None, "skeleton_adv": None,
        "goal_match": {"strength": 0.5, "hypertrophy": 0.9, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["leg_press"],
        "primary_lift": None, "muscle_group": "legs",
    },
    "leg_press_calf": {
        "name": "레그프레스카프레이즈", "type": "isolation", # "base_risk": 0.3,
        "pain_areas": ["ankle"],
        "skeleton_key": None, "skeleton_adv": None,
        "goal_match": {"strength": 0.5, "hypertrophy": 0.8, "diet": 0.4},
        # "required_rom": "",
        "equipment": ["leg_press"],
        "primary_lift": None, "muscle_group": "legs",
    },

    # ════════════════════════════════════════ 하체 — 복합 (7.5)
    "lunge": {
        "name": "런지", "type": "compound", # "base_risk": 0.5,
        "pain_areas": ["knee", "lower_back"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.6, "hypertrophy": 0.9, "diet": 0.8},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "squat", "muscle_group": "legs",
    },
    "step_up": {
        "name": "스텝업", "type": "compound", # "base_risk": 0.3,
        "pain_areas": ["knee"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "neutral",
        "goal_match": {"strength": 0.5, "hypertrophy": 0.7, "diet": 0.8},
        # "required_rom": "",
        "equipment": ["dumbbell"],
        "primary_lift": "squat", "muscle_group": "legs",
    },
    "wide_leg_press": {
        "name": "레그프레스 (광폭)", "type": "compound", # "base_risk": 0.4,
        "pain_areas": ["knee", "hip"],
        "skeleton_key": "femur_ratio", "skeleton_adv": "long",  # 장퇴형 강점
        "goal_match": {"strength": 0.6, "hypertrophy": 1.0, "diet": 0.5},
        # "required_rom": "",
        "equipment": ["leg_press"],
        "primary_lift": "squat", "muscle_group": "legs",
    },
}


# ── 생체역학 파라미터 (Formula ①: Risk = τ_ext × N / C × R) ─────────
# torque_factor : 운동별 1RM 대비 관절 실효 부하 비율 (수동 정의)
# moment_arm_key: 주요 모멘트암 신체 분절 키 (forearm | shin | thigh)
BIOMECH_PARAMS: dict[str, dict] = {
    # 가슴
    "incline_bench":         {"torque_factor": 0.85, "moment_arm_key": "forearm"},
    "bench_press":           {"torque_factor": 1.00, "moment_arm_key": "forearm"},
    "dumbbell_bench":        {"torque_factor": 0.75, "moment_arm_key": "forearm"},
    "cable_press":           {"torque_factor": 0.35, "moment_arm_key": "forearm"},
    "smith_bench":           {"torque_factor": 0.90, "moment_arm_key": "forearm"},
    "decline_bench":         {"torque_factor": 0.90, "moment_arm_key": "forearm"},
    "dips_chest":            {"torque_factor": 0.80, "moment_arm_key": "forearm"},
    "dumbbell_fly":          {"torque_factor": 0.30, "moment_arm_key": "forearm"},
    "cable_crossover":       {"torque_factor": 0.30, "moment_arm_key": "forearm"},
    "pec_deck":              {"torque_factor": 0.35, "moment_arm_key": "forearm"},
    # 등
    "pull_up":               {"torque_factor": 0.80, "moment_arm_key": "forearm"},
    "chin_up":               {"torque_factor": 0.80, "moment_arm_key": "forearm"},
    "lat_pulldown":          {"torque_factor": 0.65, "moment_arm_key": "forearm"},
    "barbell_row":           {"torque_factor": 0.85, "moment_arm_key": "forearm"},
    "dumbbell_row":          {"torque_factor": 0.70, "moment_arm_key": "forearm"},
    "seated_cable_row":      {"torque_factor": 0.60, "moment_arm_key": "forearm"},
    "inverted_row":          {"torque_factor": 0.60, "moment_arm_key": "forearm"},
    "deadlift":              {"torque_factor": 1.00, "moment_arm_key": "thigh"},
    "rdl":                   {"torque_factor": 0.80, "moment_arm_key": "thigh"},
    "face_pull":             {"torque_factor": 0.25, "moment_arm_key": "forearm"},
    "rear_delt_machine":     {"torque_factor": 0.20, "moment_arm_key": "forearm"},
    # 어깨
    "front_raise":           {"torque_factor": 0.20, "moment_arm_key": "forearm"},
    "ohp_dumbbell":          {"torque_factor": 0.75, "moment_arm_key": "forearm"},
    "lateral_raise":         {"torque_factor": 0.15, "moment_arm_key": "forearm"},
    "cable_lateral":         {"torque_factor": 0.15, "moment_arm_key": "forearm"},
    "rear_delt_raise":       {"torque_factor": 0.15, "moment_arm_key": "forearm"},
    "bent_over_lateral":     {"torque_factor": 0.15, "moment_arm_key": "forearm"},
    "shoulder_press_db":     {"torque_factor": 0.75, "moment_arm_key": "forearm"},
    "military_press":        {"torque_factor": 1.00, "moment_arm_key": "forearm"},
    "arnold_press":          {"torque_factor": 0.70, "moment_arm_key": "forearm"},
    "machine_shoulder_press":{"torque_factor": 0.80, "moment_arm_key": "forearm"},
    "shrug":                 {"torque_factor": 1.20, "moment_arm_key": "forearm"},
    "upright_row":           {"torque_factor": 0.60, "moment_arm_key": "forearm"},
    # 팔
    "barbell_curl":          {"torque_factor": 0.35, "moment_arm_key": "forearm"},
    "dumbbell_curl":         {"torque_factor": 0.30, "moment_arm_key": "forearm"},
    "hammer_curl":           {"torque_factor": 0.30, "moment_arm_key": "forearm"},
    "incline_curl":          {"torque_factor": 0.25, "moment_arm_key": "forearm"},
    "cable_curl":            {"torque_factor": 0.25, "moment_arm_key": "forearm"},
    "preacher_curl":         {"torque_factor": 0.30, "moment_arm_key": "forearm"},
    "skull_crusher":         {"torque_factor": 0.40, "moment_arm_key": "forearm"},
    "overhead_triceps":      {"torque_factor": 0.25, "moment_arm_key": "forearm"},
    "triceps_pushdown":      {"torque_factor": 0.25, "moment_arm_key": "forearm"},
    "kickback":              {"torque_factor": 0.15, "moment_arm_key": "forearm"},
    "dips_triceps":          {"torque_factor": 0.80, "moment_arm_key": "forearm"},
    "close_grip_bench":      {"torque_factor": 0.85, "moment_arm_key": "forearm"},
    "wrist_curl":            {"torque_factor": 0.20, "moment_arm_key": "forearm"},
    "reverse_curl":          {"torque_factor": 0.25, "moment_arm_key": "forearm"},
    "farmers_carry":         {"torque_factor": 0.90, "moment_arm_key": "forearm"},
    # 하체
    "barbell_squat":         {"torque_factor": 1.00, "moment_arm_key": "shin"},
    "goblet_squat":          {"torque_factor": 0.45, "moment_arm_key": "shin"},
    "leg_press":             {"torque_factor": 1.30, "moment_arm_key": "shin"},
    "leg_extension":         {"torque_factor": 0.40, "moment_arm_key": "shin"},
    "hack_squat":            {"torque_factor": 0.90, "moment_arm_key": "shin"},
    "bss":                   {"torque_factor": 0.55, "moment_arm_key": "shin"},
    "lying_leg_curl":        {"torque_factor": 0.40, "moment_arm_key": "shin"},
    "seated_leg_curl":       {"torque_factor": 0.35, "moment_arm_key": "shin"},
    "hip_thrust":            {"torque_factor": 1.10, "moment_arm_key": "thigh"},
    "cable_hip_extension":   {"torque_factor": 0.20, "moment_arm_key": "thigh"},
    "seated_calf_raise":     {"torque_factor": 0.50, "moment_arm_key": "shin"},
    "leg_press_calf":        {"torque_factor": 0.80, "moment_arm_key": "shin"},
    "lunge":                 {"torque_factor": 0.55, "moment_arm_key": "shin"},
    "step_up":               {"torque_factor": 0.45, "moment_arm_key": "shin"},
    "wide_leg_press":        {"torque_factor": 1.30, "moment_arm_key": "shin"},
}

# 신체 분절 기본값 (cm → m, 측정값 없을 때 사용)
_MOMENT_ARM_DEFAULTS: dict[str, float] = {"forearm": 0.28, "shin": 0.38, "thigh": 0.42}
# 정규화 기준: deadlift(beginner, strength, 기본 thigh) ≈ dynamic_base_risk 1.0
_RISK_REF = 7.0


# ── Pydantic Models ────────────────────────────────────────────
class UserProfile(BaseModel):
    weight: float                            # kg
    strength_exp: str                        # beginner | intermediate | advanced
    gym_exp: str                             # beginner | intermediate | advanced
    goal: str                                # diet | strength | hypertrophy
    pain_areas: list[str] = []              # '있음' 부위 → Injury_score 감점
    pain_areas_slight: list[str] = []       # '약간있음' 부위 → 현재 스코어링 미반영
    equipment: list[str] = []               # 사용 가능 기구 ID
    # 골격 측정 (선택)
    upper_arm: Optional[float] = None       # cm
    forearm: Optional[float] = None         # cm
    thigh: Optional[float] = None           # cm
    shin: Optional[float] = None            # cm
    # 1RM (선택)
    rm_squat: Optional[float] = None
    rm_bench: Optional[float] = None
    rm_deadlift: Optional[float] = None
    rm_row: Optional[float] = None
    rm_ohp: Optional[float] = None


class ScoringRequest(BaseModel):
    user: UserProfile
    muscle_group: Optional[str] = None     # chest|back|shoulders|arms|legs|None(전체)


class SubScores(BaseModel):
    strength: float
    injury: float
    skeleton: float
    goal: float


class ExerciseScore(BaseModel):
    exercise_id: str
    name: str
    score: float
    rank: int
    muscle_group: str
    sub_scores: SubScores
    rm_used: bool  # 해당 운동의 primary_lift 1RM이 실제로 입력된 경우 True


# ── Sub-score 계산 함수 ────────────────────────────────────────

def _strength_score(ex: dict, user: UserProfile) -> float:
    """상대 근력 적합도 (0–100). scoring.md 2.1"""
    lift = ex.get("primary_lift")
    if lift is None:
        return 60.0  # 전완 등 1RM 무관 운동 → 중간값

    rm_map: dict[str, Optional[float]] = {
        "squat": user.rm_squat, "bench": user.rm_bench,
        "deadlift": user.rm_deadlift, "row": user.rm_row, "ohp": user.rm_ohp,
    }
    rm_val = rm_map.get(lift)
    benchmarks = RM_BENCHMARKS.get(user.strength_exp, RM_BENCHMARKS["beginner"])
    benchmark_bw = benchmarks.get(lift, 1.0)

    if rm_val is None or rm_val <= 0 or user.weight <= 0:
        # 1RM 미입력 → 추정치 사용 안 함, 보수적 낮은 값 반환
        return 50.0

    relative = rm_val / user.weight
    return min(100.0, (relative / benchmark_bw) * 100.0)



def _injury_score(ex_id: str, ex: dict, pain_areas: list[str], user: UserProfile) -> float:
    """부상 안전도 점수 (0–100, 높을수록 안전).
    Formula ①: dynamic_base_risk = f(torque_factor, moment_arm, 목표, 숙련도)
    raw_penalty = Σ(pain_overlap × dynamic_base_risk)
    """
    dyn_risk = _calc_dynamic_base_risk(ex_id, user)
    raw = 0.0
    for part in pain_areas:
        if part in ex["pain_areas"]:
            raw += dyn_risk
    return max(0.0, 100.0 - raw * 100.0)


def _skeleton_score(ex: dict, user: UserProfile) -> float:
    """골격 비례 적합도 (0–100). scoring.md 2.4"""
    key = ex.get("skeleton_key")
    adv = ex.get("skeleton_adv")

    if key is None or adv is None or adv == "neutral":
        return 80.0  # skeleton 무관 or 중립 운동

    if key == "forearm_ratio":
        if user.forearm is None or user.upper_arm is None or user.upper_arm == 0:
            return 60.0  # 측정값 없음 → 중간 이하 (불리하게 책정)
        ratio = user.forearm / user.upper_arm
    elif key == "femur_ratio":
        if user.thigh is None or user.shin is None or user.shin == 0:
            return 60.0
        ratio = user.thigh / user.shin
    else:
        return 80.0

    # 비율 → 점수 매핑 (scoring.md 2.4 테이블 기준)
    if adv == "short":
        return 100.0 if ratio < 0.9 else (80.0 if ratio <= 1.1 else 60.0)
    else:  # "long"
        return 100.0 if ratio > 1.1 else (80.0 if ratio >= 0.9 else 60.0)


def _goal_score(ex: dict, goal: str) -> float:
    """운동 목적 정합도 (0–100). scoring.md 2.5"""
    return ex["goal_match"].get(goal, 0.5) * 100.0


def _calc_dynamic_base_risk(ex_id: str, user: UserProfile) -> float:
    """Formula ①: 생체역학 부하 기반 동적 base_risk (0–1).
    risk_per_rep = (torque_factor × g × moment_arm) / ((1 + N/30) × R)
    N: 목표별 대표 반복수 (strength=5, hypertrophy=10, diet=15)
    R: 숙련도 계수 (beginner=0.5, intermediate=0.7, advanced=0.9)
    """
    bp = BIOMECH_PARAMS.get(ex_id, {})
    torque_factor = bp.get("torque_factor", 0.5)
    mak = bp.get("moment_arm_key", "forearm")

    user_arm_m: dict[str, Optional[float]] = {
        "forearm": (user.forearm / 100) if user.forearm else None,
        "shin":    (user.shin    / 100) if user.shin    else None,
        "thigh":   (user.thigh   / 100) if user.thigh   else None,
    }
    moment_arm_m = user_arm_m.get(mak) or _MOMENT_ARM_DEFAULTS[mak]

    N = {"strength": 5, "hypertrophy": 10, "diet": 15}.get(user.goal, 10)
    R = {"beginner": 0.5, "intermediate": 0.7, "advanced": 0.9}.get(user.gym_exp, 0.5)

    risk_raw = (torque_factor * 9.8 * moment_arm_m) / ((1 + N / 30) * R)
    return min(1.0, max(0.0, risk_raw / _RISK_REF))


def _calc_rm_used(ex: dict, user: UserProfile) -> bool:
    """해당 운동의 primary_lift에 대한 1RM이 실제로 입력되었는지 반환"""
    lift = ex.get("primary_lift")
    if lift is None:
        return False
    rm_map: dict[str, Optional[float]] = {
        "squat": user.rm_squat, "bench": user.rm_bench,
        "deadlift": user.rm_deadlift, "row": user.rm_row, "ohp": user.rm_ohp,
    }
    return (rm_map.get(lift) or 0) > 0


def _calculate_bfs(ex_id: str, user: UserProfile) -> tuple[float, SubScores, bool]:
    """BFS 최종 점수 계산 (0–100) + 서브스코어 + rm_used 반환"""
    ex = EXERCISE_PARAMS[ex_id]
    w = TYPE_WEIGHTS[ex["type"]]

    s_str  = _strength_score(ex, user)
    s_inj  = _injury_score(ex_id, ex, user.pain_areas, user)
    s_ske  = _skeleton_score(ex, user)
    s_goal = _goal_score(ex, user.goal)

    score = (
        w["strength"] * s_str  +
        w["injury"]   * s_inj  +
        w["skeleton"] * s_ske  +
        w["goal"]     * s_goal
    )

    sub = SubScores(
        strength=round(s_str, 1),
        injury=round(s_inj, 1),
        skeleton=round(s_ske, 1),
        goal=round(s_goal, 1),
    )
    return round(max(0.0, min(100.0, score)), 2), sub, _calc_rm_used(ex, user)


# ── Route ─────────────────────────────────────────────────────
@router.post("/rank")
async def get_exercise_ranking(
    req: ScoringRequest,
    x_user_id: str = Header(...),
) -> list[ExerciseScore]:
    """
    BFS(Biomechanical Fit Score) 기반 운동 랭킹을 반환합니다.

    필터링 순서:
    1. 사용자 보유 기구로 수행 가능한 운동만 포함
    2. muscle_group 파라미터가 있으면 해당 부위만 포함
    3. BFS 점수 내림차순 정렬
    """
    user = req.user
    user_equip = set(user.equipment)

    results: list[ExerciseScore] = []
    for ex_id, ex in EXERCISE_PARAMS.items():
        # 기구 필터: 운동에 필요한 기구를 모두 보유해야 함
        if not set(ex["equipment"]).issubset(user_equip):
            continue

        # 근육 그룹 필터
        if req.muscle_group and ex["muscle_group"] != req.muscle_group:
            continue

        score, sub, rm_used = _calculate_bfs(ex_id, user)
        results.append(ExerciseScore(
            exercise_id=ex_id,
            name=ex["name"],
            score=score,
            rank=0,  # 정렬 후 할당
            muscle_group=ex["muscle_group"],
            sub_scores=sub,
            rm_used=rm_used,
        ))

    # BFS 점수 내림차순 정렬 후 rank 할당
    results.sort(key=lambda r: r.score, reverse=True)
    for i, r in enumerate(results, 1):
        r.rank = i

    return results
