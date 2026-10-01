"""Builds a generic European tri-axle curtain-side semi-trailer from scratch (no source asset).

blender -b --factory-startup --python tools/blender/build_trailer.py -- <out.blend> [coupling_height_m]

Manufacturer-neutral, real-world metres. Blender axes: forward −Y (= glTF +Z),
left +X, up +Z. Trailer_Root sits at the kingpin on the coupling plane: local
z = 0 is the underside of the upper coupler (it rests on the tractor's fifth
wheel), so world height = coupling height + local z.
"""

import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
OUT = argv[0]
COUPLING = float(argv[1]) if len(argv) > 1 else 1.215  # fifth-wheel plate top on the tractor

# --- Dimensions (metres).
LENGTH = 13.60  # with the 1.60 m kingpin setback: exactly 12.00 m kingpin → rear
WIDTH = 2.55
HALF = WIDTH / 2
KINGPIN_BACK = 1.60  # kingpin behind the front bulkhead
FRONT = -KINGPIN_BACK  # local y of the front face (forward is −Y)
REAR = FRONT + LENGTH  # local y of the rear face
FLOOR_TOP = 0.12
ROOF_TOP = 4.0 - COUPLING  # 4.0 m overall when coupled
CURTAIN_BOTTOM, CURTAIN_TOP = 0.13, ROOF_TOP - 0.2
TYRE_R, TYRE_W = 0.536, 0.385  # 385/65 R22.5 class
RIM_R = 0.286
WHEEL_Z = TYRE_R - COUPLING  # wheel centre, local
WHEEL_X = HALF - 0.005 - TYRE_W / 2
AXLES = (6.39, 7.70, 9.01)  # local y, 1.31 m spacing
LEGS_Y = 2.6

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"


# --- Materials (neutral preview; contract slot names).
def principled(name, color, roughness=0.5, metallic=0.0, emission=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 0.0
    return m


MAT = {
    "curtain": principled("MAT_Curtain", (0.80, 0.80, 0.78), 0.82),
    "panel": principled("MAT_Box_Panel", (0.80, 0.80, 0.78), 0.45),
    "graphite": principled("MAT_Paint_Graphite", (0.045, 0.048, 0.05), 0.55),
    "dark": principled("MAT_Metal_Dark", (0.03, 0.032, 0.034), 0.5, 0.6),
    "steel": principled("MAT_Metal_Steel", (0.62, 0.63, 0.64), 0.3, 1.0),
    "rubber": principled("MAT_Rubber", (0.02, 0.02, 0.02), 0.85),
    "reflective": principled("MAT_Reflective", (0.75, 0.74, 0.7), 0.3),
    "tail": principled("MAT_Light_Tail", (0.35, 0.02, 0.02), 0.2, emission=(0.8, 0.05, 0.05)),
    "brake": principled("MAT_Light_Brake", (0.35, 0.02, 0.02), 0.2, emission=(1, 0.05, 0.05)),
    "marker": principled("MAT_Light_Marker", (0.55, 0.35, 0.05), 0.2, emission=(1, 0.7, 0.2)),
}


# --- Mesh helpers (one bmesh per object; material per face).
class Builder:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []

    def mat(self, key):
        m = MAT[key]
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def box(self, x0, x1, y0, y1, z0, z1, key):
        # Normalise bounds: mirrored (−X) callers pass them reversed, which would invert winding.
        x0, x1 = min(x0, x1), max(x0, x1)
        y0, y1 = min(y0, y1), max(y0, y1)
        z0, z1 = min(z0, z1), max(z0, z1)
        bm, i = self.bm, self.mat(key)
        vs = [bm.verts.new(v) for v in (
            (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
            (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
        for f in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            face = bm.faces.new([vs[k] for k in f])
            face.material_index = i

    def prism(self, outline, z0, z1, key):
        """Vertical extrusion of a convex (x, y) outline between z0 and z1."""
        bm, i = self.bm, self.mat(key)
        n = len(outline)
        area = sum(outline[k][0] * outline[(k + 1) % n][1] - outline[(k + 1) % n][0] * outline[k][1] for k in range(n))
        if area < 0:  # orient counter-clockwise (seen from +Z) so faces point outward
            outline = list(reversed(outline))
        low = [bm.verts.new((x, y, z0)) for x, y in outline]
        high = [bm.verts.new((x, y, z1)) for x, y in outline]
        for k in range(n):
            m = (k + 1) % n
            bm.faces.new((low[k], low[m], high[m], high[k])).material_index = i
        bm.faces.new(list(reversed(low))).material_index = i
        bm.faces.new(high).material_index = i

    def cylinder(self, centre, axis, radius, length, key, segments=12):
        """Capped cylinder along 'x', 'y' or 'z' centred at `centre`."""
        bm, i = self.bm, self.mat(key)
        cx, cy, cz = centre
        rings = []
        for s in (-0.5, 0.5):
            ring = []
            for k in range(segments):
                a = 2 * math.pi * k / segments
                u, v = radius * math.cos(a), radius * math.sin(a)
                if axis == "x":
                    p = (cx + s * length, cy + u, cz + v)
                elif axis == "y":
                    p = (cx + u, cy + s * length, cz + v)
                else:
                    p = (cx + u, cy + v, cz + s * length)
                ring.append(bm.verts.new(p))
            rings.append(ring)
        for k in range(segments):
            n = (k + 1) % segments
            f = bm.faces.new((rings[0][k], rings[0][n], rings[1][n], rings[1][k]))
            f.material_index = i
        for ring in (rings[0], list(reversed(rings[1]))):
            f = bm.faces.new(ring)
            f.material_index = i

    def lathe(self, profile, key, segments=40, closed=False):
        """Revolves (lateral x, radius r) points around the local X axis."""
        bm, i = self.bm, self.mat(key)
        rings = []
        for x, r in profile:
            rings.append([bm.verts.new((x, r * math.cos(2 * math.pi * k / segments),
                                        r * math.sin(2 * math.pi * k / segments))) for k in range(segments)])
        for a, b in zip(rings, rings[1:]):
            for k in range(segments):
                n = (k + 1) % segments
                f = bm.faces.new((a[k], a[n], b[n], b[k]))
                f.material_index = i

    def grid(self, fn, cols, rows, key):
        """Parametric surface: fn(u, v) → (x, y, z) for u, v ∈ [0, 1]."""
        bm, i = self.bm, self.mat(key)
        vs = [[bm.verts.new(fn(c / cols, r / rows)) for c in range(cols + 1)] for r in range(rows + 1)]
        for r in range(rows):
            for c in range(cols):
                f = bm.faces.new((vs[r][c], vs[r][c + 1], vs[r + 1][c + 1], vs[r + 1][c]))
                f.material_index = i

    def finish(self, parent=None, outward_from=None):
        """Boxes are built with outward winding (never merged: shared vertices between
        touching boxes break closed-shape normals). Open surfaces (curtain, lathed
        wheels) are oriented away from `outward_from` (a point, or a callable per face)."""
        mesh = bpy.data.meshes.new(self.name)
        if outward_from is not None:
            for f in self.bm.faces:
                ref = outward_from(f) if callable(outward_from) else Vector(outward_from)
                if f.normal.dot(f.calc_center_median() - ref) < 0:
                    f.normal_flip()
        self.bm.to_mesh(mesh)
        self.bm.free()
        for m in self.mats:
            mesh.materials.append(m)
        for p in mesh.polygons:
            p.use_smooth = False
        o = bpy.data.objects.new(self.name, mesh)
        scene.collection.objects.link(o)
        if parent:
            o.parent = parent
        return o


def empty(name, location=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.25
    e.location = location
    scene.collection.objects.link(e)
    if parent:
        e.parent = parent
    return e


trailer = empty("Trailer")
root = empty("Trailer_Root", parent=trailer)

# --- Chassis: two I-beam rails (shallow over the fifth wheel, deep behind the gooseneck),
# cross members, upper coupler plate, kingpin, side underrun rails, mudguards, bumper frame.
ch = Builder("Trailer_Chassis")
for sx in (-1, 1):
    x = sx * 0.52
    # Rail as a lofted profile: over the tractor (gooseneck) it stays above the coupling
    # plane (depth 0.05); from y 3.2, clear of the tractor, it deepens to 0.45.
    steps = [FRONT + 0.05, 2.2, 3.2, REAR - 0.6, REAR - 0.05]
    depth = [0.05, 0.05, 0.45, 0.45, 0.3]
    for (y0, d0), (y1, d1) in zip(zip(steps, depth), zip(steps[1:], depth[1:])):
        bm = ch.bm
        i = ch.mat("graphite")
        pts = []
        for y, d in ((y0, d0), (y1, d1)):
            z0 = FLOOR_TOP - 0.04 - d
            web = [(x - 0.006, y, z0), (x + 0.006, y, z0), (x + 0.006, y, FLOOR_TOP - 0.04), (x - 0.006, y, FLOOR_TOP - 0.04)]
            pts.append([bm.verts.new(p) for p in web])
        for k in range(4):
            n = (k + 1) % 4
            f = bm.faces.new((pts[0][k], pts[0][n], pts[1][n], pts[1][k]))
            f.material_index = i
        # Flanges (top and bottom) as thin boxes.
        ch.box(x - 0.08, x + 0.08, y0, y1, FLOOR_TOP - 0.055, FLOOR_TOP - 0.04, "graphite")
        z_bottom = FLOOR_TOP - 0.04 - max(d0, d1)
        ch.box(x - 0.08, x + 0.08, y0, y1, z_bottom, z_bottom + 0.015, "graphite")
for y in [FRONT + 0.4 + k * 0.9 for k in range(int((LENGTH - 0.8) / 0.9) + 1)]:
    d = 0.05 if y < 2.5 else 0.22
    ch.box(-1.2, 1.2, y - 0.04, y + 0.04, FLOOR_TOP - 0.04 - d, FLOOR_TOP - 0.04, "graphite")
ch.box(-1.0, 1.0, FRONT + 0.05, 1.3, 0.002, 0.03, "graphite")  # upper coupler plate (rests on the fifth wheel)
ch.cylinder((0, 0, -0.04), "z", 0.045, 0.08, "steel", 16)  # kingpin
# Floor.
ch.box(-HALF + 0.01, HALF - 0.01, FRONT + 0.01, REAR - 0.01, FLOOR_TOP - 0.04, FLOOR_TOP, "graphite")
# Lower outer side rails (where the curtain closes) with contour marking.
for sx in (-1, 1):
    # Kept above the coupling plane: nothing but the kingpin reaches down over the tractor.
    # Starts behind the chamfered front corners; markers and strips sit flush within 2.55 m.
    ch.box(sx * (HALF - 0.075), sx * (HALF - 0.01), FRONT + 0.1, REAR, 0.03, FLOOR_TOP + 0.02, "graphite")
    ch.box(sx * (HALF - 0.01), sx * (HALF - 0.007), FRONT + 0.3, REAR - 0.3, 0.05, 0.09, "reflective")
# Side underrun protection between landing legs and axles.
for sx in (-1, 1):
    for z in (-0.52, -0.82):
        ch.box(sx * 1.13, sx * 1.19, LEGS_Y + 0.6, AXLES[0] - 0.8, z - 0.05, z + 0.05, "graphite")
    for y in (LEGS_Y + 0.8, (LEGS_Y + AXLES[0]) / 2, AXLES[0] - 0.95):
        ch.box(sx * 1.1, sx * 1.2, y - 0.03, y + 0.03, -0.9, -0.1, "graphite")
# Mudguards over the axle group, mud flaps behind the last axle.
for sx in (-1, 1):
    x0, x1 = sx * (WHEEL_X - TYRE_W / 2 - 0.03), sx * (HALF - 0.005)
    ch.box(min(x0, x1), max(x0, x1), AXLES[0] - 0.75, AXLES[2] + 0.75, WHEEL_Z + TYRE_R + 0.05, WHEEL_Z + TYRE_R + 0.07, "graphite")
    ch.box(min(x0, x1), max(x0, x1), AXLES[2] + 0.72, AXLES[2] + 0.74, WHEEL_Z - 0.35, WHEEL_Z + TYRE_R + 0.07, "rubber")
# Rear bumper frame, underrun bar and lamp bar.
for sx in (-1, 1):
    ch.box(sx * 0.62, sx * 0.72, REAR - 0.35, REAR - 0.25, -0.78, FLOOR_TOP - 0.04, "graphite")
ch.box(-1.15, 1.15, REAR - 0.3, REAR - 0.18, -0.77, -0.65, "graphite")  # underrun bar (≈ 0.45–0.55 m)
ch.box(-1.2, 1.2, REAR - 0.12, REAR - 0.02, -0.58, -0.4, "graphite")  # lamp bar
ch.box(-1.1, 1.1, REAR - 0.183, REAR - 0.181, -0.75, -0.67, "reflective")
chassis = ch.finish(root)

# --- Axles, suspension, wheels.
ax = Builder("Trailer_Axles")
for y in AXLES:
    ax.cylinder((0, y, WHEEL_Z), "x", 0.07, 2 * WHEEL_X - 0.1, "dark", 12)
    for sx in (-1, 1):
        x = sx * 0.62
        ax.box(x - 0.05, x + 0.05, y - 0.55, y - 0.45, WHEEL_Z, FLOOR_TOP - 0.4, "dark")  # hanger
        ax.box(x - 0.04, x + 0.04, y - 0.5, y + 0.35, WHEEL_Z - 0.06, WHEEL_Z + 0.02, "dark")  # trailing arm
        ax.cylinder((x, y + 0.3, WHEEL_Z + 0.16), "z", 0.13, 0.22, "rubber", 14)  # air spring
        ax.cylinder((sx * (WHEEL_X - 0.25), y, WHEEL_Z), "x", 0.2, 0.18, "dark", 16)  # brake drum
axles = ax.finish(root)

TYRE_PROFILE = [
    (-0.17, RIM_R + 0.01), (-0.19, 0.36), (-0.195, 0.44), (-0.188, 0.495), (-0.165, 0.525), (-0.12, TYRE_R),
    (0.0, TYRE_R + 0.002), (0.12, TYRE_R), (0.165, 0.525), (0.188, 0.495), (0.195, 0.44), (0.19, 0.36),
    (0.17, RIM_R + 0.01),
]
RIM_OUTER = [  # outside face: rim flange → dished disc → hub
    (0.17, RIM_R + 0.01), (0.16, RIM_R - 0.005), (0.12, RIM_R - 0.02), (0.09, 0.24), (0.08, 0.16),
    (0.1, 0.13), (0.1, 0.08), (0.13, 0.07), (0.13, 0.0),
]
RIM_INNER = [(-0.17, RIM_R + 0.01), (-0.16, RIM_R - 0.02), (-0.05, 0.2), (-0.05, 0.0)]


def wheel(name, x, y, sx):
    spin = empty(name, (x, y, WHEEL_Z), root)
    w = Builder(name.replace("_Spin", "_Mesh"))
    profile = [(sx * px, r) for px, r in TYRE_PROFILE]
    w.lathe(profile if sx > 0 else list(reversed(profile)), "rubber", 40)
    w.lathe([(sx * px, r) for px, r in RIM_OUTER], "steel", 32)
    w.lathe([(sx * px, r) for px, r in RIM_INNER], "dark", 24)
    for k in range(10):  # wheel nuts
        a = 2 * math.pi * k / 10
        w.cylinder((sx * 0.135, 0.1 * math.cos(a), 0.1 * math.sin(a)), "x", 0.012, 0.02, "steel", 6)
    w.finish(spin, outward_from=(0, 0, 0))
    return spin


for n, y in enumerate(AXLES, 1):
    wheel(f"Wheel_TL_{n:02d}_Spin", WHEEL_X, y, 1)
    wheel(f"Wheel_TR_{n:02d}_Spin", -WHEEL_X, y, -1)

# --- Body: front bulkhead, roof, cant rails, rear portal, corner posts. Parts meet edge to
# edge — never on coincident faces (they self-shadow black in path tracing and z-fight in WebGL).
bd = Builder("Trailer_Body_Mesh")
bd.box(-HALF + 0.13, HALF - 0.13, FRONT + 0.002, FRONT + 0.05, FLOOR_TOP, ROOF_TOP - 0.035, "panel")  # front bulkhead
for sx in (-1, 1):
    # Chamfered front corner post (0.1 m × 0.1 m): every front point stays within the
    # 2.04 m swing radius about the kingpin.
    outline = [(HALF - 0.13, FRONT), (HALF - 0.10, FRONT), (HALF, FRONT + 0.10), (HALF, FRONT + 0.14), (HALF - 0.13, FRONT + 0.14)]
    bd.prism([(sx * x, y) for x, y in outline], FLOOR_TOP, ROOF_TOP, "panel")
bd.box(-HALF + 0.06, HALF - 0.06, FRONT + 0.14, REAR - 0.14, ROOF_TOP - 0.035, ROOF_TOP - 0.004, "panel")  # roof
for sx in (-1, 1):
    bd.box(sx * (HALF - 0.06), sx * HALF, FRONT + 0.14, REAR - 0.14, CURTAIN_TOP - 0.02, ROOF_TOP, "panel")  # cant rail
    bd.box(sx * (HALF - 0.1), sx * HALF, REAR - 0.14, REAR, FLOOR_TOP - 0.06, ROOF_TOP - 0.22, "panel")  # rear post
bd.box(-HALF, HALF, REAR - 0.14, REAR, ROOF_TOP - 0.22, ROOF_TOP, "panel")  # rear header
body = bd.finish(root)
body.name = "Trailer_Body"
body.data.name = "Trailer_Body"

# --- Curtain: broad tension undulation, stronger low (buckles), slight mid-height belly.
cu = Builder("Trailer_Curtain")
STRAP = 0.6
for sx in (-1, 1):
    y0, y1 = FRONT + 0.14, REAR - 0.14

    def surface(u, v, sx=sx, y0=y0, y1=y1):
        y = y0 + (y1 - y0) * u
        z = CURTAIN_BOTTOM + (CURTAIN_TOP - CURTAIN_BOTTOM) * v
        tension = 0.0085 * math.sin(2 * math.pi * (y - y0) / STRAP) * (0.25 + 0.75 * (1 - v) ** 1.5)
        broad = 0.006 * math.sin(2 * math.pi * (y - y0) / 3.1 + 1.2) * math.sin(math.pi * v)
        belly = 0.01 * math.sin(math.pi * v) ** 2
        return (sx * (HALF - 0.035 + tension + broad + belly), y, z)

    cu.grid(surface, int((y1 - y0) / 0.075), 18, "curtain")
    # Straps and buckles at the lower edge.
    y = y0 + STRAP / 2
    while y < y1 - 0.2:
        x = sx * (HALF - 0.02)
        cu.box(min(x, x + sx * 0.006), max(x, x + sx * 0.006), y - 0.022, y + 0.022, CURTAIN_BOTTOM - 0.02, CURTAIN_BOTTOM + 0.34, "graphite")
        cu.box(min(x, x + sx * 0.018), max(x, x + sx * 0.018), y - 0.03, y + 0.03, CURTAIN_BOTTOM + 0.02, CURTAIN_BOTTOM + 0.1, "steel")
        y += STRAP
curtain = cu.finish(root, outward_from=lambda f: Vector((0, f.calc_center_median().y, f.calc_center_median().z)))

# --- Rear doors: two leaves, locking bars, hinges, contour marking.
dr = Builder("Trailer_RearDoors")
DOOR_Y = REAR - 0.08  # recessed inside the rear portal: no hardware beyond the 12.00 m line
for sx in (-1, 1):
    x_in, x_out = sx * 0.004, sx * (HALF - 0.1)
    dr.box(min(x_in, x_out), max(x_in, x_out), DOOR_Y - 0.01, DOOR_Y + 0.03, FLOOR_TOP - 0.02, ROOF_TOP - 0.22, "panel")
    for bx in (0.32, 0.86):
        dr.cylinder((sx * bx, DOOR_Y + 0.055, (FLOOR_TOP + ROOF_TOP - 0.22) / 2), "z", 0.017, ROOF_TOP - 0.36 - FLOOR_TOP, "steel", 10)
        dr.box(sx * bx - 0.03, sx * bx + 0.03, DOOR_Y + 0.03, DOOR_Y + 0.08, 0.95, 1.05, "steel")  # handle
    for hz in (0.45, 1.25, 2.05, ROOF_TOP - 0.45):
        x = sx * (HALF - 0.12)
        dr.box(min(x, x + sx * 0.09), max(x, x + sx * 0.09), DOOR_Y + 0.03, DOOR_Y + 0.06, hz - 0.06, hz + 0.06, "steel")
    x0, x1 = sx * 0.02, sx * (HALF - 0.12)
    dr.box(min(x0, x1), max(x0, x1), DOOR_Y + 0.031, DOOR_Y + 0.033, FLOOR_TOP + 0.02, FLOOR_TOP + 0.07, "reflective")
    xs = sx * (HALF - 0.16)
    dr.box(min(xs, xs + sx * 0.05), max(xs, xs + sx * 0.05), DOOR_Y + 0.031, DOOR_Y + 0.033, FLOOR_TOP + 0.1, ROOF_TOP - 0.35, "reflective")
doors = dr.finish(root)

# --- Landing gear: two legs, cross brace, diagonal braces, crank box.
lg = Builder("Trailer_LandingGear")
FOOT_Z = 0.12 - COUPLING  # feet ≈ 0.12 m above the ground when coupled
for sx in (-1, 1):
    x = sx * 0.95
    lg.box(x - 0.065, x + 0.065, LEGS_Y - 0.065, LEGS_Y + 0.065, FOOT_Z + 0.45, FLOOR_TOP - 0.2, "graphite")
    lg.box(x - 0.05, x + 0.05, LEGS_Y - 0.05, LEGS_Y + 0.05, FOOT_Z + 0.04, FOOT_Z + 0.5, "graphite")
    lg.box(x - 0.13, x + 0.13, LEGS_Y - 0.13, LEGS_Y + 0.13, FOOT_Z, FOOT_Z + 0.04, "graphite")
    lg.box(x - 0.02, x + 0.02, LEGS_Y - 0.9, LEGS_Y - 0.06, FLOOR_TOP - 0.3, FLOOR_TOP - 0.24, "graphite")
lg.box(-0.9, 0.9, LEGS_Y - 0.03, LEGS_Y + 0.03, FOOT_Z + 0.55, FOOT_Z + 0.61, "graphite")
lg.box(-1.1, -1.02, LEGS_Y - 0.08, LEGS_Y + 0.08, FOOT_Z + 0.75, FOOT_Z + 0.9, "dark")  # crank gearbox
landing = lg.finish(root)

# --- Lights (separate objects so the runtime can switch them).
li_tail, li_brake, li_mark = Builder("Lights_Tail"), Builder("Lights_Brake"), Builder("Lights_Marker")
for sx in (-1, 1):
    x = sx * 0.9
    li_tail.box(min(x, x + sx * 0.14), max(x, x + sx * 0.14), REAR - 0.02, REAR, -0.55, -0.43, "tail")
    li_brake.box(min(sx * 0.62, sx * 0.9), max(sx * 0.62, sx * 0.9), REAR - 0.02, REAR, -0.55, -0.43, "brake")
    for y in (FRONT + 0.5, 3.4, 6.9, 10.4, REAR - 0.4):
        # Flush in the side rail: the vehicle stays within 2.55 m.
        li_mark.box(sx * (HALF - 0.01), sx * (HALF - 0.004), y - 0.04, y + 0.04, 0.095, 0.135, "marker")
    li_mark.box(sx * (HALF - 0.24), sx * (HALF - 0.16), FRONT - 0.01, FRONT + 0.002, ROOF_TOP - 0.1, ROOF_TOP - 0.05, "marker")
for b in (li_tail, li_brake, li_mark):
    b.finish(root)

# --- Livery placeholders (Step 3).
empty("Livery_Wordmark", (0, (FRONT + REAR) / 2, (FLOOR_TOP + ROOF_TOP) / 2), body)
empty("Livery_Accent", (0, (FRONT + REAR) / 2, FLOOR_TOP + 0.3), body)

# Coupled pose for inspection: Trailer at the tractor's hitch (0, 0, COUPLING).
trailer.location = (0, 0, COUPLING)
bpy.context.view_layer.update()

meshes = [o for o in scene.objects if o.type == "MESH"]
pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
tris = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes}
print(f"TRAILER W {hi.x - lo.x:.3f} L {hi.y - lo.y:.3f} top {hi.z:.3f} ground {lo.z:.3f}")
print("TRIANGLES", sum(tris.values()), tris if len(tris) < 30 else "")
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("SAVED", OUT)
