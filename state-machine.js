export const KEY_LENS_STATES = Object.freeze({
  IDLE: 'IDLE',
  SCANNING: 'SCANNING',
  TARGET_STABILIZING: 'TARGET_STABILIZING',
  TARGET_FOUND: 'TARGET_FOUND',
  LOADING: 'LOADING',
  PLAYING: 'PLAYING',
  TARGET_LOST: 'TARGET_LOST',
  COMPLETED: 'COMPLETED',
  REPLAY: 'REPLAY',
  ERROR: 'ERROR'
});

const ALLOWED = Object.freeze({
  IDLE: ['SCANNING', 'ERROR'],
  SCANNING: ['TARGET_STABILIZING', 'ERROR'],
  TARGET_STABILIZING: ['SCANNING', 'TARGET_FOUND', 'ERROR'],
  TARGET_FOUND: ['LOADING', 'SCANNING', 'ERROR'],
  LOADING: ['PLAYING', 'TARGET_LOST', 'ERROR'],
  PLAYING: ['TARGET_LOST', 'COMPLETED', 'ERROR'],
  TARGET_LOST: ['PLAYING', 'SCANNING', 'COMPLETED', 'ERROR'],
  COMPLETED: ['REPLAY', 'SCANNING', 'ERROR'],
  REPLAY: ['TARGET_STABILIZING', 'SCANNING', 'ERROR'],
  ERROR: ['IDLE']
});

export class KeyLensStateMachine {
  constructor(initialState = KEY_LENS_STATES.IDLE) {
    this.state = initialState;
    this.listeners = new Set();
    this.history = [{ state: initialState, at: Date.now(), meta: {} }];
  }

  can(nextState) {
    return (ALLOWED[this.state] || []).includes(nextState);
  }

  transition(nextState, meta = {}) {
    if (this.state === nextState) return true;
    if (!this.can(nextState)) {
      console.warn('[KEY LENS] Invalid state transition', this.state, '→', nextState, meta);
      return false;
    }

    const previousState = this.state;
    this.state = nextState;
    const entry = { state: nextState, previousState, at: Date.now(), meta };
    this.history.push(entry);
    if (this.history.length > 100) this.history.shift();
    this.listeners.forEach((listener) => listener(entry));
    return true;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
