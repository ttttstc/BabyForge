# 08｜新生儿女宝｜左视图

## 用途
用于与对应主视图组成三维重建和旋转展示所需的严格 90° 左侧正交资产。

## 参考图规则
必须使用对应 `07-newborn-girl-front` 生成图作为唯一视觉参考。


## 固定风格锁（所有资产必须继承）

**BabyForge Anatomy Specimen 3D**

- 高级医学教育级三维渲染，解剖结构可信，但视觉温和、适合育儿产品。
- 柔化写实，而非摄影：轮廓真实、比例准确；不呈现毛孔、汗液、血腥组织或令人不适的临床细节。
- PBR 非金属材质；中等偏高粗糙度，约 `0.48–0.60`；宽而柔的高光；仅保留极弱清漆层，避免蜡像和塑料玩具感。
- 暖白主光从右前上方照射；低强度淡青蓝补光从左前方照射；柔和珊瑚色轮廓光从左后方勾边；环境光暖而均匀。
- 使用 ACES Filmic 风格的柔和色调映射：高光不过曝，暗部保留层次，整体低对比、低饱和、无黄色滤镜。
- 相机呈中长焦医学标本感：约 `85–120 mm` 等效焦段；透视压缩自然；禁止广角变形。
- 主体边缘清晰、内部细节克制；纯白或暖象牙白背景；仅允许很淡的接触阴影和极轻的主体色环境辉光。
- 颜色锚点：珊瑚红 `#EB7C6B`、器官深珊瑚 `#B86858`、淡青蓝 `#6393D8`、鼠尾草绿 `#769D74`、暖金 `#F2A33B`、暖白 `#F7F0E7`。
- 画面内不生成文字、字母、数字、Logo、水印、图例、箭头、UI 卡片或品牌符号。


## 正向提示词（建议直接用于生图模型）

```text
Using the uploaded `girl newborn front-view image` as the sole visual reference, generate exactly the same East Asian newborn identity as a strict 90-degree orthographic left side view. This is a real camera rotation around one unchanged 3D body, not a mirrored repaint and not a new pose.

Preserve exactly: head shape, facial profile, hair amount, body proportions, limb lengths, arm angle, elbow bend, hand openness, finger count, hip and knee flexion, foot separation, diaper shape, skin tone, PBR material, lighting softness, and overall scale. Do not improve, beautify, restyle, or change the pose.

Camera is positioned precisely at body midline height on the baby's left side, looking horizontally across the body. Equivalent 85–120 mm orthographic lens, no wide-angle distortion. Full body is centered and occupies about 82% of canvas width, with head, back contour, diaper, both arms, both legs, hands, feet and toes remaining readable. Where limbs overlap in true side view, preserve slight natural depth separation from the reference so individual limbs do not fuse.

Use the same softened medical 3D realism, warm ivory key, pale cyan-blue fill, faint coral/gold rim, pure white background and soft contact shadow as the main image. Output one clean asset only.
```

## 构图与硬约束
- 必须上传对应 `07-newborn-girl-front` 作为唯一参考图。
- 只改变相机方位，不改变宝宝姿势、比例、表情和材质。
- 严格 90° 左侧正交。
- 本图在 Hunyuan3D 中映射为 `left`。
- 不是水平镜像；应旋转同一个三维身体。
- 身体占画面宽度约 82%。

## 该资产专属负向提示词

```text
front view, top view, three-quarter view, right side view, mirrored anatomy,
new pose, changed face, changed diaper, changed limb angle, changed lighting,
photograph, plastic toy, yellow skin, perspective distortion, fisheye,
fused arms, fused legs, missing far-side limbs, extra fingers, missing toes,
cropped head, cropped feet, visible genitals, pink decoration, bow, hair accessory, props, text, UI, extra baby
```

## 输出规格
- 1536×1536，正方形。
- 纯白 `#FFFFFF`。
- 输出恰好一个严格侧视图。

## QA 验收
- [ ] 与主图身份完全一致。
- [ ] 相机为严格 90° 左侧。
- [ ] 姿势未改变。
- [ ] 远侧肢体没有消失或融合。
- [ ] 比例、材质、光照和缩放匹配主图。
