# 10｜新生儿女宝｜背视图

## 用途
用于 Hunyuan3D 多视图建模的 `back` 输入，与前、左、右视图共同约束宝宝背侧几何、头颅后部、肩背、臀部、尿布后片和四肢厚度。

## 参考图规则
必须使用对应 `07-newborn-girl-front` 生成图作为唯一视觉参考；同时参考已经通过 QA 的左右视图，仅用于核对厚度，不得改变身份或姿势。

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
Using the uploaded `07-newborn-girl-front` image as the sole identity and geometry reference, generate exactly the same East Asian newborn girl, approximately one week old, as a strict posterior orthographic view for the Hunyuan3D `back` field.

Treat this as a virtual camera rotation around one unchanged 3D body. The posterior surface faces the camera: show the back of the head, both ears in anatomically plausible partial profile, neck, shoulders, upper back, spine contour, lower back, the back panel of the same seamless ivory diaper, buttock volume fully covered by the diaper, backs of the arms and legs, heels and soles where physically visible. Do not turn the baby into a new prone pose, do not place the face against a surface, and do not change any joint angle.

Preserve exactly the same head shape, hair amount, body proportions, limb lengths, arm separation, elbow bend, hand openness, finger count, hip and knee flexion, foot separation, diaper construction, skin tone, PBR material, light softness, and overall scale. The front image and this back image must describe opposite surfaces of one identical model.

Use a strict orthographic camera aligned to the posterior body plane, equivalent to an 85–120 mm lens with no wide-angle distortion. Full body centered and occupying about 82% of canvas height. Maintain slight depth separation between near and far limbs so no arm, hand, leg, foot, finger or toe disappears or fuses.

Pure white #FFFFFF background. Use the same neutral reconstruction lighting as the other views: broad warm-ivory key, pale cyan-blue fill, extremely faint coral rim, minimal edge tint, and only a very soft light-gray contact shadow. Output one clean asset only.
```

## 构图与硬约束
- 与 `front` 是同一个模型的相反表面，不是重新摆成俯卧姿势。
- 只改变虚拟相机方向，不改变身体、四肢、手脚和尿布姿势。
- 严格背侧正交，映射到 Hunyuan3D `back`。
- 全身居中，占画面高度约 82%。
- 后脑、肩背、腰背、尿布后片、手脚厚度必须可读。
- 禁止直接将前视图做二维镜像或简单翻转。

## 该资产专属负向提示词

```text
front view, face visible from the front, three-quarter view, side view,
new prone sleeping pose, face pressed into mattress, turned head, changed joint angles,
mirrored front image, redesigned face, changed diaper, changed body proportions,
pink bow, hair accessory, gender stereotype decoration, photograph, hyperreal pores, plastic doll, clay render, yellow skin,
fused limbs, missing far-side limbs, missing fingers, missing toes, extra digits,
visible genitals, open diaper, cropped head, cropped hands, cropped feet,
props, mattress, blanket, text, UI, second baby
```

## 输出规格
- 1536×1536，正方形。
- 纯白 `#FFFFFF`；优先同时保存透明 PNG。
- 输出恰好一名宝宝、一个严格背视图。

## QA 验收
- [ ] 与前视图身份和姿势完全一致。
- [ ] 是同一模型的背侧，不是新的俯卧动作。
- [ ] 后脑、肩背、腰背和尿布后片结构连续。
- [ ] 远侧肢体没有消失或融合。
- [ ] 缩放、材质、肤色和灯光与其余三视图一致。
