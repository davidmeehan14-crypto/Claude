"""
Paper Comet bot — Blender build + render script.

Run with Blender's Python (bpy):  python bot.py out.png [--samples N] [--size W H] [--mood NAME] [--flames 0|1]

Builds the character from primitives with procedural materials, lights it like a
high-key product shot, and renders one transparent PNG with Cycles.
"""
import bpy, bmesh, math, sys, argparse
from mathutils import Vector, Euler

# ---------------------------------------------------------------- args
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('out')
ap.add_argument('--samples', type=int, default=256)
ap.add_argument('--size', type=int, nargs=2, default=[1200, 900])
ap.add_argument('--mood', default='idle')
ap.add_argument('--flames', type=int, default=1)
ap.add_argument('--frame', type=int, default=0)
ap.add_argument('--bg', type=int, default=0, help='render on a sky background for review')
A = ap.parse_args(argv)

INK = (0.012, 0.018, 0.045, 1)
CREAM = (1.0, 0.86, 0.62, 1)
CORAL = (1.0, 0.30, 0.16, 1)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
col = sc.collection

# ---------------------------------------------------------------- helpers

def link(o):
    col.objects.link(o)
    return o

def smooth(o):
    for p in o.data.polygons:
        p.use_smooth = True

def principled(name, base=(1, 1, 1, 1), rough=0.4, coat=0.0, coat_rough=0.1, emission=None, strength=0, specular=0.5, subsurface=0.0, sss_radius=(1, .4, .2), alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = base
    b.inputs['Roughness'].default_value = rough
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = coat_rough
    b.inputs['Specular IOR Level'].default_value = specular
    b.inputs['Alpha'].default_value = alpha
    if subsurface:
        b.inputs['Subsurface Weight'].default_value = subsurface
        b.inputs['Subsurface Radius'].default_value = sss_radius
    if emission:
        b.inputs['Emission Color'].default_value = emission
        b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        m.surface_render_method = 'BLENDED'
    return m

def rounded_box(name, size, radius, segments=10, sub=2):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new('bevel', 'BEVEL')
    m.width = radius
    m.segments = segments
    m.limit_method = 'NONE'
    if sub:
        o.modifiers.new('sub', 'SUBSURF').levels = sub
        o.modifiers['sub'].render_levels = sub
    smooth(o)
    return o

def sphere(name, r, loc=(0, 0, 0), scale=(1, 1, 1), seg=48):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=seg // 2, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    smooth(o)
    return o

def capsule(name, r, length, loc=(0, 0, 0), rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=length, location=loc, rotation=rot, vertices=48)
    o = bpy.context.object
    o.name = name
    m = o.modifiers.new('b', 'BEVEL')
    m.width = r * 0.999
    m.segments = 16
    smooth(o)
    return o

# ---------------------------------------------------------------- the bot
# Axes: bot faces -Y (toward the camera), +Z up, +X to its right. Flames trail to +X (screen left is -X).

bot = link(bpy.data.objects.new('bot', None))

shell = principled('shell', base=(1.0, 0.985, 0.97, 1), rough=0.3, coat=1.0, coat_rough=0.12, specular=0.55)
visor_m = principled('visor', base=INK, rough=0.12, coat=1.0, coat_rough=0.04, specular=0.7)
eye_m = principled('eye', base=CREAM, rough=0.4, emission=CREAM, strength=6)
coral_m = principled('coral', base=CORAL, rough=0.28, coat=0.9, coat_rough=0.12, emission=CORAL, strength=0.25, subsurface=0.3, sss_radius=(1, .3, .15))
nozzle_m = principled('nozzle', base=INK, rough=0.35, coat=0.6)

# head: a plump rounded box, slightly wider than tall, with a gently domed front
head = rounded_box('head', (1.12, 1.0, 0.94), 0.36, segments=14, sub=2)
head.parent = bot

# visor: a rounded slab, inset into the front and following the head's curve
visor = rounded_box('visor', (0.78, 0.62, 0.56), 0.26, segments=12, sub=2)
visor.location = (0.0, -0.26, -0.03)
visor.parent = bot
visor.data.materials.append(visor_m)

# bezel: a slightly larger white lip around the visor
bezel = rounded_box('bezel', (0.86, 0.62, 0.64), 0.29, segments=12, sub=2)
bezel.location = (0.0, -0.235, -0.03)
bezel.parent = bot
bezel.data.materials.append(shell)

head.data.materials.append(shell)

# eyes: two glowing pills, expression-dependent
MOODS = {
    'idle':     ('pills', 1.0, 1.0, 0),
    'happy':    ('arcs', 1, 1, 0),
    'wink':     ('wink', 1, 1, 0),
    'laugh':    ('chev', 1, 1, 0),
    'focus':    ('pills', 1.0, 0.75, 0.3),
    'sad':      ('pills', 0.9, 0.7, -0.3),
    'big':      ('pills', 1.5, 1.1, 0),
    'sleep':    ('lines', 1, 1, 0),
    'thinking': ('dots', 1, 1, 0),
}
kind, sw, sh, tilt = MOODS.get(A.mood, MOODS['idle'])

def eye_pill(x, w, h, tilt=0.0, y=-0.585, z=0.0):
    o = capsule('eye', 0.046 * w, 0.2 * h, loc=(x, y, z), rot=(0, tilt, 0))
    o.data.materials.append(eye_m)
    o.parent = bot
    return o

def eye_arc(x, y=-0.585, z=0.01, flip=False):
    # a bent pill reading as ^ (happy) or v
    o = capsule('eye', 0.035, 0.2, loc=(x, y, z), rot=(0, math.radians(90), 0))
    b = o.modifiers.new('bend', 'SIMPLE_DEFORM'); b.deform_method = 'BEND'; b.angle = math.radians(-110 if not flip else 110); b.deform_axis = 'Z'
    o.data.materials.append(eye_m)
    o.parent = bot
    return o

if kind == 'pills':
    eye_pill(-0.16, sw, sh, tilt)
    eye_pill(0.16, sw, sh, -tilt)
elif kind == 'arcs':
    eye_arc(-0.145); eye_arc(0.145)
elif kind == 'wink':
    eye_pill(-0.145, 1, 1); eye_arc(0.145)
elif kind == 'chev':
    eye_arc(-0.145, flip=False); eye_arc(0.145, flip=False)
    for o in [x for x in bpy.data.objects if x.name.startswith('eye')]:
        o.rotation_euler = (0, math.radians(0), math.radians(90 if o.location.x < 0 else -90))
elif kind == 'lines':
    for x in (-0.145, 0.145):
        o = capsule('eye', 0.028, 0.14, loc=(x, -0.565, 0.0), rot=(0, math.radians(90), 0)); o.data.materials.append(eye_m); o.parent = bot
elif kind == 'dots':
    for i, x in enumerate((-0.12, 0, 0.12)):
        o = sphere('eye', 0.035, loc=(x, -0.565, 0.0)); o.data.materials.append(eye_m); o.parent = bot

# ears: soft lens discs on each side
for sx in (-1, 1):
    ear = sphere('ear', 0.19, loc=(sx * 0.56, 0.02, -0.02), scale=(0.42, 1, 1))
    ear.data.materials.append(shell)
    ear.parent = bot

# antenna: a floating coral drop above the head
ant = capsule('antenna', 0.07, 0.3, loc=(-0.12, 0.0, 0.72), rot=(0, math.radians(-32), 0))
ant.data.materials.append(coral_m)
ant.parent = bot

# arms: little white nubs at the lower sides
for sx in (-1, 1):
    arm = capsule('arm', 0.08, 0.22, loc=(sx * 0.5, -0.28, -0.33), rot=(math.radians(-20), math.radians(-sx * 22), 0))
    arm.data.materials.append(shell)
    arm.parent = bot

# thruster: dark nozzle underneath
noz = bpy.ops.mesh.primitive_cylinder_add(radius=0.12, depth=0.08, location=(0, 0, -0.5), vertices=48)
noz = bpy.context.object; noz.name = 'nozzle'
noz.modifiers.new('b', 'BEVEL').width = 0.02
smooth(noz); noz.data.materials.append(nozzle_m); noz.parent = bot
flame_core = principled('thrust', base=(1, .8, .5, 1), rough=1, emission=(1, .72, .45, 1), strength=6, alpha=0.6)
th = sphere('thrust', 0.1, loc=(0, 0, -0.58), scale=(1, 1, 0.7))
th.data.materials.append(flame_core); th.parent = bot

# ---------------------------------------------------------------- flames (optional, separate from the bot)
if A.flames:
    flame_m = bpy.data.materials.new('flame')
    flame_m.use_nodes = True
    nt = flame_m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.75
    b.inputs['Coat Weight'].default_value = 0.1
    b.inputs['Specular IOR Level'].default_value = 0.2
    b.inputs['Subsurface Weight'].default_value = 0.12
    b.inputs['Subsurface Radius'].default_value = (0.6, 0.25, 0.1)
    b.inputs['Emission Strength'].default_value = 0.75
    # colour ramp along the lobe's local Y: white-hot near the bot, red-orange at the tip
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 1.0; mr.inputs['From Max'].default_value = 0.1
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (1.0, 0.95, 0.88, 1)
    ramp.color_ramp.elements[1].color = (1.0, 0.13, 0.05, 1)
    e = ramp.color_ramp.elements.new(0.05); e.color = (1.0, 0.72, 0.5, 1)
    e = ramp.color_ramp.elements.new(0.16); e.color = (1.0, 0.5, 0.3, 1)
    e = ramp.color_ramp.elements.new(0.6); e.color = (1.0, 0.32, 0.15, 1)
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    nt.links.new(sep.outputs['X'], mr.inputs['Value'])
    nt.links.new(mr.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Emission Color'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Subsurface Radius']) if False else None

    flames = link(bpy.data.objects.new('flames', None))
    flames.parent = bot
    # the cluster's tail axis points behind the head (+Y) and to the left (-X), dipping slightly
    flames.rotation_euler = Euler((math.radians(-8), math.radians(8), math.radians(-34)), 'XYZ')
    flames.location = (0.0, 0.0, -0.06)
    # (x offset back, y, z, length, radius, pitch deg)
    LOBES = [
        (0.00, 0.00, -0.08, 1.3, 0.27, 6), (-0.06, -0.16, 0.16, 1.0, 0.22, -18), (-0.04, 0.14, -0.3, 0.95, 0.22, 24),
        (0.0, 0.24, 0.04, 0.8, 0.18, 12), (-0.08, -0.3, -0.12, 0.85, 0.19, -4), (-0.3, 0.04, 0.36, 0.55, 0.13, -34),
        (-0.34, 0.1, -0.42, 0.5, 0.12, 38), (-0.55, 0.2, 0.1, 0.45, 0.09, -10), (-0.6, -0.16, -0.2, 0.4, 0.085, 18),
        (-0.85, 0.02, 0.24, 0.3, 0.06, -6), (-0.9, -0.05, -0.3, 0.28, 0.055, 10),
    ]
    GAP = 0.1
    LOBES = [(bx, y, z, L * 1.3, R, p) for (bx, y, z, L, R, p) in LOBES]
    for i, (bx, y, z, L, R, pitch) in enumerate(LOBES):
        # a teardrop built from a profile: round front, gentle taper, rounded cap at the tail
        cap = 0.42
        prof = []
        for k in range(0, 9):                                   # front hemisphere (+X)
            a = math.pi / 2 * (1 - k / 8); prof.append((math.sin(a), math.cos(a)))
        for k in range(1, 13):                                  # taper toward the tail
            u = k / 12; prof.append((-(L / R - cap) * u, 1 - (1 - cap) * (u ** 1.5)))
        for k in range(1, 9):                                   # tail cap
            a = math.pi / 2 * k / 8; prof.append((-(L / R - cap) - cap * math.sin(a), cap * math.cos(a)))
        bm = bmesh.new()
        ring = []
        N = 40
        for (px, pr) in prof:
            ring.append([bm.verts.new((px, pr * math.cos(2 * math.pi * q / N), pr * math.sin(2 * math.pi * q / N))) for q in range(N)])
        for r0, r1 in zip(ring, ring[1:]):
            for q in range(N):
                a_, b_, c_, d_ = r0[q], r0[(q + 1) % N], r1[(q + 1) % N], r1[q]
                try: bm.faces.new((a_, b_, c_, d_))
                except ValueError: pass
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(f'lobe{i}'); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new(f'lobe{i}', me); link(o)
        o.modifiers.new('sub', 'SUBSURF').levels = 1
        o.scale = (R, R, R)
        # lobe space +X is "back"; place the round front a fixed gap behind the head's back edge (head back ≈ +0.56)
        o.location = (-(0.56 + GAP + R * 0.95) + bx, y, z)
        o.rotation_euler = (0, math.radians(pitch), 0)
        o.data.materials.append(flame_m)
        o.parent = flames
        smooth(o)
    # warm light from the flames onto the bot
    fl = bpy.data.lights.new('flamelight', 'POINT'); fl.energy = 30; fl.color = (1, .55, .35); fl.shadow_soft_size = 0.6
    flo = link(bpy.data.objects.new('flamelight', fl)); flo.location = (-0.6, 0.75, -0.05); flo.parent = bot

# ---------------------------------------------------------------- pose
bot.rotation_euler = Euler((math.radians(-8), math.radians(-14), math.radians(14)), 'XYZ')

# ---------------------------------------------------------------- camera + light
cam = bpy.data.cameras.new('cam'); cam.lens = 70
co = link(bpy.data.objects.new('cam', cam))
co.location = (-0.4 if A.flames else 0.0, -6.4, 0.75)
co.rotation_euler = (math.radians(84), 0, math.radians(2.5))
sc.camera = co
cam.dof.use_dof = True; cam.dof.focus_object = head; cam.dof.aperture_fstop = 5.6

def area(name, energy, loc, size, color=(1, 1, 1), target=bot):
    l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size; l.color = color
    o = link(bpy.data.objects.new(name, l)); o.location = loc
    c = o.constraints.new('TRACK_TO'); c.target = target; c.track_axis = 'TRACK_NEGATIVE_Z'; c.up_axis = 'UP_Y'
    return o
area('key', 260, (-2.6, -4.2, 4.2), 4.5, (1, .98, .95))
area('fill', 90, (4, -3.5, 0.6), 6, (1, .93, .88))
area('rim', 140, (1.5, 3.5, 2.0), 3, (1, .85, .75))
area('under', 30, (0, -2, -3.5), 4, (1, .9, .8))
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (.92, .95, 1.0, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 0.35

# ---------------------------------------------------------------- render settings
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = A.samples
sc.cycles.use_denoising = True
sc.cycles.denoiser = 'OPENIMAGEDENOISE'
sc.render.resolution_x, sc.render.resolution_y = A.size
sc.render.film_transparent = not A.bg
if A.bg:
    w.node_tree.nodes['Background'].inputs[0].default_value = (.55, .72, .92, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGBA'
vts = [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items]
sc.view_settings.view_transform = 'Khronos PBR Neutral' if 'Khronos PBR Neutral' in vts else ('Filmic' if 'Filmic' in vts else 'Standard')
sc.view_settings.look = 'None'
sc.view_settings.exposure = -0.2

# glow: a bloom pass in the compositor (Blender 5 keeps it in a node group on the scene)
try:
    ng = bpy.data.node_groups.new('comp', 'CompositorNodeTree')
    sc.compositing_node_group = ng
    ng.interface.new_socket('Image', in_out='INPUT', socket_type='NodeSocketColor')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    gi = ng.nodes.new('NodeGroupInput'); go = ng.nodes.new('NodeGroupOutput')
    rl = ng.nodes.new('CompositorNodeRLayers'); rl.scene = sc
    glare = ng.nodes.new('CompositorNodeGlare')
    glare.inputs['Type'].default_value = 'Bloom'
    for k, val in (('Threshold', 0.9), ('Strength', 0.22), ('Size', 0.5), ('Saturation', 0.9)):
        if k in glare.inputs: glare.inputs[k].default_value = val
    ng.links.new(rl.outputs['Image'], glare.inputs['Image'])
    ng.links.new(glare.outputs['Image'], go.inputs['Image'])
    sc.render.use_compositing = True
except Exception as ex:
    print('bloom skipped:', ex)
    sc.compositing_node_group = None
    sc.render.use_compositing = False

sc.frame_set(A.frame)
sc.render.filepath = A.out
bpy.ops.render.render(write_still=True)
print('rendered', A.out)
