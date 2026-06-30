import { Application, Graphics, Container, Assets } from 'pixi.js';
import { GAME_CONSTANTS, ShipState, SimulationEvent, TurnCommand } from '@shared/types';
import { Ship } from './game/Ship';
import { CommandInput } from './game/CommandInput';
import { PredictionRenderer } from './game/PredictionRenderer';
import { HUD } from './ui/HUD';
import { sound } from './game/SoundManager';

const SERVER_URL = 'http://localhost:3000';

// ============================================================
// 별밭 및 그리드 헬퍼
// ============================================================

function createStarfield(width: number, height: number, count: number): Graphics {
  const stars = new Graphics();
  for (let i = 0; i < count; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = Math.random() * 1.5 + 0.3;
    const alpha = Math.random() * 0.6 + 0.2;
    stars.circle(x, y, radius);
    stars.fill({ color: 0xffffff, alpha });
  }
  return stars;
}

function createGrid(width: number, height: number, spacing: number): Graphics {
  const grid = new Graphics();
  for (let x = 0; x <= width; x += spacing) {
    grid.moveTo(x, 0);
    grid.lineTo(x, height);
    grid.stroke({ width: 0.5, color: 0x1a3a5c, alpha: 0.3 });
  }
  for (let y = 0; y <= height; y += spacing) {
    grid.moveTo(0, y);
    grid.lineTo(width, y);
    grid.stroke({ width: 0.5, color: 0x1a3a5c, alpha: 0.3 });
  }
  return grid;
}

// ============================================================
// Main Game Logic
// ============================================================

async function main() {
  // --- 1. 역할 선택 화면 (Role Selection Overlay) ---
  const selectedPlayerId = await showRoleSelection();

  // --- 2. Pixi.js 초기화 ---
  const app = new Application();
  await app.init({
    width: 1280,
    height: 720,
    background: '#060a1a',
    antialias: true,
  });

  const appContainer = document.getElementById('app-container');
  if (appContainer) {
    appContainer.appendChild(app.canvas);
  } else {
    document.body.appendChild(app.canvas);
  }

  // 모바일/브라우저 해상도 맞춤 반응형 레터박스 스케일러 (세로 모드 시 자동 90도 회전 피팅)
  function resizeGame() {
    if (!appContainer) return;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const isPortrait = winH > winW;

    if (isPortrait) {
      // 세로 화면일 때는 기기를 가로로 뉘여서 하도록 90도 회전 및 translate 정중앙 정렬 매핑
      const scale = Math.min(winH / 1280, winW / 720);
      appContainer.style.transform = `translate(-50%, -50%) rotate(90deg) scale(${scale})`;
    } else {
      // 가로 화면일 때는 정상 정방향 배율 및 translate 정중앙 정렬 매핑
      const scale = Math.min(winW / 1280, winH / 720);
      appContainer.style.transform = `translate(-50%, -50%) rotate(0deg) scale(${scale})`;
    }
  }

  window.addEventListener('resize', resizeGame);
  resizeGame(); // 초기 로딩 시 뷰포트 배율 설정 적용

  // --- 에셋 사전 로드 (Preload Assets) ---
  await Assets.load([
    '/assets/ship_blue.png',
    '/assets/ship_red.png'
  ]);

  // --- 3. 레이어 설정 ---
  const bgLayer = new Container();
  const predictionLayer = new Container();
  const effectLayer = new Container(); // 폭발, 빔 연출용 레이어
  const gameLayer = new Container();

  bgLayer.addChild(createStarfield(1280, 720, 250));
  bgLayer.addChild(createGrid(1280, 720, 60));

  app.stage.addChild(bgLayer);
  app.stage.addChild(predictionLayer);
  app.stage.addChild(effectLayer);
  app.stage.addChild(gameLayer);

  // --- 4. 게임 상태 & 함선 초기화 (서버 연동) ---
  let turnNumber = 1;
  let initialShipStateA: ShipState = {
    position: { x: 400, y: 360 },
    velocity: { x: 0, y: 0 },
    heading: 0,
    hp: GAME_CONSTANTS.DEFAULT_HP,
  };
  let initialShipStateB: ShipState = {
    position: { x: 880, y: 360 },
    velocity: { x: 0, y: 0 },
    heading: Math.PI,
    hp: GAME_CONSTANTS.DEFAULT_HP,
  };

  try {
    const res = await fetch(`${SERVER_URL}/api/turn/state`);
    const data = await res.json();
    if (data.status === 'success') {
      turnNumber = data.turnNumber;
      initialShipStateA = data.ships.playerA;
      initialShipStateB = data.ships.playerB;
      console.log(`[Main] Loaded state from server: Turn ${turnNumber}`);
    }
  } catch (err) {
    console.warn('[Main] Failed to load initial state from server. Using defaults.', err);
  }

  const shipA = new Ship('playerA', 0x4488ff, initialShipStateA);
  const shipB = new Ship('playerB', 0xff4444, initialShipStateB);

  gameLayer.addChild(shipA.graphics);
  gameLayer.addChild(shipB.graphics);

  // 조작 대상 지정
  const myShip = selectedPlayerId === 'playerA' ? shipA : shipB;
  const oppShip = selectedPlayerId === 'playerA' ? shipB : shipA;

  // --- 5. 예측 렌더러 & 명령 입력 모듈 ---
  const prediction = new PredictionRenderer(myShip.state, myShip.color);
  predictionLayer.addChild(prediction.graphics);

  const commandInput = new CommandInput(app, myShip);

  commandInput.onCommandChange = () => {
    prediction.update(
      myShip.state,
      commandInput.thrust,
      commandInput.targetHeading,
      commandInput.weaponTarget,
      commandInput.weaponType
    );
    commandInput.updatePredicted25State(prediction.predicted25Pos, prediction.predicted25Heading);
    hud.updateWeapon(commandInput.weaponType);
  };

  // --- 6. HUD 초기화 ---
  const hud = new HUD();
  hud.updateHP(shipA.state, shipB.state);
  hud.updateVelocity(myShip.state.velocity);

  // 최초 2.5초 예측 위치/각도 캡처 및 주입
  prediction.update(
    myShip.state,
    commandInput.thrust,
    commandInput.targetHeading,
    commandInput.weaponTarget,
    commandInput.weaponType
  );
  commandInput.updatePredicted25State(prediction.predicted25Pos, prediction.predicted25Heading);

  hud.updateWeapon(commandInput.weaponType);
  hud.setPhase(`명령 입력 중 [Turn ${turnNumber}]`);

  // 무기 화살표 클릭 핸들러
  hud.onPrevWeaponClick = () => {
    commandInput.setWeaponType('BEAM');
  };
  hud.onNextWeaponClick = () => {
    commandInput.setWeaponType('TORPEDO');
  };

  // 제출 버튼 핸들러
  hud.onSubmitClick = () => {
    commandInput.submit();
  };

  // 리셋 버튼 핸들러
  hud.onResetClick = async () => {
    if (confirm('게임을 초기화하시겠습니까?')) {
      try {
        await fetch(`${SERVER_URL}/api/turn/reset`, { method: 'POST' });
        window.location.reload();
      } catch (err) {
        console.error(err);
        window.location.reload();
      }
    }
  };

  // --- 7. 서버 통신 & 시뮬레이션 연동 ---
  let pollingInterval: any = null;

  commandInput.onSubmit = async (command) => {
    // 입력 비활성화
    app.stage.eventMode = 'none';
    hud.setSubmitDisabled(true);
    prediction.graphics.visible = false;
    hud.setPhase('대기 중 — 상대의 제출을 기다립니다...');

    try {
      const response = await fetch(`${SERVER_URL}/api/turn/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...command, turnNumber }),
      });
      const data = await response.json();

      if (data.status === 'success') {
        // 즉시 두 플레이어 명령 수집 완료 -> 재생 시작
        playSimulation(data.simulation, data.nextStates);
      } else if (data.status === 'waiting') {
        // 대기 중 -> 서버 폴링 시작
        startPolling();
      } else {
        alert(`제출 에러: ${data.message}`);
        resetInputState();
      }
    } catch (err) {
      console.error(err);
      alert('서버 전송 실패. 콘솔을 확인하세요.');
      resetInputState();
    }
  };

  function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/turn/status?playerId=${selectedPlayerId}&turnNumber=${turnNumber}`);
        const data = await res.json();
        if (data.status === 'success') {
          clearInterval(pollingInterval);
          pollingInterval = null;
          playSimulation(data.simulation, data.nextStates);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1000);
  }

  function resetInputState() {
    app.stage.eventMode = 'static';
    hud.setSubmitDisabled(false);
    prediction.graphics.visible = true;
    commandInput.reset();

    // 턴 초기화 시 2.5초 예측 캡처 수행
    prediction.update(
      myShip.state,
      commandInput.thrust,
      commandInput.targetHeading,
      commandInput.weaponTarget,
      commandInput.weaponType
    );
    commandInput.updatePredicted25State(prediction.predicted25Pos, prediction.predicted25Heading);

    hud.updateVelocity(myShip.state.velocity);
    hud.updateWeapon(commandInput.weaponType);
    hud.setPhase(`명령 입력 중 [Turn ${turnNumber}]`);
  }

  // --- 8. 시뮬레이션 연출 재생기 (Sequence Player) ---
  interface ActiveLaser {
    graphics: Graphics;
    origin: { x: number; y: number };
    target: { x: number; y: number };
    color: number;
    elapsed: number;
    chargingDuration: number;
    maxDuration: number;
    hasFired: boolean;
  }

  interface ActiveExplosion {
    graphics: Graphics;
    x: number;
    y: number;
    duration: number;
    maxDuration: number;
  }

  interface ActiveTorpedo {
    graphics: Graphics;
    origin: { x: number; y: number };
    target: { x: number; y: number };
    startTime: number;
    endTime: number;
  }

  let activeLasers: ActiveLaser[] = [];
  let activeExplosions: ActiveExplosion[] = [];
  let activeTorpedos: ActiveTorpedo[] = [];

  // 함선 흔들림용
  let shakeOffsetA = { x: 0, y: 0 };
  let shakeOffsetB = { x: 0, y: 0 };
  let shakeDurationA = 0;
  let shakeDurationB = 0;

  function playSimulation(events: SimulationEvent[], nextStates: Record<string, ShipState>) {
    hud.setPhase('전투 진행 중 (시뮬레이션)...');

    const duration = GAME_CONSTANTS.SIMULATION_DURATION; // 5초
    let playbackTime = 0;
    let eventIndex = 0;

    // 시뮬레이션 추진음 재생 가동
    sound.startThrusterLoop();

    // 이벤트 시간 오름차순 정렬
    const sortedEvents = [...events].sort((a, b) => a.time - b.time);

    // 재생 전용 틱 루프 추가
    const playTicker = (ticker: any) => {
      const dtSec = ticker.deltaMS / 1000;
      playbackTime += dtSec;

      // 1. 타임라인에 맞춘 이벤트 실행
      while (eventIndex < sortedEvents.length && sortedEvents[eventIndex].time <= playbackTime) {
        const ev = sortedEvents[eventIndex];
        eventIndex++;

        switch (ev.event) {
          case 'MOVE': {
            const ship = ev.shipId === 'playerA' ? shipA : shipB;
            ship.state.position.x = ev.x;
            ship.state.position.y = ev.y;
            ship.state.heading = ev.heading;
            ship.syncGraphics();
            break;
          }
          case 'FIRE': {
            const ship = ev.shipId === 'playerA' ? shipA : shipB;
            if (ev.weaponType === 'BEAM') {
              // 레이저 연출 스폰 (지잉 응축 -> 슈웅 격발 루프를 위해 상태 등록)
              const laserG = new Graphics();
              effectLayer.addChild(laserG);
              activeLasers.push({
                graphics: laserG,
                origin: { ...ev.origin },
                target: { ...ev.target },
                color: ship.color,
                elapsed: 0,
                chargingDuration: 0.25,
                maxDuration: 0.65,
                hasFired: false,
              });
              // 빔 충전음 재생
              sound.playBeamCharge(0.25);
            } else if (ev.weaponType === 'TORPEDO') {
              // 어뢰 발사음 재생
              sound.playTorpedoLaunch();
              // 어뢰 날아가는 애니메이션 데이터 스폰
              const torpG = new Graphics();
              effectLayer.addChild(torpG);
              // 비행 시간 찾기 (다음 HIT 이벤트 또는 5.0초에 대응)
              const matchingHit = sortedEvents.find(
                (e) => e.event === 'HIT' && e.time > ev.time && e.time <= ev.time + 5.0
              );
              const endTime = matchingHit ? matchingHit.time : 5.0;

              activeTorpedos.push({
                graphics: torpG,
                origin: { ...ev.origin },
                target: { ...ev.target },
                startTime: ev.time,
                endTime,
              });
            }
            break;
          }
          case 'HIT': {
            const target = ev.targetId === 'playerA' ? shipA : shipB;
            // 함선 흔들림 트리거
            if (ev.targetId === 'playerA') {
              shakeDurationA = 0.25;
            } else {
              shakeDurationB = 0.25;
            }

            // 피격 폭발음 재생
            sound.playExplosion();

            // 폭발 이펙트 추가
            const expG = new Graphics();
            effectLayer.addChild(expG);
            activeExplosions.push({
              graphics: expG,
              x: target.state.position.x,
              y: target.state.position.y,
              duration: 0.5,
              maxDuration: 0.5,
            });

            // 임시 데미지 수치 차감 및 텍스트 팝업
            target.state.hp = Math.max(0, target.state.hp - ev.damage);
            hud.updateHP(shipA.state, shipB.state);
            showDamagePopup(target.state.position, ev.damage);
            break;
          }
          case 'END':
            // 루프 종료 처리로 이동
            break;
        }
      }

      // 2. 부드러운 애니메이션 업데이트 (프레임 단위)
      
      // 빔 페이드아웃 및 충전/격발 실시간 드로잉
      activeLasers.forEach((laser) => {
        laser.elapsed += dtSec;
        laser.graphics.clear();

        const color = laser.color;
        const org = laser.origin;
        const tgt = laser.target;

        if (laser.elapsed <= laser.chargingDuration) {
          // 1단계: 지잉하고 응축 (Charging Phase)
          const progress = laser.elapsed / laser.chargingDuration; // 0.0 ~ 1.0
          const maxRadius = 35 * (1 - progress); // 사방에서 중심으로 응축
          const orbRadius = 3 + 6 * progress; // 구체가 점점 웅장해짐

          // 에너지 구체
          laser.graphics.circle(org.x, org.y, orbRadius);
          laser.graphics.fill({ color: 0xffffff, alpha: 0.5 * progress });
          laser.graphics.circle(org.x, org.y, orbRadius + 4);
          laser.graphics.fill({ color, alpha: 0.3 * progress });

          // 기수로 소용돌이치며 들어가는 에너지 선들 (4갈래)
          const particleCount = 4;
          for (let i = 0; i < particleCount; i++) {
            const angle = (i / particleCount) * Math.PI * 2 + progress * Math.PI * 2.5;
            const px = org.x + Math.cos(angle) * maxRadius;
            const py = org.y + Math.sin(angle) * maxRadius;
            laser.graphics.moveTo(px, py);
            laser.graphics.lineTo(org.x, org.y);
            laser.graphics.stroke({ width: 1.5, color, alpha: 0.5 * (1 - progress) });
          }
        } else {
          // 2단계: 슈웅 격발 및 아우라 소멸 (Firing Phase)
          const fireElapsed = laser.elapsed - laser.chargingDuration;
          const fireDuration = laser.maxDuration - laser.chargingDuration; // 0.4초
          const progress = Math.min(1, fireElapsed / fireDuration);
          const alpha = 1 - progress;

          // 빔 격발 시점에만 효과음 1회 동기화 재생
          if (!laser.hasFired) {
            sound.playBeamFire(0.4);
            laser.hasFired = true;
          }

          const outerWidth = 9 * alpha;
          const innerWidth = 2.5 * alpha;

          // 머즐 플래시 (Muzzle Flash)
          laser.graphics.circle(org.x, org.y, 18 * alpha);
          laser.graphics.fill({ color: 0xffffff, alpha: alpha * 0.8 });
          laser.graphics.circle(org.x, org.y, 28 * alpha);
          laser.graphics.fill({ color, alpha: alpha * 0.4 });

          // 아우라 빔 선
          laser.graphics.moveTo(org.x, org.y);
          laser.graphics.lineTo(tgt.x, tgt.y);
          laser.graphics.stroke({ width: outerWidth, color, alpha: alpha * 0.6 });

          // 코어 빔 선 (흰색 레이저 코어)
          laser.graphics.moveTo(org.x, org.y);
          laser.graphics.lineTo(tgt.x, tgt.y);
          laser.graphics.stroke({ width: innerWidth, color: 0xffffff, alpha: alpha * 0.95 });

          // 타격지점 번쩍임 스파크 (Spark)
          laser.graphics.circle(tgt.x, tgt.y, 10 * alpha);
          laser.graphics.fill({ color: 0xffffff, alpha: alpha * 0.8 });
          laser.graphics.circle(tgt.x, tgt.y, 18 * alpha);
          laser.graphics.fill({ color, alpha: alpha * 0.4 });
        }
      });

      activeLasers = activeLasers.filter((laser) => {
        if (laser.elapsed >= laser.maxDuration) {
          effectLayer.removeChild(laser.graphics);
          laser.graphics.destroy();
          return false;
        }
        return true;
      });

      // 어뢰 이동 프레임 업데이트
      activeTorpedos.forEach((torp) => {
        const totalDuration = torp.endTime - torp.startTime;
        const elapsed = playbackTime - torp.startTime;
        const progress = Math.min(1, Math.max(0, elapsed / totalDuration));

        const curX = torp.origin.x + (torp.target.x - torp.origin.x) * progress;
        const curY = torp.origin.y + (torp.target.y - torp.origin.y) * progress;

        torp.graphics.clear();
        torp.graphics.circle(curX, curY, 5);
        torp.graphics.fill({ color: 0xffaa00 });
        torp.graphics.circle(curX, curY, 8);
        torp.graphics.stroke({ width: 1, color: 0xff6600, alpha: 0.5 });
      });

      activeTorpedos = activeTorpedos.filter((torp) => {
        if (playbackTime >= torp.endTime) {
          effectLayer.removeChild(torp.graphics);
          torp.graphics.destroy();
          
          // 폭발 사운드 재생
          sound.playExplosion();

          // 폭발 추가
          const expG = new Graphics();
          effectLayer.addChild(expG);
          activeExplosions.push({
            graphics: expG,
            x: torp.target.x,
            y: torp.target.y,
            duration: 0.5,
            maxDuration: 0.5,
          });
          return false;
        }
        return true;
      });

      // 폭발 애니메이션
      activeExplosions.forEach((exp) => {
        exp.duration -= dtSec;
        const ratio = 1 - (exp.duration / exp.maxDuration);
        const radius = ratio * 60; // 최대 폭발 반경 60px
        const alpha = Math.max(0, exp.duration / exp.maxDuration);

        exp.graphics.clear();
        exp.graphics.circle(exp.x, exp.y, radius);
        exp.graphics.fill({ color: 0xff6600, alpha: alpha * 0.7 });
        exp.graphics.circle(exp.x, exp.y, radius * 0.7);
        exp.graphics.fill({ color: 0xffcc00, alpha: alpha * 0.9 });
      });
      activeExplosions = activeExplosions.filter((exp) => {
        if (exp.duration <= 0) {
          effectLayer.removeChild(exp.graphics);
          exp.graphics.destroy();
          return false;
        }
        return true;
      });

      // 함선 피격 흔들림
      if (shakeDurationA > 0) {
        shakeDurationA -= dtSec;
        shakeOffsetA = {
          x: (Math.random() - 0.5) * 12,
          y: (Math.random() - 0.5) * 12,
        };
        const pos = shipA.visualPosition;
        shipA.graphics.x = pos.x + shakeOffsetA.x;
        shipA.graphics.y = pos.y + shakeOffsetA.y;
      } else {
        const pos = shipA.visualPosition;
        shipA.graphics.x = pos.x;
        shipA.graphics.y = pos.y;
      }

      if (shakeDurationB > 0) {
        shakeDurationB -= dtSec;
        shakeOffsetB = {
          x: (Math.random() - 0.5) * 12,
          y: (Math.random() - 0.5) * 12,
        };
        const pos = shipB.visualPosition;
        shipB.graphics.x = pos.x + shakeOffsetB.x;
        shipB.graphics.y = pos.y + shakeOffsetB.y;
      } else {
        const pos = shipB.visualPosition;
        shipB.graphics.x = pos.x;
        shipB.graphics.y = pos.y;
      }

      // 시뮬레이션 끝났는지 체크
      if (playbackTime >= duration) {
        app.ticker.remove(playTicker);
        sound.stopThrusterLoop(); // 시뮬레이션 종료 시 추진음 해제
        finishSimulation(nextStates);
      }
    };

    app.ticker.add(playTicker);
  }

  function finishSimulation(nextStates: Record<string, ShipState>) {
    // 서버 오피셜 데이터로 상태 완전 강제 동기화
    shipA.state = { ...nextStates.playerA };
    shipB.state = { ...nextStates.playerB };

    shipA.syncGraphics();
    shipB.syncGraphics();

    hud.updateHP(shipA.state, shipB.state);

    // 승패 종료 검사
    if (shipA.state.hp <= 0 || shipB.state.hp <= 0) {
      showEndGameResult();
      return;
    }

    // 다음 턴 셋업
    turnNumber++;
    resetInputState();
  }

  function showDamagePopup(pos: { x: number; y: number }, damage: number) {
    const popup = document.createElement('div');
    popup.className = 'damage-popup';
    popup.textContent = `-${damage}`;
    popup.style.left = `${pos.x}px`;
    popup.style.top = `${pos.y - 30}px`;
    document.body.appendChild(popup);

    setTimeout(() => {
      popup.remove();
    }, 1000);
  }

  function showEndGameResult() {
    const isWin = (selectedPlayerId === 'playerA' && shipB.state.hp <= 0) ||
                  (selectedPlayerId === 'playerB' && shipA.state.hp <= 0);
    const isDraw = shipA.state.hp <= 0 && shipB.state.hp <= 0;

    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';
    
    let title = 'VICTORY';
    let titleColor = '#44ff88';
    if (isDraw) {
      title = 'MUTUAL DESTRUCTION';
      titleColor = '#ffcc00';
    } else if (!isWin) {
      title = 'DEFEAT';
      titleColor = '#ff4444';
    }

    overlay.innerHTML = `
      <div class="game-over-card">
        <h1 style="color: ${titleColor}; text-shadow: 0 0 20px ${titleColor};">${title}</h1>
        <p>전투가 종료되었습니다.</p>
        <p style="font-size: 13px; opacity: 0.6; margin-bottom: 24px;">Turn: ${turnNumber} | Player A HP: ${shipA.state.hp} | Player B HP: ${shipB.state.hp}</p>
        <button id="reset-game-btn">재경기 하기 (Reset Game)</button>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('reset-game-btn')?.addEventListener('click', async () => {
      try {
        await fetch(`${SERVER_URL}/api/turn/reset`, { method: 'POST' });
        window.location.reload();
      } catch (err) {
        console.error(err);
        window.location.reload();
      }
    });
  }

  // --- 9. 일반 업데이트 루프 ---
  app.ticker.add(() => {
    // 점검: 재생 단계가 아닐 때만 예측선 그리기
    if (prediction.graphics.visible) {
      prediction.update(
        myShip.state,
        commandInput.thrust,
        commandInput.targetHeading,
        commandInput.weaponTarget,
        commandInput.weaponType
      );

      // OOB 이탈 실시간 경고 체크
      const MAP_WIDTH = 1280;
      const MAP_HEIGHT = 720;
      const pos = myShip.state.position;
      const isOob = pos.x < 0 || pos.x > MAP_WIDTH || pos.y < 0 || pos.y > MAP_HEIGHT;
      hud.setOOBWarning(isOob);
    } else {
      // 재생 중일 때나 대기 단계에서는 경고 오버레이를 끕니다.
      hud.setOOBWarning(false);
    }
  });

  console.log('[WeGo] 클라이언트 코어 통합 완료');
}

// ============================================================
// 역할 선택 UI & 게임오버 스타일
// ============================================================

function showRoleSelection(): Promise<string> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.id = 'role-overlay';
    overlay.innerHTML = `
      <div class="role-card">
        <h2>🚀 COSMOS ODYSSEY</h2>
        <h3>Faction Selection</h3>
        <p>1:1 We-Go 동시 턴제 우주 전술 시뮬레이션</p>
        <div class="role-buttons">
          <button class="role-btn btn-blue" id="select-a-btn">🔵 Player A (Blue)</button>
          <button class="role-btn btn-red" id="select-b-btn">🔴 Player B (Red)</button>
        </div>
        <p class="role-tip">팁: 브라우저 창을 2개 띄우고 각각 A와 B를 선택하여 플레이해 보세요.</p>
      </div>
    `;

    // 공통 CSS 삽입
    const style = document.createElement('style');
    style.textContent = OVERLAY_STYLES;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    document.getElementById('select-a-btn')?.addEventListener('click', () => {
      overlay.remove();
      resolve('playerA');
    });

    document.getElementById('select-b-btn')?.addEventListener('click', () => {
      overlay.remove();
      resolve('playerB');
    });
  });
}

const OVERLAY_STYLES = `
  /* --- 역할 선택 오버레이 --- */
  #role-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: radial-gradient(circle at center, #0d152d, #03050c);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
    font-family: 'Courier New', 'Consolas', monospace;
    color: #c0d0e0;
  }
  .role-card {
    background: rgba(10, 18, 42, 0.6);
    border: 1px solid rgba(68, 136, 255, 0.25);
    border-radius: 12px;
    padding: 40px;
    text-align: center;
    backdrop-filter: blur(15px);
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);
    max-width: 500px;
  }
  .role-card h2 {
    font-size: 26px;
    margin-bottom: 8px;
    color: #4488ff;
    letter-spacing: 3px;
    text-shadow: 0 0 10px rgba(68, 136, 255, 0.5);
  }
  .role-card h3 {
    font-size: 14px;
    margin-bottom: 24px;
    opacity: 0.6;
    letter-spacing: 5px;
    text-transform: uppercase;
  }
  .role-card p {
    font-size: 13px;
    line-height: 1.6;
    margin-bottom: 30px;
  }
  .role-buttons {
    display: flex;
    gap: 16px;
    justify-content: center;
    margin-bottom: 24px;
  }
  .role-btn {
    padding: 14px 24px;
    font-size: 14px;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    border-radius: 6px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s ease;
  }
  .btn-blue {
    background: rgba(68, 136, 255, 0.15);
    border-color: rgba(68, 136, 255, 0.4);
    color: #4488ff;
  }
  .btn-blue:hover {
    background: rgba(68, 136, 255, 0.35);
    border-color: #4488ff;
    box-shadow: 0 0 15px rgba(68, 136, 255, 0.35);
  }
  .btn-red {
    background: rgba(255, 68, 68, 0.15);
    border-color: rgba(255, 68, 68, 0.4);
    color: #ff4444;
  }
  .btn-red:hover {
    background: rgba(255, 68, 68, 0.35);
    border-color: #ff4444;
    box-shadow: 0 0 15px rgba(255, 68, 68, 0.35);
  }
  .role-tip {
    font-size: 11px !important;
    opacity: 0.4;
    margin: 0 !important;
  }

  /* --- 데미지 수치 팝업 --- */
  .damage-popup {
    position: fixed;
    pointer-events: none;
    font-family: 'Impact', 'Arial Black', sans-serif;
    font-size: 28px;
    color: #ff3333;
    -webkit-text-stroke: 1px black;
    text-shadow: 0 0 8px rgba(255, 0, 0, 0.6);
    z-index: 50;
    animation: floatUpFade 1s forwards ease-out;
  }
  @keyframes floatUpFade {
    0% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-50px); opacity: 0; }
  }

  /* --- 게임 오버 오버레이 --- */
  .game-over-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 200;
    font-family: 'Courier New', 'Consolas', monospace;
    color: #c0d0e0;
  }
  .game-over-card {
    background: rgba(10, 18, 42, 0.85);
    border: 2px solid rgba(255, 68, 68, 0.3);
    border-radius: 12px;
    padding: 50px;
    text-align: center;
    backdrop-filter: blur(15px);
    max-width: 450px;
    box-shadow: 0 0 50px rgba(0, 0, 0, 0.9);
  }
  .game-over-card h1 {
    font-size: 32px;
    margin-bottom: 16px;
    letter-spacing: 5px;
  }
  .game-over-card p {
    font-size: 14px;
    margin-bottom: 8px;
  }
  #reset-game-btn {
    padding: 12px 30px;
    font-size: 14px;
    font-family: 'Courier New', monospace;
    font-weight: bold;
    background: rgba(68, 255, 136, 0.15);
    border: 1px solid rgba(68, 255, 136, 0.5);
    color: #44ff88;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  #reset-game-btn:hover {
    background: rgba(68, 255, 136, 0.3);
    border-color: #44ff88;
    box-shadow: 0 0 20px rgba(68, 255, 136, 0.3);
  }
`;

main().catch(console.error);
