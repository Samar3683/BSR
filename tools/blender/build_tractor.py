"""Structural cleanup of the source tractor (MAN TGX, CC BY 4.0 — see assets/source/truck/ATTRIBUTION.md).

blender -b --factory-startup --python tools/blender/build_tractor.py -- <source.fbx> <out.blend>

Works on a fresh import of the untouched source file:
  1. removes explicit branding (MAN wordmark, lion emblem, V8 badges, side lettering, plate text);
  2. straightens the front wheels (authored at −45°), levels them, splits the fused rear pair;
  3. scales to real-world metres (×0.147 from source units) with the origin on the ground
     under the rear axle; front towards −Y in Blender (= +Z in glTF), truck left = +X;
  4. sorts parts into Tractor_Body (cab) and Tractor_Chassis, separates light lenses,
     adds a fifth-wheel plate and the contract nodes and material slots.
Neutral preview materials only (no livery).
"""

import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
SOURCE, OUT = argv[0], argv[1]

SCALE = 0.147  # source units → metres (0.1 m per unit × 1.47 real-size correction)
MAIN = "d75ac7d3-ea99-4386-8004-2b8b4d77a8ed"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SOURCE)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"


def obj(name):
    return bpy.data.objects[name]


# --- 0. Bake object transforms into mesh data (clean, predictable coordinates).
for o in list(scene.objects):
    if o.type == "MESH":
        o.data = o.data.copy()  # never edit shared data blocks in place
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
    else:
        bpy.data.objects.remove(o)
bpy.data.objects.remove(obj("Object_2"))  # empty mesh (0 triangles)


def islands(bm):
    bm.faces.ensure_lookup_table()
    seen, result = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, group = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            group.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        result.append(group)
    return result


def bounds(faces):
    vs = {v for f in faces for v in f.verts}
    xs, ys, zs = [v.co.x for v in vs], [v.co.y for v in vs], [v.co.z for v in vs]
    return min(xs), min(ys), min(zs), max(xs), max(ys), max(zs)


def delete_islands(name, predicate):
    o = obj(name)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    doomed = []
    mats = [s.material.name if s.material else "" for s in o.material_slots]
    for group in islands(bm):
        b = bounds(group)
        names = {mats[f.material_index] if f.material_index < len(mats) else "" for f in group}
        if predicate(b, names, len(group)):
            doomed.extend(group)
    bmesh.ops.delete(bm, geom=list(set(doomed)), context="FACES")
    bm.to_mesh(o.data)
    bm.free()
    return len(doomed)


# --- 1. Branding removal (bounds measured with tools/blender/inspect_tractor.py).
removed = {}
# Grille mesh: MAN letters (z 9.8–10.5), lion emblem + frame (z 9.2–9.8), V8 badge (x 4.6–6.0, z 12.9–13.5).
# The chrome grille bar (z 11.1–11.9) and the washer nubs (z 13.4–13.9, |x| 3.3–4.4) stay.
removed["grille marks"] = delete_islands(
    MAIN + ".002",
    lambda b, m, n: (b[2] > 9.2 and b[5] < 10.5 and -1.6 < b[0] and b[3] < 2.0)
    or (b[0] > 4.6 and b[2] > 12.9 and b[5] < 13.5),
)
# Side-skirt lettering ("V8", "MAN"): the whole mesh.
bpy.data.objects.remove(obj(MAIN + ".016"))
removed["side lettering"] = "mesh removed"
# Plate text ("DevPoly3D"): light islands on the plate; the dark plate backing stays blank.
removed["plate text"] = delete_islands(
    MAIN,
    lambda b, m, n: b[1] < -20.4 and b[0] > -2.0 and b[3] < 2.25 and b[2] > 2.3 and b[5] < 3.4
    and ("Metalic" in m or "Material" in m) and "dark" not in m,
)

# --- 2. Wheels.
def centre_axle(points):
    c = sum(points, Vector()) / len(points)
    return c


def wheel_object(name, verts_filter=None, new_name=None):
    o = obj(name)
    if verts_filter is None:
        o.name = new_name
        return o
    dup = o.copy()
    dup.data = o.data.copy()
    scene.collection.objects.link(dup)
    dup.name = new_name
    bm = bmesh.new()
    bm.from_mesh(dup.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not verts_filter(v.co)], context="VERTS")
    bm.to_mesh(dup.data)
    bm.free()
    return dup


rear = obj("Object_3")
wheel_rl = wheel_object("Object_3", lambda co: co.x > 0, "Wheel_RL_Mesh")
wheel_rr = wheel_object("Object_3", lambda co: co.x < 0, "Wheel_RR_Mesh")
bpy.data.objects.remove(rear)
wheel_fl = wheel_object("Object_3.001", None, "Wheel_FL_Mesh")
wheel_fr = wheel_object("Object_3.002", None, "Wheel_FR_Mesh")

REAR_BOTTOM = 3.122 - 3.558  # rear tyre contact (source units)
for w in (wheel_fl, wheel_fr):
    pts = [v.co.copy() for v in w.data.vertices]
    c = sum(pts, Vector()) / len(pts)
    # Straighten: the axle is authored at −45° about Z; rotate it back onto X.
    w.data.transform(Matrix.Translation(c) @ Matrix.Rotation(math.radians(45), 4, "Z") @ Matrix.Translation(-c))
    # Level: same ground contact as the rear tyres.
    low = min(v.co.z for v in w.data.vertices)
    w.data.transform(Matrix.Translation((0, 0, REAR_BOTTOM - low)))

# --- 3. Scale to metres; origin on the ground under the rear axle.
REAR_AXLE_Y = 11.983
to_metres = Matrix.Scale(SCALE, 4) @ Matrix.Translation((0, -REAR_AXLE_Y, -REAR_BOTTOM))
for o in scene.objects:
    if o.type == "MESH":
        o.data.transform(to_metres)

# --- 4. Materials (neutral preview values; contract slot names).
def principled(name, color, roughness=0.5, metallic=0.0, emission=None, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 0.0
    if alpha < 1:
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
    return m


M = {
    "MAT_Paint_Body": principled("MAT_Paint_Body", (0.84, 0.83, 0.79), 0.35),
    "MAT_Paint_Graphite": principled("MAT_Paint_Graphite", (0.045, 0.048, 0.05), 0.55),
    "MAT_Plastic_Grille": principled("MAT_Plastic_Grille", (0.018, 0.019, 0.02), 0.6),
    "MAT_Glass": principled("MAT_Glass", (0.02, 0.025, 0.03), 0.05, 0.0),
    "MAT_Rubber": principled("MAT_Rubber", (0.02, 0.02, 0.02), 0.85),
    "MAT_Metal_Steel": principled("MAT_Metal_Steel", (0.62, 0.63, 0.64), 0.3, 1.0),
    "MAT_Light_Head": principled("MAT_Light_Head", (0.8, 0.8, 0.78), 0.15, emission=(1, 0.97, 0.9)),
    "MAT_Light_Marker": principled("MAT_Light_Marker", (0.55, 0.35, 0.05), 0.2, emission=(1, 0.7, 0.2)),
    "MAT_Light_Tail": principled("MAT_Light_Tail", (0.35, 0.02, 0.02), 0.2, emission=(0.8, 0.05, 0.05)),
    "MAT_Light_Brake": principled("MAT_Light_Brake", (0.35, 0.02, 0.02), 0.2, emission=(1, 0.05, 0.05)),
}
SOURCE_TO_SLOT = {
    "Grey": "MAT_Paint_Body",  # the cab paint (navy in the source)
    "Back Trailor": "MAT_Paint_Graphite",
    "dark": "MAT_Plastic_Grille",
    "Darker Most": "MAT_Plastic_Grille",
    "Material": "MAT_Plastic_Grille",
    "Metalic": "MAT_Metal_Steel",
    "Glass": "MAT_Glass",
    "Hubs": "MAT_Metal_Steel",
    "Rims": "MAT_Metal_Steel",
    "Tyre_sidewalls": "MAT_Rubber",
    "Tyre_tread": "MAT_Rubber",
    "White Light": "MAT_Light_Head",
    "Yellow Loght Black": "MAT_Light_Marker",
    "Red Light Back": "MAT_Light_Tail",
}
for o in scene.objects:
    if o.type != "MESH":
        continue
    if not o.material_slots:
        o.data.materials.append(M["MAT_Paint_Graphite"])  # untextured mirror arms
    for slot in o.material_slots:
        src = slot.material.name.split(".")[0] if slot.material else ""
        slot.material = M[SOURCE_TO_SLOT.get(src, "MAT_Paint_Graphite")]

# Brake: the inboard half of each red rear lens (outboard stays tail).
lamp = obj("Cube")
bm = bmesh.new()
bm.from_mesh(lamp.data)
if "MAT_Light_Brake" not in [m.name for m in lamp.data.materials]:
    lamp.data.materials.append(M["MAT_Light_Brake"])
brake_index = [m.name for m in lamp.data.materials].index("MAT_Light_Brake")
tail_index = [m.name for m in lamp.data.materials].index("MAT_Light_Tail")
tail_faces = [f for f in bm.faces if f.material_index == tail_index]
if tail_faces:
    xs = sorted(abs(f.calc_center_median().x) for f in tail_faces)
    split = xs[len(xs) // 2]
    for f in tail_faces:
        if abs(f.calc_center_median().x) < split:
            f.material_index = brake_index
bm.to_mesh(lamp.data)
bm.free()

# --- 5. Body / chassis sorting.
CHASSIS_OBJECTS = {MAIN + ".015", "Cube"}
BODY_OBJECTS = {MAIN + s for s in (".001", ".002", ".003", ".004", ".005", ".006", ".007", ".008",
                                    ".009", ".010", ".011", ".012", ".013", ".014", ".017")} | {"Cube.001"}
GLASS_OBJECTS = {MAIN + ".018"}
CAB_BACK_Y = -6.5 * SCALE + (-REAR_AXLE_Y * SCALE)  # behind the cab back wall (m)


def split_main():
    """The main source mesh mixes cab and chassis islands: split by island position."""
    o = obj(MAIN)
    chassis = o.copy()
    chassis.data = o.data.copy()
    scene.collection.objects.link(chassis)
    for target, keep_chassis in ((o, False), (chassis, True)):
        bm = bmesh.new()
        bm.from_mesh(target.data)
        doomed = []
        for group in islands(bm):
            b = bounds(group)
            is_chassis = b[1] > CAB_BACK_Y or b[5] < 0.9  # behind the cab, or low frame parts
            if is_chassis != keep_chassis:
                doomed.extend(group)
        bmesh.ops.delete(bm, geom=list(set(doomed)), context="FACES")
        bm.to_mesh(target.data)
        bm.free()
    return o, chassis


main_body, main_chassis = split_main()


def join(objects, name):
    objects = [o for o in objects if o and o.type == "MESH" and len(o.data.polygons)]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = bpy.context.view_layer.objects.active
    result.name = name
    result.data.name = name
    return result


def separate_by_material(o, slot_names, name):
    """Moves the faces using `slot_names` into a new object called `name`."""
    bm = bmesh.new()
    bm.from_mesh(o.data)
    idx = {i for i, m in enumerate(o.data.materials) if m and m.name in slot_names}
    if not any(f.material_index in idx for f in bm.faces):
        bm.free()
        return None
    new = o.copy()
    new.data = o.data.copy()
    scene.collection.objects.link(new)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in idx], context="FACES")
    bm.to_mesh(o.data)
    bm.free()
    bm = bmesh.new()
    bm.from_mesh(new.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index not in idx], context="FACES")
    bm.to_mesh(new.data)
    bm.free()
    new.name = name
    new.data.name = name
    return new


body = join([main_body] + [obj(n) for n in BODY_OBJECTS if n in bpy.data.objects], "Tractor_Body_Mesh")
chassis = join([main_chassis] + [obj(n) for n in CHASSIS_OBJECTS if n in bpy.data.objects], "Tractor_Chassis")
glass = join([obj(n) for n in GLASS_OBJECTS], "Tractor_Glass")

lights = {}
for slot, node in (("MAT_Light_Head", "Lights_Head"), ("MAT_Light_Marker", "Lights_Marker"),
                   ("MAT_Light_Tail", "Lights_Tail"), ("MAT_Light_Brake", "Lights_Brake")):
    parts = [p for p in (separate_by_material(body, {slot}, node + "_a"),
                         separate_by_material(chassis, {slot}, node + "_b")) if p]
    lights[node] = join(parts, node) if parts else None

# --- 6. Fifth wheel: a simple plate on the frame just ahead of the rear axle.
def chassis_top(y0, y1):
    top = 0.0
    for v in chassis.data.vertices:
        if abs(v.co.x) < 0.45 and y0 < v.co.y < y1:
            top = max(top, v.co.z)
    return top


# Fifth-wheel lead ahead of the rear axle (Blender −Y = forward). 0.48 m keeps the combination
# within 16.5 m with a 12.0 m kingpin-to-rear trailer; the trailer's chamfered front corners
# (≤ 2.04 m swing radius) keep the articulation clear of the cab.
FIFTH_Y = -(float(argv[2]) if len(argv) > 2 else 0.48)
frame_top = chassis_top(-1.2, 0.8)
FIFTH_HEIGHT = max(frame_top, 1.05)
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.45, depth=0.08,
                                    location=(0, FIFTH_Y, FIFTH_HEIGHT - 0.04))
plate = bpy.context.active_object
plate.name = "Fifth_Wheel_Plate"
plate.data.materials.append(M["MAT_Paint_Graphite"])

# --- 7. Hierarchy (contract names; Blender −Y forward exports to glTF +Z).
def empty(name, location=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.3
    scene.collection.objects.link(e)
    e.location = location
    if parent:
        e.parent = parent
    return e


def parent_keep(child, parent):
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world


tractor = empty("Tractor")
tractor_body = empty("Tractor_Body", parent=tractor)
parent_keep(body, tractor_body)
parent_keep(glass, tractor_body)
parent_keep(chassis, tractor)
parent_keep(plate, chassis)
hitch = empty("Hitch_FifthWheel", (0, FIFTH_Y, FIFTH_HEIGHT), tractor)
for node, mesh in lights.items():
    if mesh:
        parent_keep(mesh, tractor_body if node in ("Lights_Head", "Lights_Marker") else chassis)

# Headlamp beam anchors at the headlamp lens centres (left = +X).
head = lights["Lights_Head"]
hl = [head.matrix_world @ v.co for v in head.data.vertices]
for side, sign in (("L", 1), ("R", -1)):
    pts = [p for p in hl if p.x * sign > 0]
    c = sum(pts, Vector()) / len(pts)
    empty(f"Lights_Head_{side}", tuple(c), tractor_body)


def wheel_pivot(mesh, name, steer=None):
    pts = [v.co for v in mesh.data.vertices]
    c = sum(pts, Vector()) / len(pts)
    # Bounds centre is more robust than the vertex mean for a wheel.
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    parent = tractor
    if steer:
        parent = empty(steer, tuple(c), tractor)
    spin = empty(name, tuple(c) if not steer else (0, 0, 0), parent)
    mesh.data.transform(Matrix.Translation(-c))
    mesh.parent = spin
    mesh.location = (0, 0, 0)
    return spin, (hi - lo)


wheel_info = {}
wheel_info["FL"] = wheel_pivot(wheel_fl, "Wheel_FL_Spin", "Wheel_FL")[1]
wheel_info["FR"] = wheel_pivot(wheel_fr, "Wheel_FR_Spin", "Wheel_FR")[1]
wheel_info["RL"] = wheel_pivot(wheel_rl, "Wheel_RL_Spin")[1]
wheel_info["RR"] = wheel_pivot(wheel_rr, "Wheel_RR_Spin")[1]

# Recalculate normals outward on the rebuilt objects (source had some flipped faces).
for o in scene.objects:
    if o.type == "MESH":
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(o.data)
        bm.free()

bpy.context.view_layer.update()

# --- Report.
def world_box(objs):
    pts = []
    for o in objs:
        if o.type == "MESH":
            pts += [o.matrix_world @ v.co for v in o.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


meshes = [o for o in scene.objects if o.type == "MESH"]
lo, hi = world_box(meshes)
cab_lo, cab_hi = world_box([body])
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
print("REMOVED", removed)
print(f"TRACTOR overall W {hi.x - lo.x:.3f} L {hi.y - lo.y:.3f} H {hi.z - lo.z:.3f} (min z {lo.z:.3f})")
print(f"CAB body W {cab_hi.x - cab_lo.x:.3f} H(top) {cab_hi.z:.3f}")
for k, size in wheel_info.items():
    print(f"WHEEL {k} diameter {size.z:.3f} width {size.x:.3f}")
print(f"FIFTH WHEEL height {FIFTH_HEIGHT:.3f} at {FIFTH_Y} (frame top found {frame_top:.3f})")
print("TRIANGLES", tris, "MESHES", len(meshes), "MATERIALS", sorted({m.name for o in meshes for m in o.data.materials if m}))
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("SAVED", OUT)
