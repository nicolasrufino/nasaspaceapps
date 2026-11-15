# Training provenance and the five-metre flight scenario

Current project decision, 2026-11-14: retain the ground-photo classifier and
evaluate small improvements on Curiosity/Gale. Keep the current application
scenario; defer CAPCOM/Foundry (R7). Do not train on Perseverance in this follow-up.

## What was actually trained

- MobileNetV3-Small, pretrained on ImageNet, with frozen visual features and a
  trained four-class head: soil, bedrock, sand, big rock. Contract unknown is a
  fixed reserved logit, not a learned class.
- NASA/JPL **AI4Mars Curiosity NAV ground photographs in Gale crater** and their
  terrain labels, release 0.6. Training uses 1,136 majority-labelled crops.
- The v2 experiment changes the classifier head only. Its recorded promotion
  gates fail, so v1 remains the published model. The old 159-patch test is now a
  regression set; a separate 302-patch expert test provides additional evidence.
- No Ingenuity photographs were used to train or evaluate these classifiers.
  The historical Perseverance result is a transfer test, not training data.

## What the five-metre statement means

The user proposes a future helicopter scouting at approximately **5 m above the
ground**. This is a **scenario assumption**, not the acquisition altitude of the
training images, a validated camera configuration, or a measured app flight
parameter. No flight height or rendering code is changed by this note.

A camera on a rover and a camera on a low-flying helicopter can have different
viewing angles, resolution, optics and motion blur. Similar height does not make
their images equivalent. Aerial performance would require images and labels from
that viewing configuration, kept separate for evaluation.

## Boundaries for the map and pitch

The training source is Gale broadly; we have not established that these photos
depict Luca's exact 2 km by 2 km target sector. Do not claim site-specific ground
validation or describe the training source as "Ingenuity at five metres".

The classifier gives a majority terrain type for one crop. It does not produce
pixel segmentation, rock heights, slopes, topography or a 3D reconstruction.
The current map uses NASA orbital terrain products; the simulated scout reveals
stored HiRISE/world layers. This classifier did not generate R5's route inputs.

Supported pitch wording: **"A Curiosity/Gale ground-image classifier, evaluated
on held-out expert-labelled crops. A proposed five-metre scout flight would need
its own aerial validation."** Neither the 93.1% original result nor the 91.1%
additional result establishes 95% reliability, obstacle safety or big-rock recall.

Evidence: [original metrics](../exports/terrain_cls.json),
[follow-up experiment](gale_experiment_v2.json),
[fresh source manifest](gale_fresh_manifest_v2.json),
[R5 route measurements](../pitch_metrics/PITCH_NUMBERS.md).
