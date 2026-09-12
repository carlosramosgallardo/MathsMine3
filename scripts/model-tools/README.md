# Model derivatives (runtime + retro tiers)

Run from the repository root:

```sh
npm ci --prefix scripts/model-tools
node scripts/model-tools/optimize.mjs
npm test
```

This offline tool uses [glTF Transform](https://gltf-transform.dev/) and Meshoptimizer. From every original in `assets/model-sources/` (outside the public web directory) it generates two derivatives in `public/models/` plus `report.json`. No optimizer or decoder is added to the application bundle: the outputs only use `EXT_texture_webp` (WebP is supported by the project's browser targets and Android WebView) and extensions three.js's `GLTFLoader` handles natively.

| Tier | Consumer | Cut | Textures |
| --- | --- | --- | --- |
| `.runtime.glb` | Home carousel | error cap 0.001 dominates; ratio only bites where silhouette/UV seams survive | 1024² WebP q85 |
| `.retro.glb` | Mining (all five maps) | error cap 0.02 so the ratio lands near 6–15% of source triangles (gentler on small props) | 512² WebP q80 |

Both tiers render identically (same material factories, smooth normals, linear mipmapped filtering); retro is only lighter. Mining's 768×480 framebuffer pixelates the whole scene uniformly, so the models need no nearest-filter or flat-shading treatment — that was tried and read as shimmer and facets on scanned faces.

Both tiers keep node hierarchies, names, skin joints, material boundaries and animation data: rigid limb animation and hand docking look nodes up by name, so do not flatten/join. `simplify` runs with `cleanup:false` for that reason (its own `prune` would drop named leaf nodes); the tool then compacts the surviving primitives and prunes **accessors only**, which is what keeps the pre-simplify vertex data from riding along as dead binary.

In Mining the retro tier lands on top of the geometry-only stand-ins in `lib/mining-retro-props.js`: the voxel figure/car/panels show immediately, the pixel-art model replaces them when it streams, and they stay if it never does. `lib/runtime-model-url.js` is the single list of names both tiers are generated from and tested against.

Review figures at close range, walking, attacking and mounted after regeneration — in both Home and Mining. Unit tests check that every derivative of both tiers exists, preserves names/joints/clip counts and that retro is the lighter one; they do not replace visual inspection. `report.json` records file sizes and triangle counts per tier, not FPS measurements.
