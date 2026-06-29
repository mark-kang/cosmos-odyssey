// ============================================================
// Project We-Go: Shared Types
// 서버와 클라이언트가 공통으로 사용하는 게임 데이터 타입 정의
// ============================================================

// --- 기본 수학 타입 ---

/** 2D 벡터 (좌표, 속도, 방향 등에 공용으로 사용) */
export interface Vector2 {
  x: number;
  y: number;
}

// --- 게임 상수 ---

export const GAME_CONSTANTS = {
  /** 시뮬레이션 총 시간 (초) */
  SIMULATION_DURATION: 5,
  /** 초당 틱 수 */
  TICK_RATE: 10,
  /** 총 틱 수 (SIMULATION_DURATION * TICK_RATE) */
  TOTAL_TICKS: 50,
  /** 최대 선회각 (라디안, 약 60도) */
  MAX_TURN_ANGLE: Math.PI / 3,
  /** 함선 기본 HP */
  DEFAULT_HP: 100,
  /** 맵 가로 크기 */
  MAP_WIDTH: 1280,
  /** 맵 세로 크기 */
  MAP_HEIGHT: 720,
  /** 화면 이탈 시 초당 대미지 패널티 */
  OUT_OF_BOUNDS_DAMAGE_PER_SECOND: 10,
  /** 직사 빔 최대 사정거리 */
  BEAM_MAX_RANGE: 600,
  /** 직사 빔 최대 발사 사각 (라디안, 좌우 30도) */
  BEAM_MAX_ANGLE: Math.PI / 6,
} as const;

// --- 함선 상태 ---

/** 함선의 현재 상태 (서버 시뮬레이션의 핵심 단위) */
export interface ShipState {
  /** 현재 좌표 */
  position: Vector2;
  /** 현재 속도 벡터 (관성) */
  velocity: Vector2;
  /** 현재 바라보는 각도 (라디안) */
  heading: number;
  /** 현재 체력 */
  hp: number;
}

// --- 턴 명령 (클라이언트 → 서버) ---

/** 무기 발사 명령 */
export interface WeaponCommand {
  /** 무기 종류 */
  type: 'BEAM' | 'TORPEDO';
  /** 목표 좌표 */
  target: Vector2;
}

/** 플레이어의 턴 명령 (1턴에 1회 제출) */
export interface TurnCommand {
  /** 플레이어 식별자 */
  playerId: string;
  /** 추진력 벡터 (이번 턴에 가할 가속도) */
  thrust: Vector2;
  /** 목표 선회 각도 (라디안) */
  targetHeading: number;
  /** 무기 발사 명령 목록 */
  weapons: WeaponCommand[];
}

// --- 시뮬레이션 이벤트 (서버 → 클라이언트) ---
// Discriminated Union: event 필드로 이벤트 종류를 구분

export interface SimEventStart {
  time: number;
  event: 'START';
  info: string;
}

export interface SimEventMove {
  time: number;
  event: 'MOVE';
  shipId: string;
  x: number;
  y: number;
  heading: number;
}

export interface SimEventFire {
  time: number;
  event: 'FIRE';
  shipId: string;
  weaponType: 'BEAM' | 'TORPEDO';
  origin: Vector2;
  target: Vector2;
}

export interface SimEventHit {
  time: number;
  event: 'HIT';
  targetId: string;
  damage: number;
}

export interface SimEventEnd {
  time: number;
  event: 'END';
  info: string;
}

/** 시뮬레이션 이벤트 (5종류의 유니온 타입) */
export type SimulationEvent =
  | SimEventStart
  | SimEventMove
  | SimEventFire
  | SimEventHit
  | SimEventEnd;

// --- 턴 결과 (서버 → 클라이언트) ---

/** 서버의 턴 시뮬레이션 응답 */
export interface TurnResult {
  status: 'success' | 'error' | 'waiting';
  message: string;
  simulation: SimulationEvent[];
  nextStates?: Record<string, ShipState>; // 턴 종료 후 함선들의 새 상태
}

