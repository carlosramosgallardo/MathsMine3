/**
 * Vertical retro USB staff for the chain-node arena landmark.
 * Same layout as the robot tool: grip at the base, shaft, Type-A plug on top.
 */
export function addVerticalArenaUsbStaff(THREE, parent, { x = 0, z = 0, simplified = false } = {}) {
  const staff = new THREE.Group()
  staff.position.set(x, 0, z)

  const scale = 4

  const darkMat = simplified
    ? new THREE.MeshLambertMaterial({ color: '#1e293b', emissive: '#0f172a', emissiveIntensity: .18 })
    : new THREE.MeshStandardMaterial({
      color: '#1e293b', roughness: .72, metalness: .18,
      emissive: '#0f172a', emissiveIntensity: .18,
    })
  const magentaMat = simplified
    ? new THREE.MeshLambertMaterial({ color: '#d946ef', emissive: '#d946ef', emissiveIntensity: .4 })
    : new THREE.MeshBasicMaterial({ color: '#d946ef' })
  const goldMat = new THREE.MeshBasicMaterial({ color: '#facc15' })
  const gripMat = simplified
    ? new THREE.MeshLambertMaterial({ color: '#07121c', emissive: '#0f172a', emissiveIntensity: .3 })
    : new THREE.MeshStandardMaterial({ color: '#07121c', roughness: .55, metalness: .55 })
  const plugShellMat = simplified
    ? new THREE.MeshLambertMaterial({ color: '#d8e7ef', emissive: '#94a3b8', emissiveIntensity: .2 })
    : new THREE.MeshStandardMaterial({ color: '#d8e7ef', metalness: .78, roughness: .20 })

  const torusSegs = simplified ? 16 : 28
  const cylSegs = simplified ? 6 : 10

  const BASE_Y = 0.32
  const GRIP_H = 0.19 * scale
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.045 * scale, .045 * scale, GRIP_H, cylSegs), gripMat)
  grip.position.set(0, BASE_Y + GRIP_H / 2, 0)
  staff.add(grip)

  const gripRing = new THREE.Mesh(new THREE.TorusGeometry(.046 * scale, .009 * scale, 5, torusSegs), magentaMat)
  gripRing.rotation.x = Math.PI / 2
  gripRing.position.set(0, BASE_Y + GRIP_H + .02 * scale, 0)
  staff.add(gripRing)

  const SHAFT_BOT = BASE_Y + GRIP_H + .04 * scale
  const SHAFT_H = 0.62 * scale
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(.024 * scale, .030 * scale, SHAFT_H, cylSegs),
    darkMat,
  )
  shaft.position.set(0, SHAFT_BOT + SHAFT_H / 2, 0)
  staff.add(shaft)

  const SHAFT_TOP = SHAFT_BOT + SHAFT_H

  // Robot plug group — collar below shell, connector face on top.
  const plug = new THREE.Group()
  const plugShell = new THREE.Mesh(
    new THREE.BoxGeometry(.15 * scale, .22 * scale, .095 * scale),
    plugShellMat,
  )
  plug.add(plugShell)

  const plugFace = new THREE.Mesh(
    new THREE.BoxGeometry(.105 * scale, .012 * scale, .061 * scale),
    new THREE.MeshBasicMaterial({ color: '#041019' }),
  )
  plugFace.position.y = .116 * scale
  plug.add(plugFace)

  for (const px of [-.034 * scale, 0, .034 * scale]) {
    const contact = new THREE.Mesh(
      new THREE.BoxGeometry(.018 * scale, .008 * scale, .034 * scale),
      goldMat,
    )
    contact.position.set(px, .124 * scale, 0)
    plug.add(contact)
  }

  const plugCollar = new THREE.Mesh(
    new THREE.BoxGeometry(.17 * scale, .055 * scale, .11 * scale),
    magentaMat,
  )
  plugCollar.position.y = -.13 * scale
  plug.add(plugCollar)

  plug.position.y = SHAFT_TOP + .13 * scale + .055 * scale
  staff.add(plug)

  const glowRing = new THREE.Mesh(
    new THREE.TorusGeometry(.30, .055, 6, torusSegs),
    new THREE.MeshBasicMaterial({ color: '#22d3ee', transparent: true, opacity: .80, depthWrite: false }),
  )
  glowRing.rotation.x = Math.PI / 2
  glowRing.position.set(0, SHAFT_BOT + .22 * scale, 0)
  staff.add(glowRing)

  const glowRing2 = new THREE.Mesh(
    new THREE.TorusGeometry(.20, .040, 6, Math.max(12, torusSegs - 4)),
    new THREE.MeshBasicMaterial({ color: '#d946ef', transparent: true, opacity: .70, depthWrite: false }),
  )
  glowRing2.rotation.x = Math.PI / 2
  glowRing2.position.set(0, SHAFT_BOT + SHAFT_H * .55, 0)
  staff.add(glowRing2)

  parent.add(staff)
  return { staff, cyanRing: glowRing, magentaRing: glowRing2 }
}
