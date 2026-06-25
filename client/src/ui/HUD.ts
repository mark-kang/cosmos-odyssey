import type { ShipState } from '@shared/types';

// ============================================================
// HUD: HTML 오버레이 기반 헤드업 디스플레이
// HP 바, 속도 표시, 턴 Phase, 제출 버튼
// ============================================================

export class HUD {
  private hpBarA!: HTMLDivElement;
  private hpBarB!: HTMLDivElement;
  private hpTextA!: HTMLSpanElement;
  private hpTextB!: HTMLSpanElement;
  private velocityText!: HTMLSpanElement;
  private phaseText!: HTMLSpanElement;
  private submitBtn!: HTMLButtonElement;

  /** 제출 버튼 클릭 시 호출되는 콜백 */
  public onSubmitClick?: () => void;
  /** 리셋 버튼 클릭 시 호출되는 콜백 */
  public onResetClick?: () => void;

  constructor() {
    this.createDOM();
  }


  private createDOM(): void {
    const container = document.createElement('div');
    container.id = 'hud';
    container.innerHTML = `
      <div class="hud-top">
        <div class="hp-panel">
          <span class="hp-label">Player A</span>
          <div class="hp-bar-track"><div class="hp-bar-fill blue" id="hp-bar-a"></div></div>
          <span class="hp-text" id="hp-text-a">100 / 100</span>
        </div>

        <div class="info-center">
          <span class="phase-text" id="phase-text">명령 입력 중</span>
          <span class="velocity-text" id="velocity-text">속도: 0.0</span>
        </div>

        <div class="hp-panel hp-panel-right">
          <span class="hp-label">Player B</span>
          <div class="hp-bar-track"><div class="hp-bar-fill red" id="hp-bar-b"></div></div>
          <span class="hp-text" id="hp-text-b">100 / 100</span>
        </div>
      </div>

      <div class="hud-bottom">
        <button class="submit-btn" id="submit-btn">⬡ 명령 제출 [SPACE]</button>
        <button class="reset-btn" id="hud-reset-btn">⬡ 리셋</button>
      </div>
    `;

    // 스타일 삽입
    const style = document.createElement('style');
    style.textContent = HUD_STYLES;
    document.head.appendChild(style);
    document.body.appendChild(container);

    // DOM 레퍼런스 캐싱
    this.hpBarA = document.getElementById('hp-bar-a') as HTMLDivElement;
    this.hpBarB = document.getElementById('hp-bar-b') as HTMLDivElement;
    this.hpTextA = document.getElementById('hp-text-a') as HTMLSpanElement;
    this.hpTextB = document.getElementById('hp-text-b') as HTMLSpanElement;
    this.velocityText = document.getElementById('velocity-text') as HTMLSpanElement;
    this.phaseText = document.getElementById('phase-text') as HTMLSpanElement;

    this.submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
    this.submitBtn.addEventListener('click', () => this.onSubmitClick?.());

    const resetBtn = document.getElementById('hud-reset-btn') as HTMLButtonElement;
    resetBtn.addEventListener('click', () => this.onResetClick?.());
  }

  /** HP 바 업데이트 */
  updateHP(stateA: ShipState, stateB: ShipState): void {
    const maxHP = 100;
    this.hpBarA.style.width = `${(stateA.hp / maxHP) * 100}%`;
    this.hpBarB.style.width = `${(stateB.hp / maxHP) * 100}%`;
    this.hpTextA.textContent = `${stateA.hp} / ${maxHP}`;
    this.hpTextB.textContent = `${stateB.hp} / ${maxHP}`;
  }

  /** 속도 표시 업데이트 */
  updateVelocity(velocity: { x: number; y: number }): void {
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
    this.velocityText.textContent = `속도: ${speed.toFixed(1)}`;
  }

  /** 턴 Phase 텍스트 변경 */
  setPhase(phase: string): void {
    this.phaseText.textContent = phase;
  }

  /** 제출 버튼 활성화/비활성화 */
  setSubmitDisabled(disabled: boolean): void {
    this.submitBtn.disabled = disabled;
    if (disabled) {
      this.submitBtn.style.opacity = '0.4';
      this.submitBtn.style.pointerEvents = 'none';
    } else {
      this.submitBtn.style.opacity = '1';
      this.submitBtn.style.pointerEvents = 'auto';
    }
  }
}

// ============================================================
// HUD 스타일시트
// ============================================================

const HUD_STYLES = `
  #hud {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    font-family: 'Courier New', 'Consolas', monospace;
    color: #c0d0e0;
    z-index: 10;
  }
  #hud * { pointer-events: auto; }

  /* --- 상단 영역 --- */
  .hud-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px 24px;
  }

  .hp-panel {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 180px;
  }
  .hp-panel-right {
    text-align: right;
    align-items: flex-end;
  }

  .hp-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
    opacity: 0.6;
  }

  .hp-bar-track {
    width: 180px;
    height: 8px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    overflow: hidden;
  }
  .hp-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }
  .hp-bar-fill.blue { background: linear-gradient(90deg, #2255aa, #4488ff); }
  .hp-bar-fill.red  { background: linear-gradient(90deg, #aa2222, #ff4444); }

  .hp-text {
    font-size: 13px;
    font-weight: bold;
  }

  /* --- 중앙 정보 --- */
  .info-center {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .phase-text {
    font-size: 13px;
    padding: 4px 16px;
    border-radius: 12px;
    background: rgba(68, 255, 136, 0.1);
    border: 1px solid rgba(68, 255, 136, 0.3);
    color: #44ff88;
  }
  .velocity-text {
    font-size: 11px;
    opacity: 0.5;
  }

  /* --- 하단 제출 버튼 --- */
  .hud-bottom {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
  }
  .submit-btn {
    padding: 10px 40px;
    font-size: 14px;
    font-family: 'Courier New', 'Consolas', monospace;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 3px;
    background: rgba(68, 136, 255, 0.15);
    border: 1px solid rgba(68, 136, 255, 0.5);
    color: #4488ff;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .submit-btn:hover {
    background: rgba(68, 136, 255, 0.3);
    border-color: #4488ff;
    box-shadow: 0 0 20px rgba(68, 136, 255, 0.3);
  }
  .submit-btn:active {
    transform: scale(0.96);
  }

  .reset-btn {
    padding: 10px 20px;
    font-size: 14px;
    font-family: 'Courier New', 'Consolas', monospace;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 2px;
    background: rgba(255, 68, 68, 0.1);
    border: 1px solid rgba(255, 68, 68, 0.4);
    color: #ff4444;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-left: 12px;
  }
  .reset-btn:hover {
    background: rgba(255, 68, 68, 0.25);
    border-color: #ff4444;
    box-shadow: 0 0 20px rgba(255, 68, 68, 0.25);
  }
  .reset-btn:active {
    transform: scale(0.96);
  }
`;
