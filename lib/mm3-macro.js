export const MACRO_DEFAULTS = {
  war_percent: 0,
  nature_percent: 0,
};

// Max absolute swing a single /api/nudge-macro call may apply, in either
// direction — enforced server-side so the endpoint can only ever nudge the
// global storm state, never set it outright.
export const NUDGE_MAX_DELTA = 10;

export function clampMacroPercent(value = 0) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

export function normalizeMacroState(value = {}) {
  return {
    war_percent: clampMacroPercent(value.war_percent),
    nature_percent: clampMacroPercent(value.nature_percent),
  };
}

export function getMacroCommissionMultiplier(value = {}) {
  const macro = normalizeMacroState(value);
  const war = macro.war_percent / 100;
  const nature = macro.nature_percent / 100;
  return Math.max(0.1, Math.min(2, 1 - war * 0.5 + nature * 0.75));
}
