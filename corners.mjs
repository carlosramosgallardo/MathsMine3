const m = await import('/home/crg/MathsMine3/lib/mining-map-ambient.js')
for (const mapId of ['2','3','4','5']) {
  const obs = m.getMiningMapAmbientObstacles(mapId)
  const out = []
  for (const [r,c] of [[3,3],[3,51],[51,3],[51,51],[4,4],[50,4],[4,50],[50,50]]) {
    let ring=0; for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++) if(obs.has(`${r+dr},${c+dc}`)) ring++
    out.push(`(${r},${c})${obs.has(`${r},${c}`)?'X':'.'}r${ring}`)
  }
  console.log('M'+mapId, out.join(' '))
}
