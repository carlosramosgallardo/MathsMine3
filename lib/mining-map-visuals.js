/** Render-only art direction. Never used for cells, collisions or gameplay. */
const MAP_VISUALS = Object.freeze({
  '1': { sky: '#08182d', fog: '#243f58', hemi: '#d8ecff', bounce: '#263342', key: '#ffe5bd', rim: '#80cbdc', ground: '#d1deeb', dome: '#c6dbff', horizon: '#526a88', zenith: '#030916' },
  '2': { sky: '#091e32', fog: '#31556d', hemi: '#dff5ff', bounce: '#243c50', key: '#f1f8ff', rim: '#92dcff', ground: '#c2deeb', dome: '#c3e6ff', horizon: '#637f99', zenith: '#041020' },
  '3': { sky: '#201c30', fog: '#514858', hemi: '#ece2ef', bounce: '#39313c', key: '#ffd5a5', rim: '#b2c6ed', ground: '#e0d1c4', dome: '#f2dbd5', horizon: '#967369', zenith: '#100e23' },
  '4': { sky: '#151c2d', fog: '#3b4c59', hemi: '#d5e9ed', bounce: '#303c3f', key: '#ffe1b4', rim: '#8bd6cc', ground: '#cbd8d2', dome: '#c6e5df', horizon: '#677b79', zenith: '#080e20' },
  '5': { sky: '#121c38', fog: '#374866', hemi: '#e1e6ff', bounce: '#30344e', key: '#ffe0cf', rim: '#baa5f4', ground: '#d8d0e8', dome: '#ded2ff', horizon: '#78658e', zenith: '#0b0c25' },
})

export function getMiningMapVisuals(mapId) {
  return MAP_VISUALS[String(mapId)] || MAP_VISUALS['1']
}
