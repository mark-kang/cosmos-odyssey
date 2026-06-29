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
  private oobWarningPanel!: HTMLDivElement;
  private weaponText!: HTMLSpanElement;
  private prevWeaponBtn!: HTMLButtonElement;
  private nextWeaponBtn!: HTMLButtonElement;

  /** 제출 버튼 클릭 시 호출되는 콜백 */
  public onSubmitClick?: () => void;
  /** 리셋 버튼 클릭 시 호출되는 콜백 */
  public onResetClick?: () => void;
  /** 무기 이전/다음 클릭 콜백 */
  public onPrevWeaponClick?: () => void;
  public onNextWeaponClick?: () => void;

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
          <div class="weapon-selector">
            <button class="arrow-btn left" id="weapon-prev-btn">&lt;</button>
            <span class="weapon-text" id="weapon-text">무기: 빔 [1/2]</span>
            <button class="arrow-btn right" id="weapon-next-btn">&gt;</button>
          </div>
        </div>

        <div class="hp-panel hp-panel-right">
          <span class="hp-label">Player B</span>
          <div class="hp-bar-track"><div class="hp-bar-fill red" id="hp-bar-b"></div></div>
          <span class="hp-text" id="hp-text-b">100 / 100</span>
        </div>
      </div>

      <div class="oob-warning-overlay" id="oob-warning-overlay" style="display: none;">
        ⚠️ OUT OF BOUNDS WARNING! (HP DAMAGE ACTIVE)
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
    this.oobWarningPanel = document.getElementById('oob-warning-overlay') as HTMLDivElement;
    this.weaponText = document.getElementById('weapon-text') as HTMLSpanElement;
    this.prevWeaponBtn = document.getElementById('weapon-prev-btn') as HTMLButtonElement;
    this.nextWeaponBtn = document.getElementById('weapon-next-btn') as HTMLButtonElement;

    this.prevWeaponBtn.addEventListener('click', () => this.onPrevWeaponClick?.());
    this.nextWeaponBtn.addEventListener('click', () => this.onNextWeaponClick?.());

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

  /** 이탈 경고 표시 여부 설정 */
  setOOBWarning(visible: boolean): void {
    if (this.oobWarningPanel) {
      this.oobWarningPanel.style.display = visible ? 'block' : 'none';
    }
  }

  /** 선택한 무기 표시 업데이트 */
  updateWeapon(type: 'BEAM' | 'TORPEDO'): void {
    if (!this.weaponText) return;
    const isBeam = type === 'BEAM';
    this.weaponText.textContent = `무기: ${isBeam ? '직사 빔 (BEAM)' : '범위 어뢰 (TORPEDO)'} [1/2]`;
    this.weaponText.style.color = isBeam ? '#ff4444' : '#ffaa00';

    // 1번(BEAM) 선택 중에는 왼쪽 화살표 비표시, 가장 끝번(TORPEDO) 선택 중에는 오른쪽 화살표 비표시
    if (this.prevWeaponBtn && this.nextWeaponBtn) {
      this.prevWeaponBtn.style.visibility = isBeam ? 'hidden' : 'visible';
      this.nextWeaponBtn.style.visibility = isBeam ? 'visible' : 'hidden';
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
  .weapon-text {
    font-size: 11px;
    font-weight: bold;
    text-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
  }
  .weapon-selector {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 2px;
  }
  .arrow-btn {
    pointer-events: auto;
    background: none;
    border: none;
    color: #ffffff;
    cursor: pointer;
    font-size: 13px;
    font-weight: bold;
    padding: 2px 6px;
    opacity: 0.6;
    transition: all 0.2s ease;
    user-select: none;
  }
  .arrow-btn:hover {
    opacity: 1;
    color: #44ff88;
    text-shadow: 0 0 8px rgba(68, 255, 136, 0.6);
  }
  .arrow-btn:active {
    transform: scale(0.85);
  }

  /* --- 하단 제출 버튼 --- */
  .hud-bottom {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
  }
  .submit-btn {
    pointer-events: auto;
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
    pointer-events: auto;
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

  /* --- 이탈 경고 오버레이 --- */
  .oob-warning-overlay {
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 0, 0, 0.2);
    border: 1px solid rgba(255, 68, 68, 0.7);
    color: #ff4444;
    padding: 8px 24px;
    font-size: 14px;
    font-weight: bold;
    border-radius: 4px;
    text-shadow: 0 0 10px rgba(255, 0, 0, 0.6);
    box-shadow: 0 0 15px rgba(255, 0, 0, 0.2);
    animation: flash 1s infinite alternate;
    pointer-events: none; /* 마우스 조작 방해 금지 */
  }

  @keyframes flash {
    0% { opacity: 0.6; }
    100% { opacity: 1; }
  }
`;
