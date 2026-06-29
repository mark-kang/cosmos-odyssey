import { Request, Response } from 'express';
import { SimulationEvent, TurnResult, ShipState, TurnCommand, Vector2, WeaponCommand, GAME_CONSTANTS } from '../../../shared/types';

// ============================================================
// 인메모리 게임 방 상태 (Room State)
// ============================================================

interface GameRoom {
  turnNumber: number;
  // 각 턴의 함선 상태 기록 (0턴은 초기 상태)
  shipsByTurn: Record<number, Record<string, ShipState>>;
  // 각 턴의 제출된 명령들
  commandsByTurn: Record<number, Record<string, TurnCommand>>;
  // 각 턴의 시뮬레이션 결과 타임라인
  simulationsByTurn: Record<number, SimulationEvent[]>;
}

const INITIAL_SHIPS: Record<string, ShipState> = {
  playerA: {
    position: { x: 400, y: 360 },
    velocity: { x: 0, y: 0 },
    heading: 0,
    hp: GAME_CONSTANTS.DEFAULT_HP,
  },
  playerB: {
    position: { x: 880, y: 360 },
    velocity: { x: 0, y: 0 },
    heading: Math.PI,
    hp: GAME_CONSTANTS.DEFAULT_HP,
  },
};

let room: GameRoom = createInitialRoom();

function createInitialRoom(): GameRoom {
  return {
    turnNumber: 1,
    shipsByTurn: {
      0: JSON.parse(JSON.stringify(INITIAL_SHIPS)), // Deep copy
    },
    commandsByTurn: {},
    simulationsByTurn: {},
  };
}

// --- 벡터 수학 헬퍼 함수 ---
function dist(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// 선분 AB와 점 P 사이의 최단 거리 계산
function distToSegment(p: Vector2, a: Vector2, b: Vector2): number {
  const l2 = dist(a, b) ** 2;
  if (l2 === 0) return dist(p, a);
  // projection factor t = [(P-A) . (B-A)] / |B-A|^2
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projection: Vector2 = {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };
  return dist(p, projection);
}

// ============================================================
// 핵심 물리 시뮬레이터 (5.0초, 50틱)
// ============================================================

function runSimulation(
  startStates: Record<string, ShipState>,
  commandA: TurnCommand,
  commandB: TurnCommand
): { timeline: SimulationEvent[]; finalStates: Record<string, ShipState> } {
  const timeline: SimulationEvent[] = [];
  const dt = 1 / GAME_CONSTANTS.TICK_RATE; // 0.1s
  const totalTicks = GAME_CONSTANTS.TOTAL_TICKS; // 50 ticks

  // 함선 상태 복사
  const stateA: ShipState = JSON.parse(JSON.stringify(startStates.playerA));
  const stateB: ShipState = JSON.parse(JSON.stringify(startStates.playerB));

  let oobTicksA = 0;
  let oobTicksB = 0;

  // 1) 추진력 반영 (속도 갱신 - 턴 시작 시 1회 적용)
  stateA.velocity.x += commandA.thrust.x;
  stateA.velocity.y += commandA.thrust.y;
  stateB.velocity.x += commandB.thrust.x;
  stateB.velocity.y += commandB.thrust.y;

  const startHeadingA = stateA.heading;
  const startHeadingB = stateB.heading;

  timeline.push({ time: 0.0, event: 'START', info: '시뮬레이션 시작' });

  // 무기 발사 계획 파싱
  const beamA = commandA.weapons.find((w) => w.type === 'BEAM');
  const beamB = commandB.weapons.find((w) => w.type === 'BEAM');
  const torpedoA = commandA.weapons.find((w) => w.type === 'TORPEDO');
  const torpedoB = commandB.weapons.find((w) => w.type === 'TORPEDO');

  // 어뢰 비행 시간 및 폭발 틱 계산
  // 속도 150px/s, dt=0.1
  const calcTorpedoExplosion = (origin: Vector2, target: Vector2) => {
    const d = dist(origin, target);
    const flightTime = d / 150;
    const expTime = Math.min(5.0, flightTime);
    const expTick = Math.round(expTime * 10);
    const expPos: Vector2 = flightTime <= 5.0 ? target : {
      x: origin.x + (target.x - origin.x) * (5.0 / flightTime),
      y: origin.y + (target.y - origin.y) * (5.0 / flightTime),
    };
    return { expTick, expPos };
  };

  const torpDetailsA = torpedoA ? calcTorpedoExplosion(stateA.position, torpedoA.target) : null;
  const torpDetailsB = torpedoB ? calcTorpedoExplosion(stateB.position, torpedoB.target) : null;

  // 어뢰 발사 이벤트는 0초에 즉시 기록
  if (torpedoA) {
    timeline.push({
      time: 0.0,
      event: 'FIRE',
      shipId: 'playerA',
      weaponType: 'TORPEDO',
      origin: { ...stateA.position },
      target: { ...torpedoA.target },
    });
  }
  if (torpedoB) {
    timeline.push({
      time: 0.0,
      event: 'FIRE',
      shipId: 'playerB',
      weaponType: 'TORPEDO',
      origin: { ...stateB.position },
      target: { ...torpedoB.target },
    });
  }

  // 50틱 시뮬레이션 루프
  for (let tick = 1; tick <= totalTicks; tick++) {
    const time = parseFloat((tick * dt).toFixed(1));

    // 이동
    stateA.position.x += stateA.velocity.x * dt;
    stateA.position.y += stateA.velocity.y * dt;
    stateB.position.x += stateB.velocity.x * dt;
    stateB.position.y += stateB.velocity.y * dt;

    // 이탈 체크 (Player A)
    const isOobA = stateA.position.x < 0 || stateA.position.x > GAME_CONSTANTS.MAP_WIDTH ||
                   stateA.position.y < 0 || stateA.position.y > GAME_CONSTANTS.MAP_HEIGHT;
    if (isOobA) {
      oobTicksA++;
      if (oobTicksA % 10 === 0) {
        stateA.hp = Math.max(0, stateA.hp - 10);
        timeline.push({ time, event: 'HIT', targetId: 'playerA', damage: 10 });
      }
    } else {
      if (oobTicksA > 0) {
        const remainingDmg = oobTicksA % 10;
        if (remainingDmg > 0) {
          stateA.hp = Math.max(0, stateA.hp - remainingDmg);
          timeline.push({ time, event: 'HIT', targetId: 'playerA', damage: remainingDmg });
        }
        oobTicksA = 0;
      }
    }

    // 이탈 체크 (Player B)
    const isOobB = stateB.position.x < 0 || stateB.position.x > GAME_CONSTANTS.MAP_WIDTH ||
                   stateB.position.y < 0 || stateB.position.y > GAME_CONSTANTS.MAP_HEIGHT;
    if (isOobB) {
      oobTicksB++;
      if (oobTicksB % 10 === 0) {
        stateB.hp = Math.max(0, stateB.hp - 10);
        timeline.push({ time, event: 'HIT', targetId: 'playerB', damage: 10 });
      }
    } else {
      if (oobTicksB > 0) {
        const remainingDmg = oobTicksB % 10;
        if (remainingDmg > 0) {
          stateB.hp = Math.max(0, stateB.hp - remainingDmg);
          timeline.push({ time, event: 'HIT', targetId: 'playerB', damage: remainingDmg });
        }
        oobTicksB = 0;
      }
    }

    // 선회 보간 (50틱 동안 부드럽게 목표 방향으로 각도 변경)
    stateA.heading = startHeadingA + (commandA.targetHeading - startHeadingA) * (tick / totalTicks);
    stateB.heading = startHeadingB + (commandB.targetHeading - startHeadingB) * (tick / totalTicks);

    // 이동 상태 이벤트 기록
    timeline.push({
      time,
      event: 'MOVE',
      shipId: 'playerA',
      x: stateA.position.x,
      y: stateA.position.y,
      heading: stateA.heading,
    });
    timeline.push({
      time,
      event: 'MOVE',
      shipId: 'playerB',
      x: stateB.position.x,
      y: stateB.position.y,
      heading: stateB.heading,
    });

    // 2) 빔 (BEAM) 사격 및 충돌 판정 (2.5초 / tick 25에 실행)
    if (tick === 25) {
      if (beamA) {
        timeline.push({
          time,
          event: 'FIRE',
          shipId: 'playerA',
          weaponType: 'BEAM',
          origin: { ...stateA.position },
          target: { ...beamA.target },
        });
        // 충돌 판정 (상대선 B와의 거리)
        const d = distToSegment(stateB.position, stateA.position, beamA.target);
        if (d <= 25) {
          stateB.hp = Math.max(0, stateB.hp - 25);
          timeline.push({ time, event: 'HIT', targetId: 'playerB', damage: 25 });
        }
      }
      if (beamB) {
        timeline.push({
          time,
          event: 'FIRE',
          shipId: 'playerB',
          weaponType: 'BEAM',
          origin: { ...stateB.position },
          target: { ...beamB.target },
        });
        // 충돌 판정 (상대선 A와의 거리)
        const d = distToSegment(stateA.position, stateB.position, beamB.target);
        if (d <= 25) {
          stateA.hp = Math.max(0, stateA.hp - 25);
          timeline.push({ time, event: 'HIT', targetId: 'playerA', damage: 25 });
        }
      }
    }

    // 3) 어뢰 (TORPEDO) 폭발 판정
    if (torpDetailsA && tick === torpDetailsA.expTick) {
      const d = dist(stateB.position, torpDetailsA.expPos);
      if (d <= 60) {
        const damage = Math.round(40 * (1 - d / 60));
        stateB.hp = Math.max(0, stateB.hp - damage);
        timeline.push({ time, event: 'HIT', targetId: 'playerB', damage });
      }
    }
    if (torpDetailsB && tick === torpDetailsB.expTick) {
      const d = dist(stateA.position, torpDetailsB.expPos);
      if (d <= 60) {
        const damage = Math.round(40 * (1 - d / 60));
        stateA.hp = Math.max(0, stateA.hp - damage);
        timeline.push({ time, event: 'HIT', targetId: 'playerA', damage });
      }
    }
  }

  // 50틱 루프가 끝난 뒤 최종 잔여 이탈 틱 정산
  if (oobTicksA > 0) {
    const remainingDmg = oobTicksA % 10;
    if (remainingDmg > 0) {
      stateA.hp = Math.max(0, stateA.hp - remainingDmg);
      timeline.push({ time: 5.0, event: 'HIT', targetId: 'playerA', damage: remainingDmg });
    }
  }
  if (oobTicksB > 0) {
    const remainingDmg = oobTicksB % 10;
    if (remainingDmg > 0) {
      stateB.hp = Math.max(0, stateB.hp - remainingDmg);
      timeline.push({ time: 5.0, event: 'HIT', targetId: 'playerB', damage: remainingDmg });
    }
  }

  timeline.push({ time: 5.0, event: 'END', info: '시뮬레이션 종료' });

  return {
    timeline,
    finalStates: { playerA: stateA, playerB: stateB },
  };
}

// ============================================================
// 라우트 핸들러 컨트롤러
// ============================================================

/** 턴 명령 제출 엔드포인트 */
export const submitTurn = (req: Request, res: Response) => {
  const { playerId, thrust, targetHeading, weapons, turnNumber } = req.body;

  if (!playerId || (playerId !== 'playerA' && playerId !== 'playerB')) {
    return res.status(400).json({ status: 'error', message: 'Invalid playerId' });
  }
  if (turnNumber !== room.turnNumber) {
    return res.status(400).json({
      status: 'error',
      message: `Turn mismatch. Client turn: ${turnNumber}, Server turn: ${room.turnNumber}`,
    });
  }

  // 명령 저장 리스트 초기화 (해당 턴에 처음 들어온 명령일 경우)
  if (!room.commandsByTurn[turnNumber]) {
    room.commandsByTurn[turnNumber] = {};
  }

  // 플레이어 명령 기록
  room.commandsByTurn[turnNumber][playerId] = { playerId, thrust, targetHeading, weapons };
  console.log(`[Server] Received turn command for player ${playerId} (Turn ${turnNumber})`);

  // 두 플레이어 명령이 모두 수집되었는지 확인
  const turnCommands = room.commandsByTurn[turnNumber];
  if (turnCommands.playerA && turnCommands.playerB) {
    // 시뮬레이션 실행!
    const startStates = room.shipsByTurn[turnNumber - 1];
    const { timeline, finalStates } = runSimulation(
      startStates,
      turnCommands.playerA,
      turnCommands.playerB
    );

    // 결과 기록
    room.simulationsByTurn[turnNumber] = timeline;
    room.shipsByTurn[turnNumber] = finalStates;

    // 서버 턴 진행
    room.turnNumber = turnNumber + 1;

    console.log(`[Server] Simulation complete for Turn ${turnNumber}. Advanced to Turn ${room.turnNumber}`);

    const result: TurnResult = {
      status: 'success',
      message: 'Simulation completed',
      simulation: timeline,
      nextStates: finalStates,
    };
    return res.status(200).json(result);
  }

  // 상대방 기다림 반환
  const result: TurnResult = {
    status: 'waiting',
    message: 'Waiting for opponent',
    simulation: [],
  };
  return res.status(200).json(result);
};

/** 턴 시뮬레이션 상태 및 결과 확인 엔드포인트 (폴링용) */
export const getTurnStatus = (req: Request, res: Response) => {
  const playerId = req.query.playerId as string;
  const turnNumber = parseInt(req.query.turnNumber as string);

  if (!playerId || (playerId !== 'playerA' && playerId !== 'playerB')) {
    return res.status(400).json({ status: 'error', message: 'Invalid playerId' });
  }
  if (isNaN(turnNumber)) {
    return res.status(400).json({ status: 'error', message: 'Invalid turnNumber' });
  }

  // 1. 이미 완료된 턴의 시뮬레이션 결과가 존재할 경우 즉시 반환
  if (room.simulationsByTurn[turnNumber]) {
    const result: TurnResult = {
      status: 'success',
      message: 'Simulation completed',
      simulation: room.simulationsByTurn[turnNumber],
      nextStates: room.shipsByTurn[turnNumber],
    };
    return res.status(200).json(result);
  }

  // 2. 명령이 아직 다 차지 않아서 대기 중인 경우
  const result: TurnResult = {
    status: 'waiting',
    message: 'Waiting for opponent',
    simulation: [],
  };
  return res.status(200).json(result);
};

/** 게임 리셋 엔드포인트 */
export const resetGame = (req: Request, res: Response) => {
  room = createInitialRoom();
  console.log('[Server] Game state reset to initial values.');
  res.status(200).json({ status: 'success', message: 'Game reset complete', initialStates: INITIAL_SHIPS });
};

/** 현재 게임 상태 조회 엔드포인트 */
export const getGameState = (req: Request, res: Response) => {
  const currentShips = room.shipsByTurn[room.turnNumber - 1];
  res.status(200).json({
    status: 'success',
    turnNumber: room.turnNumber,
    ships: currentShips
  });
};
