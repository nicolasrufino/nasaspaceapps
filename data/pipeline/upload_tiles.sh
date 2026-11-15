#!/usr/bin/env bash
# Host the detail tiles (make_tiles.py) on Azure Blob Storage, public read, CORS for the app's origins.
# Run once by whoever owns the team's Azure subscription (the Static Web App lives there):
#
#   az login
#   python3 data/pipeline/make_tiles.py                      # -> data/raw/gale/tiles/ (~28 MB, git-ignored)
#   RG=<resource group of the Static Web App> bash data/pipeline/upload_tiles.sh
#
# Prints the base URL; then:  python3 data/pipeline/make_tiles.py --base-url <that URL>  (writes world.json detail_tiles)
# Cost: Standard_LRS, ~30 MB stored, a few GB served during the hackathon: cents.
set -euo pipefail
: "${RG:?set RG to the resource group (az group list -o table)}"
ACCOUNT="${ACCOUNT:-marsmap$(az account show --query id -o tsv | tr -d '-' | cut -c1-10)}"  # 3-24 lowercase letters/digits
LOCATION="${LOCATION:-$(az group show -n "$RG" --query location -o tsv)}"
CONTAINER="${CONTAINER:-tiles}"
SRC="${SRC:-data/raw/gale/tiles}"
ORIGINS="${ORIGINS:-https://nasa.nicolasrufino.com https://*.azurestaticapps.net http://localhost:5173 http://127.0.0.1:5173}"

[ -f "$SRC/tiles.json" ] || { echo "no $SRC/tiles.json: run python3 data/pipeline/make_tiles.py first" >&2; exit 1; }

az storage account show -n "$ACCOUNT" -g "$RG" >/dev/null 2>&1 || \
  az storage account create -n "$ACCOUNT" -g "$RG" -l "$LOCATION" --sku Standard_LRS --kind StorageV2 \
    --min-tls-version TLS1_2 --allow-blob-public-access true -o none
KEY=$(az storage account keys list -n "$ACCOUNT" -g "$RG" --query '[0].value' -o tsv)
az storage container create -n "$CONTAINER" --account-name "$ACCOUNT" --account-key "$KEY" --public-access blob -o none
# Browsers fetch the tiles from another origin: allow GET from the app only.
az storage cors clear --services b --account-name "$ACCOUNT" --account-key "$KEY"
az storage cors add --services b --methods GET HEAD --origins $ORIGINS --allowed-headers '*' --exposed-headers '*' \
  --max-age 3600 --account-name "$ACCOUNT" --account-key "$KEY"
az storage blob upload-batch -d "$CONTAINER" --destination-path gale -s "$SRC" --overwrite \
  --account-name "$ACCOUNT" --account-key "$KEY" --content-cache-control "public, max-age=86400" -o none
URL="https://$ACCOUNT.blob.core.windows.net/$CONTAINER/gale"
curl -sf "$URL/tiles.json" >/dev/null && echo "uploaded: $URL" || { echo "upload done but $URL/tiles.json is not readable" >&2; exit 1; }
echo "next: python3 data/pipeline/make_tiles.py --base-url $URL"
