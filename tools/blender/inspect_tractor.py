"""Inspect the source tractor FBX in Blender (read-only on the source).

blender -b --factory-startup --python tools/blender/inspect_tractor.py -- <fbx> [<report.json>]

Reports scene units, objects, materials (base colours), and loose parts
per object with their world bounds — raised logos/badges are loose islands.
"""

import json
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
source = argv[0]
report_path = argv[1] if len(argv) > 1 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=source)
bpy.context.view_layer.update()


def world_bounds(obj, verts=None):
    mw = obj.matrix_world
    pts = [mw @ (v.co if hasattr(v, "co") else v) for v in (verts if verts is not None else obj.data.vertices)]
    if not pts:
        return None
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return [round(c, 4) for c in lo] + [round(c, 4) for c in hi]


report = {"unit_scale": bpy.context.scene.unit_settings.scale_length, "objects": [], "materials": {}}
for mat in bpy.data.materials:
    color = None
    if mat.use_nodes:
        bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf:
            color = [round(c, 3) for c in bsdf.inputs["Base Color"].default_value]
    report["materials"][mat.name] = {"color": color, "diffuse": [round(c, 3) for c in mat.diffuse_color]}

for obj in bpy.context.scene.objects:
    entry = {"name": obj.name, "type": obj.type, "parent": obj.parent.name if obj.parent else None,
             "location": [round(c, 4) for c in obj.matrix_world.translation]}
    if obj.type == "MESH":
        mesh = obj.data
        entry["tris"] = sum(len(p.vertices) - 2 for p in mesh.polygons)
        entry["bounds"] = world_bounds(obj)
        entry["materials"] = [s.material.name if s.material else None for s in obj.material_slots]
        # Loose parts (islands) via vertex adjacency.
        parent = list(range(len(mesh.vertices)))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        for e in mesh.edges:
            a, b = find(e.vertices[0]), find(e.vertices[1])
            if a != b:
                parent[a] = b
        islands = {}
        for p in mesh.polygons:
            root = find(p.vertices[0])
            isl = islands.setdefault(root, {"faces": 0, "tris": 0, "verts": set(), "mats": set()})
            isl["faces"] += 1
            isl["tris"] += len(p.vertices) - 2
            isl["verts"].update(p.vertices)
            isl["mats"].add(p.material_index)
        parts = []
        for isl in islands.values():
            b = world_bounds(obj, [mesh.vertices[i] for i in isl["verts"]])
            parts.append({"tris": isl["tris"], "bounds": b,
                          "mats": sorted(entry["materials"][m] or "?" for m in isl["mats"] if m < len(entry["materials"]))})
        entry["islands"] = len(parts)
        entry["parts"] = sorted(parts, key=lambda p: -p["tris"])
    report["objects"].append(entry)

text = json.dumps(report, indent=1)
if report_path:
    with open(report_path, "w", encoding="utf-8") as fh:
        fh.write(text)
print("objects:", len(report["objects"]), "unit_scale:", report["unit_scale"])
