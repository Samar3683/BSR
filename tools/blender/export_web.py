"""Exports the approved livery vehicle as per-tier tractor + trailer GLBs (pre-compression).

blender -b assets/work/truck/vehicle_livery.blend --python tools/blender/export_web.py -- <tier> <out_dir>

Writes <out_dir>/bsr-tractor-<tier>.glb and bsr-trailer-<tier>.glb (PNG textures, no
compression); tools/encode-vehicle-web.mjs then converts textures to KTX2 and geometry
to Meshopt. Per tier:
  - material slots merged to the tier's truck-material budget (contract slots kept);
  - static meshes joined per parent (fewer draw calls); wheel, steer, hitch, kingpin
    and livery nodes stay separate;
  - lower tiers: decimated trailer detail and smaller textures.
The review-only "TRASPORTI" descriptor (disabled by default) is not exported.
"""

import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :]
TIER, OUT = argv[0], os.path.abspath(argv[1])
os.makedirs(OUT, exist_ok=True)

# Material merges per tier (source slot -> kept slot). Head/marker/tail/brake stay
# separate: the runtime drives each one's emission.
MERGE = {"MAT_Box_Panel": "MAT_Paint_Body", "MAT_Metal_Dark": "MAT_Paint_Graphite"}
if TIER in ("medium", "low"):
    MERGE |= {
        "MAT_Plastic_Grille": "MAT_Paint_Graphite",
        "MAT_Livery_Accent_Green": "MAT_Livery_Mark",  # accents become vertex colours of the print
        "MAT_Livery_Accent_Red": "MAT_Livery_Mark",
    }
if TIER == "low":
    MERGE |= {"MAT_Metal_Steel": "MAT_Reflective"}  # light-grey rims
PRINT_BY_VERTEX_COLOUR = TIER in ("medium", "low")

# Decimation ratios (object name -> ratio) and texture sizes per tier.
DECIMATE = {
    "high": {},
    "medium": {"Livery_Wordmark": 0.3, "Wheel_T": 0.6},
    "low": {"Livery_Wordmark": 0.12, "Trailer_Curtain": 0.4, "Wheel_T": 0.35, "Wheel_R": 0.7, "Wheel_F": 0.7},
}[TIER]
TEXTURE_SIZE = {
    "high": {},
    "medium": {"curtain_normal_2k": 1024, "curtain_orm_1k": 512, "tyre_normal_1k": 512},
    "low": {"curtain_normal_2k": 512, "curtain_orm_1k": 256, "tyre_normal_1k": 256},
}[TIER]

objects = bpy.data.objects
objects.remove(objects["Livery_Descriptor"], do_unlink=True)

# Light lenses: glTF bakes emission strength into emissiveFactor, so the "off" review
# state (strength 0) would export black and the runtime's emissiveIntensity could
# never light them. Export the lens colour at strength 1; the runtime drives it.
for mat in bpy.data.materials:
    if mat.name.startswith("MAT_Light_") and mat.use_nodes:
        bsdf = mat.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Emission Strength"].default_value = 1.0
        print("EMISSION", mat.name, tuple(round(c, 3) for c in bsdf.inputs["Emission Color"].default_value[:3]))
# Glass: a touch denser so the lit cab interior never tints the windscreen.
bpy.data.materials["MAT_Glass"].node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = 0.88


def assign_windscreen():
    """The source models the windscreen as one opaque dark-plastic island (the cab front
    above the grille, facing forward). Under the warm dock flood it reads as brown
    plastic; as MAT_Glass it reflects the sky and shows the modelled interior."""
    import bmesh
    from mathutils import Vector

    o = objects["Tractor_Body_Mesh"]
    names = [s.material.name if s.material else None for s in o.material_slots]
    grille = {i for i, n in enumerate(names) if n == "MAT_Plastic_Grille"}
    if "MAT_Glass" not in names:
        o.data.materials.append(bpy.data.materials["MAT_Glass"])
        names.append("MAT_Glass")
    glass = names.index("MAT_Glass")
    bm = bmesh.new()
    bm.from_mesh(o.data)
    mw = o.matrix_world
    seen = set()
    for f in bm.faces:
        if f.material_index not in grille or f.index in seen:
            continue
        island, stack = [], [f]
        seen.add(f.index)
        while stack:
            g = stack.pop()
            island.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.material_index in grille and h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        pts = [mw @ v.co for g in island for v in g.verts]
        normal = sum((g.normal * g.calc_area() for g in island), Vector()).normalized()
        if max(p.y for p in pts) < -4.4 and min(p.z for p in pts) > 2.0 and normal.y < -0.9:
            for g in island:
                g.material_index = glass
            print("WINDSCREEN", len(island), "faces -> MAT_Glass")
    bm.to_mesh(o.data)
    bm.free()


assign_windscreen()


def meshes_under(root):
    out, stack = [], [root]
    while stack:
        o = stack.pop()
        if o.type == "MESH":
            out.append(o)
        stack.extend(o.children)
    return out


def ensure_col(obj, colour=(1, 1, 1, 1)):
    attrs = obj.data.color_attributes
    if "Col" not in attrs:
        attrs.new("Col", "FLOAT_COLOR", "POINT")
        for d in attrs["Col"].data:
            d.color = colour
    return attrs["Col"]


def base_colour(name):
    return tuple(bpy.data.materials[name].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value)


# ---------------------------------------------------------------- print colours (medium/low)
if PRINT_BY_VERTEX_COLOUR:
    ink = base_colour("MAT_Livery_Mark")
    for o in objects:
        if o.type != "MESH" or not any(s.material and s.material.name.startswith("MAT_Livery") for s in o.material_slots):
            continue
        col = ensure_col(o)
        me = o.data
        for p in me.polygons:
            mat = o.material_slots[p.material_index].material
            if mat and mat.name.startswith("MAT_Livery"):
                c = ink if mat.name == "MAT_Livery_Mark" else base_colour(mat.name)
                for v in p.vertices:
                    col.data[v].color = c
    mark = bpy.data.materials["MAT_Livery_Mark"]
    nt = mark.node_tree
    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])

# ---------------------------------------------------------------- material merges
for o in objects:
    if o.type != "MESH":
        continue
    for slot in o.material_slots:
        if slot.material and slot.material.name in MERGE:
            slot.material = bpy.data.materials[MERGE[slot.material.name]]
    # Collapse duplicate slots so each material is one primitive.
    me = o.data
    first = {}
    remap = []
    for i, slot in enumerate(o.material_slots):
        key = slot.material.name if slot.material else None
        remap.append(first.setdefault(key, i))
    for p in me.polygons:
        p.material_index = remap[p.material_index]
    with bpy.context.temp_override(object=o, active_object=o):
        bpy.ops.object.material_slot_remove_unused()

# ---------------------------------------------------------------- decimation
for o in objects:
    if o.type != "MESH":
        continue
    ratio = next((r for prefix, r in DECIMATE.items() if o.name.startswith(prefix)), None)
    if ratio:
        if o.data.users > 1:
            o.data = o.data.copy()
        mod = o.modifiers.new("Decimate", "DECIMATE")
        mod.ratio = ratio
        with bpy.context.temp_override(object=o, active_object=o):
            bpy.ops.object.modifier_apply(modifier=mod.name)

# ---------------------------------------------------------------- textures
for name, size in TEXTURE_SIZE.items():
    im = bpy.data.images[name]
    im.scale(size, size)
    im.filepath_raw = os.path.join(OUT, f"{name}-{TIER}.png")
    im.file_format = "PNG"
    im.save()

# ---------------------------------------------------------------- split + join static meshes
tractor, trailer = objects["Tractor"], objects["Trailer"]
trailer.parent = None
trailer.matrix_world.identity()  # kingpin (Trailer_Root) at the file origin
tractor.parent = None
tractor.matrix_world.identity()
bpy.context.view_layer.update()

KEEP_SEPARATE = ("Wheel_", "Livery_Wordmark", "Livery_Accent")


def join_static(root, into=None):
    groups = {}
    for o in meshes_under(root):
        if o.name.startswith(KEEP_SEPARATE):
            continue
        groups.setdefault(o.parent.name, []).append(o)
    for parent, objs in groups.items():
        if len(objs) < 2:
            continue
        target = objects[into] if into and objects[into] in objs else max(objs, key=lambda o: len(o.data.polygons))
        if any("Col" in o.data.color_attributes for o in objs):
            for o in objs:
                ensure_col(o)  # white where unused, so no primitive is darkened by a zero colour
        with bpy.context.temp_override(active_object=target, selected_editable_objects=objs, object=target):
            bpy.ops.object.join()


join_static(tractor)
join_static(trailer, into="Trailer_Body")


def export(root, path):
    bpy.ops.object.select_all(action="DESELECT")
    stack = [root]
    while stack:
        o = stack.pop()
        o.select_set(True)
        stack.extend(o.children)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_vertex_color="MATERIAL",
        export_image_format="AUTO",
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_animations=False,
        export_draco_mesh_compression_enable=False,
    )
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes_under(root))
    mats = {s.material.name for o in meshes_under(root) for s in o.material_slots if s.material}
    print(f"EXPORTED {os.path.basename(path)} triangles {tris} materials {len(mats)}")
    return mats


m1 = export(tractor, os.path.join(OUT, f"bsr-tractor-{TIER}.glb"))
m2 = export(trailer, os.path.join(OUT, f"bsr-trailer-{TIER}.glb"))
print(f"TRUCK MATERIALS {TIER}: {len(m1 | m2)} {sorted(m1 | m2)}")
