# 12｜新生儿肝脏｜右视图

## 用途
用于与肝脏主视图组成同一模型的严格 90° 右正交资产。

## 参考图规则
必须使用 `10-liver-front` 生成图作为唯一视觉参考。


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
Using the uploaded `10-liver-front` image as the sole visual reference, render exactly the same neonatal liver as a strict 90-degree orthographic right view. Rotate the same 3D organ around its vertical axis; do not mirror the source image and do not redesign the anatomy.

Preserve exactly the same geometry, lobe volumes, right-to-left size relationship, superior convexity, inferior taper, groove depth, surface microtexture, reddish-brown/coral color, roughness, highlight width, scale, and lighting softness. Only the camera position changes.

Use an 85–120 mm orthographic medical-asset camera with no perspective distortion. Center the liver and fill about 78% of the square canvas. Pure white #FFFFFF background, faint warm-gray contact shadow, no plinth. The side silhouette must remain anatomically plausible and show the true depth of the same organ rather than a flattened icon.

Output exactly one right view.
```

## 构图与硬约束
- 必须使用 `10-liver-front` 作为唯一视觉参考。
- 只旋转相机，不改变几何、材质和光照。
- 严格 90° 右正交，不是三分之二侧面。
- 不是镜像翻转。
- 本图在 Hunyuan3D 中映射为 `right`。

## 该资产专属负向提示词

```text
front view, three-quarter view, left view, mirrored image, redesigned liver,
changed lobe ratio, flattened icon, changed color, changed texture, diseased liver,
gallbladder, external vessels, cutaway, blood, wet surface, metallic organ,
plastic toy, black background, plinth, human body, text, labels, arrows
```

## 输出规格
- 1536×1536，正方形。
- 纯白 `#FFFFFF`。
- 输出恰好一个严格侧视图。

## QA 验收
- [ ] 与主图为同一肝脏。
- [ ] 严格 90° 右正交。
- [ ] 叶段体积、颜色、纹理和缩放一致。
- [ ] 没有镜像错误。
- [ ] 无台座和附加结构。
