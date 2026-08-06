# 05｜黄疸观察部位｜中性版

## 用途
用于提示家长观察面部、眼白、胸腹和四肢等部位；不直接输出诊断或严重程度。

## 参考图规则
无；该资产为人体观察中性图，不区分男女；如产品需要角色一致性，可额外使用任一新生儿主资产作为风格参考，但不改变观察部位与医学表达。

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
A clean premium 3D medical-education composition showing one sex-neutral East Asian newborn in a strict top-down frontal view while lying supine. Full body visible from head to toes. Place the baby on the left side of a horizontal canvas, occupying about 82% of image height, with at least 32% clean negative space on the right for UI.

The baby has natural peach-apricot skin and age-accurate newborn proportions, wearing a seamless ivory diaper. Keep the base skin color fully natural; do not tint the whole baby yellow. Do not include any sex-coded styling, hair accessories, clothing decoration, or gender stereotype props.

Apply four separate, equal-intensity, low-saturation warm-gold translucent observation glows to: 1) facial skin, 2) both sclera regions, 3) chest and abdomen surface, and 4) arms and legs. The glows are soft surface overlays with feathered edges and identical visual strength. They indicate places to observe, not disease severity. Do not show internal organs or x-ray transparency.

Use softened anatomical 3D realism, warm ivory key light, pale cyan-blue fill, faint coral rim, pure warm-white background, minimal contact shadow. No text, scale, legend, arrows, diagnosis, warning symbol, or severity coding.
```

## 构图与硬约束
- 宝宝位于左侧，右侧至少 32% 留白。
- 面部、眼白、胸腹、四肢四组高亮强度必须一致。
- 高亮是局部低饱和暖金柔光，不是整体变黄。
- 眼白仍可辨认，不画成强烈黄色。
- 不出现内部器官。
- 人物必须是中性表达，不使用任何性别刻板元素。

## 该资产专属负向提示词

```text
whole body yellow, severe jaundice, orange filter, neon yellow skin, yellow room light,
unequal highlight intensity, gradient severity scale, Kramer scale, diagnosis,
warning icon, arrows, labels, numbers, legend, x-ray body, visible liver,
blood, needle, syringe, hospital bed, crying in distress, naked genitals,
pink bow, hair accessory, gender stereotype props,
photograph, extra baby, cropped feet, malformed eyes
```

## 输出规格
- 1536×1024，横向 3:2。
- 暖白或透明背景。
- 不生成文字和分级，由应用层完成。

## QA 验收
- [ ] 基础肤色自然。
- [ ] 四组观察区域齐全且同强度。
- [ ] 右侧留白足够。
- [ ] 无诊断、无严重程度暗示。
- [ ] 全身、手脚和尿布完整。
- [ ] 无性别刻板装饰。
