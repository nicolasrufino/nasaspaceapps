# NASA resources: what they are and how we use them

## Our slice of Mars

We do not simulate the whole planet. We build **one slice: about 2 km × 2 km of lower Mount Sharp, in Gale crater**, along the stretch where Curiosity studied the boxwork ridges in 2025.

- **Why this slice:**
  - NASA's challenge uses it as its example.
  - NASA's resource list includes Curiosity's route map of this area.
  - USGS already publishes detailed terrain and images for Curiosity's area.
  - Curiosity measured the radiation and weather here and photographed the ground.
- **Two resolutions of the same box:**
  - A coarse "orbit view" of about 8 m per cell (256 × 256 cells): the map before the drone flies.
  - The full 1 m terrain and 25 cm images: what the drone "reveals".
- **What the box must contain** (Person 3 picks it in Mars Trek):
  - boxwork ridges (the science);
  - at least one sand patch and one slope over 15° (the hazards);
  - a rock field that is hard to see at 8 m (the drone's moment).

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
| **Gale merged terrain model, 1 m** | [USGS Astrogeology](https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_dem_1m) (built from HiRISE) | Slopes for walking cost and the slope limit; the "drone reveal" terrain |
| **Gale merged image mosaic, 25 cm** | [USGS Astrogeology](https://astrogeology.usgs.gov/search/map/mars_msl_gale_merged_orthophoto_mosaic_25cm) (HiRISE) | The "drone reveal" image; rock detection from shadows |
| **Detailed geologic map of lower Mount Sharp** | [Fraeman et al. 2016](https://pmc.ncbi.nlm.nih.gov/articles/PMC5101845), from Curiosity's mission data | Rock units at walk scale; science targets |
| **THEMIS thermal inertia** | Mars Odyssey (NASA PDS) | Where the ground is loose sand or dust |
| **CRISM minerals** | Mars Reconnaissance Orbiter (NASA PDS) | Where water-related minerals point to science targets |
| **Curiosity raw images** | [NASA raw image gallery](https://mars.nasa.gov/msl/multimedia/raw-images/) | What each stop looks like from the ground |
| **Curiosity RAD and REMS** | NASA PDS | Radiation dose and weather measured in this crater |
| **DONKI** | [NASA CCMC](https://ccmc.gsfc.nasa.gov/tools/DONKI/) | Solar storm alerts for the shelter warning |
| **AI4Mars** | NASA / JPL | Labels (soil, bedrock, sand, big rock) to train the ground classifier |

## How the data flows

1. **Mars Trek:** choose the box.
2. **USGS 1 m terrain and 25 cm images:** cut the box. Make an 8 m "orbit view" and keep the full resolution for the drone.
3. **Layers:** THEMIS (sand), CRISM and the local geologic map (science), slope (from terrain), rocks (from image shadows).
4. **Targets:** the boxwork ridges and the regions named on Curiosity's route map.
5. **Route:** plan on the orbit view, then re-plan after the drone reveals detail.
6. **Stops:** Curiosity raw images near each target.
7. **Safety:** RAD dose, REMS weather, DONKI storms.
8. **Ground truth:** the classifier, trained on AI4Mars and tested on Perseverance images.
