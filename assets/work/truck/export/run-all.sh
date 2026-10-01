#!/usr/bin/env sh
# Re-exports and encodes every tier (Blender export -> KTX2 + Meshopt -> public/).
set -e
cd "$(dirname "$0")/../../../.."
B="/c/Users/Hp/Tools/blender-4.5.14-windows-x64/blender.exe"
for t in high medium low; do
  "$B" -b assets/work/truck/vehicle_livery.blend --python tools/blender/export_web.py -- $t assets/work/truck/export/$t 2>&1 | grep -E "EXPORTED|TRUCK MAT|EMISSION|Error|Traceback" || true
  for r in tractor trailer; do
    node tools/encode-vehicle-web.mjs assets/work/truck/export/$t/bsr-$r-$t.glb public/assets/models/truck/bsr-$r-$t.glb
  done
done
