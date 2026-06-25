import { Graphics } from 'pixi.js';
import type { ShipState } from '@shared/types';

// ============================================================
// Ship: 함선 클래스 (Graphics + ShipState 래핑)
// ============================================================

export class Ship {
  public readonly graphics: Graphics;
  public state: ShipState;
  public readonly id: string;
  public readonly color: number;

  constructor(id: string, color: number, initialState: ShipState) {
    this.id = id;
    this.color = color;
    this.state = {
      position: { ...initialState.position },
      velocity: { ...initialState.velocity },
      heading: initialState.heading,
      hp: initialState.hp,
    };
    this.graphics = this.createGraphics();
    this.syncGraphics();
  }

  /** 함선 외형 생성 (사각형 본체 + 삼각형 노즈 + 엔진 글로우) */
  private createGraphics(): Graphics {
    const g = new Graphics();

    // 함선 본체 (40×20 사각형, 원점 중심)
    g.rect(-20, -10, 40, 20);
    g.fill({ color: this.color, alpha: 0.9 });

    // 함선 노즈 (전방 방향 표시 삼각형)
    g.moveTo(20, -8);
    g.lineTo(32, 0);
    g.lineTo(20, 8);
    g.closePath();
    g.fill({ color: 0xffffff, alpha: 0.7 });

    // 엔진 글로우 (후방 표시)
    g.rect(-24, -6, 4, 12);
    g.fill({ color: 0xff6644, alpha: 0.6 });

    return g;
  }

  /** ShipState의 position/heading을 Graphics에 동기화 */
  syncGraphics(): void {
    this.graphics.x = this.state.position.x;
    this.graphics.y = this.state.position.y;
    this.graphics.rotation = this.state.heading;
  }

  /** 특정 좌표가 함선 히트 영역 내인지 판정 (원형 근사) */
  isPointInside(x: number, y: number, radius: number = 40): boolean {
    const dx = x - this.state.position.x;
    const dy = y - this.state.position.y;
    return dx * dx + dy * dy <= radius * radius;
  }
}
