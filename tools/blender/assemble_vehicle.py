"""Couples the cleaned tractor and the curtain-side trailer; checks the coupling.

blender -b <tractor_clean.blend> --python tools/blender/assemble_vehicle.py -- <trailer.blend> <out.blend>

The trailer's "Trailer" node is parented to the tractor's Hitch_FifthWheel with
no offset (Trailer_Root = kingpin on the coupling plane). Checks, by real mesh
intersection (BVH), not bounding boxes:
  - tractor vs trailer at 0° and ±25° articulation (rotation about the kingpin);
  - front wheels at ±30° steer vs the tractor body/chassis.
"""

import math
import sys

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1 :]
TRAILER_BLEND, OUT = argv[0], argv[1]
scene = bpy.context.scene

with bpy.data.libraries.load(TRAILER_BLEND, link=False) as (src, dst):
    dst.objects = list(src.objects)
for o in dst.objects:
    scene.collection.objects.link(o)

# Appending duplicates same-named materials ("MAT_Rubber.001"): merge each into the
# tractor's slot so the combination shares one set of contract materials.
for mat in list(bpy.data.materials):
    base, _, suffix = mat.name.rpartition(".")
    if suffix.isdigit() and base in bpy.data.materials:
        mat.user_remap(bpy.data.materials[base])
        bpy.data.materials.remove(mat)

hitch = bpy.data.objects["Hitch_FifthWheel"]
trailer = bpy.data.objects["Trailer"]
trailer.parent = hitch
trailer.location = (0, 0, 0)
trailer.rotation_euler = (0, 0, 0)
bpy.context.view_layer.update()

truck_root = bpy.data.objects.new("TruckRoot", None)
scene.collection.objects.link(truck_root)
bpy.data.objects["Tractor"].parent = truck_root
bpy.context.view_layer.update()


def descendants(root):
    out = []
    stack = [root]
    while stack:
        o = stack.pop()
        if o.type == "MESH":
            out.append(o)
        stack.extend(o.children)
    return out


def bvh(objs):
    verts, polys, owner = [], [], []
    centres = []
    for o in objs:
        base = len(verts)
        verts += [o.matrix_world @ v.co for v in o.data.vertices]
        for p in o.data.polygons:
            polys.append([base + i for i in p.vertices])
            owner.append(o.name)
            centres.append(o.matrix_world @ p.center)
    return BVHTree.FromPolygons(verts, polys), owner, centres


def clashes(a_objs, b_objs):
    (a, a_owner, a_c), (b, b_owner, b_c) = bvh(a_objs), bvh(b_objs)
    pairs = {}
    for i, j in a.overlap(b):
        key = f"{a_owner[i]} x {b_owner[j]}"
        entry = pairs.setdefault(key, {"n": 0, "lo": None, "hi": None})
        entry["n"] += 1
        c = b_c[j]
        entry["lo"] = c.copy() if entry["lo"] is None else Vector(map(min, entry["lo"], c))
        entry["hi"] = c.copy() if entry["hi"] is None else Vector(map(max, entry["hi"], c))
    return {k: f"{v['n']} pairs, region x {v['lo'].x:.2f}..{v['hi'].x:.2f} y {v['lo'].y:.2f}..{v['hi'].y:.2f} z {v['lo'].z:.2f}..{v['hi'].z:.2f}" for k, v in pairs.items()}


tractor = bpy.data.objects["Tractor"]
trailer_root = bpy.data.objects["Trailer_Root"]
trailer_meshes = descendants(trailer)
tractor_meshes = [o for o in descendants(tractor) if o not in trailer_meshes and o.name != "Fifth_Wheel_Plate"]
results = {}
for angle in (0, 25, -25):
    trailer_root.rotation_euler = (0, 0, math.radians(angle))
    bpy.context.view_layer.update()
    results[f"articulation {angle:+d}°"] = clashes(tractor_meshes, trailer_meshes)
trailer_root.rotation_euler = (0, 0, 0)

# Front steering clearance (wheel vs body/chassis, not vs itself).
for angle in (15, -15, 30, -30):
    for side in ("FL", "FR"):
        bpy.data.objects[f"Wheel_{side}"].rotation_euler = (0, 0, math.radians(angle))
    bpy.context.view_layer.update()
    wheels = [bpy.data.objects[f"Wheel_{s}_Mesh"] for s in ("FL", "FR")]
    others = [o for o in tractor_meshes if o not in wheels]
    results[f"steer {angle:+d}°"] = clashes(wheels, others)
for side in ("FL", "FR"):
    bpy.data.objects[f"Wheel_{side}"].rotation_euler = (0, 0, 0)
bpy.context.view_layer.update()

# Coupled geometry report.
def box(objs):
    pts = [o.matrix_world @ v.co for o in objs for v in o.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


all_meshes = tractor_meshes + trailer_meshes
lo, hi = box(all_meshes)
cab_lo, cab_hi = box([bpy.data.objects["Tractor_Body_Mesh"]])
tr_lo, tr_hi = box([bpy.data.objects["Trailer_Body"]])
kingpin = trailer_root.matrix_world.translation
print("COUPLING kingpin at", tuple(round(c, 3) for c in kingpin), "hitch at", tuple(round(c, 3) for c in hitch.matrix_world.translation))
print(f"GAP cab back → trailer front: {tr_lo.y - cab_hi.y:.3f} m")
print(f"COMBINATION length {hi.y - lo.y:.3f} m, height {hi.z:.3f} m, width {hi.x - lo.x:.3f} m, ground {lo.z:.3f}")
for k, v in results.items():
    print("CHECK", k, v or "clear")
print("TRIANGLES", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in all_meshes))
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("SAVED", OUT)
