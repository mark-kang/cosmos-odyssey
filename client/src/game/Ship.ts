import { Container, Sprite } from 'pixi.js';
import type { ShipState } from '@shared/types';

// ============================================================
// Ship: 함선 클래스 (Container + Sprite + ShipState 래핑)
// ============================================================

export class Ship {
  public readonly graphics: Container; // 하위 호환성을 위해 이름을 graphics로 유지하되 Container 타입으로 정의
  public readonly sprite: Sprite;
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
    
    // 컨테이너 및 스프라이트 생성
    this.graphics = new Container();
    this.sprite = this.createSprite();
    this.graphics.addChild(this.sprite);
    
    this.syncGraphics();
  }

  /** 함선 스프라이트 에셋 생성 및 정렬 보정 */
  private createSprite(): Sprite {
    const isPlayerA = this.id === 'playerA';
    const texturePath = isPlayerA ? '/assets/ship_blue.png' : '/assets/ship_red.png';
    const sprite = Sprite.from(texturePath);
    
    // 중앙 피벗 설정
    sprite.anchor.set(0.5, 0.5);
    
    // 검은색 배경 투명화 및 발광 효과 극대화를 위한 스크린 블렌드 모드 적용
    sprite.blendMode = 'screen';
    
    // 적절한 스케일 적용 (2D 탑다운 전투기는 가로/세로 64px 정사각형에 맞게 스케일링)
    sprite.width = 64;
    sprite.height = 64;
    
    // 2D 이미지의 기수 정면이 3시 방향(0도)을 향하고 있으므로 정렬 회전 오프셋은 0입니다.
    sprite.rotation = 0;

    return sprite;
  }

  /** 화면 경계 내로 클램핑된 시각적 위치 반환 */
  get visualPosition(): { x: number; y: number } {
    const margin = 20; // 캔버스 내 마진
    const MAP_WIDTH = 1280;
    const MAP_HEIGHT = 720;
    return {
      x: Math.max(margin, Math.min(MAP_WIDTH - margin, this.state.position.x)),
      y: Math.max(margin, Math.min(MAP_HEIGHT - margin, this.state.position.y)),
    };
  }

  /** ShipState의 position/heading을 Graphics(Container)에 동기화 */
  syncGraphics(): void {
    const pos = this.visualPosition;
    this.graphics.x = pos.x;
    this.graphics.y = pos.y;
    this.graphics.rotation = this.state.heading;
  }

  /** 특정 좌표가 함선 히트 영역 내인지 판정 (원형 근사) */
  isPointInside(x: number, y: number, radius: number = 40): boolean {
    const pos = this.visualPosition;
    const dx = x - pos.x;
    const dy = y - pos.y;
    return dx * dx + dy * dy <= radius * radius;
  }
}
