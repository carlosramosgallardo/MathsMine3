import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { addM1RetroDecor, batchMiningStaticDecor, batchMiningShoreline, simplifyMiningMaterials, miningRetroPixelRatio } from './mining-retro.js'

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
