# 10｜新生儿肝脏｜前视图

## 用途
用于 Hunyuan3D 多视图建模的 `front` 输入，是肝脏几何、叶段比例、颜色和材质的唯一基准。

## 参考图规则
无；本图是后续肝脏左、右、背视图及 Hero 展示图的唯一器官参考。

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
One isolated anatomically credible human neonatal liver rendered as a premium medical-education 3D reconstruction asset. Strict anterior orthographic view, camera centered directly in front of the organ with no superior, inferior, left, or right three-quarter rotation. This image maps to the Hunyuan3D `front` field.

Show the intact anterior surface. Preserve a broad larger right lobe and a thinner left lobe with a natural transition across the midline. The superior contour is smoothly convex, the inferior margin is softly tapered, and the falciform-ligament groove is subtle and shallow. Keep the organ whole; do not expose internal tissue.

Use warm reddish-brown and muted deep-coral tissue colors with restrained darker maroon only in natural grooves. Surface texture is finely organic, clean and dry. PBR non-metallic material, roughness approximately 0.50–0.60, broad soft highlights, faint clearcoat, softened normal detail, no wet shine.

Use neutral reconstruction lighting that remains reproducible in all views: broad warm-ivory key from upper front-right, pale cyan-blue fill from front-left, extremely faint coral rim, minimal edge color contamination. Orthographic 85–120 mm equivalent camera, no perspective distortion. Center the liver and fill about 78% of a square canvas.

Pure white #FFFFFF background with only a faint warm-gray contact shadow. No plinth, no human torso, no gallbladder, no external vessels extending away from the organ, no labels, no arrows, no extra objects.
```

## 构图与硬约束
- 严格正前方正交，不是前上方或三分之四视图。
- 本图映射到 Hunyuan3D `front`。
- 右叶、左叶、上缘和下缘均完整可见。
- 主体占画面约 78%，中心和缩放作为其他视图基准。
- 不使用标本台、身体轮廓或环境辉光。

## 该资产专属负向提示词

```text
anterior-superior view, three-quarter view, side view, top view,
adult oversized liver, diseased liver, fatty liver, cirrhosis, tumor, cyst,
gallstone, gallbladder, external vessels, cutaway, cross-section, exposed tissue,
wet organ, bloody organ, surgery specimen, gore, metallic surface, glass organ,
plastic toy, clay render, red neon, black background, dramatic shadow, plinth,
human torso, hands holding organ, text, labels, arrows, logo, multiple organs
```

## 输出规格
- 1536×1536，正方形。
- 纯白 `#FFFFFF`；建议同时保留透明 PNG。
- 输出单一完整肝脏前视图。

## QA 验收
- [ ] 严格正前方正交，对应 Hunyuan3D `front`。
- [ ] 器官完整、无病变、无切面。
- [ ] 叶段比例、中心和缩放可作为其他三视图基准。
- [ ] 材质干净柔和，不湿、不塑料。
- [ ] 无台座、无体腔、无多余器官。
