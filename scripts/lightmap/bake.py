"""Bước 2 của `npm run lightmap` – chạy trong Blender không giao diện:

    blender -b --factory-startup -P scripts/lightmap/bake.py -- [--size 2048] [--samples 128]

Đọc .lightmap/{scene.json, positions.bin, normals.bin} (do export.mjs xuất), dựng lại mesh tĩnh của phòng, mở UV lightmap chung
một atlas (diện tích UV tỉ lệ diện tích thật), đặt nguồn sáng như phòng (tấm đèn trần, nắng qua cửa sổ, trời), nướng phần ánh sáng
GIÁN TIẾP khuếch tán bằng Cycles, khử nhiễu (OIDN qua compositor) rồi ghi public/lightmap/{atlas.png, uv1.bin, manifest.json}.

UV đọc ngược theo đúng thứ tự đỉnh của trình duyệt: mỗi tam giác i giữ chỉ số gốc (thuộc tính mặt `ofi`), góc k ↔ đỉnh 3·i + k.
"""
import json
import math
import os
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Vector

ROOT = os.getcwd()
IN = os.path.join(ROOT, '.lightmap')
OUT = os.path.join(ROOT, 'public', 'lightmap')

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opt = {'size': 2048, 'samples': 64, 'margin': 2}
for i in range(0, len(argv) - 1, 2):
    opt[argv[i].lstrip('-')] = int(argv[i + 1])
SIZE, SAMPLES = opt['size'], opt['samples']
t0 = time.time()


def log(msg):
    print(f'[lightmap {time.time() - t0:6.1f}s] {msg}', flush=True)


scene_json = json.load(open(os.path.join(IN, 'scene.json'), encoding='utf-8'))
pos = np.fromfile(os.path.join(IN, 'positions.bin'), dtype=np.float32).reshape(-1, 3)
nor = np.fromfile(os.path.join(IN, 'normals.bin'), dtype=np.float32).reshape(-1, 3)
meshes = scene_json['meshes']
# Khóa `occluder:` = vật che (cánh tủ đóng): có trong cảnh để chặn sáng, không nhận lightmap, không có trong atlas.
assert sum(m['count'] for m in meshes) == len(pos), 'positions.bin không khớp scene.json'
n_targets = sum(1 for m in meshes if not m['key'].startswith('occluder:'))
assert all(m['key'].startswith('occluder:') for m in meshes[n_targets:]), 'vật che phải nằm cuối danh sách'
target_verts = sum(m['count'] for m in meshes[:n_targets])

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------- Dựng mesh ----------
img = bpy.data.images.new('lightmap', SIZE, SIZE, float_buffer=True, alpha=False)
objs = []
offset = 0
for idx, m in enumerate(meshes):
    n = m['count']
    P = pos[offset:offset + n]
    N = nor[offset:offset + n]
    offset += n
    tris = n // 3
    me = bpy.data.meshes.new(f"m{idx}")
    me.vertices.add(n)
    me.vertices.foreach_set('co', P.ravel())
    me.loops.add(n)
    me.loops.foreach_set('vertex_index', np.arange(n, dtype=np.int32))
    me.polygons.add(tris)
    me.polygons.foreach_set('loop_start', np.arange(0, n, 3, dtype=np.int32))
    me.update(calc_edges=True)
    me.normals_split_custom_set(N.tolist())
    # Chỉ số tam giác gốc – giữ qua mọi thao tác hình học.
    attr = me.attributes.new('ofi', 'INT', 'FACE')
    attr.data.foreach_set('value', np.arange(tris, dtype=np.int32))
    ob = bpy.data.objects.new(f"o{idx}", me)
    scene.collection.objects.link(ob)
    if m['key'].startswith('occluder:'):
        mat = bpy.data.materials.new(f"occ{idx}")
        mat.use_nodes = True
        r, g, b = m['albedo']
        mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (r, g, b, 1)
        me.materials.append(mat)
        continue
    # Vật liệu: khuếch tán màu albedo; nút ảnh lightmap đang chọn (đích nướng).
    mat = bpy.data.materials.new(f"mat{idx}")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    r, g, b = m['albedo']
    bsdf.inputs['Base Color'].default_value = (r, g, b, 1)
    bsdf.inputs['Roughness'].default_value = 1.0
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.nodes.active = tex
    me.materials.append(mat)
    objs.append(ob)
log(f'{len(objs)} mesh nhận lightmap + {len(meshes) - len(objs)} vật che, {len(pos)} đỉnh')

# Nối đỉnh trùng (để UV chia mảng theo mặt phẳng thay vì từng tam giác rời); mặt suy biến bị xóa – `ofi` giữ chỉ số gốc.
for ob in objs:
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.uv_layers.new(name='lm')
log('đã nối đỉnh trùng')

# ---------- UV lightmap chung một atlas ----------
bpy.ops.object.select_all(action='DESELECT')
for ob in objs:
    ob.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
log('smart project xong')
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.average_islands_scale()
# Khoảng cách giữa các mảnh: cộng thêm ~1,5 điểm ảnh (FRACTION theo tỉ lệ cố định thì hàng nghìn mảnh nhỏ nuốt hết atlas).
# Mảnh cách nhau 4 px; lề nướng (margin) chỉ 2 px để không lan sang mảnh bên cạnh (viền sáng quanh cánh tủ).
bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, scale=True, margin_method='ADD', margin=4 / SIZE)
log(f'số mảnh UV ước tính: {sum(len(o.data.polygons) for o in objs)} mặt')
bpy.ops.object.mode_set(mode='OBJECT')
log('xếp đảo UV xong')

# ---------- Nguồn sáng ----------
world = bpy.data.worlds.new('sky')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.78, 0.85, 0.95, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.5
scene.world = world
for i, p in enumerate(scene_json['panels']):
    ld = bpy.data.lights.new(f'panel{i}', 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size, ld.size_y = p['size']
    ld.energy = 120.0
    ld.color = (0.96, 0.97, 1.0)
    lo = bpy.data.objects.new(f'panel{i}', ld)
    lo.location = p['center']  # mặc định chiếu xuống −Z
    scene.collection.objects.link(lo)
# Nắng: cùng hướng với đèn "sun" thời gian thực (lighting.ts: SUN_OFFSET (−30, 75, 110) theo trục three).
sd = bpy.data.lights.new('sun', 'SUN')
sd.energy = 3.0
sd.color = (1.0, 0.94, 0.85)
sd.angle = math.radians(1.5)
so = bpy.data.objects.new('sun', sd)
to_light = Vector((-30, -110, 75)).normalized()
so.rotation_euler = (-to_light).to_track_quat('-Z', 'Y').to_euler()
scene.collection.objects.link(so)

# ---------- Nướng ----------
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = False
scene.cycles.max_bounces = 4
scene.cycles.diffuse_bounces = 4
scene.render.bake.margin = opt['margin']
scene.render.bake.use_clear = True
bpy.ops.object.select_all(action='DESELECT')
for ob in objs:
    ob.select_set(True)
bpy.context.view_layer.objects.active = objs[0]
log(f'bắt đầu nướng {SIZE}×{SIZE}, {SAMPLES} mẫu…')
bpy.ops.object.bake(type='DIFFUSE', pass_filter={'INDIRECT'}, margin=opt['margin'], use_clear=True)
log('nướng xong')

# ---------- Khử nhiễu (OIDN qua compositor) ----------
scene.use_nodes = True
tree = scene.node_tree
tree.nodes.clear()
n_img = tree.nodes.new('CompositorNodeImage')
n_img.image = img
n_dn = tree.nodes.new('CompositorNodeDenoise')
n_dn.prefilter = 'NONE'
n_out = tree.nodes.new('CompositorNodeComposite')
tree.links.new(n_img.outputs['Image'], n_dn.inputs['Image'])
tree.links.new(n_dn.outputs['Image'], n_out.inputs['Image'])
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))  # render cần camera dù chỉ chạy compositor
scene.collection.objects.link(cam)
scene.camera = cam
scene.render.resolution_x = scene.render.resolution_y = SIZE
scene.render.resolution_percentage = 100
scene.cycles.samples = 1
for ob in scene.objects:  # không vẽ lại cảnh, chỉ chạy compositor
    ob.hide_render = True
bpy.ops.render.render(write_still=False)
den = bpy.data.images['Render Result']
tmp = os.path.join(IN, 'denoised.exr')
scene.render.image_settings.file_format = 'OPEN_EXR'
den.save_render(tmp, scene=scene)
d_img = bpy.data.images.load(tmp)
px = np.array(d_img.pixels[:], dtype=np.float32).reshape(-1, 4)[:, :3]
log('khử nhiễu xong')

# ---------- Chuẩn hóa + ghi ----------
lum = px.max(axis=1)
nz = lum[lum > 1e-6]
scale = float(np.percentile(nz, 99.5)) if nz.size else 1.0
out_px = np.clip(px / scale, 0, 1)
out = bpy.data.images.new('atlas', SIZE, SIZE, alpha=False, float_buffer=True)
out.pixels.foreach_set(np.concatenate([out_px, np.ones((len(out_px), 1), np.float32)], axis=1).ravel())
os.makedirs(OUT, exist_ok=True)
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'
out.save_render(os.path.join(OUT, 'atlas.png'), scene=scene)

# UV theo thứ tự đỉnh gốc (uint16 chuẩn hóa).
uv_all = np.zeros((len(pos), 2), dtype=np.float32)
manifest_meshes = []
offset = 0
for idx, (m, ob) in enumerate(zip(meshes, objs)):
    me = ob.data
    nl = len(me.loops)
    luv = np.zeros(nl * 2, dtype=np.float32)
    me.uv_layers['lm'].data.foreach_get('uv', luv)
    luv = luv.reshape(-1, 2)
    ofi = np.zeros(len(me.polygons), dtype=np.int32)
    me.attributes['ofi'].data.foreach_get('value', ofi)
    starts = np.zeros(len(me.polygons), dtype=np.int32)
    me.polygons.foreach_get('loop_start', starts)
    for k in range(3):
        uv_all[offset + ofi * 3 + k] = luv[starts + k]
    manifest_meshes.append({'key': m['key'], 'count': m['count'], 'offset': offset})
    offset += m['count']
(np.clip(uv_all[:target_verts], 0, 1) * 65535 + 0.5).astype(np.uint16).tofile(os.path.join(OUT, 'uv1.bin'))
json.dump({
    'version': 1, 'size': SIZE, 'samples': SAMPLES,
    # Ảnh lưu sRGB đã chia cho `scale`; three: chiếu xạ = lightMap × intensity, khuếch tán = chiếu xạ × albedo / π → nhân π.
    'intensity': scale * math.pi,
    'atlas': 'atlas.png', 'uv': 'uv1.bin', 'meshes': manifest_meshes,
}, open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False)
log(f'xong: {OUT} (hệ số {scale:.4f})')
