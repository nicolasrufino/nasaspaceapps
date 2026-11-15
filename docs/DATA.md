# NASA resources: what they are and how we use them

## Our slice of Mars

We do not simulate the whole planet. We build **one slice: about 2 km × 2 km of lower Mount Sharp, in Gale crater**, along the stretch where Curiosity studied the boxwork ridges in 2025.

- **Why this slice:**
  - NASA's challenge uses it as its example.
  - NASA's resource list includes Curiosity's route map of this area.
  - USGS already publishes detailed terrain and images for Curiosity's area.
  - Curiosity measured the radiation and weather here and photographed the ground.
- **Two resolutions of the same box:**
  - A coarse "orbit view" of about 8 m per cell (256 × 256 cells): the map before the helicopter flies.
  - The full 1 m terrain and 25 cm images: what the helicopter "reveals".
- **What the box must contain** (Person 3 picks it in Mars Trek):
  - boxwork ridges (the science);
  - at least one sand patch and one slope over 15° (the hazards);
  - a rock field that is hard to see at 8 m (the helicopter's moment).

## The five resources NASA listed for this challenge

| Resource | What it is, in plain words | Useful for | How we use it | Verdict |
|---|---|---|---|---|
| [**Mars Trek**](https://trek.nasa.gov/mars/) (JPL) | A free web map of all of Mars where you can stack hundreds of NASA data layers, view them in 3D and download them. It has APIs | Finding a place, comparing layers, downloading base maps | **Pick our slice** and check what each layer shows there. Download context layers (the 5 m CTX image mosaic, elevation). Screenshots of the site for the pitch | **Use.** Our scouting tool for the site |
| [**USGS-NASA Planetary Geologic Mapping**](https://astrogeology-usgs.hub.arcgis.com/pages/interactive-maps-mars) | Official geologic maps: which rock unit is where, drawn by planetary geologists | Science targets (which rocks are where) | The global map is too coarse for one walk (regional scale), so we use it for context. For walk scale we use the **detailed map of lower Mount Sharp** made from Curiosity's mission data (below). The same USGS Astrogeology site also hosts our core terrain data | **Use**, with the detailed local map |
| [**Curiosity's proposed route up Mount Sharp**](https://science.nasa.gov/resource/curiositys-proposed-path-up-mount-sharp/) | NASA's annotated map of the rover's planned path, with labelled regions (clay-bearing unit, sulfate-bearing unit and others) | Shows what a good route map looks like; names the science regions | **The model for our route view.** Its labelled regions become our science targets. **A benchmark:** we compare our walking route with the rover's path in the same place | **Use** |
| [**NASA Worldview**](https://worldview.earthdata.nasa.gov/) | NASA's viewer for **Earth** satellite images | Earth science, not Mars | **Not used.** It has no Mars data. We say so rather than force it in | **Don't use** |
| [**Perseverance raw images**](https://mars.nasa.gov/mars2020/multimedia/raw-images/) | Over a million photos from Perseverance's cameras, at Jezero crater | Seeing the ground the way a rover (or astronaut) would | Our slice is in Gale, so **stop previews use Curiosity's raw images** (the same NASA gallery for the other rover). Perseverance images become a **fair test of our ground classifier**: trained on one rover's camera, tested on another's. If the team picks Jezero instead, they become the stop photos | **Use**, for testing |

## What we add ourselves, and why

| Data | Where from | What it does in our map |
|---|---|---|
| **Gale merged terrain model, 1 m** | [USGS Astrogeology](https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m) (built from HiRISE) | Slopes for walking cost and the slope limit; the "helicopter reveal" terrain |
| **Gale merged image mosaic, 25 cm** | [USGS Astrogeology](https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_orthophoto_mosaic_25cm) (HiRISE) | The "helicopter reveal" image; rock detection from shadows |
| **Detailed geologic map of lower Mount Sharp** | [Fraeman et al. 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5101845), from Curiosity's mission data | Rock units at walk scale; science targets |
| **THEMIS thermal inertia** | Mars Odyssey (NASA PDS) | Where the ground is loose sand or dust |
| **CRISM minerals** | Mars Reconnaissance Orbiter (NASA PDS) | Where water-related minerals point to science targets |
| **Curiosity raw images** | [NASA raw image gallery](https://mars.nasa.gov/msl/multimedia/raw-images/) | What each stop looks like from the ground |
| **Curiosity RAD and REMS** | NASA PDS | Radiation dose and weather measured in this crater |
| **DONKI** | [NASA CCMC](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | Solar storm alerts for the shelter warning |
| **AI4Mars** | NASA / JPL | Labels (soil, bedrock, sand, big rock) to train the ground classifier |

## The box we chose (D1, done)

- **Centre** −4.800° N, 137.383° E; **2048 × 2048 m** (lat −4.8173..−4.7827, lon 137.3657..137.4003), equirectangular Mars sphere (r = 3,396,190 m), same grid as the USGS mosaics. Full georeferencing in `data/raw/gale/slice.json` (made by `data/pipeline/cut_slice.py`).
- **Why here:** it holds Curiosity's 2025 boxwork route (sols ~4480–4900: the Altadena, Valle de la Luna and Nevado Sajama drill sites, the ramp and the overlook), buttes with slopes over 25°, dark sand in the hollows, and blocky ground that only shows at 1 m.
- **Files:** USGS 1 m DEM ([MSL_Gale_DEM_Mosaic_1m_v3.tif](https://planetarymaps.usgs.gov/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif)) and 25 cm HiRISE colour ([MSL_Gale_HiRISE-LRGB_78quads_sharp_cog.tif](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_HiRISE-LRGB_78quads_sharp_cog.tif)); the lossless greyscale 25 cm mosaic also works (`--ortho gray`, ~1.5 GB read). Only the box is read; nothing large goes in Git.
- **Rebuild:** `pip install -r data/pipeline/requirements-gdal.txt`, then `python3 data/pipeline/cut_slice.py --lat -4.800 --lon 137.383 --ortho color` , `python3 data/pipeline/make_gale.py`, `python3 data/pipeline/add_d6_layers.py`, `python3 data/pipeline/terrain_1m.py` and `python3 data/pipeline/scout_plan.py data/worlds/gale` → `data/worlds/gale/` (open the app with `?world=gale`; add `&flags=drone_scout` for the helicopter).
- **3D tiles (hosted on Azure Blob, `world.json` `detail_tiles`):** `python3 data/pipeline/make_tiles.py` cuts the 1 m terrain and 25 cm HiRISE colour into 256 m tiles plus three coarser zoom levels (`L1`–`L3`: 2, 4, 8 m), so the app loads coarse first and sharpens as you zoom (Google Earth style). It also writes `overview.jpg`, the whole box in HiRISE colour at 1 m/px (2048 px, north up), linked from `world.json` `detail_tiles.overview`. `python3 data/pipeline/make_context.py` adds horizon rings around the box: 30 km at 32 m from the USGS Gale merged DEM (HiRISE colour where covered, else Mars-tinted shaded relief) and 240 km at 463 m from MGS MOLA (crater rim and Mount Sharp). Upload with `data/pipeline/upload_tiles.sh`.
- **Reviewed rocks for the map:** `python3 data/pipeline/reviewed_rocks.py` → `reviewed_rocks.json` (the 23 human-accepted ROSCO rocks from `ml/exports/rocks.json`, placed in the app frame) for the Hazards view.
- **Accuracy and 3D overlay** (need `data/raw/gale`): `python3 data/pipeline/check_accuracy.py` → `validation.json` (our terrain vs Curiosity's elevations at its drive waypoints, NASA/JPL MSL traverse: 148 waypoints, 0.12 m RMSE on the 1 m terrain, 0.33 m on the 8 m grid, after removing the mean offset). `python3 data/pipeline/topo_overlay.py` → `route_3d.json` (the route on the 1 m terrain, one point per metre, in the detail-tile frame) and `crossings_blocked.json` (crossings the 8 m map allows but the 1 m check blocks, with the reason: ledge, steep or both). Extra files, not part of the world contract; for the 3D view and the pitch. `python3 data/pipeline/navcam_compare.py` renders our 1 m terrain from Curiosity's own Navcam camera models (sol 4611 noon panorama, 8 frames) and saves the photo/render pairs to `docs/validation/navcam_sol4611.jpg`; the edge-match score in `validation.json` peaks with the render unturned (0°), so the terrain and the camera line up.
- **Note:** the 256 m rock-review test patch at −4.720°, 137.375° E is about 5 km north of this box, outside it.

## How the data flows

1. **Mars Trek:** choose the box.
2. **USGS 1 m terrain and 25 cm images:** cut the box. Make an 8 m "orbit view" and keep the full resolution for the helicopter.
3. **Layers:** THEMIS (sand), CRISM and the local geologic map (science), slope (from terrain), rocks (from image shadows).
4. **Targets:** the boxwork ridges and the regions named on Curiosity's route map.
5. **Route:** plan on the orbit view, then re-plan after the helicopter reveals detail.
6. **Stops:** Curiosity raw images near each target.
7. **Safety:** RAD dose, REMS weather, DONKI storms.
8. **Ground truth:** the classifier, trained on AI4Mars and tested on Perseverance images.
