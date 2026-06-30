import { Application, FederatedPointerEvent } from 'pixi.js';
import type { Vector2, TurnCommand, WeaponCommand } from '@shared/types';
import { GAME_CONSTANTS } from '@shared/types';
import { Ship } from './Ship';

// ============================================================
// CommandInput: 마우스 입력으로 추진력/무기 타겟 조작
// ============================================================

/** 드래그 거리(px)를 추진력 크기로 변환하는 스케일 */
export const THRUST_SCALE = 0.05;
const MAX_THRUST = 8;

export class CommandInput {
  private app: Application;
  private playerShip: Ship;

  // --- 명령 상태 ---
  private _thrust: Vector2 = { x: 0, y: 0 };
  private _weaponTarget: Vector2 | null = null;
  private _targetHeading: number = 0;
  private _weaponType: 'BEAM' | 'TORPEDO' = 'BEAM';

  // --- 2.5초 시점 예상 함선 상태 (클램핑 기준점) ---
  private predicted25State = { position: { x: 400, y: 360 }, heading: 0 };

  // --- 터치 트랙킹 상태 ---
  private pointerDownPos: Vector2 | null = null;
  private pointerDownTime: number = 0;

  // --- 드래그 상태 ---
  private isDragging = false;

  /** 명령 값이 변경될 때 호출되는 콜백 */
  public onCommandChange?: () => void;
  /** 명령 제출 시 호출되는 콜백 */
  public onSubmit?: (command: TurnCommand) => void;

  constructor(app: Application, playerShip: Ship) {
    this.app = app;
    this.playerShip = playerShip;
    this._targetHeading = playerShip.state.heading;
    this.setupEvents();
  }

  // --- Getters ---
  get thrust(): Vector2 { return this._thrust; }
  get weaponTarget(): Vector2 | null { return this._weaponTarget; }
  get targetHeading(): number { return this._targetHeading; }
  get weaponType(): 'BEAM' | 'TORPEDO' { return this._weaponType; }

  setWeaponType(type: 'BEAM' | 'TORPEDO'): void {
    this._weaponType = type;
    if (type === 'BEAM' && this._weaponTarget) {
      this._weaponTarget = this.clampBeamTarget(this._weaponTarget);
    }
    this.onCommandChange?.();
  }

  /** 예측된 2.5초 시점의 상태 주입 및 타겟 리클램핑 */
  updatePredicted25State(pos: Vector2, heading: number): void {
    this.predicted25State = { position: { ...pos }, heading };
    if (this._weaponTarget && this._weaponType === 'BEAM') {
      this._weaponTarget = this.clampBeamTarget(this._weaponTarget);
    }
  }

  /** 직사 빔의 타겟 좌표를 사거리 및 사각 한계선으로 클램핑 */
  private clampBeamTarget(target: Vector2): Vector2 {
    const origin = this.predicted25State.position;
    const heading = this.predicted25State.heading;

    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    if (d === 0) return { ...origin };

    const targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - heading;

    // [-PI, PI] 범위 정규화
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;

    const maxAngle = GAME_CONSTANTS.BEAM_MAX_ANGLE;
    const maxRange = GAME_CONSTANTS.BEAM_MAX_RANGE;

    let finalAngle = targetAngle;
    if (Math.abs(diff) > maxAngle) {
      finalAngle = heading + Math.sign(diff) * maxAngle;
    }

    const finalRange = Math.min(d, maxRange);
    return {
      x: origin.x + Math.cos(finalAngle) * finalRange,
      y: origin.y + Math.sin(finalAngle) * finalRange,
    };
  }

  // --- 이벤트 설정 ---

  private setupEvents(): void {
    const stage = this.app.stage;
    stage.eventMode = 'static';
    stage.hitArea = this.app.screen;

    stage.on('pointerdown', this.onPointerDown.bind(this));
    stage.on('pointermove', this.onPointerMove.bind(this));
    stage.on('pointerup', this.onPointerUp.bind(this));
    stage.on('pointerupoutside', this.onPointerUp.bind(this));

    // 우클릭: 무기 타겟 설정 (브라우저 컨텍스트 메뉴 차단)
    this.app.canvas.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      const rect = this.app.canvas.getBoundingClientRect();
      const rawTarget = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      if (this._weaponType === 'BEAM') {
        this._weaponTarget = this.clampBeamTarget(rawTarget);
      } else {
        this._weaponTarget = rawTarget;
      }
      this.onCommandChange?.();
    });

    // Space 키: 명령 제출, 1/2 키: 무기 전환
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.submit();
      } else if (e.code === 'Digit1') {
        this.setWeaponType('BEAM');
      } else if (e.code === 'Digit2') {
        this.setWeaponType('TORPEDO');
      }
    });
  }

  private onPointerDown(e: FederatedPointerEvent): void {
    if (e.button !== 0) return; // 좌클릭/터치만
    const { x, y } = e.global;

    this.pointerDownPos = { x, y };
    this.pointerDownTime = Date.now();

    if (this.playerShip.isPointInside(x, y)) {
      this.isDragging = true;
    }
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (!this.isDragging) return;

    const { x, y } = e.global;
    const shipPos = this.playerShip.visualPosition;

    // 추진력 벡터 계산 (드래그 거리 × 스케일)
    let tx = (x - shipPos.x) * THRUST_SCALE;
    let ty = (y - shipPos.y) * THRUST_SCALE;

    // 최대 추진력 제한
    const mag = Math.sqrt(tx * tx + ty * ty);
    if (mag > MAX_THRUST) {
      tx = (tx / mag) * MAX_THRUST;
      ty = (ty / mag) * MAX_THRUST;
    }

    this._thrust = { x: tx, y: ty };

    // 추진 방향으로 목표 heading 계산 (선회각 클램핑 적용)
    if (mag > 0.1) {
      const desiredHeading = Math.atan2(ty, tx);
      this._targetHeading = this.clampHeading(desiredHeading);
    }

    this.onCommandChange?.();
  }

  private onPointerUp(e: FederatedPointerEvent): void {
    const { x, y } = e.global;

    // 탭 판정: 유지 시간 250ms 이하 & 이동 거리 8px 미만
    if (this.pointerDownPos) {
      const dx = x - this.pointerDownPos.x;
      const dy = y - this.pointerDownPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const duration = Date.now() - this.pointerDownTime;

      const isTap = duration < 250 && dist < 8;

      // 함선 밖을 탭했을 경우 무기 조준점으로 설정
      if (isTap && !this.playerShip.isPointInside(x, y)) {
        const rawTarget = { x, y };
        if (this._weaponType === 'BEAM') {
          this._weaponTarget = this.clampBeamTarget(rawTarget);
        } else {
          this._weaponTarget = rawTarget;
        }
        this.onCommandChange?.();
      }
    }

    this.isDragging = false;
    this.pointerDownPos = null;
  }

  // --- 선회각 제한 ---

  /** 목표 heading을 현재 heading ± MAX_TURN_ANGLE 범위로 클램핑 */
  private clampHeading(desired: number): number {
    const current = this.playerShip.state.heading;
    let delta = desired - current;

    // [-PI, PI] 범위로 정규화
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    const max = GAME_CONSTANTS.MAX_TURN_ANGLE;
    delta = Math.max(-max, Math.min(max, delta));

    return current + delta;
  }

  // --- 명령 생성/제출 ---

  /** 현재 설정된 명령을 TurnCommand 형태로 반환 */
  getCommand(): TurnCommand {
    const weapons: WeaponCommand[] = [];
    if (this._weaponTarget) {
      weapons.push({ type: this._weaponType, target: { ...this._weaponTarget } });
    }
    return {
      playerId: this.playerShip.id,
      thrust: { ...this._thrust },
      targetHeading: this._targetHeading,
      weapons,
    };
  }

  /** 명령 제출 */
  submit(): void {
    const command = this.getCommand();
    console.log('[CommandInput] 명령 제출:', JSON.stringify(command, null, 2));
    this.onSubmit?.(command);
  }

  /** 명령 초기화 (다음 턴 준비) */
  reset(): void {
    this._thrust = { x: 0, y: 0 };
    this._weaponTarget = null;
    this._targetHeading = this.playerShip.state.heading;
    this._weaponType = 'BEAM';
    this.onCommandChange?.();
  }
}
