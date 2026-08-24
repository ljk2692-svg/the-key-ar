export const EVENT_PROFILE = Object.freeze({
  audienceType: 'common',
  eventName: null,
  eventLogo: null,
  customMessage: null,
  customFinalMessage: null
});

export const KEY_LENS_CONFIG = Object.freeze({
  appName: 'THE KEY / KEY LENS',
  systemName: 'THE KEY SYSTEM',
  version: '0.2.3-ar01',
  stableDetectionMs: 500,
  targetLostGraceMs: 1500,
  targetData: './TK_R1_ROTATE_01.mind',
  targetAspectRatio: 941 / 1672,
  targets: [
    {
      id: 'TK_R1_ROTATE_01',
      name: 'ROUND 1 / R1-Q02 / Perspective Shift',
      round: 'ROUND_1',
      experienceType: 'ROTATE',
      targetIndex: 0,
      targetImage: './TK_R1_ROTATE_01.png',
      enabled: true,
      version: 1,
      productionReady: false
    }
  ]
});

export function getEnabledTargetByIndex(targetIndex) {
  return KEY_LENS_CONFIG.targets.find(
    (target) => target.enabled && target.targetIndex === targetIndex
  ) || null;
}
