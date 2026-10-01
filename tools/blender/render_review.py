"""Review renders of a vehicle .blend (Cycles, CPU).

blender -b <file.blend> --python tools/blender/render_review.py -- <out_dir> <views> [samples]

<views> is a comma list of `view`, or `view=file.png:preset` to set the output name
and lighting. Views: front34, side, rear34, hero, front, grille, sidecheck, rearcorner.
Presets:
  studio    even studio light (default)
  daylight  soft overcast daylight (branding legibility)
  sunrise   low warm sun ahead of the truck, cool sky (the road light)
  bluehour  twilight sky, one warm dock flood, dark façade with the lit bay,
            marker lights on and headlights off (the hero opening state)
"""

import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :]
OUT_DIR = argv[0]
VIEWS = argv[1].split(",")
SAMPLES = int(argv[2]) if len(argv) > 2 else 48
os.makedirs(OUT_DIR, exist_ok=True)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Base Contrast"

pts = []
for o in scene.objects:
    if o.type == "MESH" and o.visible_get():
        pts += [o.matrix_world @ v.co for v in o.data.vertices]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
centre = (lo + hi) / 2
length = hi.y - lo.y

# --- Shared set: world (sky), floor, camera; per-preset lights and context.
world = bpy.data.worlds.new("Review")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
sky = world.node_tree.nodes.new("ShaderNodeTexSky")
try:
    sky.sky_type = "NISHITA"
except TypeError:
    pass
world.node_tree.links.new(sky.outputs["Color"], bg.inputs["Color"])

# Blue-hour world: an elevation gradient on the website's light-story keys (deep blue zenith,
# blue horizon, a thin warm band low towards the glow) — Nishita washes out below the horizon.
twilight = bpy.data.worlds.new("Review_BlueHour")
twilight.use_nodes = True
tnt = twilight.node_tree
tbg = tnt.nodes["Background"]
coord = tnt.nodes.new("ShaderNodeTexCoord")
sep = tnt.nodes.new("ShaderNodeSeparateXYZ")
ramp = tnt.nodes.new("ShaderNodeValToRGB")
tnt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
remap = tnt.nodes.new("ShaderNodeMapRange")  # view direction z ∈ [−1, 1] → [0, 1]; horizon = 0.5
remap.inputs["From Min"].default_value = -1.0
tnt.links.new(sep.outputs["Z"], remap.inputs["Value"])
tnt.links.new(remap.outputs["Result"], ramp.inputs["Fac"])
tnt.links.new(ramp.outputs["Color"], tbg.inputs["Color"])
ramp.color_ramp.elements[0].position = 0.0
ramp.color_ramp.elements[0].color = (0.012, 0.016, 0.028, 1)  # below the horizon
ramp.color_ramp.elements[1].position = 1.0
ramp.color_ramp.elements[1].color = (0.003, 0.008, 0.028, 1)  # zenith
for position, colour in ((0.5, (0.26, 0.11, 0.07, 1)), (0.52, (0.045, 0.075, 0.17, 1)), (0.62, (0.012, 0.028, 0.085, 1))):
    element = ramp.color_ramp.elements.new(position)
    element.color = colour
tbg.inputs["Strength"].default_value = 1.0

floor_mat = bpy.data.materials.new("Review_Floor")
floor_mat.use_nodes = True
floor_bsdf = floor_mat.node_tree.nodes["Principled BSDF"]
bpy.ops.mesh.primitive_plane_add(size=4000, location=(centre.x, centre.y, 0))
floor = bpy.context.active_object
floor.data.materials.append(floor_mat)

cam_data = bpy.data.cameras.new("ReviewCam")
cam = bpy.data.objects.new("ReviewCam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

preset_objects = []


def area(name, loc, energy, size, target, colour=(1, 1, 1)):
    bpy.ops.object.light_add(type="AREA", location=loc)
    light = bpy.context.active_object
    light.name = name
    light.data.energy = energy
    light.data.size = size
    light.data.color = colour
    light.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    preset_objects.append(light)
    return light


def emission(material_name, strength):
    mat = bpy.data.materials.get(material_name)
    if not mat:
        return
    for node in mat.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            node.inputs["Emission Strength"].default_value = strength


def set_sky(elevation_deg, rotation_deg, strength, dust=0.6):
    try:
        sky.sun_elevation = math.radians(elevation_deg)
        sky.sun_rotation = math.radians(rotation_deg)
        sky.air_density = 1.0
        sky.dust_density = dust
        sky.sun_disc = False
    except AttributeError:
        pass
    bg.inputs["Strength"].default_value = strength


def preset(name):
    for o in preset_objects:
        bpy.data.objects.remove(o, do_unlink=True)
    preset_objects.clear()
    scene.world = twilight if name == "bluehour" else world
    for m in ("MAT_Light_Head", "MAT_Light_Marker", "MAT_Light_Tail", "MAT_Light_Brake"):
        emission(m, 0.0)
    floor_bsdf.inputs["Base Color"].default_value = (0.32, 0.33, 0.34, 1)
    floor_bsdf.inputs["Roughness"].default_value = 0.8
    if name == "studio":
        set_sky(35, 210, 0.16)
        area("Key", (centre.x - 9, lo.y - 6, 9), 3200, 8, centre)
        area("Fill", (centre.x + 10, centre.y, 6), 1300, 12, centre)
        area("Rim", (centre.x, hi.y + 10, 8), 2000, 10, centre)
        scene.view_settings.exposure = -0.9
    elif name == "daylight":
        set_sky(28, 150, 0.22, dust=1.5)
        area("Soft", (centre.x - 14, centre.y - 6, 14), 5200, 24, centre)
        area("Fill", (centre.x + 14, centre.y, 8), 1200, 20, centre)
        floor_bsdf.inputs["Base Color"].default_value = (0.22, 0.225, 0.23, 1)
        scene.view_settings.exposure = -0.8
    elif name == "sunrise":
        set_sky(4, 180, 0.55, dust=2.0)  # low sun ahead of the truck (towards −Y)
        bpy.ops.object.light_add(type="SUN", location=(0, 0, 10))
        sun = bpy.context.active_object
        sun.data.energy = 3.2
        sun.data.color = (1.0, 0.72, 0.45)
        sun.data.angle = math.radians(1.5)
        sun.rotation_euler = (Vector((0.35, 1.0, -0.12))).to_track_quat("-Z", "Y").to_euler()
        preset_objects.append(sun)
        floor_bsdf.inputs["Base Color"].default_value = (0.09, 0.092, 0.095, 1)  # asphalt
        floor_bsdf.inputs["Roughness"].default_value = 0.6
        emission("MAT_Light_Tail", 2.5)
        emission("MAT_Light_Marker", 1.5)
        scene.view_settings.exposure = -0.3
    elif name == "bluehour":
        # Dark customer façade parallel to the truck on its far side (+X), lit bay ahead of the cab
        # (the website dock layout; three.js (x, y, z) → Blender (x, −z, y)).
        bpy.ops.mesh.primitive_cube_add(size=1, location=(9 + 12, 28, 5.75))
        wall = bpy.context.active_object
        wall.scale = (24, 56, 11.5)
        wall_mat = bpy.data.materials.new("Review_Facade")
        wall_mat.use_nodes = True
        wall_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.03, 0.035, 0.042, 1)
        wall_mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.6
        wall.data.materials.append(wall_mat)
        preset_objects.append(wall)
        bpy.ops.mesh.primitive_plane_add(size=1, location=(8.99, 8, 2.9))
        bay = bpy.context.active_object
        bay.scale = (3.2, 3.4, 1)
        bay.rotation_euler = (math.radians(90), 0, math.radians(90))
        bay_mat = bpy.data.materials.new("Review_Bay")
        bay_mat.use_nodes = True
        bay_bsdf = bay_mat.node_tree.nodes["Principled BSDF"]
        bay_bsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
        bay_bsdf.inputs["Emission Color"].default_value = (1.0, 0.72, 0.42, 1)
        bay_bsdf.inputs["Emission Strength"].default_value = 1.0
        bay.data.materials.append(bay_mat)
        preset_objects.append(bay)
        # ONE warm dock flood (website position), ahead-right of the cab front.
        bpy.ops.object.light_add(type="SPOT", location=(8.5, -14.0, 9.6))
        flood = bpy.context.active_object
        flood.data.energy = 26000
        flood.data.color = (1.0, 0.8, 0.58)
        flood.data.spot_size = math.radians(76)
        flood.data.spot_blend = 0.6
        flood.data.shadow_soft_size = 0.4
        flood.rotation_euler = (Vector((-1, -8, 0.6)) - flood.location).to_track_quat("-Z", "Y").to_euler()
        preset_objects.append(flood)
        # Damp concrete: darker, moderately glossy (never a mirror).
        floor_bsdf.inputs["Base Color"].default_value = (0.07, 0.072, 0.075, 1)
        floor_bsdf.inputs["Roughness"].default_value = 0.38
        emission("MAT_Light_Marker", 3.0)
        emission("MAT_Light_Tail", 0.6)
        scene.view_settings.exposure = 0.1


def shoot(name, loc, target, lens, shift=(0.0, 0.0)):
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cam_data.lens = lens
    cam_data.shift_x, cam_data.shift_y = shift
    scene.render.filepath = os.path.join(OUT_DIR, name)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", scene.render.filepath)


# Blender: vehicle front towards −Y, truck left = +X.
front = lo.y
views = {
    "front34": ("01-front-three-quarter.png", (centre.x - 9.5, front - 9.0, 2.6), (centre.x, front + length * 0.33, 1.9), 40),
    "side": ("02-side-profile.png", (centre.x - 30, centre.y, 2.2), (centre.x, centre.y, 2.0), 50),
    "rear34": ("03-rear-three-quarter.png", (centre.x + 9.5, hi.y + 9.5, 3.0), (centre.x, hi.y - length * 0.35, 1.9), 40),
    # The website opening shot (config/hero-shots.ts "opening"), converted from three.js
    # (x left, y up, z forward) to Blender (x left, −y forward, z up): position
    # (−9.83, −27.04, 0.64), level look at the pivot, 20° vertical FOV (≈ 57.5 mm on a
    # 36 mm sensor at 16:9), lens shift 0.35 right / 0.23 of the height down.
    "hero": ("04-hero-angle.png", (-9.83, -27.04, 0.64), (3.63, 1.56, 0.64), 57.5, (-0.35, 0.129)),
    "front": ("check-front.png", (centre.x, front - 7.5, 2.0), (centre.x, front, 1.9), 45),
    "grille": ("check-grille.png", (centre.x - 0.6, front - 3.6, 1.8), (centre.x, front, 1.5), 45),
    "sidecheck": ("check-side.png", (centre.x + 12, centre.y, 1.8), (centre.x, centre.y, 1.6), 45),
    "rearcorner": ("check-rear-corner.png", (3.2, 15.5, 5.2), (-0.6, 11.8, 3.6), 50),
    "cabdoor": ("check-cab-door.png", (-6.5, -5.2, 2.2), (-1.1, -3.85, 2.0), 50),
}
for token in VIEWS:
    view, _, rest = token.partition("=")
    out_name, _, preset_name = rest.partition(":") if rest else ("", "", "")
    name, *camera = views[view]
    preset(preset_name or "studio")
    shoot(out_name or name, *camera)
