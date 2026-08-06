# 06｜新生儿黄疸机制｜中性版

## 用途
用于以无文字方式说明：红细胞分解产生胆红素、经血流到达肝脏、新生儿肝脏处理和排泄能力尚未成熟、部分胆红素在皮肤和眼白表现。

## 参考图规则
无；该资产为器官/机制中性图，不区分男女；如产品需要角色一致性，可额外使用任一新生儿主资产作为风格参考，但不改变机制内容。

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
A horizontal premium 3D medical-education mechanism scene arranged as one continuous left-to-right visual journey, not a flat infographic.

Stage 1 on the far left: a simplified translucent blood-flow environment in muted coral and deep rose, where a small controlled number of warm-gold bilirubin particles appear near gently fading red blood cell forms. No rupture, gore, or microscopic photography.

Stage 2: the same warm-gold particles travel through one elegant curved cyan-blue vascular pathway toward the center. The pathway is continuous and smooth, with no arrowheads and no text.

Stage 3 in the center: one anatomically credible newborn liver rendered as a warm coral-red 3D specimen. The liver has rounded lobes, a larger right lobe, a thinner left lobe, a subtle falciform groove and restrained surface texture. Some gold particles enter the liver; fewer particles continue beyond it, subtly communicating that neonatal processing and clearance are still maturing. Do not depict blockage or organ failure.

Stage 4 on the right: a softly translucent upper-body silhouette of one sex-neutral East Asian newborn, with natural skin color. Apply equal, low-intensity warm-gold surface glows only to the facial skin and sclera. The child looks calm, not critically ill. Do not include any sex-coded styling, clothing decoration, or accessories.

Use a warm white background, warm key light, pale cyan-blue fill, coral rim light, broad stable highlights, and gentle spatial depth. Keep all four stages visually connected by the particle path. No arrows, text, equations, values, severity scales, diagnosis, or UI.
```

## 构图与硬约束
- 左到右连续四段，整体仍是一张连贯三维场景。
- 粒子颜色和数量不表示严重程度。
- 中央肝脏是视觉锚点。
- 进入肝脏后的粒子应减少，但不能表现为完全阻塞。
- 右侧仅面部皮肤与眼白轻度同强度发光。
- 右侧人物为性别中性医学轮廓，不使用性别刻板元素。

## 该资产专属负向提示词

```text
flat flowchart, boxes, cards, arrowheads, labels, formula, bilirubin number,
severity level, blocked liver, diseased liver, cirrhosis, gallstone, tumor,
exploding red blood cells, blood splash, gore, microscope photo, x-ray gore,
whole baby yellow, critical illness, crying, oxygen mask, hospital equipment,
pink bow, hair accessory, gender stereotype decoration,
photograph, cartoon icon set, extra organs, random particles everywhere
```

## 输出规格
- 1536×1024，横向 3:2。
- 暖白或透明背景。
- 四段之间不得用分割线或卡片边框。

## QA 验收
- [ ] 红细胞分解、血流、肝脏、皮肤/眼白四个要素齐全。
- [ ] 粒子路径连续，进入肝脏后数量减少。
- [ ] 无文字箭头和医学数值。
- [ ] 不把黄疸画成严重全身黄染。
- [ ] 右侧人物为中性表达，无性别刻板装饰。
- [ ] 肝脏形态可信。
