# 3D models (ticket A1)

All three are NASA models from NASA 3D Resources, which NASA publishes "free and without copyright"
(usage guidelines: https://www.nasa.gov/nasa-brand-center/images-and-media). Each was made smaller with
`npx @gltf-transform/cli@4 optimize in.glb out.glb --compress false --texture-compress webp --texture-size 1024 --join false --flatten false`
(the Ingenuity file also with `--simplify false`, so its rotor nodes stay separate).

| File | What | Source | Credit | Size in the app |
|---|---|---|---|---|
| `ingenuity.glb` | Mars Ingenuity Helicopter | https://science.nasa.gov/resource/mars-ingenuity-helicopter-3d-model/ | NASA/JPL-Caltech | as modelled: rotor span 1.2 m |
| `z2-spacesuit.glb` | Z-2 Spacesuit, NASA's planetary-surface prototype suit | https://science.nasa.gov/3d-resources/z2-spacesuit/ | Model courtesy NASA 3D Resources | scaled to 1.8 m tall |
| `habitat-demonstration-unit.glb` | Habitat Demonstration Unit (part 1), NASA's Deep Space Habitat prototype | https://science.nasa.gov/3d-resources/habitat-demonstration-unit/ | Model courtesy NASA 3D Resources | scaled to 9.7 m long (the model's units read as inches: an estimate) |

Loaded by `app/src/figures.js`. If a file fails to load, the built-in shapes stay.
