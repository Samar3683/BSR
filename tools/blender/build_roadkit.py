"""Builds the hero road kit (Gate B): impostor cards + road surface, as one GLB.

blender -b --python tools/blender/build_roadkit.py -- <work_dir> <out.glb> [only_card_id ...]

Everything is generated here (no downloaded assets): generic, unbranded set pieces
modelled procedurally, lit by a low sunrise sun ahead of the camera (as in the hero's
road stage) and rendered in Cycles as camera-matched impostor cards with baked light
and contact shadows (shadow catcher, transparent film). Cards are trimmed and packed
into two atlases:

  RK_Atlas_Built   — industrial / service / rural buildings, vehicles-in-scene
  RK_Atlas_Nature  — vegetation and passing traffic

Each card becomes an empty node "Card_<id>" whose extras hold its atlas rect (uv),
real-world size (metres) and ground anchor, so the runtime can place it at scale.
The road surface (asphalt with aggregate, wheel paths, patches, sealed cracks, shoulder
dirt, worn Italian motorway markings) is baked with numpy as colour + normal + ORM on
a tile covering the carriageway width and 36 m of road (3 dash cycles).

Card camera: orthographic, looking along +Y (the road direction) from slightly on the
road side (yaw) and slightly above (pitch) — the hero's road-tracking view family.
Buildings sit to the right of the road; the runtime mirrors cards for the left side.
"""

import json
import math
import os
import sys

import bmesh
import bpy
import numpy as np
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
WORK = os.path.abspath(argv[0])
OUT = os.path.abspath(argv[1])
ONLY = set(argv[2:])
CARDS_DIR = os.path.join(WORK, "cards")
os.makedirs(CARDS_DIR, exist_ok=True)
RNG = np.random.default_rng(7)
scene = bpy.context.scene

# ============================================================== scene / render
def reset_scene():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def setup_render():
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 4
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -0.35
    scene.render.resolution_percentage = 100


SUN_ELEVATION = math.radians(9)


def setup_world():
    world = bpy.data.worlds.get("RK_World") or bpy.data.worlds.new("RK_World")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new("ShaderNodeTexSky")
    sky.sky_type = "NISHITA"
    sky.sun_disc = False
    sky.sun_elevation = SUN_ELEVATION
    sky.sun_rotation = math.radians(-4)  # sky glow far ahead (+Y), a touch left (matches the sun lamp)
    sky.air_density = 1.4
    sky.dust_density = 2.5
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = float(os.environ.get("RK_SKY", "0.22"))
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    # Low warm sun ahead of the camera: the road-facing sides sit in soft shadow,
    # edges catch the light, shadows fall long towards the viewer.
    sun_data = bpy.data.lights.new("RK_Sun", "SUN")
    sun_data.energy = float(os.environ.get("RK_SUN", "3.2"))
    sun_data.color = (1.0, 0.80, 0.60)
    sun_data.angle = math.radians(1.2)
    sun = bpy.data.objects.new("RK_Sun", sun_data)
    scene.collection.objects.link(sun)
    d = Vector((-0.07, -1.0, -math.tan(SUN_ELEVATION))).normalized()  # travelling towards the camera
    sun.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    catcher_me = bpy.data.meshes.new("RK_Catcher")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=2000)
    bm.to_mesh(catcher_me)
    bm.free()
    catcher = bpy.data.objects.new("RK_Catcher", catcher_me)
    catcher.is_shadow_catcher = True
    scene.collection.objects.link(catcher)


# ============================================================== materials
_mats = {}


def mix_rgb(nt, blend="MIX"):
    """ShaderNodeMix in RGBA mode; returns (node, A, B, Result) colour sockets
    (the node also carries same-named float/vector sockets)."""
    n = nt.nodes.new("ShaderNodeMix")
    n.data_type = "RGBA"
    n.blend_type = blend
    a = next(s for s in n.inputs if s.name == "A" and s.type == "RGBA")
    b = next(s for s in n.inputs if s.name == "B" and s.type == "RGBA")
    r = next(s for s in n.outputs if s.name == "Result" and s.type == "RGBA")
    return n, a, b, r


def node_mat(name, color, rough=0.6, metal=0.0, bump=None, bump_scale=5.0, bump_strength=0.25,
             noise=0.08, grime=0.18, emission=None, emission_strength=0.0, windows=None,
             translucent=0.0, alpha_image=None, panels=None):
    """Principled material with procedural breakup: colour noise, grime towards the
    ground, optional ribs/door slats/panel bump, window grids (u = x + y, v = z)."""
    key = name
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord.outputs["Object"], sep.inputs["Vector"])

    # Colour: base × (1 ± noise) × grime(z)
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 0.35
    tex.inputs["Detail"].default_value = 6
    nt.links.new(coord.outputs["Object"], tex.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["To Min"].default_value = 1 - noise
    ramp.inputs["To Max"].default_value = 1 + noise
    nt.links.new(tex.outputs["Fac"], ramp.inputs["Value"])
    g = nt.nodes.new("ShaderNodeMapRange")
    g.inputs["From Min"].default_value = 0.0
    g.inputs["From Max"].default_value = 1.8
    g.inputs["To Min"].default_value = 1 - grime
    g.inputs["To Max"].default_value = 1.0
    nt.links.new(sep.outputs["Z"], g.inputs["Value"])
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    nt.links.new(ramp.outputs["Result"], mul.inputs[0])
    nt.links.new(g.outputs["Result"], mul.inputs[1])
    col, col_a, col_b, col_r = mix_rgb(nt, "MULTIPLY")
    col.inputs["Factor"].default_value = 1.0
    col_a.default_value = (*color, 1)
    comb = nt.nodes.new("ShaderNodeCombineColor")
    factor_out = mul.outputs[0]
    panel_fac = None
    if panels:
        # Sandwich-panel construction: seams every `w` m (u = x + y along the wall), a small
        # tone step per panel, and vertical rain / rust streaks that are stronger near the top.
        uv2 = nt.nodes.new("ShaderNodeCombineXYZ")
        xy = nt.nodes.new("ShaderNodeMath")
        xy.operation = "ADD"
        nt.links.new(sep.outputs["X"], xy.inputs[0])
        nt.links.new(sep.outputs["Y"], xy.inputs[1])
        nt.links.new(xy.outputs[0], uv2.inputs["X"])
        nt.links.new(sep.outputs["Z"], uv2.inputs["Y"])
        pb = nt.nodes.new("ShaderNodeTexBrick")
        pb.offset = 0.0
        pb.squash = 1.0
        pb.inputs["Scale"].default_value = 1.0
        pb.inputs["Brick Width"].default_value = panels.get("w", 1.0)
        pb.inputs["Row Height"].default_value = panels.get("h", 60.0)
        pb.inputs["Mortar Size"].default_value = panels.get("seam", 0.03)
        pb.inputs["Mortar Smooth"].default_value = 0.4
        pb.inputs["Color1"].default_value = (1 - panels.get("tone", 0.07),) * 3 + (1,)
        pb.inputs["Color2"].default_value = (1, 1, 1, 1)
        nt.links.new(uv2.outputs["Vector"], pb.inputs["Vector"])
        seam = nt.nodes.new("ShaderNodeMapRange")
        seam.inputs["To Min"].default_value = 0.5
        seam.inputs["To Max"].default_value = 1.0
        nt.links.new(pb.outputs["Fac"], seam.inputs["Value"])
        tone = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(pb.outputs["Color"], tone.inputs["Color"])
        pm = nt.nodes.new("ShaderNodeMath")
        pm.operation = "MULTIPLY"
        nt.links.new(seam.outputs["Result"], pm.inputs[0])
        nt.links.new(tone.outputs["Red"], pm.inputs[1])
        # Streaks: noise stretched along Z.
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1.0, 1.0, 0.07)
        stx = nt.nodes.new("ShaderNodeCombineXYZ")
        nt.links.new(xy.outputs[0], stx.inputs["X"])
        nt.links.new(sep.outputs["Z"], stx.inputs["Z"])
        nt.links.new(stx.outputs["Vector"], mp.inputs["Vector"])
        sn = nt.nodes.new("ShaderNodeTexNoise")
        sn.inputs["Scale"].default_value = 1.7
        sn.inputs["Detail"].default_value = 3.0
        nt.links.new(mp.outputs["Vector"], sn.inputs["Vector"])
        sr = nt.nodes.new("ShaderNodeMapRange")
        sr.inputs["From Min"].default_value = 0.38
        sr.inputs["From Max"].default_value = 0.72
        sr.inputs["To Min"].default_value = 1.0
        sr.inputs["To Max"].default_value = 1.0 - panels.get("streak", 0.28)
        nt.links.new(sn.outputs["Fac"], sr.inputs["Value"])
        pm2 = nt.nodes.new("ShaderNodeMath")
        pm2.operation = "MULTIPLY"
        nt.links.new(pm.outputs[0], pm2.inputs[0])
        nt.links.new(sr.outputs["Result"], pm2.inputs[1])
        pm3 = nt.nodes.new("ShaderNodeMath")
        pm3.operation = "MULTIPLY"
        nt.links.new(mul.outputs[0], pm3.inputs[0])
        nt.links.new(pm2.outputs[0], pm3.inputs[1])
        factor_out = pm3.outputs[0]
        panel_fac = pb.outputs["Fac"]
    for i in range(3):
        nt.links.new(factor_out, comb.inputs[i])
    nt.links.new(comb.outputs["Color"], col_b)
    base_out = col_r

    if windows:
        # Window grid: bricks = panes, mortar = wall. Random per-pane lit windows.
        uv = nt.nodes.new("ShaderNodeCombineXYZ")
        add = nt.nodes.new("ShaderNodeMath")
        add.operation = "ADD"
        nt.links.new(sep.outputs["X"], add.inputs[0])
        nt.links.new(sep.outputs["Y"], add.inputs[1])
        nt.links.new(add.outputs[0], uv.inputs["X"])
        zoff = nt.nodes.new("ShaderNodeMath")
        zoff.operation = "SUBTRACT"
        zoff.inputs[1].default_value = windows.get("z0", 0.0)
        nt.links.new(sep.outputs["Z"], zoff.inputs[0])
        nt.links.new(zoff.outputs[0], uv.inputs["Y"])
        brick = nt.nodes.new("ShaderNodeTexBrick")
        brick.offset = 0.0
        brick.squash = 1.0
        brick.inputs["Scale"].default_value = 1.0
        brick.inputs["Brick Width"].default_value = windows["w"]
        brick.inputs["Row Height"].default_value = windows["h"]
        brick.inputs["Mortar Size"].default_value = windows["mortar"]
        brick.inputs["Mortar Smooth"].default_value = 0.0
        brick.inputs["Color1"].default_value = (0, 0, 0, 1)
        brick.inputs["Color2"].default_value = (1, 1, 1, 1)
        brick.inputs["Bias"].default_value = 0.0
        nt.links.new(uv.outputs["Vector"], brick.inputs["Vector"])
        glass, glass_a, glass_b, glass_r = mix_rgb(nt)
        glass_a.default_value = (*windows.get("glass", (0.03, 0.04, 0.05)), 1)
        nt.links.new(brick.outputs["Fac"], glass.inputs["Factor"])
        nt.links.new(base_out, glass_b)
        base_out = glass_r
        # Glass is smooth; the wall keeps its roughness.
        rmix = nt.nodes.new("ShaderNodeMapRange")
        rmix.inputs["To Min"].default_value = 0.08
        rmix.inputs["To Max"].default_value = rough
        nt.links.new(brick.outputs["Fac"], rmix.inputs["Value"])
        nt.links.new(rmix.outputs["Result"], bsdf.inputs["Roughness"])
        if windows.get("lit"):
            sepc = nt.nodes.new("ShaderNodeSeparateColor")
            nt.links.new(brick.outputs["Color"], sepc.inputs["Color"])
            thr = nt.nodes.new("ShaderNodeMath")
            thr.operation = "GREATER_THAN"
            thr.inputs[1].default_value = 1 - windows["lit"]
            nt.links.new(sepc.outputs["Red"], thr.inputs[0])
            inv = nt.nodes.new("ShaderNodeMath")
            inv.operation = "SUBTRACT"
            inv.inputs[0].default_value = 1.0
            nt.links.new(brick.outputs["Fac"], inv.inputs[1])
            lit = nt.nodes.new("ShaderNodeMath")
            lit.operation = "MULTIPLY"
            nt.links.new(thr.outputs[0], lit.inputs[0])
            nt.links.new(inv.outputs[0], lit.inputs[1])
            bsdf.inputs["Emission Color"].default_value = (1.0, 0.72, 0.42, 1)
            em = nt.nodes.new("ShaderNodeMath")
            em.operation = "MULTIPLY"
            em.inputs[1].default_value = windows.get("lit_strength", 2.5)
            nt.links.new(lit.outputs[0], em.inputs[0])
            nt.links.new(em.outputs[0], bsdf.inputs["Emission Strength"])

    nt.links.new(base_out, bsdf.inputs["Base Color"])

    if bump:
        wave_nodes = []
        axes = {"ribs": ("X", "Y"), "slats": ("Z",), "ribs_h": ("Z",), "furrow_x": ("X",), "furrow_y": ("Y",)}[bump]
        for axis in axes:
            w = nt.nodes.new("ShaderNodeTexWave")
            w.wave_type = "BANDS"
            w.bands_direction = axis
            w.wave_profile = "SAW" if bump == "slats" else "SIN"
            w.inputs["Scale"].default_value = bump_scale
            w.inputs["Distortion"].default_value = 0
            nt.links.new(coord.outputs["Object"], w.inputs["Vector"])
            wave_nodes.append(w)
        height = wave_nodes[0].outputs["Fac"]
        if len(wave_nodes) == 2:
            mx = nt.nodes.new("ShaderNodeMath")
            mx.operation = "ADD"
            nt.links.new(wave_nodes[0].outputs["Fac"], mx.inputs[0])
            nt.links.new(wave_nodes[1].outputs["Fac"], mx.inputs[1])
            height = mx.outputs[0]
        b = nt.nodes.new("ShaderNodeBump")
        b.inputs["Strength"].default_value = bump_strength
        b.inputs["Distance"].default_value = 0.02
        nt.links.new(height, b.inputs["Height"])
        nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])
    elif panel_fac is not None:
        b = nt.nodes.new("ShaderNodeBump")
        b.inputs["Strength"].default_value = 0.5
        b.inputs["Distance"].default_value = 0.01
        nt.links.new(panel_fac, b.inputs["Height"])
        nt.links.new(b.outputs["Normal"], bsdf.inputs["Normal"])

    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = emission_strength

    shader = bsdf.outputs["BSDF"]
    if translucent > 0:
        tr = nt.nodes.new("ShaderNodeBsdfTranslucent")
        tr.inputs["Color"].default_value = (color[0] * 1.6, color[1] * 1.8, color[2] * 0.9, 1)
        mixs = nt.nodes.new("ShaderNodeMixShader")
        mixs.inputs["Fac"].default_value = translucent
        nt.links.new(shader, mixs.inputs[1])
        nt.links.new(tr.outputs["BSDF"], mixs.inputs[2])
        shader = mixs.outputs["Shader"]
    if alpha_image is not None:
        uvn = nt.nodes.new("ShaderNodeUVMap")
        img = nt.nodes.new("ShaderNodeTexImage")
        img.image = alpha_image
        nt.links.new(uvn.outputs["UV"], img.inputs["Vector"])
        transp = nt.nodes.new("ShaderNodeBsdfTransparent")
        mixa = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(img.outputs["Alpha"], mixa.inputs["Fac"])
        nt.links.new(transp.outputs["BSDF"], mixa.inputs[1])
        nt.links.new(shader, mixa.inputs[2])
        shader = mixa.outputs["Shader"]
    nt.links.new(shader, out.inputs["Surface"])
    _mats[key] = m
    return m


def palette():
    P = {}
    panels = {"w": 1.0, "tone": 0.07, "seam": 0.03, "streak": 0.30}
    P["clad_grey"] = node_mat("clad_grey", (0.42, 0.44, 0.46), 0.45, 0.35, bump="ribs", bump_scale=4.0, panels=panels, grime=0.3)
    P["clad_light"] = node_mat("clad_light", (0.60, 0.61, 0.60), 0.5, 0.25, bump="ribs", bump_scale=4.0, panels=panels, grime=0.28)
    P["clad_cream"] = node_mat("clad_cream", (0.64, 0.60, 0.52), 0.55, 0.15, bump="ribs", bump_scale=3.0, panels=panels, grime=0.28)
    P["clad_dark"] = node_mat("clad_dark", (0.12, 0.13, 0.14), 0.5, 0.3, bump="ribs", bump_scale=4.0, panels=panels)
    P["clad_bluegrey"] = node_mat("clad_bluegrey", (0.24, 0.29, 0.34), 0.5, 0.3, bump="ribs", bump_scale=4.0, panels=panels, grime=0.3)
    P["bollard"] = node_mat("bollard", (0.72, 0.52, 0.04), 0.35, 0.1, noise=0.12, grime=0.35)
    P["cabinet"] = node_mat("cabinet", (0.36, 0.38, 0.38), 0.5, 0.3, noise=0.12, grime=0.3)
    P["plate"] = node_mat("plate", (0.75, 0.75, 0.72), 0.5, noise=0.05, grime=0.1)
    P["wallpack"] = node_mat("wallpack", (0.9, 0.92, 0.9), 0.3, emission=(0.85, 0.92, 1.0), emission_strength=7.0, grime=0.0)
    P["roof"] = node_mat("roof", (0.30, 0.31, 0.31), 0.7, 0.2, noise=0.15)
    P["concrete"] = node_mat("concrete", (0.48, 0.47, 0.44), 0.85, 0.0, noise=0.14, grime=0.25)
    P["yard"] = node_mat("yard", (0.25, 0.25, 0.24), 0.9, 0.0, noise=0.2, grime=0.0)
    P["door"] = node_mat("door", (0.38, 0.40, 0.42), 0.45, 0.3, bump="slats", bump_scale=4.0, bump_strength=0.4)
    P["shelter"] = node_mat("shelter", (0.03, 0.03, 0.035), 0.8)
    P["glass"] = node_mat("glass", (0.04, 0.05, 0.06), 0.06, 0.0, noise=0.0, grime=0.0)
    P["glass_lit"] = node_mat("glass_lit", (0.08, 0.07, 0.06), 0.1, emission=(1.0, 0.78, 0.5), emission_strength=1.6, grime=0.0)
    P["steel"] = node_mat("steel", (0.55, 0.56, 0.57), 0.35, 1.0, noise=0.05, grime=0.1)
    P["galv"] = node_mat("galv", (0.62, 0.64, 0.65), 0.45, 0.9, noise=0.1)
    P["dark_metal"] = node_mat("dark_metal", (0.08, 0.085, 0.09), 0.5, 0.6)
    P["trailer_white"] = node_mat("trailer_white", (0.74, 0.74, 0.72), 0.45, 0.0, bump="ribs_h", bump_scale=2.5, bump_strength=0.05, grime=0.25)
    P["trailer_grey"] = node_mat("trailer_grey", (0.42, 0.44, 0.45), 0.5, 0.0, grime=0.25)
    P["trailer_blue"] = node_mat("trailer_blue", (0.12, 0.20, 0.32), 0.5, 0.0, grime=0.25)
    P["trailer_red"] = node_mat("trailer_red", (0.36, 0.08, 0.06), 0.5, 0.0, grime=0.25)
    P["cab_white"] = node_mat("cab_white", (0.78, 0.78, 0.76), 0.3, 0.0, grime=0.15)
    P["cab_blue"] = node_mat("cab_blue", (0.10, 0.18, 0.35), 0.3, 0.3, grime=0.15)
    P["cab_red"] = node_mat("cab_red", (0.42, 0.06, 0.05), 0.3, 0.3, grime=0.15)
    P["tyre"] = node_mat("tyre", (0.02, 0.02, 0.02), 0.85)
    P["canopy"] = node_mat("canopy", (0.80, 0.80, 0.78), 0.4, 0.1, grime=0.0)
    P["canopy_band"] = node_mat("canopy_band", (0.20, 0.23, 0.26), 0.4, 0.3, grime=0.0)
    P["canopy_light"] = node_mat("canopy_light", (0.9, 0.9, 0.88), 0.3, emission=(1.0, 0.95, 0.85), emission_strength=6.0, grime=0.0)
    P["pump"] = node_mat("pump", (0.62, 0.64, 0.66), 0.4, 0.2, grime=0.1)
    P["screen"] = node_mat("screen", (0.05, 0.06, 0.07), 0.2, emission=(0.6, 0.8, 0.9), emission_strength=1.5, grime=0.0)
    P["plaster_cream"] = node_mat("plaster_cream", (0.72, 0.64, 0.50), 0.85, noise=0.1, grime=0.22)
    P["plaster_ochre"] = node_mat("plaster_ochre", (0.70, 0.52, 0.30), 0.85, noise=0.12, grime=0.22)
    P["plaster_white"] = node_mat("plaster_white", (0.76, 0.74, 0.70), 0.85, noise=0.08, grime=0.2)
    P["plaster_rose"] = node_mat("plaster_rose", (0.72, 0.50, 0.42), 0.85, noise=0.1, grime=0.2)
    P["terracotta"] = node_mat("terracotta", (0.48, 0.20, 0.11), 0.8, noise=0.18, grime=0.0, bump="ribs_h", bump_scale=5.0, bump_strength=0.15)
    P["brick"] = node_mat("brick", (0.46, 0.22, 0.14), 0.85, noise=0.2)
    P["rust_roof"] = node_mat("rust_roof", (0.33, 0.24, 0.18), 0.75, 0.3, bump="ribs", bump_scale=5.0, noise=0.25)
    P["hay"] = node_mat("hay", (0.62, 0.48, 0.22), 0.9, noise=0.25, grime=0.1)
    P["hotel_facade"] = node_mat(
        "hotel_facade", (0.78, 0.76, 0.72), 0.8, noise=0.05,
        windows={"w": 3.1, "h": 3.3, "mortar": 0.34, "z0": 0.6, "lit": 0.28, "lit_strength": 2.2, "glass": (0.05, 0.06, 0.07)},
    )
    P["office_facade"] = node_mat(
        "office_facade", (0.55, 0.58, 0.60), 0.4, 0.3,
        windows={"w": 1.6, "h": 3.6, "mortar": 0.12, "z0": 0.4, "lit": 0.12, "lit_strength": 1.5, "glass": (0.05, 0.07, 0.09)},
    )
    P["shop_facade"] = node_mat(
        "shop_facade", (0.20, 0.22, 0.24), 0.3, 0.4,
        windows={"w": 2.0, "h": 3.4, "mortar": 0.06, "z0": 0.3, "lit": 0.95, "lit_strength": 1.8, "glass": (0.10, 0.09, 0.07)},
    )
    P["house_facade"] = node_mat(
        "house_facade", (0.72, 0.62, 0.46), 0.85, noise=0.12, grime=0.2,
        windows={"w": 3.4, "h": 3.0, "mortar": 0.6, "z0": 0.9, "lit": 0.0, "glass": (0.12, 0.09, 0.06)},
    )
    P["fence"] = node_mat("fence", (0.40, 0.42, 0.40), 0.5, 0.6, noise=0.05)
    P["bark"] = node_mat("bark", (0.16, 0.13, 0.10), 0.9, noise=0.2, grime=0.0)
    P["container_red"] = node_mat("container_red", (0.38, 0.12, 0.08), 0.6, 0.3, bump="ribs", bump_scale=3.0)
    P["container_blue"] = node_mat("container_blue", (0.10, 0.20, 0.32), 0.6, 0.3, bump="ribs", bump_scale=3.0)
    P["car_silver"] = node_mat("car_silver", (0.55, 0.56, 0.57), 0.25, 0.7, grime=0.1)
    P["car_dark"] = node_mat("car_dark", (0.05, 0.08, 0.13), 0.25, 0.6, grime=0.1)
    P["car_white"] = node_mat("car_white", (0.78, 0.78, 0.76), 0.25, 0.1, grime=0.1)
    P["car_red"] = node_mat("car_red", (0.40, 0.06, 0.05), 0.25, 0.4, grime=0.1)
    P["tail"] = node_mat("tail", (0.4, 0.02, 0.02), 0.3, emission=(1.0, 0.05, 0.03), emission_strength=1.2, grime=0.0)
    P["head"] = node_mat("head", (0.8, 0.8, 0.8), 0.2, emission=(1.0, 0.95, 0.85), emission_strength=2.5, grime=0.0)
    P["lamp"] = node_mat("lamp", (0.9, 0.85, 0.7), 0.3, emission=(1.0, 0.8, 0.55), emission_strength=5.0, grime=0.0)
    P["grass"] = node_mat("grass", (0.14, 0.16, 0.07), 0.95, noise=0.3, grime=0.0)
    return P


# ============================================================== geometry helpers
def mesh_obj(name, bm, mat, bevel=0.0):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(mat)
    scene.collection.objects.link(o)
    if bevel > 0:
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
    return o


def box(name, center, size, mat, bevel=0.0, rot_z=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
        if rot_z:
            v.co.rotate(__import__("mathutils").Euler((0, 0, rot_z)))
        v.co += Vector(center)
    return mesh_obj(name, bm, mat, bevel)


def cyl(name, center, radius, depth, mat, verts=12, axis="Z", radius2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=radius,
                          radius2=radius if radius2 is None else radius2, depth=depth)
    for v in bm.verts:
        if axis == "X":
            v.co = Vector((v.co.z, v.co.y, v.co.x))
        elif axis == "Y":
            v.co = Vector((v.co.x, v.co.z, v.co.y))
        v.co += Vector(center)
    return mesh_obj(name, bm, mat)


def gable(name, x0, x1, y0, y1, z0, ridge, mat, along="Y"):
    """Pitched roof prism over a rectangle (ridge along `along`)."""
    bm = bmesh.new()
    if along == "Y":
        xm = (x0 + x1) / 2
        pts = [(x0, y0, z0), (x1, y0, z0), (xm, y0, ridge), (x0, y1, z0), (x1, y1, z0), (xm, y1, ridge)]
    else:
        ym = (y0 + y1) / 2
        pts = [(x0, y0, z0), (x0, y1, z0), (x0, ym, ridge), (x1, y0, z0), (x1, y1, z0), (x1, ym, ridge)]
    v = [bm.verts.new(p) for p in pts]
    for f in ((0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)):
        bm.faces.new([v[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, mat)


# ============================================================== vehicles / props
def truck(P, x, y, rot=0.0, cab="cab_white", body="trailer_white", trailer=True, rigid=False):
    """Generic European tractor + trailer (or rigid box truck), nose towards −Y at rot 0."""
    from mathutils import Matrix
    objs = []
    R = Matrix.Rotation(rot, 4, "Z")
    def place(o):
        o.matrix_world = Matrix.Translation((x, y, 0)) @ R
        objs.append(o)
    place(box("cab", (0, -1.2, 2.0), (2.5, 2.3, 2.6), P[cab], bevel=0.12))
    place(box("wind", (0, -2.36, 2.55), (2.2, 0.05, 1.0), P["glass"]))
    place(box("bumper", (0, -2.3, 0.7), (2.5, 0.25, 0.6), P["dark_metal"]))
    place(box("chassis", (0, 3, 0.9), (1.2, 10, 0.4), P["dark_metal"]))
    if trailer or rigid:
        length = 7.5 if rigid else 13.6
        y0 = 0.4 if rigid else 1.4
        place(box("box", (0, y0 + length / 2, 2.55), (2.55, length, 2.9), P[body], bevel=0.05))
    for wy in ([-1.4, 2.0] + ([9.5, 10.8, 12.1] if trailer and not rigid else [6.0])):
        for wx in (-1.05, 1.05):
            place(cyl("wheel", (wx, wy, 0.52), 0.52, 0.4, P["tyre"], verts=14, axis="X"))
    return objs


def car(P, x, y, rot=0.0, paint="car_silver"):
    from mathutils import Matrix
    R = Matrix.Rotation(rot, 4, "Z")
    objs = []
    def place(o):
        o.matrix_world = Matrix.Translation((x, y, 0)) @ R
        objs.append(o)
    place(box("body", (0, 0, 0.62), (1.8, 4.4, 0.7), P[paint], bevel=0.18))
    place(box("cabin", (0, 0.25, 1.2), (1.6, 2.3, 0.55), P["glass"], bevel=0.15))
    for wy in (-1.35, 1.35):
        for wx in (-0.82, 0.82):
            place(cyl("wheel", (wx, wy, 0.33), 0.33, 0.24, P["tyre"], verts=12, axis="X"))
    place(box("tl", (0.6, 2.21, 0.8), (0.35, 0.03, 0.12), P["tail"]))
    place(box("tl", (-0.6, 2.21, 0.8), (0.35, 0.03, 0.12), P["tail"]))
    place(box("hl", (0.6, -2.21, 0.72), (0.35, 0.03, 0.1), P["head"]))
    place(box("hl", (-0.6, -2.21, 0.72), (0.35, 0.03, 0.1), P["head"]))
    return objs


def van(P, x, y, rot=0.0):
    from mathutils import Matrix
    R = Matrix.Rotation(rot, 4, "Z")
    objs = []
    def place(o):
        o.matrix_world = Matrix.Translation((x, y, 0)) @ R
        objs.append(o)
    place(box("body", (0, 0.4, 1.35), (2.0, 5.2, 2.2), P["car_white"], bevel=0.14))
    place(box("hood", (0, -2.55, 0.85), (1.95, 1.0, 1.0), P["car_white"], bevel=0.2))
    place(box("wind", (0, -2.05, 1.75), (1.8, 0.05, 0.8), P["glass"]))
    for wy in (-2.1, 1.9):
        for wx in (-0.88, 0.88):
            place(cyl("wheel", (wx, wy, 0.36), 0.36, 0.25, P["tyre"], axis="X"))
    place(box("tl", (0.85, 3.02, 1.0), (0.2, 0.03, 0.4), P["tail"]))
    place(box("tl", (-0.85, 3.02, 1.0), (0.2, 0.03, 0.4), P["tail"]))
    place(box("hl", (0.7, -3.06, 0.95), (0.3, 0.03, 0.14), P["head"]))
    place(box("hl", (-0.7, -3.06, 0.95), (0.3, 0.03, 0.14), P["head"]))
    return objs


def lamp_post(P, x, y, h=10.0, arm=1.6, facing=-1):
    objs = [cyl("pole", (x, y, h / 2), 0.09, h, P["galv"], verts=8, radius2=0.06)]
    objs.append(box("arm", (x + facing * arm / 2, y, h - 0.1), (arm, 0.08, 0.08), P["galv"]))
    objs.append(box("head", (x + facing * arm, y, h - 0.25), (0.7, 0.3, 0.12), P["dark_metal"]))
    objs.append(box("lens", (x + facing * arm, y, h - 0.32), (0.6, 0.25, 0.02), P["lamp"]))
    return objs


def fence(P, x0, y0, x1, y1, h=2.4):
    """Wire-mesh fence with posts: posts as geometry, mesh as a thin dark translucent-looking band."""
    objs = []
    length = math.hypot(x1 - x0, y1 - y0)
    n = max(2, int(length / 3))
    for i in range(n + 1):
        t = i / n
        objs.append(cyl("fpost", (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, h / 2), 0.04, h, P["fence"], verts=6))
    ang = math.atan2(y1 - y0, x1 - x0)
    mesh_mat = node_mat("fence_mesh", (0.30, 0.32, 0.31), 0.5, 0.6, bump="ribs", bump_scale=12, bump_strength=0.6, noise=0.0)
    band = box("fmesh", ((x0 + x1) / 2, (y0 + y1) / 2, h / 2 + 0.05), (length, 0.02, h - 0.1), mesh_mat, rot_z=ang)
    objs.append(band)
    objs.append(box("frail", ((x0 + x1) / 2, (y0 + y1) / 2, h), (length, 0.05, 0.05), P["fence"], rot_z=ang))
    return objs


def roof_kit(P, x0, x1, y0, y1, z, count, seed):
    rng = np.random.default_rng(seed)
    objs = []
    for _ in range(count):
        w, d, h = rng.uniform(2, 5), rng.uniform(1.5, 3.5), rng.uniform(1.0, 2.2)
        cx, cy = rng.uniform(x0 + 3, x1 - 3), rng.uniform(y0 + 3, y1 - 3)
        objs.append(box("hvac", (cx, cy, z + h / 2), (w, d, h), P["clad_light"], bevel=0.05))
        if rng.random() < 0.5:
            objs.append(cyl("fan", (cx, cy, z + h + 0.15), min(w, d) * 0.3, 0.3, P["dark_metal"], verts=14))
    for _ in range(count):
        objs.append(cyl("vent", (rng.uniform(x0 + 2, x1 - 2), rng.uniform(y0 + 2, y1 - 2), z + 0.9), 0.35, 1.8, P["galv"], verts=10))
    return objs


# ============================================================== set pieces
def facade_details(P, x0, y0, y1, H, door_ys, seed, sill=1.2):
    """The construction evidence a wall needs to read as built: eaves gutter + downpipes (with a
    rain-wash streak below each), a wall-pack lantern and bay-number plate above every dock door,
    steel bollards either side, utility cabinets and a personnel door at the ends. The façade
    plane is x = x0 and the wall faces −X (towards the yard / road)."""
    rng = np.random.default_rng(seed)
    o = []
    length = y1 - y0
    o.append(box("gutter", ((x0 - 0.13), (y0 + y1) / 2, H - 1.35), (0.24, length, 0.17), P["galv"]))
    for y in np.arange(y0 + 9, y1 - 5, 24.0 + rng.uniform(-2, 2)):
        o.append(cyl("downpipe", (x0 - 0.17, y, (H - 1.4) / 2), 0.055, H - 1.4, P["galv"], verts=8))
        o.append(box("dp_bracket", (x0 - 0.1, y, H * 0.35), (0.16, 0.16, 0.06), P["dark_metal"]))
        o.append(box("dp_bracket", (x0 - 0.1, y, H * 0.7), (0.16, 0.16, 0.06), P["dark_metal"]))
        o.append(box("dp_foot", (x0 - 0.2, y, 0.2), (0.22, 0.2, 0.4), P["galv"]))
    for k, y in enumerate(door_ys):
        o.append(box("packbody", (x0 - 0.3, y, sill + 4.3), (0.32, 0.95, 0.3), P["cabinet"]))
        o.append(box("packlens", (x0 - 0.47, y, sill + 4.23), (0.04, 0.82, 0.17), P["wallpack"]))
        o.append(box("bayplate", (x0 - 0.05, y + 0.05, sill + 3.85), (0.06, 0.55, 0.36), P["plate"]))
        for dy in (-2.0, 2.0):
            o.append(cyl("bollard", (x0 - 1.7, y + dy, 0.55), 0.09, 1.1, P["bollard"], verts=10))
            o.append(cyl("bollard_cap", (x0 - 1.7, y + dy, 1.12), 0.09, 0.04, P["dark_metal"], verts=10))
            o.append(cyl("bollard_base", (x0 - 1.7, y + dy, 0.03), 0.16, 0.05, P["steel"], verts=10))
        # Compressed rubber bumpers either side of the opening.
        for dy in (-1.6, 1.6):
            o.append(box("bumper", (x0 - 0.13, y + dy, sill - 0.1), (0.2, 0.18, 0.5), P["shelter"]))
    for y in (y0 + 3.5, y1 - 3.5):
        o.append(box("cabinet", (x0 - 0.35, y, 0.9), (0.6, 1.1, 1.8), P["cabinet"], bevel=0.02))
        o.append(box("conduit", (x0 - 0.06, y, 3.6), (0.06, 0.06, 3.6), P["dark_metal"]))
    o.append(box("pdoor", (x0 - 0.06, y0 + 7.0, 1.05), (0.12, 1.0, 2.1), P["door"]))
    o.append(box("pdoor_light", (x0 - 0.25, y0 + 7.0, 2.6), (0.22, 0.32, 0.14), P["wallpack"]))
    return o


def warehouse_long(P):
    """Distribution warehouse: long side facing the road with dock doors. No vehicles baked in
    (parked trailers are their own controlled card)."""
    o = []
    L, D, H = 120.0, 48.0, 12.0
    x0 = 0.0  # road-facing façade plane (the yard is at −X)
    o.append(box("hall", (x0 + D / 2, 0, H / 2), (D, L, H), P["clad_grey"]))
    o.append(box("fascia", (x0 + D / 2, 0, H - 0.6), (D + 0.3, L + 0.3, 1.2), P["clad_dark"]))
    o.append(box("coping", (x0 + D / 2, 0, H + 0.14), (D + 0.5, L + 0.5, 0.18), P["galv"]))
    o.append(box("plinth", (x0 + D / 2, 0, 0.6), (D + 0.1, L + 0.1, 1.2), P["concrete"]))
    o.append(box("roof", (x0 + D / 2, 0, H + 0.05), (D, L, 0.1), P["roof"]))
    doors = np.arange(-L / 2 + 8, L / 2 - 6, 5.0)
    for i, y in enumerate(doors):
        open_door = i in (4, 11)
        o.append(box("door", (x0 - 0.06, y, 1.2 + (2.9 if open_door else 1.6)), (0.12, 3.0, 0.5 if open_door else 3.2), P["door"]))
        if open_door:
            o.append(box("dark_bay", (x0 + 0.3, y, 1.2 + 1.5), (0.4, 2.9, 3.0), P["shelter"]))
        o.append(box("shelter", (x0 - 0.35, y, 1.2 + 1.8), (0.7, 3.6, 3.8), P["shelter"]))
        o.append(box("leveller", (x0 - 0.5, y, 0.6), (1.0, 3.0, 1.2), P["concrete"]))
    o += facade_details(P, x0, -L / 2, L / 2, H, doors, 21)
    o += roof_kit(P, x0, x0 + D, -L / 2, L / 2, H, 9, 11)
    o.append(box("apron", (x0 - 16, 0, 0.02), (32, L + 10, 0.04), P["yard"]))
    o += fence(P, x0 - 34, -L / 2 - 4, x0 - 34, L / 2 + 4)
    for y in (-45, -5, 35):
        o += lamp_post(P, x0 - 30, y, 11, facing=1)
    return o


def _trailer_only(P, x, y, body):
    """Parked semi-trailer nose-in at a dock door (landing gear down)."""
    o = [box("trailer", (x, y, 2.6), (13.6, 2.55, 2.9), P[body], bevel=0.05)]
    o.append(box("gear", (x - 4.5, y, 0.6), (0.2, 2.0, 1.2), P["dark_metal"]))
    for wx in (x + 4.2, x + 5.5):
        for wy in (y - 1.05, y + 1.05):
            o.append(cyl("wheel", (wx, wy, 0.52), 0.52, 0.4, P["tyre"], axis="Y"))
    return o


def distribution_center(P):
    o = []
    L, D, H = 90.0, 60.0, 14.0
    o.append(box("hall", (D / 2, 0, H / 2), (D, L, H), P["clad_light"]))
    o.append(box("band", (D / 2, 0, H - 1.2), (D + 0.2, L + 0.2, 0.9), P["clad_bluegrey"]))
    o.append(box("plinth", (D / 2, 0, 0.5), (D + 0.1, L + 0.1, 1.0), P["concrete"]))
    # Two-storey office block on the near (−Y) corner, ribbon windows.
    o.append(box("office", (12, -L / 2 - 6, 4.2), (24, 12, 8.4), P["office_facade"]))
    o.append(box("office_roof", (12, -L / 2 - 6, 8.5), (24.4, 12.4, 0.3), P["clad_dark"]))
    o.append(box("entrance", (-0.4, -L / 2 - 6, 1.6), (0.8, 5, 3.2), P["glass_lit"]))
    dc_doors = np.arange(-L / 2 + 8, L / 2 - 4, 5.5)
    for i, y in enumerate(dc_doors):
        o.append(box("door", (-0.06, y, 2.8), (0.12, 3.0, 3.2), P["door"]))
        o.append(box("shelter", (-0.35, y, 3.0), (0.7, 3.6, 3.8), P["shelter"]))
    o += facade_details(P, 0.0, -L / 2 + 3, L / 2, H, dc_doors, 23, sill=1.2)
    o += roof_kit(P, 0, D, -L / 2, L / 2, H, 8, 21)
    o.append(box("apron", (-15, 0, 0.02), (30, L + 30, 0.04), P["yard"]))
    o += fence(P, -30, -L / 2 - 16, -30, L / 2 + 4)
    o.append(box("barrier", (-30, -L / 2 - 10, 1.0), (0.1, 5, 0.1), P["trailer_red"]))
    for y in (-30, 10):
        o += lamp_post(P, -26, y, 10, facing=1)
    return o


def yard_trailers(P):
    o = [box("yard", (0, 0, 0.02), (40, 70, 0.04), P["yard"])]
    rng = np.random.default_rng(5)
    bodies = ["trailer_white", "trailer_grey", "trailer_blue", "trailer_white", "trailer_red", "trailer_white"]
    for i, y in enumerate(np.arange(-28, 30, 4.2)[:12]):
        if rng.random() < 0.8:
            o += _trailer_only(P, 2 + rng.uniform(-0.6, 0.6), y, bodies[i % len(bodies)])
    for i, y in enumerate((-40, -33.5)):
        o.append(box("container", (-10, y, 1.3), (12.2, 2.44, 2.6), P["container_red" if i else "container_blue"]))
    o.append(box("container", (-10, -36.8, 3.9), (12.2, 2.44, 2.6), P["container_blue"]))
    o += fence(P, -18, -45, -18, 38)
    o += fence(P, -18, -45, 20, -45)
    for y in (-30, 0, 30):
        o += lamp_post(P, -16, y, 12, facing=1)
    o.append(box("cabin", (-12, 25, 1.4), (6, 3, 2.8), P["clad_cream"]))
    return o


def pylon(P):
    """Lattice transmission tower (thin members)."""
    o = []
    H = 38.0
    def member(a, b, r=0.09):
        a, b = Vector(a), Vector(b)
        mid = (a + b) / 2
        d = b - a
        c = cyl("m", (0, 0, 0), r, d.length, P["galv"], verts=4)
        c.matrix_world = __import__("mathutils").Matrix.Translation(mid) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
        o.append(c)
    base, top = 4.0, 1.0
    for sx, sy in ((1, 1), (1, -1), (-1, 1), (-1, -1)):
        member((sx * base, sy * base, 0), (sx * top, sy * top, H))
    for z in np.linspace(0, H, 9)[:-1]:
        w0 = base + (top - base) * z / H
        w1 = base + (top - base) * (z + H / 8) / H
        for s in (1, -1):
            member((-w0, s * w0, z), (w0, s * w1, z + H / 8), 0.05)
            member((s * w0, -w0, z), (s * w1, w0, z + H / 8), 0.05)
    for z, span in ((H * 0.62, 9.0), (H * 0.8, 7.0), (H * 0.96, 5.0)):
        member((0, -span, z), (0, span, z), 0.12)
    return o


def industrial_skyline(P):
    """Far layer: a band of sheds, silos, a lattice mast and stacks (no smoke)."""
    o = []
    rng = np.random.default_rng(9)
    y = -200.0
    mats = [P["clad_grey"], P["clad_light"], P["clad_cream"], P["clad_bluegrey"]]
    while y < 200:
        w = rng.uniform(25, 70)
        h = rng.uniform(7, 18)
        d = rng.uniform(30, 60)
        xoff = rng.uniform(0, 60)
        o.append(box("shed", (xoff + d / 2, y + w / 2, h / 2), (d, w, h), mats[int(rng.integers(0, 4))]))
        if rng.random() < 0.35:
            o.append(cyl("silo", (xoff - 4, y + 5, 11), 3.5, 22, P["galv"], verts=16))
            o.append(cyl("silo", (xoff - 4, y + 13, 11), 3.5, 22, P["galv"], verts=16))
        if rng.random() < 0.2:
            o.append(cyl("stack", (xoff + 10, y + w / 2, 18), 1.2, 36, P["concrete"], verts=12, radius2=0.9))
        y += w + rng.uniform(5, 25)
    return o


def fuel_station(P):
    """Generic motorway service area: canopy + pumps, shop/café, truck and car parking. No brands."""
    o = []
    # Forecourt paving.
    o.append(box("forecourt", (10, 0, 0.02), (70, 90, 0.04), P["concrete"]))
    # Canopy 34 × 16 on 6 columns, clean fascia with a dark band (no text, no logos).
    o.append(box("canopy", (0, 0, 5.8), (16, 34, 1.1), P["canopy"], bevel=0.05))
    o.append(box("band", (0, 0, 5.55), (16.1, 34.1, 0.3), P["canopy_band"]))
    for y in (-11, 0, 11):
        o.append(box("light", (-3.5, y, 5.23), (5, 6, 0.04), P["canopy_light"]))
        o.append(box("light", (3.5, y, 5.23), (5, 6, 0.04), P["canopy_light"]))
    for y in (-14, 0, 14):
        for x in (-5, 5):
            o.append(box("column", (x, y, 2.6), (0.45, 0.45, 5.2), P["canopy"]))
    for y in (-11, 0, 11):
        o.append(box("island", (0, y, 0.12), (1.6, 7.5, 0.24), P["concrete"]))
        for dy in (-2.2, 2.2):
            o.append(box("pump", (0, y + dy, 1.05), (0.8, 1.1, 1.9), P["pump"], bevel=0.04))
            o.append(box("screen", (-0.41, y + dy, 1.4), (0.02, 0.6, 0.4), P["screen"]))
    # Forecourt furniture instead of parked vehicles: pump-island bollards, kerbed island ends,
    # bins, a windscreen-wash station and an air/water cabinet.
    for y in (-11, 0, 11):
        for dy in (-3.9, 3.9):
            o.append(cyl("bollard", (0, y + dy, 0.55), 0.1, 1.1, P["bollard"], verts=10))
        o.append(box("wash", (2.4, y + 3.2, 0.5), (0.5, 0.5, 1.0), P["cabinet"]))
    for x in (-5, 5):
        for y in (-14, 0, 14):
            o.append(box("colguard", (x, y, 0.5), (0.7, 0.7, 1.0), P["bollard"], bevel=0.03))
            o.append(box("colbase", (x, y, 0.03), (0.75, 0.75, 0.06), P["steel"]))
    o.append(box("bin", (12, 20, 0.5), (0.6, 0.6, 1.0), P["canopy_band"]))
    o.append(box("airwater", (12.5, -18, 0.75), (0.5, 0.9, 1.5), P["cabinet"]))
    for y in np.arange(-32, 33, 8.0):  # parking-bay markings on the hardstand
        o.append(box("bay", (18.5, y, 0.05), (0.12, 4.5, 0.02), P["plate"]))
    # Shop / café behind the canopy: low flat roof, glazed lit front, terrace.
    o.append(box("shop", (24, 4, 2.4), (14, 30, 4.8), P["clad_light"]))
    o.append(box("shopfront", (16.95, 4, 2.1), (0.1, 26, 3.6), P["shop_facade"]))
    o.append(box("shoproof", (23.4, 4, 4.95), (16, 32, 0.3), P["canopy_band"]))
    o.append(box("terrace", (14.5, 12, 3.4), (5, 10, 0.2), P["canopy"]))
    for y in (8, 12, 16):
        o.append(cyl("table", (13.5, y, 0.4), 0.45, 0.05, P["steel"], verts=10))
    # Anonymous price pylon: blank panels only.
    o.append(box("pylon", (-12, -40, 4.5), (0.8, 2.4, 9.0), P["canopy_band"]))
    o.append(box("panel", (-12.42, -40, 6.5), (0.02, 2.0, 3.6), P["canopy"]))
    # Truck hardstand beyond the shop: marked bays only (vehicles are separate controlled assets).
    for y in np.arange(-34, -12, 3.6):
        o.append(box("bay", (32, y, 0.05), (16, 0.12, 0.02), P["plate"]))
    o += lamp_post(P, -10, 30, 10, facing=1)
    o += lamp_post(P, 20, -40, 10, facing=-1)
    return o


def hotel(P):
    """Low roadside hotel (3 floors), lit entrance, car and truck parking."""
    o = []
    L, D, H = 60.0, 14.0, 10.5
    o.append(box("lot", (-10, 0, 0.02), (40, 90, 0.04), P["yard"]))
    o.append(box("hotel", (D / 2, 0, H / 2), (D, L, H), P["hotel_facade"]))
    o.append(box("hroof", (D / 2, 0, H + 0.25), (D + 0.6, L + 0.6, 0.5), P["clad_dark"]))
    o.append(box("stair", (D / 2, L / 2 + 2.5, H / 2 + 1), (6, 5, H + 2), P["plaster_white"]))
    o.append(box("canopy", (-2.2, -10, 3.4), (4.5, 10, 0.35), P["canopy_band"]))
    o.append(box("entrance", (-0.06, -10, 1.5), (0.12, 7, 3.0), P["glass_lit"]))
    for y in (-18, -10, -2):
        o.append(box("planter", (-5, y, 0.4), (1.2, 1.2, 0.8), P["concrete"]))
    for y in np.arange(-24, 24, 2.8):  # car-park bay lines, no parked vehicles
        o.append(box("bay", (-13, y, 0.05), (4.6, 0.1, 0.02), P["plate"]))
    o += lamp_post(P, -22, -20, 9, facing=1)
    o += lamp_post(P, -22, 10, 9, facing=1)
    return o


def restaurant(P):
    o = []
    o.append(box("lot", (-8, 0, 0.02), (40, 70, 0.04), P["yard"]))
    o.append(box("rest", (9, 0, 2.3), (18, 32, 4.6), P["plaster_white"]))
    o.append(box("front", (-0.05, -2, 2.0), (0.1, 24, 3.2), P["shop_facade"]))
    o.append(box("roof", (8.5, 0, 4.85), (20, 34, 0.5), P["clad_dark"]))
    o.append(box("pergola", (-3, -2, 3.2), (6, 24, 0.2), P["clad_dark"]))
    for y in np.arange(-13, 12, 5):
        o.append(box("post", (-5.8, y, 1.6), (0.15, 0.15, 3.2), P["clad_dark"]))
    for y in (-26, -19, 16, 23):
        o.append(box("bay", (-20, y, 0.05), (14, 0.12, 0.02), P["plate"]))
    o += lamp_post(P, -16, 0, 9, facing=1)
    return o


def truck_parking(P):
    o = [box("lot", (0, 0, 0.02), (40, 70, 0.04), P["yard"])]
    for i, y in enumerate(np.arange(-24, 26, 8)):  # marked hardstand bays (line pairs), empty
        o.append(box("bay", (0, y - 3.4, 0.05), (18, 0.12, 0.02), P["plate"]))
        o.append(box("bay", (0, y + 3.4, 0.05), (18, 0.12, 0.02), P["plate"]))
    for y in (-20, 20):
        o += lamp_post(P, -14, y, 11, facing=1)
    return o


def farm_shed(P):
    o = []
    o.append(box("shed", (8, 0, 3.0), (16, 30, 6.0), P["brick"]))
    o.append(gable("roof", -0.8, 16.8, -15.8, 15.8, 6.0, 8.6, P["rust_roof"]))
    o.append(box("open", (-0.05, 0, 2.6), (0.1, 26, 5.0), P["shelter"]))
    for y in np.arange(-11, 12, 2.4):
        for z in (0.6, 1.8, 3.0):
            o.append(box("bale", (1.4, y, z), (2.2, 2.2, 1.15), P["hay"], bevel=0.25))
    o.append(cyl("silo", (18, 20, 7), 3.0, 14, P["galv"], verts=16))
    o.append(cyl("silo_top", (18, 20, 14.8), 3.0, 1.6, P["galv"], verts=16, radius2=0.4))
    o.append(box("yard", (-6, 0, 0.02), (14, 50, 0.04), P["yard"]))
    return o


def low_shed(P):
    o = []
    o.append(box("shed", (15, 0, 3.5), (30, 45, 7.0), P["clad_cream"]))
    o.append(gable("roof", -0.3, 30.3, -22.8, 22.8, 7.0, 8.8, P["clad_grey"]))
    for y in (-12, 0, 12):
        o.append(box("door", (-0.06, y, 2.4), (0.12, 4.5, 4.8), P["door"]))
    o.append(box("yard", (-8, 0, 0.02), (16, 50, 0.04), P["yard"]))
    return o


def farmhouse(P):
    """Po valley cascina: long rural house + barn under terracotta roofs."""
    o = []
    o.append(box("house", (6, -10, 4.5), (12, 18, 9.0), P["house_facade"]))
    o.append(gable("roof", -0.6, 12.6, -19.6, -0.4, 9.0, 11.2, P["terracotta"]))
    o.append(box("barn", (6, 10, 3.8), (12, 22, 7.6), P["brick"]))
    o.append(gable("broof", -0.6, 12.6, -1.0, 21.6, 7.6, 9.6, P["terracotta"]))
    o.append(box("arch", (-0.05, 10, 2.8), (0.1, 16, 5.0), P["shelter"]))
    return o


def village(P):
    """Distant town edge: houses with terracotta roofs, a bell tower, a few trees (far layer)."""
    o = []
    rng = np.random.default_rng(13)
    facades = [P["plaster_cream"], P["plaster_ochre"], P["plaster_white"], P["plaster_rose"]]
    for i in range(46):
        x = rng.uniform(0, 110)
        y = rng.uniform(-150, 150)
        w, d = rng.uniform(9, 18), rng.uniform(8, 14)
        h = rng.choice([6.5, 9.5, 12.5])
        o.append(box("house", (x, y, h / 2), (d, w, h), facades[int(rng.integers(0, 4))]))
        o.append(gable("roof", x - d / 2 - 0.4, x + d / 2 + 0.4, y - w / 2 - 0.4, y + w / 2 + 0.4, h, h + 2.2, P["terracotta"],
                       along="Y" if rng.random() < 0.5 else "X"))
    # Campanile (a generic bell tower; every northern Italian town has one).
    o.append(box("tower", (45, 10, 16), (5, 5, 32), P["brick"]))
    o.append(box("belfry", (45, 10, 33.5), (5.4, 5.4, 3), P["plaster_cream"]))
    o.append(gable("spire", 42.2, 47.8, 7.2, 12.8, 35.0, 40.0, P["terracotta"]))
    o.append(box("church", (58, 10, 7), (24, 12, 14), P["plaster_cream"]))
    o.append(gable("croof", 45.6, 70.4, 3.6, 16.4, 14, 17.5, P["terracotta"], along="X"))
    return o


def overpass_prop(P):
    return []


# ============================================================== vegetation
# Real tree structure: a recursive branching skeleton (tapered bark tubes) carries
# lobed foliage clusters at its tips, so crowns are asymmetric, gappy and let the
# low sun through (translucent leaves), instead of a sphere of identical cards.
def leaf_texture():
    """Broadleaf silhouette (pointed tip, slightly lobed edge, midrib notch) as alpha."""
    size = 96
    yy, xx = np.mgrid[0:size, 0:size]
    u = (xx + 0.5) / size * 2 - 1  # across the blade
    v = (yy + 0.5) / size  # 0 = stem end, 1 = tip
    width = 0.62 * np.sin(np.pi * np.clip(v, 0, 1) ** 0.75) * (1.0 - 0.25 * v)
    lobes = 1.0 + 0.10 * np.sin(v * 34.0)
    leaf = (np.abs(u) <= width * lobes) & (v > 0.04) & (v < 0.985)
    img = bpy.data.images.new("leaf_alpha", size, size, alpha=True)
    px = np.zeros((size, size, 4), np.float32)
    px[..., :3] = 1.0
    px[..., 3] = leaf.astype(np.float32)
    img.pixels = px.ravel()
    return img


def needle_texture():
    """Narrow lanceolate leaf for poplars / willows / grass blades."""
    size = 64
    yy, xx = np.mgrid[0:size, 0:size]
    u = (xx + 0.5) / size * 2 - 1
    v = (yy + 0.5) / size
    width = 0.34 * np.sin(np.pi * np.clip(v, 0, 1) ** 0.8)
    leaf = (np.abs(u) <= width) & (v > 0.03) & (v < 0.99)
    img = bpy.data.images.new("needle_alpha", size, size, alpha=True)
    px = np.zeros((size, size, 4), np.float32)
    px[..., :3] = 1.0
    px[..., 3] = leaf.astype(np.float32)
    img.pixels = px.ravel()
    return img


_leaf_img = None
_needle_img = None


def _leaf_image(kind):
    global _leaf_img, _needle_img
    if kind == "needle":
        if _needle_img is None:
            _needle_img = needle_texture()
        return _needle_img
    if _leaf_img is None:
        _leaf_img = leaf_texture()
    return _leaf_img


def _shade(color, k):
    return tuple(min(1.0, c * k) for c in color)


def foliage(name, clusters, color, seed, leaf=0.14, kind="broad", per=200, flat=0.0):
    """Leaf cards scattered in lobes. `clusters` = [(centre Vector, radius Vector3-ish, weight)].
    Leaves are split over three tonal materials (deep shade / body / sun-yellow) so a crown
    reads as light and shadow, and each card stands roughly outward (crown-facing) with jitter."""
    rng = np.random.default_rng(seed)
    img = _leaf_image(kind)
    tones = [(0.55, 0.85), (1.0, 1.0), (1.55, 1.25)]
    weights = [0.32, 0.46, 0.22]
    bms = [bmesh.new() for _ in tones]
    uvs = [b.loops.layers.uv.new("UVMap") for b in bms]
    mats = []
    for i, (kc, kg) in enumerate(tones):
        r, g, b = color
        col = (min(1.0, r * kc * 1.15), min(1.0, g * kc * kg), b * kc * 0.8)
        mats.append(node_mat(f"lv_{name}_{seed}_{i}", col, 0.65, translucent=0.55, noise=0.18, grime=0.0, alpha_image=img))
    all_c = [c[0] for c in clusters]
    crown_c = sum(all_c, Vector((0, 0, 0))) / max(1, len(all_c))
    for centre, radii, weight in clusters:
        n = int(per * weight)
        for _ in range(n):
            d = rng.normal(size=3)
            d /= np.linalg.norm(d)
            r = rng.uniform(0.25, 1.0) ** 0.55
            p = centre + Vector((d[0] * radii[0] * r, d[1] * radii[1] * r, d[2] * radii[2] * r * (1 - flat)))
            out = (p - crown_c)
            if out.length < 1e-4:
                out = Vector((0, 0, 1))
            nrm = (out.normalized() * 0.55 + Vector(rng.normal(size=3)).normalized() * 0.65).normalized()
            t = nrm.orthogonal().normalized()
            b = nrm.cross(t)
            ang = rng.uniform(0, 2 * math.pi)
            t, b = t * math.cos(ang) + b * math.sin(ang), -t * math.sin(ang) + b * math.cos(ang)
            s = leaf * rng.uniform(0.7, 1.35)
            # Light on the sky/sun side, shade deep inside and underneath.
            shade = np.clip(0.5 + 0.9 * (r - 0.5) + 0.35 * (p.z - crown_c.z) / max(radii[2], 0.5), 0, 1)
            pick_i = int(rng.choice(3, p=np.array([weights[0] * (1.4 - shade), weights[1], weights[2] * (0.4 + shade)]) /
                                    (weights[0] * (1.4 - shade) + weights[1] + weights[2] * (0.4 + shade))))
            bm, uv_layer = bms[pick_i], uvs[pick_i]
            verts = [bm.verts.new(p + t * (sx * s * 0.6) + b * (sy * s * 0.5 + s * 0.5)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            f = bm.faces.new(verts)
            for loop, (uu, vv) in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
                loop[uv_layer].uv = (uu, vv)
    return [mesh_obj(f"foliage_{name}_{i}", bm, mats[i]) for i, bm in enumerate(bms)]


def bark_tubes(name, tubes, mat, sides=6):
    """One mesh from many tapered tubes: [(points Nx3, radii N)]."""
    bm = bmesh.new()
    for pts, radii in tubes:
        pts = [Vector(p) for p in pts]
        rings = []
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            a = t.orthogonal().normalized()
            b = t.cross(a)
            ring = [bm.verts.new(p + (a * math.cos(2 * math.pi * k / sides) + b * math.sin(2 * math.pi * k / sides)) * radii[i])
                    for k in range(sides)]
            rings.append(ring)
        for i in range(len(rings) - 1):
            for k in range(sides):
                bm.faces.new([rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]])
    return mesh_obj(name, bm, mat)


def _grow(rng, tubes, tips, start, direction, length, radius, depth, spread=0.85, up=0.35, seg=5, jit=0.10):
    pts = [Vector(start)]
    d = Vector(direction).normalized()
    for _ in range(seg):
        d = (d + Vector(rng.normal(0, jit, 3)) + Vector((0, 0, 0.02))).normalized()
        pts.append(pts[-1] + d * length / seg)
    radii = list(np.linspace(radius, max(radius * 0.5, 0.012), seg + 1))
    tubes.append((pts, radii))
    if depth == 0:
        tips.append((pts[-1], d, length))
        return
    kids = int(rng.integers(2, 4)) + (1 if depth >= 2 else 0)
    for k in range(kids):
        tj = rng.uniform(0.35, 1.0) if k < kids - 1 else 1.0
        base = pts[min(len(pts) - 1, max(1, int(tj * seg)))]
        rnd = Vector(rng.normal(size=3))
        rnd.z = abs(rnd.z) * up
        nd = (d * (1.0 - spread * 0.55) + rnd.normalized() * spread).normalized()
        if nd.z < 0.05:
            nd.z = 0.05 + 0.2 * up
            nd.normalize()
        _grow(rng, tubes, tips, base, nd, length * rng.uniform(0.62, 0.8), radius * rng.uniform(0.48, 0.62), depth - 1,
              spread, up, max(3, seg - 1))


def deciduous(P, x=0.0, y=0.0, h=12.0, seed=2, color=(0.11, 0.16, 0.06), spread=1.0, lean=0.0, per=420, kind="broad"):
    """Broadleaf roadside tree: a leaning trunk that forks into limbs; foliage lobes at the tips."""
    rng = np.random.default_rng(seed)
    for _attempt in range(12):
        # Roadside trees are balanced: keep the first skeleton whose crown centre sits over its trunk.
        tubes, tips = [], []
        trunk_h = h * rng.uniform(0.28, 0.36)
        lean_v = Vector((rng.normal(0, lean * 0.5 + 0.02), rng.normal(0, lean * 0.5 + 0.02), 1.0)).normalized()
        _grow(rng, tubes, tips, (x, y, 0), lean_v, trunk_h, h * 0.017 + 0.07, 3, spread=0.8 * spread, up=0.6, seg=5, jit=0.04)
        cx = sum(t[0].x for t in tips) / len(tips) - x
        cy = sum(t[0].y for t in tips) / len(tips) - y
        if math.hypot(cx, cy) < 0.07 * h:
            break
    bark = bark_tubes("trunk", tubes, node_mat("bark_tree", (0.13, 0.105, 0.085), 0.9, noise=0.25, grime=0.0), sides=7)
    # Lobes: one cluster at every tip plus a couple of inner ones (crown is dense but not solid).
    lobe_r = h * 0.125
    clusters = []
    for pt, _d, ln in tips:
        r = lobe_r * rng.uniform(0.75, 1.3)
        clusters.append((pt + Vector((0, 0, r * 0.15)), (r * 1.1, r * 1.1, r * 0.85), rng.uniform(0.8, 1.2)))
    for _ in range(max(2, len(tips) // 4)):
        pt, _d, _l = tips[int(rng.integers(0, len(tips)))]
        base = Vector((x, y, h * 0.55))
        c = base + (pt - base) * rng.uniform(0.35, 0.7)
        clusters.append((c, (lobe_r * 0.9, lobe_r * 0.9, lobe_r * 0.7), rng.uniform(0.5, 0.8)))
    leaves = foliage(f"decid{seed}", clusters, color, seed * 7 + 1, leaf=0.085 + h * 0.0095, kind=kind, per=per)
    return [bark] + leaves


def poplar(P, x=0.0, y=0.0, h=22.0, seed=1):
    """Lombardy poplar: a straight trunk, a cloud of short upswept branches whose foliage
    stacks into a narrow, irregular flame; the lowest quarter is clear stem."""
    rng = np.random.default_rng(seed)
    tubes = []
    lean = Vector((rng.normal(0, 0.012), rng.normal(0, 0.012), 1.0)).normalized()
    top = Vector((x, y, 0)) + lean * h * 0.94
    tubes.append(([Vector((x, y, 0)) + lean * (h * 0.94 * i / 8) for i in range(9)], list(np.linspace(0.27, 0.05, 9))))
    clusters = []
    n_layers = 20
    for i in range(n_layers):
        t = 0.22 + 0.78 * i / (n_layers - 1)
        zc = h * 0.94 * t
        # Columnar profile: widest around 40–55 % height, tapered flame top.
        prof = math.sin(math.pi * min(1.0, (t - 0.12) / 0.92)) ** 0.75
        for _ in range(int(rng.integers(2, 4))):
            ang = rng.uniform(0, 2 * math.pi)
            reach = (0.35 + 1.05 * prof) * rng.uniform(0.6, 1.1)
            c = Vector((x + math.cos(ang) * reach, y + math.sin(ang) * reach, zc)) + lean * 0
            branch_top = c + Vector((0, 0, 0.25 * h / 22))
            tubes.append(([Vector((x, y, zc - 0.3)) + lean * 0, branch_top], [0.03, 0.015]))
            clusters.append((c, (1.0 + 0.7 * prof, 1.0 + 0.7 * prof, 1.6 * h / 22), rng.uniform(0.7, 1.2)))
    bark = bark_tubes("trunk", tubes, node_mat("bark_pop", (0.16, 0.14, 0.11), 0.9, noise=0.2, grime=0.0), sides=6)
    leaves = foliage(f"pop{seed}", clusters, (0.10, 0.155, 0.045), seed * 5 + 3, leaf=0.26, kind="needle", per=300)
    return [bark] + leaves


def round_tree(P, x=0.0, y=0.0, h=11.0, seed=2, color=(0.11, 0.16, 0.06)):
    return deciduous(P, x, y, h, seed, color, spread=1.0, lean=0.06, per=420)


def hedge(P, length=18.0, seed=3):
    """Field hedge: irregular height, gaps, dead patches, a few sapling stems standing out."""
    rng = np.random.default_rng(seed)
    clusters = []
    tubes = []
    y = -length / 2
    hedge_h = rng.uniform(1.8, 2.8)
    while y < length / 2:
        hedge_h = float(np.clip(hedge_h + rng.normal(0, 0.28), 1.5, 3.4))
        h = hedge_h
        w = rng.uniform(0.9, 1.5)
        for _ in range(int(rng.integers(2, 5))):
            clusters.append((Vector((rng.uniform(-0.35, 0.35), y + rng.uniform(-0.5, 0.5), h * rng.uniform(0.35, 0.8))),
                             (w, rng.uniform(0.9, 1.5), h * 0.45), rng.uniform(0.5, 1.0)))
        if rng.random() < 0.28:  # a young tree stem standing out of the hedge
            top = h + rng.uniform(1.2, 2.6)
            tubes.append(([Vector((0, y, 0)), Vector((rng.normal(0, 0.1), y, top))], [0.05, 0.02]))
            clusters.append((Vector((0, y, top)), (0.8, 0.8, 0.7), 0.7))
        y += rng.uniform(1.2, 2.6) if rng.random() > 0.12 else rng.uniform(3.0, 4.5)  # occasional gap
    o = foliage("hedge", clusters, (0.09, 0.13, 0.05), seed * 3 + 5, leaf=0.12, per=330)
    if tubes:
        o.append(bark_tubes("stems", tubes, node_mat("bark_tree", (0.13, 0.105, 0.085), 0.9, noise=0.25, grime=0.0), sides=5))
    return o


def shrub(P, seed=4):
    rng = np.random.default_rng(seed)
    clusters = [(Vector((rng.uniform(-0.7, 0.7), rng.uniform(-0.6, 0.6), rng.uniform(0.5, 1.2))),
                 (rng.uniform(0.55, 0.9), rng.uniform(0.55, 0.9), rng.uniform(0.4, 0.7)), rng.uniform(0.6, 1.0)) for _ in range(6)]
    return foliage("shrub", clusters, (0.10, 0.14, 0.06), seed + 40, leaf=0.09, per=110)


def poplar_row(P, seed=5):
    o = []
    rng = np.random.default_rng(seed)
    for i, yy in enumerate(np.arange(-44, 45, 9.0)):
        if rng.random() < 0.82:
            o += poplar(P, rng.uniform(-1.6, 1.6), yy + rng.uniform(-1.6, 1.6), rng.uniform(16, 27), seed=seed * 10 + i)
    return o


def tree_group(P, seed=6):
    o = []
    rng = np.random.default_rng(seed)
    for i in range(6):
        o += deciduous(P, rng.uniform(-9, 9), rng.uniform(-20, 20), rng.uniform(8, 15), seed=seed * 10 + i,
                       color=(0.09 + rng.uniform(0, 0.05), 0.14 + rng.uniform(0, 0.04), 0.045 + rng.uniform(0, 0.02)),
                       spread=rng.uniform(0.9, 1.15), lean=0.08, per=260)
    return o


# ============================================================== card rendering
CARDS = []  # (id, builder, atlas, res_x, yaw_deg, pitch_deg)


def card(cid, builder, atlas, res, yaw=16.0, pitch=2.0):
    CARDS.append((cid, builder, atlas, res, yaw, pitch))


card("warehouse_long", warehouse_long, "built", 1400, yaw=22)
card("distribution", distribution_center, "built", 1200, yaw=22)
card("yard_trailers", yard_trailers, "built", 900, yaw=22)
card("skyline", industrial_skyline, "built", 1500, yaw=6, pitch=1.0)
card("pylon", pylon, "built", 260, yaw=10, pitch=1.0)
card("fuel_station", fuel_station, "built", 1400, yaw=24)
card("hotel", hotel, "built", 1000, yaw=22)
card("restaurant", restaurant, "built", 800, yaw=22)
card("truck_parking", truck_parking, "built", 800, yaw=22)
card("farm_shed", farm_shed, "built", 560, yaw=20)
card("low_shed", low_shed, "built", 600, yaw=20)
card("farmhouse", farmhouse, "built", 480, yaw=20)
card("village", village, "built", 1400, yaw=8, pitch=1.0)
card("poplar_a", lambda P: poplar(P, seed=11), "nature", 512, yaw=0, pitch=1.0)
card("poplar_b", lambda P: poplar(P, h=19, seed=12), "nature", 512, yaw=0, pitch=1.0)
card("tree_a", lambda P: round_tree(P, seed=21), "nature", 512, yaw=0, pitch=1.0)
card("tree_b", lambda P: round_tree(P, h=14, seed=22, color=(0.12, 0.17, 0.07)), "nature", 512, yaw=0, pitch=1.0)
card("hedge", hedge, "nature", 640, yaw=12, pitch=1.0)
card("shrub", shrub, "nature", 256, yaw=0, pitch=1.0)
card("poplar_row", poplar_row, "nature", 1400, yaw=8, pitch=1.0)
card("tree_group", tree_group, "nature", 700, yaw=4, pitch=1.0)
card("car_rear_a", lambda P: car(P, 0, 0, rot=math.pi, paint="car_silver"), "nature", 180, yaw=8, pitch=3.0)
card("car_rear_b", lambda P: car(P, 0, 0, rot=math.pi, paint="car_dark"), "nature", 180, yaw=8, pitch=3.0)
card("van_rear", lambda P: van(P, 0, 0, rot=math.pi), "nature", 190, yaw=8, pitch=3.0)
card("truck_rear", lambda P: truck(P, 0, 0, rot=math.pi, cab="cab_white", body="trailer_white"), "nature", 240, yaw=8, pitch=3.0)
card("car_front", lambda P: car(P, 0, 0, rot=0.0, paint="car_white"), "nature", 180, yaw=12, pitch=3.0)
card("truck_front", lambda P: truck(P, 0, 0, rot=0.0, cab="cab_blue", body="trailer_grey"), "nature", 240, yaw=12, pitch=3.0)


def render_card(cid, builder, res, yaw, pitch):
    reset_scene()
    setup_world()
    global _mats, _leaf_img, _needle_img
    _mats = {}
    _leaf_img = None
    _needle_img = None
    P = palette()
    objs = builder(P)
    bpy.context.view_layer.update()
    pts = []
    for o in objs:
        pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), 0.0))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre = (lo + hi) / 2
    yaw_r, pitch_r = math.radians(yaw), math.radians(pitch)
    fwd = Vector((math.sin(yaw_r) * math.cos(pitch_r), math.cos(yaw_r) * math.cos(pitch_r), -math.sin(pitch_r)))
    right = fwd.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(fwd).normalized()
    corners = [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    us = [(c - centre).dot(right) for c in corners]
    vs = [(c - centre).dot(up) for c in corners]
    w = (max(us) - min(us)) * 1.04
    h = (max(vs) - min(vs)) * 1.06
    cam_data = bpy.data.cameras.new("RK_Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(w, h)
    cam_data.clip_end = 5000
    cam = bpy.data.objects.new("RK_Cam", cam_data)
    scene.collection.objects.link(cam)
    target = centre + right * (max(us) + min(us)) / 2 + up * (max(vs) + min(vs)) / 2
    cam.location = target - fwd * 1500
    cam.rotation_euler = fwd.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    res_x = res if w >= h else max(8, int(res * w / h))
    res_y = max(8, int(res_x * h / w))
    scene.render.resolution_x, scene.render.resolution_y = res_x, res_y
    path = os.path.join(CARDS_DIR, f"{cid}.png")
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    # Ground anchor: the set piece's ground origin projected into the frame.
    ground = Vector((0.0, 0.0, 0.0)) if cid not in ("skyline", "village") else Vector((centre.x, centre.y, 0.0))
    a = world_to_camera_view(scene, cam, ground)
    meta = {"w": w, "h": h, "res": [res_x, res_y], "anchor": [a.x, a.y]}
    with open(os.path.join(CARDS_DIR, f"{cid}.json"), "w") as f:
        json.dump(meta, f)
    print(f"CARD {cid} {res_x}x{res_y} {w:.1f}x{h:.1f} m")


# ============================================================== road surface (numpy)
ROAD_X0, ROAD_X1 = -4.475, 9.0  # carriageway: hard shoulder … median (hero road world)
TILE_LEN = 36.0


def fft_noise(h, w, scale_px, seed):
    rng = np.random.default_rng(seed)
    n = rng.normal(size=(h, w))
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    f = np.sqrt(fx * fx + fy * fy)
    filt = np.exp(-(f * scale_px) ** 2)
    out = np.real(np.fft.ifft2(np.fft.fft2(n) * filt))
    out -= out.min()
    return out / max(1e-6, out.max())


def road_surface():
    W, H = 1024, 2048
    x = ROAD_X0 + (np.arange(W) + 0.5) / W * (ROAD_X1 - ROAD_X0)
    y = (np.arange(H) + 0.5) / H * TILE_LEN
    X, Y = np.meshgrid(x, y)
    rng = np.random.default_rng(42)
    grain = rng.random((H, W))
    stones = (grain > 0.965).astype(np.float32) * rng.uniform(0.3, 1.0, (H, W))
    mottle = fft_noise(H, W, 60, 1)
    broad = fft_noise(H, W, 300, 2)
    # Aggregate itself (8–11 mm stones) is far below this tile's ~13 mm/texel: it lives in the
    # runtime's tiled 1 mm/texel detail layer. This tile carries only the large-scale history
    # (wheel paths, patches, cracks, paint), so its height/normal has no random micro-relief
    # (interpolated white noise magnified at 0.4 m camera height reads as water ripples).
    tone = 0.30 + 0.03 * (grain - 0.5) + 0.04 * stones + 0.05 * (mottle - 0.5) + 0.04 * (broad - 0.5)
    rough = 0.86 + 0.03 * (grain - 0.5) - 0.02 * stones
    height = 0.0 * grain + 0.05 * mottle

    # Wheel paths: two polished, slightly darker bands per lane (+ faint rutting).
    for lane_c in (0.0, 3.75):
        for off in (-0.9, 0.9):
            d = np.abs(X - (lane_c + off))
            wp = np.exp(-(d / 0.32) ** 2)
            tone -= 0.035 * wp
            rough -= 0.1 * wp
            height -= 0.8 * wp
        oil = np.exp(-((X - lane_c) / 0.25) ** 2) * (0.6 + 0.4 * mottle)
        tone -= 0.02 * oil
    # Paving seam between lanes and at the hard shoulder.
    for sx in (1.875 + 0.2, -1.875 - 0.35):
        seam = np.exp(-((X - sx) / 0.02) ** 2)
        tone -= 0.05 * seam
        rough -= 0.2 * seam
    # Repair patches (newer, darker asphalt with crisp edges) — two per tile.
    for (px, py, pw, pl) in ((0.4, 6.0, 2.6, 3.4), (3.2, 24.0, 1.8, 2.2)):
        m = (np.abs(X - px) < pw / 2) & (np.abs(Y - py) < pl / 2)
        tone[m] -= 0.045
        rough[m] -= 0.05
        edge = m & ~((np.abs(X - px) < pw / 2 - 0.03) & (np.abs(Y - py) < pl / 2 - 0.03))
        tone[edge] -= 0.04
    # Sealed cracks: thin dark tar lines (random walks), a few per tile.
    for k in range(7):
        cx, cy = rng.uniform(ROAD_X0 + 1, ROAD_X1 - 1), rng.uniform(0, TILE_LEN)
        ang = rng.uniform(0, math.pi)
        for step in range(260):
            ang += rng.normal(0, 0.18)
            cx += math.cos(ang) * 0.02
            cy += math.sin(ang) * 0.02
            i = int((cy % TILE_LEN) / TILE_LEN * H)
            j = int((cx - ROAD_X0) / (ROAD_X1 - ROAD_X0) * W)
            if 0 <= j < W:
                sl = slice(max(0, j - 1), j + 2)
                tone[i, sl] -= 0.06
                rough[i, sl] = 0.55
                height[i, sl] -= 0.8
    # Shoulder dirt towards the outer edge, dust along the median.
    tone += 0.03 * np.clip((-1.875 - X) / 2.6, 0, 1) * (0.5 + mottle)
    tone -= 0.02 * np.clip((X - 7.5) / 1.5, 0, 1)
    gutter = X < ROAD_X0 + 0.3
    tone[gutter] = 0.52 + 0.04 * (grain[gutter] - 0.5)
    rough[gutter] = 0.9

    # Markings (Italian motorway): edge lines 25 cm, lane dashes 15 cm × 4.5 m on 12 m.
    paint = np.zeros_like(tone)
    paint[np.abs(X - (-1.875)) < 0.125] = 1
    paint[np.abs(X - 5.625) < 0.125] = 1
    dash = (np.abs(X - 1.875) < 0.075) & ((Y % 12.0) < 4.5)
    paint[dash] = 1
    wear = np.clip(0.25 + 0.9 * fft_noise(H, W, 8, 5) - 0.35 * grain, 0, 1)
    paint *= np.clip(0.55 + 0.6 * wear, 0, 1)
    colour = np.stack([tone, tone, tone * 1.02], -1)
    white = np.array([0.80, 0.80, 0.77])
    colour = colour * (1 - paint[..., None]) + white * paint[..., None]
    rough = rough * (1 - paint) + 0.55 * paint
    height += 0.6 * paint

    def save(name, arr, w, h):
        img = bpy.data.images.new(name, w, h, alpha=True)
        img.filepath_raw = os.path.join(WORK, f"{name}.png")
        img.file_format = "PNG"
        img.pixels = np.flipud(arr).astype(np.float32).ravel()
        img.save()
        return img

    rgba = np.concatenate([np.clip(colour, 0, 1), np.ones((H, W, 1))], -1)
    col_img = save("road_color", rgba, W, H)
    col_img.colorspace_settings.name = "sRGB"
    # Normal + ORM at half resolution.
    hs = height[::2, ::2]
    gy, gx = np.gradient(hs)
    k = 2.2
    n = np.stack([-gx * k, -gy * k, np.ones_like(hs)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    nrm = np.concatenate([n * 0.5 + 0.5, np.ones(hs.shape + (1,))], -1)
    nrm_img = save("road_normal", nrm, W // 2, H // 2)
    nrm_img.colorspace_settings.name = "Non-Color"
    r = np.clip(rough[::2, ::2], 0, 1)
    orm = np.stack([np.ones_like(r), r, np.zeros_like(r), np.ones_like(r)], -1)
    orm_img = save("road_orm", orm, W // 2, H // 2)
    orm_img.colorspace_settings.name = "Non-Color"
    return col_img, nrm_img, orm_img


# ============================================================== atlas packing
def load_rgba(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(img)
    return np.flipud(a)  # top-down rows


def pack(atlas_name, ids, width):
    items = []
    for cid in ids:
        px = load_rgba(os.path.join(CARDS_DIR, f"{cid}.png"))
        meta = json.load(open(os.path.join(CARDS_DIR, f"{cid}.json")))
        alpha = px[..., 3]
        rows = np.where(alpha.max(1) > 0.02)[0]
        cols = np.where(alpha.max(0) > 0.02)[0]
        r0, r1, c0, c1 = rows[0], rows[-1] + 1, cols[0], cols[-1] + 1
        crop = px[r0:r1, c0:c1]
        res_x, res_y = meta["res"]
        mpp = meta["w"] / res_x  # metres per pixel (square pixels)
        ax_px = meta["anchor"][0] * res_x - c0
        ay_px = (1 - meta["anchor"][1]) * res_y - r0  # from the crop top
        items.append({"id": cid, "px": crop, "mpp": mpp, "ax": ax_px, "ay": ay_px})
    # Shelf packing, tallest first, 2 px gutters. The atlas must stay square (the KTX2
    # encoder only builds a valid mip chain for square images) and at 2048 px (a 4096² atlas
    # is 64 MB of GPU memory and exceeds the wasm encoder): if the cards do not fit, every
    # card is resampled by the same factor until they do.
    for it in items:
        it["src"] = it["px"]
        it["src_mpp"] = it["mpp"]
        it["src_ax"], it["src_ay"] = it["ax"], it["ay"]
    scale = 1.0
    for _attempt in range(24):
        for it in items:
            if scale == 1.0:
                it["px"], it["mpp"], it["ax"], it["ay"] = it["src"], it["src_mpp"], it["src_ax"], it["src_ay"]
            else:
                sh, sw = it["src"].shape[:2]
                nw, nh = max(2, int(round(sw * scale))), max(2, int(round(sh * scale)))
                tmp = bpy.data.images.new("tmp_resize", sw, sh, alpha=True)
                tmp.pixels = np.flipud(it["src"]).ravel()
                tmp.scale(nw, nh)
                arr = np.array(tmp.pixels[:], dtype=np.float32).reshape(nh, nw, 4)
                bpy.data.images.remove(tmp)
                it["px"] = np.flipud(arr)
                it["mpp"] = it["src_mpp"] * sw / nw
                it["ax"], it["ay"] = it["src_ax"] * nw / sw, it["src_ay"] * nh / sh
        items.sort(key=lambda it: -it["px"].shape[0])
        x = y = shelf = 0
        for it in items:
            h, w = it["px"].shape[:2]
            if x + w > width:
                x, y, shelf = 0, y + shelf + 2, 0
            it["pos"] = (x, y)
            x += w + 2
            shelf = max(shelf, h)
        if y + shelf <= width:
            break
        scale *= 0.94
    height = width  # square
    atlas = np.zeros((height, width, 4), np.float32)
    for it in items:
        h, w = it["px"].shape[:2]
        ox, oy = it["pos"]
        atlas[oy:oy + h, ox:ox + w] = it["px"]
    # Bleed colour into transparent texels (no dark fringes under mip filtering).
    rgb = atlas[..., :3]
    a = atlas[..., 3:4]
    unpremult = np.where(a > 0.004, rgb / np.maximum(a, 1e-4), 0)
    atlas[..., :3] = np.clip(np.where(a > 0.004, unpremult, rgb), 0, 1)
    img = bpy.data.images.new(atlas_name, width, height, alpha=True)
    img.filepath_raw = os.path.join(WORK, f"{atlas_name}.png")
    img.file_format = "PNG"
    img.pixels = np.flipud(atlas).ravel()
    img.save()
    metas = {}
    for it in items:
        h, w = it["px"].shape[:2]
        ox, oy = it["pos"]
        metas[it["id"]] = {
            "atlas": atlas_name,
            # UV rect (u0, v0, u1, v1) with v up (glTF flips; runtime uses texture.flipY=false).
            "uv": [ox / width, oy / height, (ox + w) / width, (oy + h) / height],
            "size": [w * it["mpp"], h * it["mpp"]],
            "anchor": [it["ax"] / w, it["ay"] / h],
        }
        print(f"PACK {atlas_name} {it['id']} {w}x{h} at {ox},{oy}")
    print(f"ATLAS {atlas_name} {width}x{height}")
    return img, metas


# ============================================================== aerial terrain (Reach)
def aerial_terrain(path, size_m=1200.0, res=2048):
    """Top-down Po-valley farmland tile for the Reach rise: parcels with furrows,
    hedgerows and tree lines on the parcel edges (so the tile repeats along them),
    tree clumps and a few farmsteads, under a low sunrise (long soft shadows)."""
    reset_scene()
    setup_world()
    global _mats
    _mats = {}
    P = palette()
    scene.render.film_transparent = False
    rng = np.random.default_rng(31)
    # Aerial light: a higher morning sun reads the land from above (shadows ~2× height).
    sun = bpy.data.objects["RK_Sun"]
    d = Vector((-0.2, -1.0, -math.tan(math.radians(27)))).normalized()
    sun.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    base = node_mat("verge", (0.34, 0.31, 0.16), 1.0, noise=0.3, grime=0.0)
    box("verge", (0, 0, -0.1), (size_m, size_m, 0.1), base)
    crops = [(0.16, 0.30, 0.08), (0.42, 0.34, 0.14), (0.20, 0.15, 0.08), (0.24, 0.34, 0.11),
             (0.12, 0.24, 0.06), (0.46, 0.38, 0.16), (0.28, 0.30, 0.10), (0.34, 0.22, 0.09)]
    # Long strip fields of varied widths (the Po valley's parcel grain).
    def splits(total, lo, hi):
        edges, x = [0.0], 0.0
        while total - x > hi:
            x += float(rng.uniform(lo, hi))
            edges.append(x)
        edges.append(total)
        return [e - total / 2 for e in edges]
    xs = splits(size_m, 70, 220)
    ys = splits(size_m, 110, 320)
    cols, rows = len(xs) - 1, len(ys) - 1
    for i in range(cols):
        for j in range(rows):
            c = crops[int(rng.integers(0, len(crops)))]
            along = "furrow_x" if rng.random() < 0.5 else "furrow_y"
            m = node_mat(f"field_{i}_{j}", c, 0.95, noise=0.22, grime=0.0,
                         bump=along, bump_scale=float(rng.choice([2.0, 2.8, 3.6])), bump_strength=0.55)
            x0, x1, y0, y1 = xs[i], xs[i + 1], ys[j], ys[j + 1]
            box("parcel", ((x0 + x1) / 2, (y0 + y1) / 2, 0.0), (x1 - x0 - 4, y1 - y0 - 4, 0.1), m)
    # Access tracks (pale gravel, tractor ruts) through some parcels and drainage ditches
    # (dark, damp) along some parcel edges: the agricultural network seen from above.
    track_mat = node_mat("track", (0.50, 0.44, 0.31), 0.95, noise=0.2, grime=0.0)
    ditch_mat = node_mat("ditch", (0.05, 0.07, 0.04), 0.5, noise=0.2, grime=0.0)
    for i in range(cols):
        for j in range(rows):
            x0, x1, y0, y1 = xs[i], xs[i + 1], ys[j], ys[j + 1]
            if rng.random() < 0.45:
                if (x1 - x0) > (y1 - y0):
                    box("track", ((x0 + x1) / 2, (y0 + y1) / 2 + rng.uniform(-8, 8), 0.12), (x1 - x0 - 8, 3.0, 0.06), track_mat)
                else:
                    box("track", ((x0 + x1) / 2 + rng.uniform(-8, 8), (y0 + y1) / 2, 0.12), (3.0, y1 - y0 - 8, 0.06), track_mat)
            if rng.random() < 0.35:
                box("ditch", (x0 + 2.5, (y0 + y1) / 2, 0.04), (2.2, y1 - y0 - 6, 0.05), ditch_mat)
    # Hedgerows / tree lines along the parcel edges (on the tile borders too).
    def clump(x, y, r, h, seed):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
        g = np.random.default_rng(seed)
        for v in bm.verts:
            v.co.z *= h / r * 0.6
            v.co += Vector(g.normal(0, r * 0.12, 3))
            v.co += Vector((x, y, h * 0.55))
        return mesh_obj("tree", bm, node_mat("canopy_top", (0.07, 0.11, 0.04), 0.9, noise=0.35, grime=0.0))
    k = 0
    # Hedgerows: some parcel edges carry dense tree lines, others none.
    for x in xs:
        density = float(rng.choice([0.0, 0.5, 0.9]))
        for y in np.arange(-size_m / 2, size_m / 2, 5.0):
            if rng.random() < density:
                clump(x + rng.normal(0, 1.0), y, rng.uniform(3.5, 6.0), rng.uniform(7, 13), k)
                k += 1
    for y in ys:
        density = float(rng.choice([0.0, 0.3, 0.8]))
        for x in np.arange(-size_m / 2, size_m / 2, 5.0):
            if rng.random() < density:
                clump(x, y + rng.normal(0, 1.0), rng.uniform(3.5, 5.5), rng.uniform(7, 12), k)
                k += 1
    for _ in range(18):
        cx, cy = rng.uniform(-size_m / 2, size_m / 2, 2)
        for _ in range(int(rng.integers(6, 16))):
            clump(cx + rng.normal(0, 14), cy + rng.normal(0, 14), rng.uniform(3, 6), rng.uniform(8, 14), k)
            k += 1
    for _ in range(9):
        cx, cy = rng.uniform(-size_m / 2 + 60, size_m / 2 - 60, 2)
        o = farmhouse(P)
        for ob in o:
            ob.location = (cx, cy, 0)
    cam_data = bpy.data.cameras.new("RK_Top")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = size_m
    cam = bpy.data.objects.new("RK_Top", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0, 0, 500)
    cam.rotation_euler = (0, 0, 0)
    cam_data.clip_end = 2000
    scene.camera = cam
    scene.render.resolution_x = scene.render.resolution_y = res
    scene.cycles.samples = 24
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.cycles.samples = 48
    print("AERIAL", path, k, "trees")


# ============================================================== warehouse interior (dock)
def warehouse_interior(path, w=1200, h=680):
    """Camera-matched depth plate seen through the dock's open bay (reference 05):
    pallet racks receding both sides, wrapped cargo, columns, warm ceiling lights.
    No forklift/workers baked in — those are realtime, placed in front of it."""
    reset_scene()
    world = bpy.data.worlds.get("RK_World") or bpy.data.worlds.new("RK_World")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = (0.05, 0.045, 0.05, 1)
    bg.inputs["Strength"].default_value = 1.0
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    global _mats
    _mats = {}
    P = palette()
    wall = node_mat("interior_wall", (0.16, 0.16, 0.165), 0.7, 0.1, noise=0.1, grime=0.15)
    floor = node_mat("interior_floor", (0.22, 0.21, 0.20), 0.5, 0.15, noise=0.12, grime=0.12)
    wrap = node_mat("pallet_wrap", (0.75, 0.76, 0.77), 0.3, 0.05, noise=0.08, grime=0.05)
    box_mat = node_mat("cardboard", (0.58, 0.44, 0.29), 0.7, noise=0.12, grime=0.08)
    DEPTH, HALF_W, CLEAR = 18.0, 4.6, 6.2
    box("floor", (0, DEPTH / 2, -0.05), (HALF_W * 2 + 1, DEPTH, 0.1), floor)
    box("ceiling", (0, DEPTH / 2, CLEAR), (HALF_W * 2 + 1, DEPTH, 0.1), P["clad_dark"])
    box("back", (0, DEPTH, CLEAR / 2), (HALF_W * 2 + 1, 0.1, CLEAR), wall)
    for side in (-1, 1):
        box("wall", (side * (HALF_W + 0.5), DEPTH / 2, CLEAR / 2), (0.1, DEPTH, CLEAR), wall)
    # Ceiling lamps: a receding row each side, warm and bright (the plate's own light source).
    lamp_mat = node_mat("interior_lamp", (1, 1, 1), 0.3, emission=(1.0, 0.86, 0.65), emission_strength=16.0, grime=0.0)
    for z in np.arange(1.6, DEPTH, 2.6):
        for side in (-1, 1):
            box("lamp", (side * HALF_W * 0.5, z, CLEAR - 0.06), (1.3, 0.55, 0.05), lamp_mat)
    fill = bpy.data.lights.new("RK_Fill", "AREA")
    fill.energy = 400
    fill.color = (1.0, 0.88, 0.72)
    fill.size = HALF_W * 2
    fill_obj = bpy.data.objects.new("RK_Fill", fill)
    fill_obj.location = (0, DEPTH * 0.4, CLEAR - 0.2)
    fill_obj.rotation_euler = (0, 0, 0)
    scene.collection.objects.link(fill_obj)
    # Pallet racks both sides: uprights + 3 beam levels, wrapped goods and boxes on each.
    rack_mat = node_mat("rack_steel", (0.62, 0.24, 0.08), 0.5, 0.4, noise=0.08)
    rng = np.random.default_rng(17)
    for side in (-1, 1):
        rx = side * (HALF_W - 0.6)
        for z in np.arange(1.5, DEPTH - 1.0, 2.4):
            for u in (-0.55, 0.55):
                box("upright", (rx + u * 0.9, z, 2.5), (0.08, 0.08, 5.0), rack_mat)
            for level in (0.3, 1.9, 3.5, 5.0):
                box("beam", (rx, z, level), (1.9, 0.08, 0.1), rack_mat)
            for level in (0.35, 1.95, 3.55):
                if rng.random() < 0.82:
                    mat = wrap if rng.random() < 0.6 else box_mat
                    bw, bd, bh = rng.uniform(0.7, 1.0), rng.uniform(0.7, 1.0), rng.uniform(0.5, 0.9)
                    box("cargo", (rx + rng.uniform(-0.3, 0.3), z, level + bh / 2 + 0.05), (bw, bd, bh), mat, bevel=0.02)
    # A few foreground pallets on the floor near the doorway (depth anchors).
    for i, (fx, fz) in enumerate([(-1.6, 1.6), (1.8, 2.2), (-0.7, 3.4)]):
        ph = rng.uniform(0.9, 1.3)
        box("floor_pallet", (fx, fz, ph / 2), (1.0, 1.0, ph), wrap if i % 2 else box_mat, bevel=0.03)
    cam_data = bpy.data.cameras.new("RK_Interior")
    cam_data.lens_unit = "FOV"
    cam_data.angle_y = math.radians(48)  # wide enough to read floor-to-ceiling depth in one frame
    cam = bpy.data.objects.new("RK_Interior", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0, -0.02, CLEAR / 2)
    cam.rotation_euler = (math.pi / 2, 0, 0)
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.film_transparent = False
    scene.cycles.samples = 64
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    scene.render.film_transparent = True
    print("INTERIOR", path)


# Journey horizon plates: the approved photographic references for the three chapters.
PLATES = {
    "RK_Plate_A": "assets/work/roadkit/plates/plate_A.png",
    "RK_Plate_B": "assets/work/roadkit/plates/plate_B.png",
    "RK_Plate_C": "assets/work/roadkit/plates/plate_C.png",
}


# ============================================================== main
setup_render()
for cid, builder, atlas, res, yaw, pitch in CARDS:
    if ONLY and cid not in ONLY:
        continue
    # RK_REUSE=1 keeps cards already rendered (iterating on a few set pieces).
    if os.environ.get("RK_REUSE") and os.path.exists(os.path.join(CARDS_DIR, f"{cid}.png")):
        continue
    render_card(cid, builder, res, yaw, pitch)

if not ONLY:
    # The aerial and interior renders reset the scene: run them before any atlas image exists.
    aerial_path = os.path.join(WORK, "aerial.png")
    if not (os.environ.get("RK_REUSE") and os.path.exists(aerial_path)):
        aerial_terrain(aerial_path)
    interior_path = os.path.join(WORK, "warehouse_interior.png")
    if not (os.environ.get("RK_REUSE") and os.path.exists(interior_path)):
        warehouse_interior(interior_path)
    reset_scene()
    built_ids = [c[0] for c in CARDS if c[2] == "built"]
    nature_ids = [c[0] for c in CARDS if c[2] == "nature"]
    built_img, built_meta = pack("RK_Atlas_Built", built_ids, 2048)
    nature_img, nature_meta = pack("RK_Atlas_Nature", nature_ids, 2048)
    road_col, road_nrm, road_orm = road_surface()
    aerial_img = bpy.data.images.load(aerial_path)
    interior_img = bpy.data.images.load(interior_path)
    plate_imgs = {}
    for name, rel in PLATES.items():
        img = bpy.data.images.load(os.path.abspath(rel))
        img.scale(2048, 1024)  # power of two for KTX2 mipmaps; the runtime keeps the photo aspect
        img.name = name
        plate_imgs[name] = img

    # Export: one quad per atlas / road tile carries the textures; card metadata in extras.
    root = bpy.data.objects.new("RoadKit", None)
    scene.collection.objects.link(root)

    def textured_quad(name, color_img, normal_img=None, orm_img=None, alpha=False):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        uvn = nt.nodes.new("ShaderNodeUVMap")
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = color_img
        nt.links.new(uvn.outputs["UV"], t.inputs["Vector"])
        nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha:
            nt.links.new(t.outputs["Alpha"], bsdf.inputs["Alpha"])
            if hasattr(m, "surface_render_method"):
                m.surface_render_method = "DITHERED"
        if normal_img:
            tn = nt.nodes.new("ShaderNodeTexImage")
            tn.image = normal_img
            nm = nt.nodes.new("ShaderNodeNormalMap")
            nt.links.new(uvn.outputs["UV"], tn.inputs["Vector"])
            nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
            nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
        if orm_img:
            to = nt.nodes.new("ShaderNodeTexImage")
            to.image = orm_img
            sp = nt.nodes.new("ShaderNodeSeparateColor")
            nt.links.new(uvn.outputs["UV"], to.inputs["Vector"])
            nt.links.new(to.outputs["Color"], sp.inputs["Color"])
            nt.links.new(sp.outputs["Green"], bsdf.inputs["Roughness"])
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new("UVMap")
        vs = [bm.verts.new(p) for p in ((0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0))]
        f = bm.faces.new(vs)
        for loop, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uvl].uv = uv
        o = mesh_obj(name, bm, m)
        o.parent = root
        return o

    textured_quad("RK_Atlas_Built", built_img, alpha=True)
    textured_quad("RK_Atlas_Nature", nature_img, alpha=True)
    textured_quad("RK_Road", road_col, road_nrm, road_orm)
    textured_quad("RK_Aerial", aerial_img)
    textured_quad("RK_Interior", interior_img)
    for name, img in plate_imgs.items():
        textured_quad(name, img)
    for cid, meta in {**built_meta, **nature_meta}.items():
        e = bpy.data.objects.new(f"Card_{cid}", None)
        e["card"] = json.dumps(meta)
        scene.collection.objects.link(e)
        e.parent = root
    root["road"] = json.dumps({"x0": ROAD_X0, "x1": ROAD_X1, "length": TILE_LEN})

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=OUT, export_format="GLB", use_selection=True, export_yup=True,
        export_extras=True, export_materials="EXPORT", export_image_format="AUTO",
        export_cameras=False, export_lights=False, export_animations=False,
    )
    print("EXPORTED", OUT)
