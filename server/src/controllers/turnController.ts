import { Request, Response } from 'express';

// Phase 1: 더미 결과를 반환하는 컨트롤러
export const submitTurn = (req: Request, res: Response) => {
  const { playerId, action } = req.body;

  // 나중에는 방(Room)에 두 플레이어의 데이터를 모아서 처리해야 하지만,
  // 현재는 단일 요청에 대해 고정된 5초 시뮬레이션 타임라인 결과를 반환합니다.
  
  const dummySimulationData = [
    { time: 0.0, event: "START", info: "턴 시작" },
    { time: 1.2, event: "MOVE", x: 12, y: 15, heading: 45 },
    { time: 3.0, event: "FIRE", type: "BEAM", origin: { x: 12, y: 15 }, target: { x: 20, y: 20 } },
    { time: 3.1, event: "HIT", damage: 20, targetId: "playerB" },
    { time: 5.0, event: "END", info: "턴 종료" }
  ];

  console.log(`[TurnController] Received turn from ${playerId || 'Unknown Player'}. Returning dummy timeline.`);

  res.status(200).json({
    status: 'success',
    message: 'Turn simulated successfully',
    simulation: dummySimulationData
  });
};
