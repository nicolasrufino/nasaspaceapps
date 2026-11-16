// The machine-learning models in the product, as one-line "model cards": what it is, what it measured, its limit.
// Figures are copied from the exports named beside each; change them there first, then here.
export const MODELS = {
  // app/scripts/belief-fit.json and app/HOW-IT-WORKS.md section 12
  rockChance: { name: 'Rock-chance model', score: 'AUC 0.73 on a development check with reviewed rocks',
    limit: 'Not calibrated: it ranks ground, it does not give true odds.', what: 'Logistic regression on two terrain features from orbit: slope ratio and 8 m relief.' },
  // ml/exports/rocks.json (review_counts)
  rockReview: { name: 'Rock detections from orbit images', score: '23 of 25 detector proposals confirmed by a person',
    limit: 'Coverage is not complete, so no hit rate is claimed.', what: 'ROSCO detector on a HiRISE image, each proposal checked by a person.' },
  // ml/exports/terrain_cls.json (held_out, perseverance_transfer)
  groundClassifier: { name: 'Ground classifier', score: '92% and 94% on two held-out Curiosity tests; 73% on fresh Perseverance photos',
    limit: 'Not tested on helicopter or phone photos; big rocks are too rare in the tests to score.', what: 'Grey input, MobileNetV3-small features and a trained linear head, on NASA/JPL AI4Mars Curiosity and Perseverance labels; runs in the browser.' },
  scan: { name: 'Scan', score: 'Simulated', limit: 'Rocks come from the stored rock layer (terrain roughness estimate plus the 23 reviewed rocks), not from a live classifier.', what: '' },
}
