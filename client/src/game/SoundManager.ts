// ============================================================
// SoundManager: Web Audio API 기반 실시간 오디오 합성 신디사이저
// 외부 오디오 에셋 다운로드 없이 브라우저 기본 API를 사용해 효과음을 생성합니다.
// ============================================================

class SoundManager {
  private ctx: AudioContext | null = null;
  private thrusterNode: OscillatorNode | null = null;
  private thrusterGain: GainNode | null = null;

  /** 오디오 컨텍스트 지연 로딩 및 사용자 브라우저 활성화 대응 */
  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** 1. 직사 빔 충전음 (지이잉~) */
  playBeamCharge(duration: number = 0.25) {
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth'; // 톱니파로 미래지향적 에너지 충전 기계음 묘사
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    // 0.25초 동안 120Hz -> 950Hz로 기하급수적 피치 상승
    osc.frequency.exponentialRampToValueAtTime(950, this.ctx.currentTime + duration);

    // 하이패스 필터로 기계음 질감 보정
    filter.type = 'peaking';
    filter.frequency.value = 650;
    filter.Q.value = 4.5;

    // 부드러운 볼륨 페이드인
    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.09, this.ctx.currentTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  /** 2. 직사 빔 격발음 (슈우웅!) */
  playBeamFire(duration: number = 0.4) {
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450, this.ctx.currentTime);
    // 1450Hz -> 70Hz로 날카롭게 급격한 피치 하강 (피유우웅!)
    osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + duration);

    // 볼륨 감쇄 페이드아웃
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  /** 3. 범위 어뢰 발사음 (퉁~ 슝~) */
  playTorpedoLaunch() {
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine'; // 부드러운 사인파로 묵직하게 밀려 나가는 어뢰 묘사
    osc.frequency.setValueAtTime(320, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }

  /** 4. 어뢰 폭발 및 함선 피격 타격음 (콰아앙!) */
  playExplosion() {
    this.initContext();
    if (!this.ctx) return;

    // 0.6초간의 화이트 노이즈 버퍼 생성 (바스락거리는 폭발 파열음의 소스)
    const duration = 0.6;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    // 저음형 로우패스 필터로 폭사의 묵직한 중저음 음향 묘사
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(15, this.ctx.currentTime + duration);

    // 가파른 폭발 볼륨 감쇄
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    noiseSource.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noiseSource.start();
    noiseSource.stop(this.ctx.currentTime + duration);
  }

  /** 5. 함선 엔진 기동 추진음 (쉬우우우~ 저음 루프) */
  startThrusterLoop() {
    this.initContext();
    if (!this.ctx) return;

    if (this.thrusterNode) return; // 중복 재생 차단

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.value = 62; // 묵직한 대형 전함의 백그라운드 엔진 베이스음

    filter.type = 'lowpass';
    filter.frequency.value = 130; // 고주파수를 깎아 부드러운 저음 가동 소리로 필터링

    // 엔진 시동을 켜듯 볼륨을 서서히 올림
    gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, this.ctx.currentTime + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();

    this.thrusterNode = osc;
    this.thrusterGain = gain;
  }

  /** 5. 함선 엔진 기동 추진음 해제 */
  stopThrusterLoop() {
    if (!this.ctx || !this.thrusterNode || !this.thrusterGain) return;

    const node = this.thrusterNode;
    const gain = this.thrusterGain;

    // 엔진이 부드럽게 시동 꺼지듯 볼륨 페이드아웃 후 정지
    gain.gain.setValueAtTime(gain.gain.value, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

    setTimeout(() => {
      try {
        node.stop();
        node.disconnect();
      } catch (e) {}
    }, 250);

    this.thrusterNode = null;
    this.thrusterGain = null;
  }
}

export const sound = new SoundManager();
