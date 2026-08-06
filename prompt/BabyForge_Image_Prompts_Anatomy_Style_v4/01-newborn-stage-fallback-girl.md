# 01｜新生儿阶段默认图｜女宝

## 用途
用于出生后 0–28 天阶段首页、资源加载失败或未匹配具体内容时的默认视觉。

## 参考图规则
无；可使用对应主资产作为身份参考


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
A premium medical-education 3D illustration of one East Asian newborn girl, approximately one week old, lying safely on his back on a firm, flat, minimal warm-ivory sleep pad. Full body visible. Head in a neutral position. Natural neonatal flexion: one small hand rests near the cheek, the other hand is half-closed; hips and knees are gently flexed; the two feet are slightly staggered rather than perfectly symmetrical. A seamless ivory diaper fully covers the genital area.

Use softened anatomical realism with age-accurate newborn proportions, restrained East Asian facial features, smooth peach-apricot skin, subtle subsurface softness, no pores and no photographic texture. Warm ivory soft key light from upper front-right, pale cyan-blue fill from front-left, faint coral rim light from rear-left, broad stable highlights, soft warm-gray contact shadow.

Horizontal 3:2 composition. The baby is the single visual subject and occupies about 76% of the frame. Background is warm white #F7F4EE. Behind the baby, add only three extremely subtle out-of-focus circular ambient glows in muted mint green, coral orange, and warm gold; they are decorative light, not toys or UI. Calm, safe, clinically clear, premium parenting-app aesthetic.
```

## 构图与硬约束
- 仰卧、头中立、全身完整。
- 一手靠近脸颊、另一手半握；双脚轻微错落。
- 仅一名宝宝；不出现照护者、床品或玩具。
- 三枚色光必须低饱和、虚化、无图标含义。

## 该资产专属负向提示词

```text
boy-coded props, pink bow, hair accessory, toy, pillow, loose blanket, bumper, plush animal,
adult bed, inclined surface, side sleeping, prone sleeping, identifiable hospital,
photograph, hyperreal pores, plastic doll, clay baby, yellow skin, orange filter,
open diaper, visible genitals, text, icon, card border, extra baby, cropped limbs
```

## 输出规格
- 1536×1024，横向 3:2。
- 优先透明 PNG；不支持透明时使用 `#F7F4EE`。
- 无文字、无 Logo、无 UI。

## QA 验收
- [ ] 年龄看起来是新生儿，不是 6–12 月龄婴儿。
- [ ] 仰卧、平整表面、无软物。
- [ ] 尿布完整遮挡。
- [ ] 手脚数量正确且未裁切。
- [ ] 肤色自然，无整体黄染。
