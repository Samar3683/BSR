"""Probe wheel meshes of the source tractor: centre, radius and axle direction (PCA).

blender -b --factory-startup --python tools/blender/probe_wheels.py -- <fbx>
"""

import sys

import bpy
from mathutils import Matrix, Vector

source = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=source)
bpy.context.view_layer.update()


def pca(points):
    n = len(points)
    c = sum(points, Vector()) / n
    cov = Matrix(((0, 0, 0), (0, 0, 0), (0, 0, 0)))
    for p in points:
        d = p - c
        for i in range(3):
            for j in range(3):
                cov[i][j] += d[i] * d[j] / n
    # Power iteration for the smallest-variance axis via the inverse is unstable; use eigen of 3x3 by Jacobi.
    a = [[cov[i][j] for j in range(3)] for i in range(3)]
    v = [[1 if i == j else 0 for j in range(3)] for i in range(3)]
    for _ in range(60):
        p, q = max(((0, 1), (0, 2), (1, 2)), key=lambda ij: abs(a[ij[0]][ij[1]]))
        if abs(a[p][q]) < 1e-12:
            break
        import math

        theta = 0.5 * math.atan2(2 * a[p][q], a[q][q] - a[p][p])
        c_, s_ = math.cos(theta), math.sin(theta)
        for k in range(3):
            akp, akq = a[k][p], a[k][q]
            a[k][p], a[k][q] = c_ * akp - s_ * akq, s_ * akp + c_ * akq
        for k in range(3):
            apk, aqk = a[p][k], a[q][k]
            a[p][k], a[q][k] = c_ * apk - s_ * aqk, s_ * apk + c_ * aqk
        for k in range(3):
            vkp, vkq = v[k][p], v[k][q]
            v[k][p], v[k][q] = c_ * vkp - s_ * vkq, s_ * vkp + c_ * vkq
    evals = [a[i][i] for i in range(3)]
    i_min = min(range(3), key=lambda i: evals[i])
    axis = Vector((v[0][i_min], v[1][i_min], v[2][i_min])).normalized()
    return c, axis, evals


for name in ("Object_3", "Object_3.001", "Object_3.002"):
    obj = bpy.data.objects[name]
    mw = obj.matrix_world
    pts = [mw @ v.co for v in obj.data.vertices]
    if name == "Object_3":
        groups = {"left(+x)": [p for p in pts if p.x > 0], "right(-x)": [p for p in pts if p.x < 0]}
    else:
        groups = {"all": pts}
    for label, g in groups.items():
        c, axis, evals = pca(g)
        radius = max(((p - c) - ((p - c).dot(axis)) * axis).length for p in g)
        width = max((p - c).dot(axis) for p in g) - min((p - c).dot(axis) for p in g)
        print(f"{name} {label}: centre {tuple(round(x, 3) for x in c)} axle {tuple(round(x, 3) for x in axis)} "
              f"radius {radius:.3f} width {width:.3f} evals {[round(e, 3) for e in evals]} rot {tuple(round(r, 3) for r in obj.rotation_euler)}")
