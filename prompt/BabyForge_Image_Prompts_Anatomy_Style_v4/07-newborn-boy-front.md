# 07｜新生儿男宝｜前视图

## 用途
用于 Hunyuan3D 多视图建模的 `front` 输入，同时作为男宝统一身份基准，并为左、右、背视图提供唯一参考。

## 参考图规则
无；本图是该角色的身份与几何基准。


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
One isolated East Asian newborn boy, approximately one week old, rendered as a premium softened-realism medical 3D character asset. Strict top-down anterior orthographic view, camera directly above the chest-and-abdomen side of the body. This image maps to the Hunyuan3D `front` field. Use an 85–120 mm lens equivalent with essentially no perspective distortion.

The baby lies supine on an invisible flat plane. Head centered and neutral. Arms are separated from the torso by approximately 28 degrees; elbows gently flexed; hands semi-relaxed with all fingers individually readable. Legs are slightly separated and gently bent in natural neonatal flexion; both feet and all toes are visible. Body pose is calm and anatomically plausible, not perfectly symmetrical. Full body centered and occupying about 82% of canvas height.

Use restrained East Asian newborn facial features, age-accurate large head and short limbs, soft peach-apricot skin, subtle low-contrast subsurface softness, no pores, no wetness, no wax. A seamless plain ivory diaper completely covers the genital area. No clothing, props, toys, text, or environment.

Pure white #FFFFFF background. Soft warm-ivory key light from upper front-right, pale cyan-blue fill from left, faint warm-gold/coral rim, extremely soft light-gray contact shadow directly below the body. High anatomical clarity, consistent PBR material, clean asset-sheet quality.
```

## 构图与硬约束
- 严格顶视正交，不是斜俯视。
- 全身居中，占画面高度约 82%。
- 双臂与躯干约 28° 分开，避免手臂与身体粘连。
- 手指、脚趾均应可辨。
- 姿势作为后续左、右、背视图的唯一几何基准。
- 本图在 Hunyuan3D 中映射为 `front`。

## 该资产专属负向提示词

```text
side view, three-quarter view, front-standing baby, sitting baby, crawling baby,
photograph, realistic pores, plastic doll, clay render, yellow skin, harsh shadow,
cropped head, cropped hands, cropped feet, arms touching torso, legs fused together,
closed fists hiding all fingers, missing toes, extra digits, visible genitals,
open diaper, props, text, UI, second baby
```

## 输出规格
- 1536×1536，正方形。
- 纯白 `#FFFFFF`。
- 输出恰好一名宝宝、一个严格前侧顶视图。
- 建议保存透明 PNG 和白底 PNG 两份。

## QA 验收
- [ ] 严格前侧顶视，对应 Hunyuan3D `front`。
- [ ] 身体完整且居中。
- [ ] 四肢分离，可用于三维重建。
- [ ] 指趾完整。
- [ ] 尿布完整遮挡。
- [ ] 无明显塑料感或摄影皮肤。
