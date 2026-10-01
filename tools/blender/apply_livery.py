"""First BSR livery + cinematic material pass on the assembled vehicle.

blender -b <vehicle_assembled.blend> --python tools/blender/apply_livery.py -- <out.blend> <texture_dir> <font.ttf>

- Procedural textures (no image assets): 2K tiling curtain weave normal, 1K curtain ORM
  (occlusion/roughness/metal), 1K tyre normal atlas. PNG, ready for KTX2 conversion.
- Curtain: soft warm-white vertex colour with a mild dirt fade at the lower edge only
  (the branding area stays clean). No graphic gradients.
- TEMPORARY wordmark "BSR" (Archivo Black, SIL OFL — the site's type family) as its own
  mesh + material (Livery_Wordmark), projected onto the actual curtain surface; short
  green + red accent bar (Livery_Accent); hidden optional "TRASPORTI" descriptor.
- Cab: warm white upper, graphite lower structure, dark glass, small BSR door marks.
Geometry of the vehicle is unchanged.
"""

import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1 :]
OUT, TEX_DIR, FONT = argv[0], argv[1], argv[2]
os.makedirs(TEX_DIR, exist_ok=True)
scene = bpy.context.scene

# Trailer geometry constants (must match tools/blender/build_trailer.py).
COUPLING = 1.215
WIDTH, LENGTH, KINGPIN_BACK = 2.55, 13.60, 1.60
HALF = WIDTH / 2
FRONT, REAR = -KINGPIN_BACK, -KINGPIN_BACK + LENGTH
ROOF_TOP = 4.0 - COUPLING
CURTAIN_BOTTOM, CURTAIN_TOP = 0.13, ROOF_TOP - 0.2
CURTAIN_Y0, CURTAIN_Y1 = FRONT + 0.14, REAR - 0.14
STRAP = 0.6


def curtain_x(y, z, sx):
    """The curtain surface of build_trailer.py (trailer-root local)."""
    u_y = y - CURTAIN_Y0
    v = (z - CURTAIN_BOTTOM) / (CURTAIN_TOP - CURTAIN_BOTTOM)
    v = min(1.0, max(0.0, v))
    tension = 0.0085 * math.sin(2 * math.pi * u_y / STRAP) * (0.25 + 0.75 * (1 - v) ** 1.5)
    broad = 0.006 * math.sin(2 * math.pi * u_y / 3.1 + 1.2) * math.sin(math.pi * v)
    belly = 0.01 * math.sin(math.pi * v) ** 2
    return sx * (HALF - 0.035 + tension + broad + belly)


def srgb(hex_colour):
    h = hex_colour.lstrip("#")
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# --------------------------------------------------------------------------- textures
def save(name, rgba, non_color):
    h, w, _ = rgba.shape
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(np.clip(rgba, 0, 1).astype(np.float32).ravel())
    img.filepath_raw = os.path.join(TEX_DIR, name + ".png")
    img.file_format = "PNG"
    img.save()
    img.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    return img


def tile_noise(size, freqs, rng, amp=1.0):
    """Tileable smooth noise: sum of integer-frequency waves with random phases."""
    y, x = np.mgrid[0:size, 0:size] / size
    out = np.zeros((size, size))
    for f in freqs:
        for _ in range(3):
            a, b = rng.integers(-f, f + 1, 2)
            if a == 0 and b == 0:
                continue
            out += np.sin(2 * np.pi * (a * x + b * y) + rng.uniform(0, 2 * np.pi)) / f
    out /= np.abs(out).max() + 1e-9
    return out * amp


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5
    n = np.dstack((-dx * strength, -dy * strength, np.ones_like(h)))
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return np.dstack(((n + 1) / 2, np.ones_like(h)))


rng = np.random.default_rng(7)
CURTAIN_TILE = 0.5  # metres per texture tile

# Curtain weave: fine woven dimples (≈ 1.6 mm pitch) + faint vertical tension streaks.
S = 2048
yy, xx = np.mgrid[0:S, 0:S] / S
weave = np.sin(2 * np.pi * 320 * xx) * np.sin(2 * np.pi * 320 * yy)
streaks = np.zeros_like(xx)
for f in (7, 13, 23, 41):
    streaks += np.sin(2 * np.pi * f * xx + rng.uniform(0, 6.28)) / f
curtain_h = 0.35 * weave + 6.0 * streaks
curtain_normal = save("curtain_normal_2k", normal_from_height(curtain_h, 1.2), True)

# Curtain ORM (1K): AO 1, roughness 0.74–0.84, metal 0.
S1 = 1024
rough = 0.79 + 0.05 * tile_noise(S1, (2, 3, 5, 9), rng)
curtain_orm = save("curtain_orm_1k", np.dstack((np.ones_like(rough), rough, np.zeros_like(rough), np.ones_like(rough))), True)

# Tyre atlas (1K): u across the profile (sidewall | tread | sidewall), v around (8 repeats).
T = 1024
v, u = np.mgrid[0:T, 0:T] / T
tread = (u > 0.25) & (u < 0.75)
shoulder = ((u > 0.2) & (u <= 0.25)) | ((u >= 0.75) & (u < 0.8))
side = (u <= 0.2) | (u >= 0.8)
h = np.zeros_like(u)
for g in (0.33, 0.44, 0.56, 0.67):  # circumferential grooves
    h -= np.exp(-((u - g) / 0.009) ** 2)
sipes = np.abs(np.sin(np.pi * (v * 30 + 2.5 * u))) < 0.06
h -= 0.45 * (sipes & tread)
blocks = np.abs(np.sin(np.pi * v * 22)) < 0.12
h -= 0.8 * (blocks & shoulder)
h += 0.12 * np.sin(2 * np.pi * u * 70) * side
tyre_normal = save("tyre_normal_1k", normal_from_height(h, 6.0), True)


# --------------------------------------------------------------------------- materials
def principled(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m, nt, bsdf


def uv_image(nt, image, scale=1.0):
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = image
    if scale != 1.0:
        coord = nt.nodes.new("ShaderNodeUVMap")
        mapping = nt.nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (scale, scale, 1)
        nt.links.new(coord.outputs["UV"], mapping.inputs["Vector"])
        nt.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    return tex


def add_normal(nt, bsdf, image, strength):
    tex = uv_image(nt, image)
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = strength
    nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])


def material(name, colour, roughness, metallic=0.0, coat=0.0, emission=None):
    m, nt, bsdf = principled(name)
    bsdf.inputs["Base Color"].default_value = (*colour, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if coat:
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.14
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 0.0
    return m, nt, bsdf


WARM_WHITE = (0.80, 0.788, 0.752)
material("MAT_Paint_Body", WARM_WHITE, 0.3, coat=0.35)  # clean working white, satin clearcoat
material("MAT_Box_Panel", (0.79, 0.778, 0.742), 0.42)  # trailer bulkhead, doors, rails
material("MAT_Paint_Graphite", (0.026, 0.028, 0.03), 0.5)
material("MAT_Plastic_Grille", (0.02, 0.021, 0.023), 0.58)
material("MAT_Metal_Steel", (0.55, 0.56, 0.57), 0.36, metallic=1.0)
material("MAT_Metal_Dark", (0.045, 0.047, 0.05), 0.55, metallic=0.7)
material("MAT_Reflective", (0.78, 0.77, 0.74), 0.25)
m, nt, bsdf = material("MAT_Livery_Mark", (0.022, 0.024, 0.027), 0.72)  # matte printed graphite
bsdf.inputs["Specular IOR Level"].default_value = 0.25  # vinyl print: low sheen, no bronze glare at grazing sun
material("MAT_Livery_Accent_Green", srgb("#1a9a63"), 0.5)
material("MAT_Livery_Accent_Red", srgb("#b32025"), 0.5)

m, nt, bsdf = material("MAT_Rubber", (0.016, 0.016, 0.017), 0.88)
add_normal(nt, bsdf, tyre_normal, 0.8)

# Glass: dark, reflective, slightly see-through (interior depth), never mirror-black.
m, nt, bsdf = material("MAT_Glass", (0.006, 0.007, 0.008), 0.03)
bsdf.inputs["Alpha"].default_value = 0.8
bsdf.inputs["IOR"].default_value = 1.5
if hasattr(m, "surface_render_method"):
    m.surface_render_method = "BLENDED"

# Curtain: warm-white vertex colour (dirt fade baked in), weave normal, ORM roughness.
m, nt, bsdf = principled("MAT_Curtain")
col = nt.nodes.new("ShaderNodeVertexColor")
col.layer_name = "Col"
nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
orm = uv_image(nt, curtain_orm)
sep = nt.nodes.new("ShaderNodeSeparateColor")
nt.links.new(orm.outputs["Color"], sep.inputs["Color"])
nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
add_normal(nt, bsdf, curtain_normal, 0.55)
bsdf.inputs["Metallic"].default_value = 0.0


# --------------------------------------------------------------------------- curtain UV + colour
curtain = bpy.data.objects["Trailer_Curtain"]
cm = curtain.data
uv = cm.uv_layers.get("UVMap") or cm.uv_layers.new(name="UVMap")
for poly in cm.polygons:
    for li in poly.loop_indices:
        co = cm.vertices[cm.loops[li].vertex_index].co
        uv.data[li].uv = (co.y / CURTAIN_TILE, co.z / CURTAIN_TILE)
if "Col" not in cm.color_attributes:
    cm.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
colour = cm.color_attributes["Col"]
for i, v in enumerate(cm.vertices):
    z = v.co.z
    dirt = 0.12 * math.exp(-(z - CURTAIN_BOTTOM) / 0.22)  # mild road film at the lower edge only
    wave = 0.012 * math.sin(v.co.y * 1.7) * math.exp(-(z - CURTAIN_BOTTOM) / 0.5)
    k = 1 - dirt - wave
    colour.data[i].color = (WARM_WHITE[0] * k, WARM_WHITE[1] * k, WARM_WHITE[2] * (k - 0.008), 1)


# --------------------------------------------------------------------------- tyre UVs
def tyre_uv(obj):
    me = obj.data
    rubber = [i for i, mat in enumerate(me.materials) if mat and mat.name == "MAT_Rubber"]
    if not rubber:
        return
    verts = {v for p in me.polygons if p.material_index in rubber for v in p.vertices}
    rs = [math.hypot(me.vertices[i].co.y, me.vertices[i].co.z) for i in verts]
    xs = [me.vertices[i].co.x for i in verts]
    r_max, r_min = max(rs), min(rs)
    half_w = max(abs(min(xs)), abs(max(xs)))
    r_tread = r_max - 0.045 * r_max / 0.536
    uvl = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    for p in me.polygons:
        if p.material_index not in rubber:
            continue
        thetas = []
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            thetas.append(math.atan2(co.z, co.y))
        if max(thetas) - min(thetas) > math.pi:
            thetas = [t + 2 * math.pi if t < 0 else t for t in thetas]
        for li, th in zip(p.loop_indices, thetas):
            co = me.vertices[me.loops[li].vertex_index].co
            r = math.hypot(co.y, co.z)
            if r >= r_tread:
                uu = 0.5 + 0.25 * max(-1, min(1, co.x / half_w))
            else:
                frac = (r_tread - r) / max(1e-6, r_tread - r_min)
                uu = 0.2 * (1 - frac) if co.x < 0 else 1 - 0.2 * (1 - frac)
            uvl.data[li].uv = (uu, th / (2 * math.pi) * 8)


for o in scene.objects:
    if o.type == "MESH" and o.name.startswith("Wheel_") and o.name.endswith("_Mesh"):
        tyre_uv(o)


# --------------------------------------------------------------------------- two-tone cab
def recolour(obj, from_name, to_name, predicate):
    me = obj.data
    if to_name not in [m.name for m in me.materials]:
        me.materials.append(bpy.data.materials[to_name])
    src = [i for i, m in enumerate(me.materials) if m and m.name == from_name]
    dst = [m.name for m in me.materials].index(to_name)
    mw = obj.matrix_world
    for p in me.polygons:
        if p.material_index in src and predicate(mw @ p.center):
            p.material_index = dst


recolour(bpy.data.objects["Tractor_Body_Mesh"], "MAT_Paint_Body", "MAT_Paint_Graphite", lambda c: c.z < 1.15)
recolour(bpy.data.objects["Tractor_Chassis"], "MAT_Paint_Body", "MAT_Paint_Graphite", lambda c: True)


# --------------------------------------------------------------------------- lettering
font = bpy.data.fonts.load(FONT)


def text_mesh(text, spacing=1.0):
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = text
    cu.font = font
    cu.size = 1.0
    cu.space_character = spacing
    ob = bpy.data.objects.new("txt", cu)
    scene.collection.objects.link(ob)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    return me


def rect_mesh(w, h, n=24):
    bm = bmesh.new()
    vs = [[bm.verts.new((w * i / n, h * j, 0)) for j in (0, 1)] for i in range(n + 1)]
    for i in range(n):
        bm.faces.new((vs[i][0], vs[i + 1][0], vs[i + 1][1], vs[i][1]))
    me = bpy.data.meshes.new("rect")
    bm.to_mesh(me)
    bm.free()
    return me


def dense(me, max_edge):
    """Triangulate and split long edges so projected lettering follows curved surfaces."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    for _ in range(8):
        long_edges = [e for e in bm.edges if e.calc_length() > max_edge]
        if not long_edges:
            break
        bmesh.ops.subdivide_edges(bm, edges=long_edges, cuts=1, use_grid_fill=False)
        bmesh.ops.triangulate(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return me


def dense_to(me, width_m, max_edge_m):
    """Densify a 2D mesh so that, once scaled to width_m, no edge exceeds max_edge_m (metres)."""
    x0, x1, _, _ = bounds2d(me)
    return dense(me, max_edge_m * (x1 - x0) / width_m)


def bounds2d(me):
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    return min(xs), max(xs), min(ys), max(ys)


def place_on_sides(me2d, width, start_offsets, z_bottom, height, surface_x, offset):
    """Maps a 2D mesh (a along reading, b up) onto both flanks, reading correctly on each."""
    x0, x1, y0, y1 = bounds2d(me2d)
    s = width / (x1 - x0)
    bm = bmesh.new()
    for sx in (1, -1):
        part = bmesh.new()
        part.from_mesh(me2d)
        for v in part.verts:
            a = (v.co.x - x0) * s
            b = (v.co.y - y0) * s
            y = start_offsets[sx] + (a if sx > 0 else -a)  # +X reads along +Y, −X along −Y
            z = z_bottom + b
            v.co = Vector((surface_x(y, z, sx) + sx * offset, y, z))
        if sx < 0:
            for f in part.faces:
                f.normal_flip()
        tmp = bpy.data.meshes.new("tmp")
        part.to_mesh(tmp)
        part.free()
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # Normals must point away from the centreline.
    for f in bm.faces:
        if f.normal.x * f.calc_center_median().x < 0:
            f.normal_flip()
    out = bpy.data.meshes.new("placed")
    bm.to_mesh(out)
    bm.free()
    return out, (y1 - y0) * s


def link_mesh(name, me, materials, parent, local=True):
    """local=True: mesh coordinates are already in the parent's space (trailer livery);
    False: world coordinates (cab mark, from world-space raycasts)."""
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old)
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    for mat in materials:
        me.materials.append(bpy.data.materials[mat])
    ob.parent = parent
    ob.matrix_parent_inverse = Matrix.Identity(4) if local else parent.matrix_world.inverted()
    return ob


trailer_root = bpy.data.objects["Trailer_Root"]
trailer_body = bpy.data.objects["Trailer_Body"]

# Wordmark: ≈ 3.5 m wide (≈ 27 % of the visible curtain), centred at 38 % from the front,
# on the upper-middle of the curtain; accent bar below; generous white space around.
MARK_W = 3.5
Y_CENTRE = FRONT + 0.38 * LENGTH
mark2d = dense_to(text_mesh("BSR", spacing=1.12), MARK_W, 0.12)
x0, x1, y0, y1 = bounds2d(mark2d)
mark_h = (y1 - y0) * MARK_W / (x1 - x0)
BAR_H, GAP = 0.075, 0.2
block_h = mark_h + GAP + BAR_H
z_block = (CURTAIN_BOTTOM + CURTAIN_TOP) / 2 + 0.05 - block_h / 2
starts = {1: Y_CENTRE - MARK_W / 2, -1: Y_CENTRE + MARK_W / 2}
mark_me, _ = place_on_sides(mark2d, MARK_W, starts, z_block + BAR_H + GAP, mark_h, curtain_x, 0.004)
link_mesh("Livery_Wordmark", mark_me, ["MAT_Livery_Mark"], trailer_body)

# Accent: short green bar then short red bar, left-aligned with the wordmark (reading order).
GREEN_W, RED_W, BAR_GAP = 1.25, 0.55, 0.06
bm = bmesh.new()
for w, off, mat_index in ((GREEN_W, 0.0, 0), (RED_W, GREEN_W + BAR_GAP, 1)):
    bar2d = dense_to(rect_mesh(1.0, BAR_H / w), w, 0.12)
    bar_starts = {1: starts[1] + off, -1: starts[-1] - off}
    placed, _ = place_on_sides(bar2d, w, bar_starts, z_block, BAR_H, curtain_x, 0.004)
    tmp_bm = bmesh.new()
    tmp_bm.from_mesh(placed)
    for f in tmp_bm.faces:
        f.material_index = mat_index
    tmp_bm.to_mesh(placed)
    tmp_bm.free()
    bm.from_mesh(placed)
    bpy.data.meshes.remove(placed)
accent_me = bpy.data.meshes.new("Livery_Accent")
bm.to_mesh(accent_me)
bm.free()
link_mesh("Livery_Accent", accent_me, ["MAT_Livery_Accent_Green", "MAT_Livery_Accent_Red"], trailer_body)

# Optional descriptor (disabled by default): small spaced "TRASPORTI" under the accent.
desc2d = dense_to(text_mesh("TRASPORTI", spacing=1.6), 1.4, 0.08)
desc_starts = {1: starts[1], -1: starts[-1]}
desc_me, _ = place_on_sides(desc2d, 1.4, desc_starts, z_block - 0.28, 0.12, curtain_x, 0.004)
desc = link_mesh("Livery_Descriptor", desc_me, ["MAT_Livery_Mark"], trailer_body)
desc.hide_render = True
desc.hide_viewport = True

# Cab door marks: small "BSR" projected onto the actual door surface (raycast).
cab = bpy.data.objects["Tractor_Body_Mesh"]
tree = BVHTree.FromObject(cab, bpy.context.evaluated_depsgraph_get())
cab_inv = cab.matrix_world.inverted()


def cab_surface_x(y, z, sx):
    origin = cab_inv @ Vector((sx * 3.0, y, z))
    direction = (cab_inv.to_3x3() @ Vector((-sx, 0, 0))).normalized()
    hit = tree.ray_cast(origin, direction)
    return (cab.matrix_world @ hit[0]).x if hit[0] is not None else sx * 1.1


CAB_W = 0.36
cab2d = dense_to(text_mesh("BSR", spacing=1.12), CAB_W, 0.05)
cab_starts = {1: -3.85 - CAB_W / 2, -1: -3.85 + CAB_W / 2}
cab_me, _ = place_on_sides(cab2d, CAB_W, cab_starts, 1.93, 0.12, cab_surface_x, 0.003)
link_mesh("Cab_Livery_Mark", cab_me, ["MAT_Livery_Mark"], bpy.data.objects["Tractor_Body"], local=False)

bpy.context.view_layer.update()


# --------------------------------------------------------------------------- report
def tris(root_name):
    root = bpy.data.objects[root_name]
    total, stack = 0, [root]
    while stack:
        o = stack.pop()
        if o.type == "MESH" and not o.hide_render:
            total += sum(len(p.vertices) - 2 for p in o.data.polygons)
        stack.extend(c for c in o.children if c.name != "Trailer" or root_name == "Trailer")
    return total


print(f"WORDMARK width {MARK_W:.2f} m (≈ {MARK_W / (CURTAIN_Y1 - CURTAIN_Y0) * 100:.0f} % of the curtain), "
      f"cap height {mark_h:.2f} m, centred {Y_CENTRE - FRONT:.2f} m from the front, bottom z {z_block + BAR_H + GAP + COUPLING:.2f} m")
print(f"ACCENT green {GREEN_W} m + red {RED_W} m, height {BAR_H} m")
print("TRIANGLES tractor", tris("Tractor"), "trailer", tris("Trailer"))
print("MATERIALS", sorted(m.name for m in bpy.data.materials if m.users))
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("SAVED", OUT)
