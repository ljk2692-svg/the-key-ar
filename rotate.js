const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class RotateExperience {
  constructor({ rootEl, rotateLayerEl, scanLineEl, phaseEl }) {
    this.rootEl = rootEl;
    this.rotateLayerEl = rotateLayerEl;
    this.scanLineEl = scanLineEl;
    this.phaseEl = phaseEl;
    this.timerIds = [];
    this.playToken = 0;
    this.playing = false;
  }

  clearTimers() {
    this.timerIds.forEach((id) => clearTimeout(id));
    this.timerIds = [];
  }

  reset() {
    this.playToken += 1;
    this.clearTimers();
    this.playing = false;
    this.rootEl?.setAttribute('visible', false);
    this.rotateLayerEl?.removeAttribute('animation__shift');
    this.rotateLayerEl?.setAttribute('rotation', '0 0 0');
    this.scanLineEl?.removeAttribute('animation__scan');
    this.scanLineEl?.setAttribute('position', '-0.27 0 0.02');
    this.phaseEl?.setAttribute('value', 'STANDBY');
  }

  async prepare() {
    this.reset();
    this.rootEl?.setAttribute('visible', true);
    this.phaseEl?.setAttribute('value', 'ANALYZING HIDDEN LAYER...');

    this.scanLineEl?.setAttribute('animation__scan', {
      property: 'position',
      from: '-0.27 0 0.02',
      to: '0.27 0 0.02',
      dur: 560,
      dir: 'alternate',
      loop: 2,
      easing: 'easeInOutSine'
    });

    await sleep(650);
  }

  play() {
    const token = ++this.playToken;
    this.playing = true;

    return new Promise((resolve) => {
      const current = () => token === this.playToken;

      this.timerIds.push(setTimeout(() => {
        if (!current()) return;
        this.phaseEl?.setAttribute('value', 'PERSPECTIVE SHIFT');
        this.rotateLayerEl?.setAttribute('animation__shift', {
          property: 'rotation',
          from: '0 0 0',
          to: '0 0 90',
          dur: 1250,
          easing: 'easeInOutSine'
        });
      }, 350));

      this.timerIds.push(setTimeout(() => {
        if (!current()) return;
        this.rotateLayerEl?.removeAttribute('animation__shift');
        this.rotateLayerEl?.setAttribute('animation__shift', {
          property: 'rotation',
          from: '0 0 90',
          to: '0 0 180',
          dur: 1250,
          easing: 'easeInOutSine'
        });
      }, 1700));

      this.timerIds.push(setTimeout(() => {
        if (!current()) return;
        this.phaseEl?.setAttribute('value', 'PERSPECTIVE SHIFT COMPLETE');
      }, 3150));

      this.timerIds.push(setTimeout(() => {
        if (!current()) return;
        this.playing = false;
        resolve();
      }, 3900));
    });
  }

  isPlaying() {
    return this.playing;
  }
}
