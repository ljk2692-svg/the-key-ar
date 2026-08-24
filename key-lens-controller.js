import { KEY_LENS_CONFIG, EVENT_PROFILE, getEnabledTargetByIndex } from './targets.js';
import { EXPERIENCE_CONFIG } from './experiences.js';
import { KeyLensStateMachine, KEY_LENS_STATES as S } from './state-machine.js';
import { RotateExperience } from './rotate.js';

export class KeyLensController {
  constructor(dom) {
    this.dom = dom;
    this.machine = new KeyLensStateMachine();
    this.started = false;
    this.arSystem = null;
    this.targetVisible = false;
    this.stableTimer = null;
    this.lostTimer = null;
    this.activeTarget = getEnabledTargetByIndex(0);
    this.completedTargets = new Set();
    this.replayArmed = false;
    this.debug = new URLSearchParams(location.search).get('debug') === '1';

    this.experience = new RotateExperience({
      rootEl: dom.rotateRoot,
      rotateLayerEl: dom.rotateLayer,
      scanLineEl: dom.scanLine,
      phaseEl: dom.rotatePhase
    });

    this.inAppBrowser = /KAKAOTALK|Instagram|FBAN|FBAV|NAVER|Line\//i.test(navigator.userAgent);
    this.bind();
    this.machine.subscribe((entry) => this.renderState(entry));
    this.renderVersion();
    this.renderDiagnostics();
  }

  bind() {
    this.dom.startBtn.addEventListener('click', () => this.start());
    this.dom.retryBtn.addEventListener('click', () => location.reload());
    this.dom.replayBtn.addEventListener('click', () => this.replay());
    this.dom.backBtn.addEventListener('click', () => this.backToScanner());

    this.dom.scene.addEventListener('arReady', () => {
      this.dom.loading.hidden = true;
      this.machine.transition(S.SCANNING, { reason: 'ar-ready' });
    });

    this.dom.scene.addEventListener('arError', (event) => {
      this.fail(event?.detail || new Error('이미지 인식 엔진 초기화에 실패했습니다.'));
    });

    this.dom.targetAnchor.addEventListener('targetFound', () => this.onTargetFound());
    this.dom.targetAnchor.addEventListener('targetLost', () => this.onTargetLost());
  }

  async waitForScene() {
    if (this.dom.scene.hasLoaded) return;
    await new Promise((resolve) => this.dom.scene.addEventListener('loaded', resolve, { once: true }));
  }

  async start() {
    if (this.started) return;
    this.started = true;
    this.dom.startBtn.disabled = true;
    this.dom.errorBox.hidden = true;
    this.dom.loading.hidden = false;
    this.dom.topBar.hidden = false;
    this.dom.bottomPanel.hidden = false;
    this.dom.guide.hidden = false;

    try {
      if (this.inAppBrowser) throw new Error('앱 내부 브라우저 대신 Chrome 또는 Safari에서 열어주세요.');
      if (!window.isSecureContext) throw new Error('KEY LENS는 HTTPS 보안 주소에서 실행해야 합니다.');
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('이 브라우저에서는 카메라를 사용할 수 없습니다.');

      await this.waitForScene();
      this.arSystem = this.dom.scene.systems['mindar-image-system'];
      if (!this.arSystem || typeof this.arSystem.start !== 'function') {
        throw new Error('이미지 인식 엔진을 불러오지 못했습니다.');
      }

      this.dom.intro.hidden = true;
      await this.arSystem.start();
    } catch (error) {
      this.started = false;
      this.dom.startBtn.disabled = false;
      this.fail(error);
    }
  }

  onTargetFound() {
    if (this.targetVisible) return;
    this.targetVisible = true;
    clearTimeout(this.lostTimer);

    if (this.machine.state === S.TARGET_LOST && this.experience.isPlaying()) {
      this.machine.transition(S.PLAYING, { reason: 'target-recovered-within-grace' });
      return;
    }

    if (this.completedTargets.has(this.activeTarget.id) && !this.replayArmed) {
      this.showCompletedTargetHint();
      return;
    }

    if (![S.SCANNING, S.REPLAY].includes(this.machine.state)) return;

    this.machine.transition(S.TARGET_STABILIZING, { target: this.activeTarget.id });
    clearTimeout(this.stableTimer);
    this.stableTimer = setTimeout(() => {
      if (this.targetVisible && this.machine.state === S.TARGET_STABILIZING) this.confirmTarget();
    }, KEY_LENS_CONFIG.stableDetectionMs);
  }

  onTargetLost() {
    if (!this.targetVisible) return;
    this.targetVisible = false;
    clearTimeout(this.stableTimer);

    if (this.machine.state === S.TARGET_STABILIZING) {
      this.machine.transition(S.SCANNING, { reason: 'lost-before-stable' });
      return;
    }

    if ([S.TARGET_FOUND, S.LOADING, S.PLAYING].includes(this.machine.state)) {
      this.machine.transition(S.TARGET_LOST, { graceMs: KEY_LENS_CONFIG.targetLostGraceMs });
      clearTimeout(this.lostTimer);
      this.lostTimer = setTimeout(() => {
        if (!this.targetVisible && this.machine.state === S.TARGET_LOST && !this.experience.isPlaying()) {
          this.machine.transition(S.SCANNING, { reason: 'lost-grace-expired' });
        }
      }, KEY_LENS_CONFIG.targetLostGraceMs);
    }
  }

  async confirmTarget() {
    this.machine.transition(S.TARGET_FOUND, { target: this.activeTarget.id });
    this.feedback('found');
    this.machine.transition(S.LOADING, { experience: this.activeTarget.experienceType });

    try {
      await this.experience.prepare();
      this.machine.transition(this.targetVisible ? S.PLAYING : S.TARGET_LOST, { experience: 'ROTATE' });
      await this.experience.play();
      this.completedTargets.add(this.activeTarget.id);
      this.replayArmed = false;
      if ([S.PLAYING, S.TARGET_LOST].includes(this.machine.state)) {
        this.machine.transition(S.COMPLETED, { target: this.activeTarget.id });
      }
      this.feedback('complete');
    } catch (error) {
      this.fail(error);
    }
  }

  replay() {
    if (this.machine.state !== S.COMPLETED) return;
    this.replayArmed = true;
    this.completedTargets.delete(this.activeTarget.id);
    this.experience.reset();
    this.machine.transition(S.REPLAY, { target: this.activeTarget.id });

    if (this.targetVisible) {
      this.machine.transition(S.TARGET_STABILIZING, { target: this.activeTarget.id, replay: true });
      clearTimeout(this.stableTimer);
      this.stableTimer = setTimeout(() => {
        if (this.targetVisible && this.machine.state === S.TARGET_STABILIZING) this.confirmTarget();
      }, KEY_LENS_CONFIG.stableDetectionMs);
    } else {
      this.machine.transition(S.SCANNING, { reason: 'replay-awaiting-target' });
    }
  }

  backToScanner() {
    this.experience.reset();
    this.dom.actionBar.hidden = true;
    if (this.machine.state === S.COMPLETED) {
      this.machine.transition(S.SCANNING, { reason: 'back-to-scanner' });
    }
  }

  showCompletedTargetHint() {
    this.dom.actionBar.hidden = false;
    this.setStatus('ANALYSIS COMPLETE', '이미 확인한 정보층입니다. 다시 보려면 REPLAY를 선택하세요.');
  }

  renderState({ state }) {
    this.dom.stateCode.textContent = state;
    const meta = EXPERIENCE_CONFIG[this.activeTarget.experienceType];
    this.dom.mode.textContent = meta?.participantLabel || 'KEY LENS';

    const states = {
      [S.SCANNING]: ['SCANNING...', '해독할 이미지를 화면 중앙에 맞추세요.'],
      [S.TARGET_STABILIZING]: ['SCANNING...', '이미지를 잠시 그대로 유지하세요.'],
      [S.TARGET_FOUND]: ['TARGET DETECTED', '숨겨진 정보층을 확인했습니다.'],
      [S.LOADING]: ['ANALYZING...', '숨겨진 정보층을 분석하고 있습니다.'],
      [S.PLAYING]: ['ACCESS GRANTED', '나타난 변화를 팀원과 함께 관찰하세요.'],
      [S.TARGET_LOST]: ['SIGNAL LOST', '이미지 전체가 화면 안에 들어오도록 다시 맞추세요.'],
      [S.COMPLETED]: ['ANALYSIS COMPLETE', '관찰한 정보를 팀원과 공유하고 해답을 완성하세요.'],
      [S.REPLAY]: ['REPLAY READY', '이미지를 다시 화면 중앙에 맞추세요.']
    };

    if (states[state]) this.setStatus(...states[state]);
    this.dom.targetPill.hidden = ![S.TARGET_FOUND, S.LOADING, S.PLAYING, S.COMPLETED].includes(state);
    this.dom.actionBar.hidden = state !== S.COMPLETED;
  }

  setStatus(title, message) {
    this.dom.statusValue.textContent = title;
    this.dom.guideText.textContent = message;
  }

  feedback(kind) {
    if (kind === 'found') {
      navigator.vibrate?.(45);
      this.dom.flash.classList.remove('active');
      void this.dom.flash.offsetWidth;
      this.dom.flash.classList.add('active');
    }
    if (kind === 'complete') navigator.vibrate?.(90);
  }

  renderVersion() {
    this.dom.version.textContent = `${KEY_LENS_CONFIG.version} / ${this.activeTarget.id}`;
  }

  renderDiagnostics() {
    if (!this.debug) return;
    this.dom.diagnostics.hidden = false;
    this.dom.diagnostics.textContent = [
      `audience=${EVENT_PROFILE.audienceType}`,
      `target=${this.activeTarget.id}`,
      `secure=${window.isSecureContext}`,
      `browser=${navigator.userAgent}`
    ].join('\n');
  }

  fail(error) {
    this.dom.loading.hidden = true;
    this.dom.errorBox.hidden = false;
    this.dom.errorText.innerHTML = `<strong>KEY LENS 실행 오류</strong><br>${String(error?.message || error)}`;
    this.dom.statusValue.textContent = 'SYSTEM ERROR';
    navigator.vibrate?.([35, 60, 35]);
    this.machine.transition(S.ERROR, { message: String(error?.message || error) });
  }
}
