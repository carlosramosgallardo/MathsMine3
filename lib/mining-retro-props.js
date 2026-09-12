// Geometry-only props. Dimensions and parent pivots match the existing game.
// Deliberately no loaders, fetches, textures, timers or model cache.
//
// In Mining these are the instant stand-ins the GLB model replaces
// once it streams in, so each builder hands back what it added — the caller
// hides exactly those meshes on arrival and keeps them if the load fails.
function box(THREE, parent, material, ...dimensions) {
  const [x, y, z, w, h, d] = dimensions
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  parent.add(mesh)
  return mesh
}

export function addRetroHead(THREE, parent, { skin = '#e8c4a8', hair = '#342820', seed = '' } = {}) {
  const skinMat = new THREE.MeshLambertMaterial({ color: skin })
  const hairMat = new THREE.MeshLambertMaterial({ color: seed === 'trump' ? '#e8bd5c' : hair })
  const eyes = new THREE.MeshBasicMaterial({ color: '#222838' })
  // Every piece goes on proceduralHeadMeshes, not just the skull box: that
  // list is what the GLB swap hides on arrival, and a hair slab or eyes left
  // off it kept floating over the scan's head once it replaced the voxel one.
  const parts = []
  const head = box(THREE,parent,skinMat,0,.835,0,.26,.27,.25)
  parts.push(head, box(THREE,parent,hairMat,0,.987,.02,.28,.055,.27))
  if (seed === 'milei') {
    for(const side of [-1,1]) parts.push(box(THREE,parent,hairMat,side*.14,.91,.025,.07,.17,.25))
  }
  for (const side of [-1,1]) parts.push(box(THREE,parent,eyes,side*.055,.86,-.13,.026,.024,.012))
  parts.push(box(THREE,parent,skinMat,0,.82,-.145,.035,.045,.04))
  parent.userData.proceduralHeadMeshes = parent.userData.proceduralHeadMeshes || []
  parent.userData.proceduralHeadMeshes.push(...parts)
  return { head }
}

export function addRetroCar(THREE, parent, tint = '#0ea5e9') {
  const paint = new THREE.MeshLambertMaterial({ color: tint })
  const dark = new THREE.MeshLambertMaterial({ color: '#182332' })
  const window = new THREE.MeshBasicMaterial({ color: '#87becb' })
  const lights = new THREE.MeshBasicMaterial({ color: '#fff0ac' })
  const root = new THREE.Group()
  root.name = 'retro RL car'
  box(THREE,root,dark,0,.15,0,.56,.12,1.28)
  box(THREE,root,paint,0,.25,0,.6,.18,1.34)
  box(THREE,root,paint,0,.40,.02,.48,.22,.62)
  box(THREE,root,window,0,.43,-.3,.42,.16,.02)
  box(THREE,root,dark,0,.41,.28,.37,.19,.36)
  for (const x of [-.31,.31]) for(const z of [-.43,.43]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.16,.16,.10,8), dark)
    wheel.rotation.z=Math.PI/2; wheel.position.set(x,.16,z); root.add(wheel)
  }
  for(const x of [-.2,.2]) box(THREE,root,lights,x,.27,-.68,.12,.055,.02)
  parent.add(root)
  return root
}

export function addRetroLedger(THREE, tool, tint = '#94a3b8', length = .38) {
  const shell = new THREE.MeshLambertMaterial({ color: '#d5dadc' })
  const dark = new THREE.MeshLambertMaterial({ color: '#172335' })
  const screen = new THREE.MeshBasicMaterial({ color: tint || '#94a3b8' })
  const fit = new THREE.Group()
  fit.rotation.z = -.16
  box(THREE,fit,shell,0,length*.5,0,.045,length,.025)
  box(THREE,fit,dark,0,length*.52,-.014,.034,length*.65,.01)
  box(THREE,fit,screen,0,length*.60,-.021,.024,.065,.004)
  tool.add(fit)
  return fit
}

export function addRetroNukePanels(THREE, group) {
  const steel = new THREE.MeshLambertMaterial({ color:'#8c9977' })
  const black = new THREE.MeshBasicMaterial({ color:'#24332b' })
  const caution = new THREE.MeshBasicMaterial({ color:'#f1ca65' })
  const meshes = []
  for (const x of [-.48,.48]) meshes.push(box(THREE,group,steel,x,.48,0,.025,.88,.9))
  for(const z of [-.5,.5]) {
    meshes.push(box(THREE,group,caution,0,.5,z,.52,.5,.018))
    meshes.push(box(THREE,group,black,0,.5,z*1.02,.12,.36,.018))
    meshes.push(box(THREE,group,black,0,.5,z*1.03,.36,.12,.018))
  }
  return meshes
}

export function addRetroCrawler(THREE, parent) {
  const suit = new THREE.MeshLambertMaterial({ color:'#1b3054' })
  const skin = new THREE.MeshLambertMaterial({ color:'#e8ae81' })
  const hair = new THREE.MeshLambertMaterial({ color:'#e5bd65' })
  const money = new THREE.MeshBasicMaterial({ color:'#98bf83' })
  const meshes = [box(THREE,parent,suit,0,.55,0,.58,.3,.84)]
  for(const x of [-.23,.23]) for(const z of [-.31,.31]) meshes.push(box(THREE,parent,suit,x,.23,z,.15,.4,.17))
  meshes.push(box(THREE,parent,skin,0,.87,-.36,.30,.3,.28))
  meshes.push(box(THREE,parent,hair,0,1.04,-.33,.32,.065,.32))
  for(const z of [-.2,0,.2]) meshes.push(box(THREE,parent,money,0,.71,z,.3,.016,.13))
  parent.userData.quadruped = true
  return meshes
}
