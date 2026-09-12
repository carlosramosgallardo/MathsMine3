import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { addM1RetroDecor, batchMiningStaticDecor, createMiningDecorBatcher, cullMiningBatchesByDistance, miningViewRadius, addChunkedInstancedMeshes, batchMiningShoreline, simplifyMiningMaterials, miningRetroPixelRatio } from './mining-retro.js'

test('M1 framebuffer stays bounded in landscape, portrait and ultrawide', () => {
  for (const [w, h] of [[1920,1080],[3840,2160],[390,844],[5120,1440],[200,100]]) {
    const ratio = miningRetroPixelRatio(w,h)
    assert.ok(w*ratio<=768 && h*ratio<=480 && ratio<=1)
  }
})

test('batching preserves world transforms and exact invisible camera collision surfaces', () => {
  const world = new THREE.Group(), group = new THREE.Group()
  group.position.set(2,0,3); world.add(group)
  const material = new THREE.MeshStandardMaterial({color:'#abcdab'})
  const originals=[]
  for(let i=0;i<3;i++) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material)
    mesh.position.set(i*2,0,0); mesh.userData.collidable=true
    group.add(mesh); originals.push(mesh)
  }
  world.updateMatrixWorld(true)
  const ray=new THREE.Raycaster(new THREE.Vector3(2,0,10),new THREE.Vector3(0,0,-1))
  const before=ray.intersectObjects(originals,false).map(h=>h.distance)
  simplifyMiningMaterials(world)
  assert.equal(batchMiningStaticDecor(world),2)
  world.updateMatrixWorld(true)
  assert.deepEqual(ray.intersectObjects(originals,false).map(h=>h.distance),before)
  assert.ok(originals.every(o=>o.parent===group && !o.visible))
  const batch=world.children.find(o=>o.name==='Mining retro static batch')
  assert.deepEqual(ray.intersectObject(batch).map(h=>h.distance),before)
})

test('interactive and animated branches retain materials, meshes and identities', () => {
  const world=new THREE.Group(), animated=new THREE.Group()
  animated.userData.m1MileiStatue=true; world.add(animated)
  const material=new THREE.MeshStandardMaterial({color:'#abcdef'})
  const objects=[]
  for(let i=0;i<4;i++) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(),material)
    animated.add(mesh); objects.push(mesh)
  }
  const node=new THREE.Mesh(new THREE.BoxGeometry(),material)
  node.userData.interactive=true; world.add(node)
  simplifyMiningMaterials(world); batchMiningStaticDecor(world)
  assert.ok(objects.every(o=>o.parent===animated && o.material===material))
  assert.equal(node.parent,world); assert.equal(node.material,material)
})

test('decoration does not mutate gameplay maps, and stays bounded in draw calls', () => {
  const obstacles=new Map([['42,42',{height:2}],['3,3',{height:4,isHouse:true}],['45,45',{height:1,isNukeCube:true}]])
  const cells=new Map([['40,40',{blockHex:'0001'}]])
  const before=JSON.stringify([...obstacles]), cellsBefore=JSON.stringify([...cells])
  const world=new THREE.Group()
  const decor=addM1RetroDecor(world,obstacles,cells)
  assert.equal(JSON.stringify([...obstacles]),before)
  assert.equal(JSON.stringify([...cells]),cellsBefore)
  assert.ok(decor.children.length<80)
  assert.ok(decor.children.every(o=>o.isInstancedMesh && !o.userData.collidable))
})


test('shoreline combines coplanar water while retaining its animation tag and material', () => {
  const world=new THREE.Group()
  const material=new THREE.MeshBasicMaterial({transparent:true,opacity:.78})
  for(let i=0;i<8;i++) {
    const edge=new THREE.Mesh(new THREE.PlaneGeometry(1,.2),material)
    edge.rotation.x=-Math.PI/2; edge.position.set(i,.017,0)
    edge.renderOrder=2; edge.userData.biomeSurface='water'; world.add(edge)
  }
  batchMiningShoreline(world)
  assert.equal(world.children.length,1)
  assert.equal(world.children[0].material,material)
  assert.equal(world.children[0].userData.biomeSurface,'water')
  assert.equal(world.children[0].geometry.attributes.position.count,48)
  assert.equal(world.userData.retroSavedDraws,7)
})

function decorWorld() {
  const world = new THREE.Group()
  const material = new THREE.MeshLambertMaterial({ color: '#8899aa' })
  // Two buckets: three boxes near the origin, three far along +x.
  for (const x0 of [1, 40]) for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material)
    mesh.position.set(x0 + i, 0, 1); world.add(mesh)
  }
  return world
}

test('incremental batcher merges nearest bucket first and never leaves a hole', () => {
  const world = decorWorld()
  const batcher = createMiningDecorBatcher(world, new Set(), { origin: { x: 0, z: 0 } })
  assert.equal(batcher.pending, 2)
  const drawn = () => world.children.filter(o => o.isMesh && o.visible).length
  assert.equal(drawn(), 6, 'originals keep drawing until merged')
  assert.equal(batcher.step(0), false, 'one bucket per zero-budget step')
  assert.equal(batcher.pending, 1)
  const batch = world.userData.retroBatches[0]
  assert.ok(batch.userData.retroBatch.cx < 12, 'the bucket around the origin merged first')
  assert.equal(drawn(), 4, 'three originals replaced by one batch, three still pending')
  assert.equal(batcher.step(0), true)
  assert.equal(batcher.done, true)
  assert.equal(batcher.savedDraws, 4)
  assert.equal(world.userData.retroSavedDraws, 4)
  assert.equal(drawn(), 2)
})

test('cancelling a batcher stops merging but still releases what was retired', () => {
  const world = decorWorld()
  const batcher = createMiningDecorBatcher(world, new Set(), { origin: { x: 0, z: 0 } })
  batcher.step(0)
  const retired = world.userData.retroBatches.length
  batcher.cancel()
  assert.equal(batcher.done, true)
  assert.equal(batcher.pending, 0)
  assert.equal(world.userData.retroBatches.length, retired, 'no further merges after cancel')
})

test('distance culling follows the fog and keeps a bucket-reach margin', () => {
  const world = decorWorld()
  batchMiningStaticDecor(world)
  const radius = miningViewRadius(.05)
  assert.ok(Math.abs(radius - 32) < 1e-9)
  assert.equal(cullMiningBatchesByDistance(world, 0, 0, radius), 1, 'the +x bucket (centre 42) is past 32+reach')
  assert.equal(world.userData.retroBatches.find(b => b.userData.retroBatch.cx > 30).visible, false)
  assert.equal(cullMiningBatchesByDistance(world, 30, 0, radius), 0, 'everything within reach again')
  assert.ok(world.userData.retroBatches.every(b => b.visible))
  assert.equal(miningViewRadius(0), Infinity)
})

test('render distance: far buckets are born hidden and appear on approach, originals never draw', () => {
  const world = decorWorld()
  const batcher = createMiningDecorBatcher(world, new Set(), { origin: { x: 0, z: 0 }, hideBeyond: 20 })
  const farOriginals = world.children.filter(o => o.isMesh && o.position.x >= 40)
  assert.ok(farOriginals.length === 3 && farOriginals.every(o => !o.visible), 'beyond the render distance nothing draws at entry')
  assert.ok(world.children.filter(o => o.isMesh && o.position.x < 10).every(o => o.visible), 'near originals draw until merged')
  while (!batcher.done) batcher.step(Infinity)
  const far = world.userData.retroBatches.find(b => b.userData.retroBatch.cx > 30)
  assert.equal(far.visible, false, 'merged far batch is born hidden')
  cullMiningBatchesByDistance(world, 38, 0, 20)
  assert.equal(far.visible, true, 'walking there reveals it')
})

test('chunked instanced meshes split a map-wide list into cullable, collidable chunks', () => {
  const world = new THREE.Group()
  const entries = [[0, 0], [1, 2], [30, 30], [31, 33]]  // [row, col]: two in chunk (0,0), two in chunk (2,2)
  const meshes = addChunkedInstancedMeshes(world, {
    geometry: new THREE.BoxGeometry(1, 1, 1), material: new THREE.MeshLambertMaterial(),
    entries, cellOf: e => e, place: ([row, col], index, matrix) => matrix.makeTranslation(col + .5, .5, row + .5),
    chunk: 14, collidable: true,
  })
  assert.equal(meshes.length, 2)
  assert.ok(meshes.every(m => m.isInstancedMesh && m.count === 2 && m.userData.collidable))
  assert.equal(world.userData.retroBatches.length, 2)
  assert.equal(cullMiningBatchesByDistance(world, 2, 2, 10), 1, 'the (2,2) chunk at centre 35 is out of range')
  const far = meshes.find(m => m.userData.retroBatch.cx > 30)
  assert.equal(far.visible, false)
  // Hidden chunks still collide: raycasting ignores visibility.
  const ray = new THREE.Raycaster(new THREE.Vector3(30.5, 5, 30.5), new THREE.Vector3(0, -1, 0))
  assert.ok(ray.intersectObject(far).length > 0)
})
