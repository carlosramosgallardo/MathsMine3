import {
  createBossRuntime as createM3BossRuntime,
  createM3PutinBossVisual,
  resolveBossSwingTarget as resolveM3BossSwingTarget,
  syncBossVisual as syncM3BossVisual,
  updateM3PutinBoss,
} from './m3-putin-boss-runtime'
import {
  createBossRuntime as createM4BossRuntime,
  createM4KimBossVisual,
  resolveBossSwingTarget as resolveM4BossSwingTarget,
  syncBossVisual as syncM4BossVisual,
  updateM4KimBoss,
} from './m4-kim-boss-runtime'
import {
  createBossRuntime as createM5BossRuntime,
  createM5TrumpBossVisual,
  resolveBossSwingTarget as resolveM5BossSwingTarget,
  syncBossVisual as syncM5BossVisual,
  updateM5TrumpBoss,
} from './m5-trump-boss-runtime'

export const BOSS_RUNTIME_BY_MAP = Object.freeze({
  '3': Object.freeze({
    createVisual: createM3PutinBossVisual,
    createRuntime: createM3BossRuntime,
    updateBoss: updateM3PutinBoss,
    resolveSwingTarget: resolveM3BossSwingTarget,
    syncVisual: syncM3BossVisual,
    groupKey: 'm3PutinBossGroup',
    userDataKey: 'm3PutinBoss',
  }),
  '4': Object.freeze({
    createVisual: createM4KimBossVisual,
    createRuntime: createM4BossRuntime,
    updateBoss: updateM4KimBoss,
    resolveSwingTarget: resolveM4BossSwingTarget,
    syncVisual: syncM4BossVisual,
    groupKey: 'm4KimBossGroup',
    userDataKey: 'm4KimBoss',
  }),
  '5': Object.freeze({
    createVisual: createM5TrumpBossVisual,
    createRuntime: createM5BossRuntime,
    updateBoss: updateM5TrumpBoss,
    resolveSwingTarget: resolveM5BossSwingTarget,
    syncVisual: syncM5BossVisual,
    groupKey: 'm5TrumpBossGroup',
    userDataKey: 'm5TrumpBoss',
  }),
})

export function getBossRuntimeModule(mapId) {
  return BOSS_RUNTIME_BY_MAP[String(mapId)] || null
}
