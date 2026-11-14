#!/usr/bin/env bash
# Repo hygiene, run by the "ci" job and by hand before a PR: ./scripts/check-hygiene.sh
# Fails on: files over 5 MB (ONNX in ml/exports/ may be 25 MB), model weights or datasets anywhere,
# ONNX outside ml/exports/, world layers (*.f32, *.u8) outside data/worlds/, and .env files.
# Checks the committed tree (HEAD), so commit first. Big data lives in data/raw/, ml/data/, ml/runs/ (git-ignored).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
shopt -s nocasematch
mb=$((1024 * 1024))
bad=0
flag() { echo "::error file=$1::$1: $2"; bad=1; }

# ls-tree -l: "<mode> <type> <sha> <size>\t<path>"
while IFS=$'\t' read -r meta path; do
  size=${meta##* }
  [ "$size" = "-" ] && continue # submodule
  limit=$((5 * mb))
  case "$path" in
    ml/exports/*.onnx) limit=$((25 * mb)) ;;
    *.onnx) flag "$path" "ONNX models go in ml/exports/" ;;
    data/worlds/*.f32 | data/worlds/*.u8) ;;
    *.f32 | *.u8) flag "$path" "world layers go in data/worlds/<name>/" ;;
    *.pt | *.pth | *.ckpt | *.safetensors | *.h5 | *.keras | *.pb | *.tflite | *.pkl | *.pickle | *.joblib | \
      *.npy | *.npz | *.parquet | *.tfrecord | *.hdf5 | *.nc | \
      *.tif | *.tiff | *.jp2 | *.img | *.lbl | *.cub | \
      *.zip | *.tar | *.tgz | *.gz | *.7z | *.rar)
      flag "$path" "weights, datasets and raw downloads are git-ignored (data/raw/, ml/data/, ml/runs/); export ONNX to ml/exports/" ;;
    .env | */.env | .env.* | */.env.*)
      case "$path" in *.example | *.sample | *.template) ;; *) flag "$path" "secrets go in an untracked .env" ;; esac ;;
  esac
  if [ "$size" -gt "$limit" ]; then
    flag "$path" "$((size * 10 / mb / 10)).$((size * 10 / mb % 10)) MB is over the $((limit / mb)) MB limit"
  fi
done < <(git ls-tree -r -l --full-tree HEAD)

[ "$bad" = 0 ] && echo "hygiene ok: no big files, weights, datasets or .env in the tree"
exit "$bad"
