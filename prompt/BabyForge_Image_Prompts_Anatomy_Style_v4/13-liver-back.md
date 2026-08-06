# 13｜新生儿肝脏｜背视图

## 用途
用于 Hunyuan3D 多视图建模的 `back` 输入，补足肝脏后表面、厚度、后缘和叶段体积约束。

## 参考图规则
必须使用 `10-liver-front` 生成图作为唯一视觉参考；可使用通过 QA 的左右视图核对厚度，但不得重新设计器官。

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
Using the uploaded `10-liver-front` image as the sole geometry and material reference, render exactly the same human neonatal liver as a strict posterior orthographic view for the Hunyuan3D `back` field. Rotate the same 3D organ by exactly 180 degrees around its vertical axis. Do not mirror the front image and do not redesign the anatomy.

Show the intact posterior surface and true organ depth. Preserve exactly the same overall width, height, thickness, right-to-left lobe volume relationship, superior convexity, inferior taper, groove depth, edge shape, reddish-brown/deep-coral color, surface microtexture, roughness and highlight width. Posterior anatomical grooves may be subtly suggested, but do not add a gallbladder, long external vessels, surgical openings, or a cutaway.

Use the same neutral reconstruction lighting and exposure as the front and side views: broad warm-ivory key, pale cyan-blue fill, extremely faint coral rim with minimal color spill. Strict orthographic 85–120 mm equivalent camera, no perspective distortion. Center the organ and fill about 78% of the square canvas.

Pure white #FFFFFF background, faint warm-gray contact shadow, no plinth, no torso, no labels or extra objects. Output exactly one posterior view.
```

## 构图与硬约束
- 必须是同一肝脏旋转 180° 后的真实背面，不是二维镜像。
- 严格后方正交，映射到 Hunyuan3D `back`。
- 几何、比例、颜色、粗糙度、缩放和曝光与 `front` 一致。
- 后表面完整，不做切面，不增加胆囊或外伸血管。

## 该资产专属负向提示词

```text
front view, three-quarter view, side view, mirrored front image, flattened icon,
redesigned liver, changed lobe ratio, changed thickness, changed color,
diseased liver, fatty liver, cirrhosis, tumor, gallbladder, long external vessels,
cutaway, cross-section, blood, wet surface, metallic organ, plastic toy,
black background, dramatic shadow, plinth, human body, text, labels, arrows
```

## 输出规格
- 1536×1536，正方形。
- 纯白 `#FFFFFF`；建议同时保留透明 PNG。
- 输出恰好一个严格背视图。

## QA 验收
- [ ] 与前视图是同一个肝脏。
- [ ] 严格后方正交，对应 Hunyuan3D `back`。
- [ ] 厚度、叶段体积、缩放、颜色和材质一致。
- [ ] 无镜像错误、病变或新增器官结构。
- [ ] 无台座和附加环境。
