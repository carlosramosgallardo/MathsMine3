# Runtime model derivatives

Run from the repository root:

```sh
npm ci --prefix scripts/model-tools
node scripts/model-tools/optimize.mjs
npm test
```

This offline tool uses [glTF Transform](https://gltf-transform.dev/) and Meshoptimizer. It generates the `.runtime.glb` files and `report.json` from the original GLBs. No optimizer or decoder is added to the application bundle. Images use WebP, supported by the project's browser targets and Android WebView.

The simplifier has a relative error ceiling of 0.001; its target ratio is subordinate to that ceiling. Node hierarchies, names, skin joints, material boundaries and animation data remain available to the existing animation/docking code. Do not flatten/join the nodes: rigid limb animation depends on them. The original GLBs live in `assets/model-sources/`, outside the public web directory, and remain the input for every run. Only optimized derivatives are served for Home; Mining uses geometric retro props and does not fetch these GLBs.

Review figures at close range, walking, attacking and mounted after regeneration. Unit tests check names/joints and model URL coverage; they do not replace visual inspection. `report.json` records file sizes and triangle counts, not FPS measurements.
