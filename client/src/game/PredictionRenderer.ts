import { Graphics } from 'pixi.js';
import type { Vector2, ShipState } from '@shared/types';
import { GAME_CONSTANTS } from '@shared/types';
import { THRUST_SCALE } from './CommandInput';

// ============================================================
// PredictionRenderer: 관성선 / 조작선 / 부채꼴 / 크로스헤어
// ============================================================

export class PredictionRenderer {
  public readonly graphics: Graphics;

  private shipState: ShipState;
  private shipColor: number;

  // 2.5초(25틱) 시점의 예상 함선 좌표 및 각도 캐싱 (조작 클램핑용)
  public predicted25Pos: Vector2 = { x: 400, y: 360 };
  public predicted25Heading: number = 0;

  constructor(shipState: ShipState, shipColor: number) {
    this.shipState = shipState;
    this.shipColor = shipColor;
    this.graphics = new Graphics();
  }

  /** 매 프레임 호출: 예측 시각화를 다시 그림 */
  update(shipState: ShipState, thrust: Vector2, targetHeading: number, weaponTarget: Vector2 | null, weaponType: 'BEAM' | 'TORPEDO' = 'BEAM'): void {
    this.graphics.clear();
    this.shipState = shipState;

    // 시각적 드로잉을 위한 클램핑된 기준 위치 계산
    const margin = 20;
    const MAP_WIDTH = 1280;
    const MAP_HEIGHT = 720;
    const position = {
      x: Math.max(margin, Math.min(MAP_WIDTH - margin, this.shipState.position.x)),
      y: Math.max(margin, Math.min(MAP_HEIGHT - margin, this.shipState.position.y)),
    };

    const { velocity, heading } = this.shipState;
    const steps = GAME_CONSTANTS.TOTAL_TICKS;
    const dt = 1 / GAME_CONSTANTS.TICK_RATE;

    // 1) 관성 예측선 (Ghost Line) — 추진 없이 현재 속도만으로 미끄러지는 궤적
    this.drawTrajectory(position, velocity, { x: 0, y: 0 }, steps, dt, 0x888888, 0.3, true, heading, heading);

    // 2) 조작 예측선 (Command Line) — 추진력 반영 궤적 및 25틱 시점 예측 위치/각도 캡처
    const prediction25 = this.drawTrajectory(position, velocity, thrust, steps, dt, this.shipColor, 0.8, false, heading, targetHeading);
    this.predicted25Pos = prediction25.position;
    this.predicted25Heading = prediction25.heading;

    // 3) 빔 사격각 가이드 부채꼴 (BEAM 선택 시에만 2.5초 예상 지점에 투명 붉은색으로 렌더링)
    if (weaponType === 'BEAM') {
      this.drawBeamArc(this.predicted25Pos, this.predicted25Heading);
    }

    // 4) 선회각 부채꼴 — heading ± MAX_TURN_ANGLE 범위 (현재 입력 지점)
    this.drawTurnArc(position, heading);

    // 5) 추진력 화살표 — 드래그 방향 표시
    if (Math.abs(thrust.x) > 0.01 || Math.abs(thrust.y) > 0.01) {
      this.drawThrustArrow(position, thrust);
    }

    // 6) 무기 타겟 크로스헤어
    if (weaponTarget) {
      this.drawCrosshair(weaponTarget, this.predicted25Pos, weaponType);
    }
  }

  // --- 궤적 렌더링 ---

  private drawTrajectory(
    startPos: Vector2, startVel: Vector2, thrust: Vector2,
    steps: number, dt: number,
    color: number, alpha: number, dotted: boolean,
    startHeading: number, targetHeading: number
  ): { position: Vector2; heading: number } {
    // 추진력은 턴 시작 시 한 번 적용되어 새 속도를 만듦
    const vx = startVel.x + thrust.x;
    const vy = startVel.y + thrust.y;

    let px = startPos.x;
    let py = startPos.y;

    let p25: Vector2 = { x: px, y: py };
    let h25 = startHeading;

    if (dotted) {
      // 점선: 3틱마다 작은 원
      for (let i = 1; i <= steps; i++) {
        px += vx * dt;
        py += vy * dt;
        if (i % 3 === 0) {
          this.graphics.circle(px, py, 2);
          this.graphics.fill({ color, alpha });
        }
        if (i === 25) {
          p25 = { x: px, y: py };
          h25 = startHeading + (targetHeading - startHeading) * 0.5;
        }
      }
    } else {
      // 실선
      this.graphics.moveTo(px, py);
      for (let i = 1; i <= steps; i++) {
        px += vx * dt;
        py += vy * dt;
        this.graphics.lineTo(px, py);

        if (i === 25) {
          p25 = { x: px, y: py };
          h25 = startHeading + (targetHeading - startHeading) * 0.5;
        }
      }
      this.graphics.stroke({ width: 2, color, alpha });

      // 끝점 마커 (마름모)
      this.drawDiamond(px, py, 6, color, alpha);
    }

    return { position: p25, heading: h25 };
  }

  private drawDiamond(x: number, y: number, size: number, color: number, alpha: number): void {
    this.graphics.moveTo(x, y - size);
    this.graphics.lineTo(x + size, y);
    this.graphics.lineTo(x, y + size);
    this.graphics.lineTo(x - size, y);
    this.graphics.closePath();
    this.graphics.stroke({ width: 1.5, color, alpha });
  }

  // --- 선회각 부채꼴 ---

  private drawTurnArc(position: Vector2, heading: number): void {
    const maxAngle = GAME_CONSTANTS.MAX_TURN_ANGLE;
    const radius = 50;

    // 호 (arc)
    this.graphics.arc(position.x, position.y, radius, heading - maxAngle, heading + maxAngle);
    this.graphics.stroke({ width: 1, color: 0x44ff88, alpha: 0.25 });

    // 경계선 2개
    const angles = [heading - maxAngle, heading + maxAngle];
    for (const angle of angles) {
      this.graphics.moveTo(position.x, position.y);
      this.graphics.lineTo(
        position.x + Math.cos(angle) * radius,
        position.y + Math.sin(angle) * radius,
      );
      this.graphics.stroke({ width: 1, color: 0x44ff88, alpha: 0.2 });
    }
  }

  // --- 추진력 화살표 ---

  private drawThrustArrow(position: Vector2, thrust: Vector2): void {
    // 추진력 벡터를 픽셀 스케일로 복원하여 화살표 길이 결정
    const visualScale = 1 / THRUST_SCALE;
    const endX = position.x + thrust.x * visualScale;
    const endY = position.y + thrust.y * visualScale;

    // 화살표 줄기
    this.graphics.moveTo(position.x, position.y);
    this.graphics.lineTo(endX, endY);
    this.graphics.stroke({ width: 2.5, color: 0xffcc00, alpha: 0.8 });

    // 화살표 머리
    const angle = Math.atan2(thrust.y, thrust.x);
    const headLen = 12;
    for (const offset of [-0.4, 0.4]) {
      this.graphics.moveTo(endX, endY);
      this.graphics.lineTo(
        endX - Math.cos(angle + offset) * headLen,
        endY - Math.sin(angle + offset) * headLen,
      );
      this.graphics.stroke({ width: 2.5, color: 0xffcc00, alpha: 0.8 });
    }
  }

  // --- 무기 타겟 크로스헤어 ---

  private drawCrosshair(target: Vector2, shipPos: Vector2, weaponType: 'BEAM' | 'TORPEDO'): void {
    const size = 14;
    const isBeam = weaponType === 'BEAM';
    const color = isBeam ? 0xff4444 : 0xffaa00;

    // 연결 점선 (함선 → 타겟)
    const dx = target.x - shipPos.x;
    const dy = target.y - shipPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const dotCount = Math.floor(dist / 10);
    for (let i = 0; i < dotCount; i += 2) {
      const t = i / dotCount;
      this.graphics.circle(shipPos.x + dx * t, shipPos.y + dy * t, 1);
      this.graphics.fill({ color, alpha: 0.35 });
    }

    // 십자선
    this.graphics.moveTo(target.x - size, target.y);
    this.graphics.lineTo(target.x + size, target.y);
    this.graphics.stroke({ width: 1.5, color, alpha: 0.8 });

    this.graphics.moveTo(target.x, target.y - size);
    this.graphics.lineTo(target.x, target.y + size);
    this.graphics.stroke({ width: 1.5, color, alpha: 0.8 });

    // 외곽 원
    this.graphics.circle(target.x, target.y, size);
    this.graphics.stroke({ width: 1.5, color, alpha: 0.5 });

    // 어뢰인 경우 60px 폭발 범위 점선 서클 추가 렌더링
    if (!isBeam) {
      // 24개 세그먼트로 구성된 점선 원
      const numSegments = 24;
      const radius = 60;
      for (let i = 0; i < numSegments; i += 2) {
        const angleStart = (i / numSegments) * Math.PI * 2;
        const angleEnd = ((i + 1) / numSegments) * Math.PI * 2;
        this.graphics.arc(target.x, target.y, radius, angleStart, angleEnd);
        this.graphics.stroke({ width: 1, color, alpha: 0.4 });
      }
    }
  }

  // --- 빔 발사 사정거리 및 사각 제한 부채꼴 그리기 ---
  private drawBeamArc(position: Vector2, heading: number): void {
    const maxAngle = GAME_CONSTANTS.BEAM_MAX_ANGLE;
    const radius = GAME_CONSTANTS.BEAM_MAX_RANGE; // 사거리 600px

    this.graphics.moveTo(position.x, position.y);
    this.graphics.arc(position.x, position.y, radius, heading - maxAngle, heading + maxAngle);
    this.graphics.closePath();
    this.graphics.fill({ color: 0xff4444, alpha: 0.04 }); // 옅은 붉은색 투명 영역 채우기
    this.graphics.stroke({ width: 1, color: 0xff4444, alpha: 0.15 }); // 붉은색 외곽선 호
  }
}
