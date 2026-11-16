"""Predeclared v2 protocol (written before the fresh Perseverance test was downloaded).

Why v2: every Curiosity training image is greyscale (R = G = B) and every Perseverance image is
colour. On the retired 197-patch transfer set, grey input alone gained +7.6 points (paired 95% CI
+3.3 to +12.7) and adding 100 Perseverance training images reached 71.6% (MODEL-STUDY, 2026-11-15).
That set has now been looked at, so v2 is judged only on a fresh, sol-blocked Perseverance test.
"""

ID = "VESTA-terrain-v2"
SEED = 2026
BLOCK_SOLS = 10            # Perseverance frames are grouped in 10-sol blocks
TEST_BLOCKS = 7            # 7 of the 28 labelled blocks, lowest SHA-256 of f"{ID}:block:{b}"
TEST_FRAMES = 60           # fresh test frames, ranked by SHA-256 inside the test blocks
NEW_TRAIN_FRAMES = 120     # new training frames from the other blocks
GREY = (0.299, 0.587, 0.114)  # ITU-R 601 luminance, applied inside the ONNX graph

# One candidate, no alternatives: grey input + the v1 head recipe (train.py: Adam lr 0.01,
# weight decay 0.001, 200 full-batch epochs, inverse class-frequency weights) refitted on
# Curiosity train + every Perseverance training patch outside the test blocks.

GATES = {
    "fresh_perseverance_gain": "paired image-bootstrap 95% CI lower bound > 0 (v2 vs v1)",
    "fresh_perseverance_balanced": "balanced accuracy over supported classes improves",
    "curiosity_expert_v1_drop_points_max": 2.0,   # 159-patch historical test
    "curiosity_expert_v2_drop_points_max": 2.0,   # 302-patch fresh expert sample
}
BOOTSTRAP = 4000
