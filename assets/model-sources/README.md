# Offline model sources

These source GLBs are inputs to the baking/optimization scripts, not web assets.
They were moved out of `public/models` to stop shipping two copies of each model.
`milei.glb` is the source for `bake-milei-figure-glb.mjs`.

Home still uses the optimized GLBs in `public/models/`. Mining M1–M5 uses
procedural retro figures, vehicles and tools, preserving gameplay pivots and bounds.

Regenerate derivatives from the repository root with:

```sh
npm ci --prefix scripts/model-tools
node scripts/model-tools/optimize.mjs
npm test
```

Model attribution remains in the repository README. These files are excluded
from Vercel uploads by `.vercelignore`.
