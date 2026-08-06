# BabyForge 全量生图 Prompt 包｜Anatomy Specimen 3D 版

本包将 BabyForge 原有的育儿医学信息表达，与 `thebuggeddev/anatomy` 的三维器官展陈语言统一起来。

## 核心判断

不是把 BabyForge 全部改成“写实人体照片”，而是建立一种稳定的 **柔化医学三维标本风格**：

1. **医学准确**：结构、体位、支撑关系和信息层级优先。
2. **产品友好**：低刺激、低饱和、无血腥、无临床恐惧感。
3. **三维统一**：宝宝、器官、机制图使用同一套 PBR 材质、灯光和色彩语言。
4. **可批量生产**：主视图、左右视图、场景图和机制图都有固定模板。
5. **UI 解耦**：图片本体不生成文字和界面，说明、分级和交互由应用层叠加。

## 从 Anatomy 项目提取的风格基因

- 单一主体位于视觉中心，像展柜中的医学标本。
- 暖白纸张/象牙白展陈背景，中心有柔和径向亮区。
- 暖色主光、冷色补光、珊瑚色轮廓光组成稳定三点布光。
- 非金属 PBR 材质，中等粗糙度，宽高光，法线细节被柔化。
- 中长焦、轻微俯视或受控正交相机，避免广角夸张。
- 器官使用暖红褐、珊瑚和少量蓝金强调色。
- 主体下方仅有非常淡的接触阴影；展示型 Hero 图可加米色标本台，但用于三维重建的多视图资产禁止标本台。
- 静态教育插图沿用器官主体、位置、微观、对比/机制四层表达。

## 文件结构

- `00-*`：全局风格、负向提示、Hunyuan3D 输入指南和自动化变量。
- `01–06`：产品内容场景图，其中 `05–06` 已合并为不区分男女的观察/机制图。
- `07–10 newborn-*`：男宝/女宝严格 `front / left / right / back` 四视图。
- `10–13 liver-*`：肝脏严格 `front / left / right / back` 四视图。
- `14-liver-hero`：产品展示图，不用于 Hunyuan3D 建模。
- 编号 `03` 保持空缺，不擅自新增资产，避免破坏现有资源映射。
- `manifest.json`：供脚本、工作流或 Agent 批量调用。

## 使用顺序

1. 先生成 `07-newborn-*-front`，再生成对应 `left / right / back`。
2. 先生成 `10-liver-front`，再生成 `11-liver-left`、`12-liver-right`、`13-liver-back`。
3. 完成四视图一致性 QA 后，再输入 Hunyuan3D 多视图模型。
4. `14-liver-hero` 从已经确认的 `10-liver-front` 派生，只用于产品展示。
5. 场景图 `01–06` 可以使用对应宝宝 front 图作为身份参考；其中 `05` 为中性观察图、`06` 为中性机制图。
6. 所有输出在进入应用前做 QA：体位、肢体数量、裁切、颜色、背景、性别刻板元素、文字污染。

## 推荐生成参数

- 场景图：`1536×1024`，横向 `3:2`。
- 多视图资产：`1536×1536`，正方形。
- `front` 使用高质量模式；`left / right / back` 降低创意强度，提高参考图约束。
- 能输出透明背景时，同时保留透明 PNG 与白底预览图。
- 不依赖随机种子保持身份；优先使用 reference image / character reference / image-to-image。

## 性别拆分策略

- **保留男女版本**：宝宝角色主资产、生活场景、安全睡眠、喂养观察等需要角色一致性的图片。
- **合并为中性版本**：内部器官、器官多视图、生理机制图，以及黄疸观察部位这类不依赖性别差异的医学观察图。
- **当前已中性化**：`05-jaundice-body-location.md`、`06-jaundice-mechanism.md`、`10–14` 肝脏资产。


## Hunyuan3D 建模资产

正式多视图建模只使用严格 `front / back / left / right` 四张图。详细文件映射与 QA 规则见：

```text
00-hunyuan3d-input-guide.md
```

场景图和 `hero` 图不得作为建模输入。

---

# 00｜BabyForge Anatomy Specimen 3D 视觉系统


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


## 1. 主体建模基因

### 宝宝模型
- 东亚新生儿或对应月龄婴幼儿，头身比例和皮下脂肪分布符合年龄。
- 面部特征克制，不做“网红宝宝”或大眼萌化。
- 皮肤为柔和桃杏色，轻微次表面散射感，但不透明、不蜡、不湿。
- 手脚完整，指趾可辨；关节自然；新生儿保持生理性屈曲。
- 统一使用无缝象牙白尿布，完整遮挡生殖部位。
- 性别仅是资产身份，不通过裸体、颜色、发饰、玩具或成人化特征表达。

### 器官模型
- 解剖轮廓优先于艺术夸张。
- 暖红褐至珊瑚红主色，沟裂、叶段与血管入口使用低对比色差表现。
- 表面略有组织纹理，但禁止湿润、血腥、黏液和手术标本感。
- 非金属、中粗糙度、弱清漆、宽高光。
- 三维重建多视图：纯白背景、无台座、无道具、无文字，仅淡接触阴影。
- UI Hero 展示：可在应用渲染层加入暖米色圆形标本台，不写入基础资产。

## 2. 固定灯光配方

- Key：右前上方暖象牙白大面积柔光，强度最高。
- Fill：左前方淡青蓝柔光，约为主光的三分之一。
- Rim：左后上方珊瑚粉轮廓光，克制，仅勾勒边缘。
- Ambient：暖白环境光，消除黑死角。
- 禁止硬边阴影、霓虹灯、赛博朋克、深黑背景。

## 3. 固定相机配方

- Hero / 场景：85–100 mm 等效焦段，轻微俯视 10–25°。
- 角色主资产：严格顶视正交或极弱透视。
- 左右资产：严格 90° 正交侧视，不允许“接近侧面”的三分之二角度。
- 器官主资产：前上方三分之四视角；左右资产围绕同一模型旋转，不是镜像翻转。
- 主体占画面 78–84%，四周留安全边距。

## 4. 背景与阴影

- 首选纯白 `#FFFFFF`；场景内容可使用暖白 `#F7F4EE`。
- 中心允许极淡径向亮区；禁止纹理墙、真实医院、卧室杂物。
- 接触阴影为浅暖灰、低不透明度、边缘柔化。
- 机制图允许极淡的珊瑚/蓝色环境辉光，但不能形成 UI 卡片。

## 5. 信息表达层级

- **主体层**：宝宝或器官。
- **位置层**：半透明身体轮廓 + 单一区域高亮。
- **机制层**：受控粒子、路径和器官，不使用箭头或文字。
- **观察层**：局部同强度柔光，不把病理颜色覆盖全身。
- **UI 层**：所有标签、说明、等级和交互后置到应用中。


## 全局负向提示词

photograph, DSLR photo, documentary photo, hyperreal skin pores, oily skin, wet skin,
wax figure, silicone doll, plastic toy, vinyl toy, clay render, low-poly, chibi, anime,
Disney-like, Pixar-like, cute mascot, exaggerated eyes, adult facial features,
beauty makeup, jewelry, bow, gender stereotype props, pink-for-girl coding,
yellow color cast, orange skin, jaundice filter over the entire body,
harsh specular highlight, metallic skin, glass skin, translucent wax,
hard black shadow, dramatic horror lighting, dark hospital room,
blood, gore, surgery, incision, exposed viscera, needle, syringe, IV line,
medical diagnosis text, warning icon, arrows, numbers, labels, watermark, logo,
extra baby, duplicate body, merged limbs, fused fingers, missing fingers,
extra fingers, malformed hands, malformed feet, broken anatomy, asymmetrical scale,
cropped head, cropped hands, cropped feet, fisheye, wide-angle distortion,
busy background, crib clutter, pillow, loose blanket, bumper, stuffed toy

---

# 00｜BabyForge 全局负向提示词

将下面内容附加在所有 prompt 末尾；单个资产文件还包含额外负向约束。


## 全局负向提示词

photograph, DSLR photo, documentary photo, hyperreal skin pores, oily skin, wet skin,
wax figure, silicone doll, plastic toy, vinyl toy, clay render, low-poly, chibi, anime,
Disney-like, Pixar-like, cute mascot, exaggerated eyes, adult facial features,
beauty makeup, jewelry, bow, gender stereotype props, pink-for-girl coding,
yellow color cast, orange skin, jaundice filter over the entire body,
harsh specular highlight, metallic skin, glass skin, translucent wax,
hard black shadow, dramatic horror lighting, dark hospital room,
blood, gore, surgery, incision, exposed viscera, needle, syringe, IV line,
medical diagnosis text, warning icon, arrows, numbers, labels, watermark, logo,
extra baby, duplicate body, merged limbs, fused fingers, missing fingers,
extra fingers, malformed hands, malformed feet, broken anatomy, asymmetrical scale,
cropped head, cropped hands, cropped feet, fisheye, wide-angle distortion,
busy background, crib clutter, pillow, loose blanket, bumper, stuffed toy

---

# 00｜Hunyuan3D 多视图输入指南

## 1. 正式建模使用的图片

每个模型使用四张严格一致的重建图：

```text
front
back
left
right
```

四张图必须描述同一个三维对象，只改变相机方向。不得分别独立创作四个相似对象。

## 2. BabyForge 模型映射

### 新生儿男宝

```text
front: 07-newborn-boy-front.png
back:  10-newborn-boy-back.png
left:  08-newborn-boy-left.png
right: 09-newborn-boy-right.png
```

### 新生儿女宝

```text
front: 07-newborn-girl-front.png
back:  10-newborn-girl-back.png
left:  08-newborn-girl-left.png
right: 09-newborn-girl-right.png
```

### 新生儿肝脏

```text
front: 10-liver-front.png
back:  13-liver-back.png
left:  11-liver-left.png
right: 12-liver-right.png
```

`14-liver-hero.png` 只用于产品展示，不传入多视图建模。

## 3. 推荐生产顺序

1. 生成并人工确认 `front`。
2. 以 `front` 为唯一身份和几何参考生成 `left`、`right`。
3. 以 `front` 为主参考、左右视图为厚度核对，生成 `back`。
4. 对四张图执行一致性 QA。
5. 去除背景，统一到相同画布、中心、缩放和透明边距。
6. 将四张图传给 Hunyuan3D 多视图模型。
7. 生成网格后检查背面、手脚、耳朵、尿布边缘及器官叶段，再进入纹理阶段。

## 4. 输入图片硬标准

- PNG，优先透明背景；其次纯白背景。
- 全部 `1536×1536`，主体占画面约 `78%–82%`。
- 四张图的中心、缩放、曝光、色温和材质一致。
- 严格正交或近正交中长焦，不使用广角。
- 无床垫、标本台、道具、文字、箭头、热点、局部发光、黄疸高亮或机制粒子。
- 轮廓光必须极弱，避免被重建成几何或纹理边缘。
- 左右视图不能通过二维镜像互相生成。

## 5. 不用于建模的图片

以下图片只用于应用展示：

```text
01 新生儿阶段默认图
02 喂养观察
04 安全睡眠
05 黄疸观察部位
06 黄疸机制
14 肝脏 Hero 展示图
```

它们包含环境、照护者、睡眠空间、观察高亮或机制表达，会污染三维几何。

---

# 01｜新生儿阶段默认图｜男宝

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
A premium medical-education 3D illustration of one East Asian newborn boy, approximately one week old, lying safely on his back on a firm, flat, minimal warm-ivory sleep pad. Full body visible. Head in a neutral position. Natural neonatal flexion: one small hand rests near the cheek, the other hand is half-closed; hips and knees are gently flexed; the two feet are slightly staggered rather than perfectly symmetrical. A seamless ivory diaper fully covers the genital area.

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
girl, pink bow, hair accessory, toy, pillow, loose blanket, bumper, plush animal,
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

---

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

---

# 02｜喂养观察｜男宝

## 用途
用于展示新生儿喂养时的安全抱姿，以及含接、吸吮、吞咽的观察路径。

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
A gentle premium 3D medical-education scene showing one East Asian newborn boy being held safely for feeding. The caregiver is anonymous: show only a softly simplified upper-torso silhouette and both arms, with no identifiable face. The caregiver uses a secure cradle hold; one forearm continuously supports the baby's head, neck, and upper back, keeping the head and body aligned. The baby is close to the caregiver's torso, relaxed, with one tiny hand lightly grasping the caregiver's plain ivory clothing. Do not specify breast or bottle and do not show any brand or feeding device.

Render the baby with softened anatomical realism, natural newborn flexion, peach-apricot skin, ivory diaper and neutral clothing. Use warm ivory key light, pale cyan-blue fill and a faint coral rim. The caregiver material is simpler and slightly lower contrast so the baby remains the focus.

Overlay one elegant translucent cyan-green curved pathway from the lips toward the throat. Place exactly three equal-size soft luminous nodes along the pathway, representing latch, suck, and swallow without text, arrows, numbers, ranking, or severity. The path must remain outside or just beneath the surface, educational and non-invasive.

Horizontal 3:2 composition, single coherent scene, warm white background, ample negative space for app copy.
```

## 构图与硬约束
- 照护者面部不可识别，只显示上半身轮廓和双臂。
- 前臂必须持续承托头颈；宝宝头、颈、躯干基本成一直线。
- 青绿色弧线只有一条，柔光圆点恰好三枚且等大。
- 不暗示母乳优于奶瓶或奶瓶优于母乳。

## 该资产专属负向提示词

```text
identifiable caregiver face, unsupported neck, head falling backward, twisted airway,
feeding while baby lies flat alone, bottle brand, nipple close-up, exposed breast,
milk splash, choking, coughing, distress, red warning symbol, arrows, text, numbers,
unequal glowing nodes, tube entering the body, x-ray gore, hospital equipment,
photograph, plastic doll, extra hands, merged arms, malformed baby
```

## 输出规格
- 1536×1024，横向 3:2。
- 暖白或透明背景。
- 场景图仅生成一张，不做分镜。

## QA 验收
- [ ] 头颈支撑连续可信。
- [ ] 宝宝贴近照护者，姿势稳定。
- [ ] 照护者不可识别。
- [ ] 恰好三枚等大圆点。
- [ ] 无品牌、无喂养方式价值判断。

---

# 02｜喂养观察｜女宝

## 用途
用于展示新生儿喂养时的安全抱姿，以及含接、吸吮、吞咽的观察路径。

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
A gentle premium 3D medical-education scene showing one East Asian newborn girl being held safely for feeding. The caregiver is anonymous: show only a softly simplified upper-torso silhouette and both arms, with no identifiable face. The caregiver uses a secure cradle hold; one forearm continuously supports the baby's head, neck, and upper back, keeping the head and body aligned. The baby is close to the caregiver's torso, relaxed, with one tiny hand lightly grasping the caregiver's plain ivory clothing. Do not specify breast or bottle and do not show any brand or feeding device.

Render the baby with softened anatomical realism, natural newborn flexion, peach-apricot skin, ivory diaper and neutral clothing. Use warm ivory key light, pale cyan-blue fill and a faint coral rim. The caregiver material is simpler and slightly lower contrast so the baby remains the focus.

Overlay one elegant translucent cyan-green curved pathway from the lips toward the throat. Place exactly three equal-size soft luminous nodes along the pathway, representing latch, suck, and swallow without text, arrows, numbers, ranking, or severity. The path must remain outside or just beneath the surface, educational and non-invasive.

Horizontal 3:2 composition, single coherent scene, warm white background, ample negative space for app copy.
```

## 构图与硬约束
- 照护者面部不可识别，只显示上半身轮廓和双臂。
- 前臂必须持续承托头颈；宝宝头、颈、躯干基本成一直线。
- 青绿色弧线只有一条，柔光圆点恰好三枚且等大。
- 不暗示母乳优于奶瓶或奶瓶优于母乳。

## 该资产专属负向提示词

```text
identifiable caregiver face, unsupported neck, head falling backward, twisted airway,
feeding while baby lies flat alone, bottle brand, nipple close-up, exposed breast,
milk splash, choking, coughing, distress, red warning symbol, arrows, text, numbers,
unequal glowing nodes, tube entering the body, x-ray gore, hospital equipment,
photograph, plastic doll, pink bow, gender stereotype decoration, extra hands, merged arms, malformed baby
```

## 输出规格
- 1536×1024，横向 3:2。
- 暖白或透明背景。
- 场景图仅生成一张，不做分镜。

## QA 验收
- [ ] 头颈支撑连续可信。
- [ ] 宝宝贴近照护者，姿势稳定。
- [ ] 照护者不可识别。
- [ ] 恰好三枚等大圆点。
- [ ] 无品牌、无喂养方式价值判断。

---

# 04｜安全睡眠｜男宝

## 用途
用于表达婴儿安全睡眠环境：仰卧、独立、平坦、坚实、无软物。

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
A premium 3D medical-education illustration of one East Asian newborn boy sleeping safely on his back in a separate infant sleep space. Use a strict high three-quarter top view with an 85–100 mm lens feel. The mattress is firm, flat, level, and tightly fitted inside a minimal safety-approved crib or bassinet. It is covered only by a smooth fitted warm-ivory sheet. The sleep area is completely empty: no pillow, no loose blanket, no bumper, no stuffed toy, no positioner, no wedge, no sleep nest.

The baby lies supine with the face fully unobstructed, head in a neutral or very slightly side-turned position, chin away from the chest, arms naturally flexed and clear of the nose and mouth, legs gently flexed. Use a simple fitted infant sleep garment or an ivory diaper with a neutral lightweight sleep suit; no loose fabric around the face or neck.

Softened medical 3D realism, age-accurate newborn proportions, natural peach-apricot skin, no photographic pores. Warm ivory key light from upper front-right, pale cyan-blue fill from left, faint coral rim, very soft contact shadow. Add a barely visible muted sage halo beneath the mattress area to communicate calm and safety, without icons, checks, text, arrows, or UI.

Horizontal 3:2 composition. The baby and sleep surface occupy the left two-thirds; preserve clean negative space on the right for product copy.
```

## 构图与硬约束
- 必须仰卧。
- 睡眠面必须坚实、平坦、水平，只覆盖紧贴床垫的床单。
- 宝宝使用独立婴儿睡眠空间。
- 婴儿口鼻完整可见，无任何物体靠近面部。
- 右侧保留至少 30% 干净留白。

## 该资产专属负向提示词

```text
side sleeping, prone sleeping, stomach sleeping, inclined mattress, wedge, positioner,
adult bed, sofa, armchair, bed sharing, caregiver sleeping beside baby, pillow,
loose blanket, quilt, comforter, crib bumper, sleep nest, stuffed toy, pacifier clip,
weighted swaddle, weighted blanket, hood, hat covering face, fabric near nose,
red cross, green checkmark, text, arrows, UI, photograph, dark bedroom
```

## 输出规格
- 1536×1024，横向 3:2。
- 背景使用 `#F7F4EE` 或透明。
- 不生成安全标识文字，由 UI 后置叠加。

## QA 验收
- [ ] 仰卧且口鼻无遮挡。
- [ ] 床面无倾斜。
- [ ] 除紧贴床单外，睡眠区内没有任何物品。
- [ ] 不是成人床、沙发或睡眠巢。
- [ ] 宝宝姿势自然，无过热或厚重包裹感。

---

# 04｜安全睡眠｜女宝

## 用途
用于表达婴儿安全睡眠环境：仰卧、独立、平坦、坚实、无软物。

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
A premium 3D medical-education illustration of one East Asian newborn girl sleeping safely on his back in a separate infant sleep space. Use a strict high three-quarter top view with an 85–100 mm lens feel. The mattress is firm, flat, level, and tightly fitted inside a minimal safety-approved crib or bassinet. It is covered only by a smooth fitted warm-ivory sheet. The sleep area is completely empty: no pillow, no loose blanket, no bumper, no stuffed toy, no positioner, no wedge, no sleep nest.

The baby lies supine with the face fully unobstructed, head in a neutral or very slightly side-turned position, chin away from the chest, arms naturally flexed and clear of the nose and mouth, legs gently flexed. Use a simple fitted infant sleep garment or an ivory diaper with a neutral lightweight sleep suit; no loose fabric around the face or neck.

Softened medical 3D realism, age-accurate newborn proportions, natural peach-apricot skin, no photographic pores. Warm ivory key light from upper front-right, pale cyan-blue fill from left, faint coral rim, very soft contact shadow. Add a barely visible muted sage halo beneath the mattress area to communicate calm and safety, without icons, checks, text, arrows, or UI.

Horizontal 3:2 composition. The baby and sleep surface occupy the left two-thirds; preserve clean negative space on the right for product copy.
```

## 构图与硬约束
- 必须仰卧。
- 睡眠面必须坚实、平坦、水平，只覆盖紧贴床垫的床单。
- 宝宝使用独立婴儿睡眠空间。
- 婴儿口鼻完整可见，无任何物体靠近面部。
- 右侧保留至少 30% 干净留白。

## 该资产专属负向提示词

```text
side sleeping, prone sleeping, stomach sleeping, inclined mattress, wedge, positioner,
adult bed, sofa, armchair, bed sharing, caregiver sleeping beside baby, pillow,
loose blanket, quilt, comforter, crib bumper, sleep nest, stuffed toy, pacifier clip,
pink bow, hair accessory, weighted swaddle, weighted blanket, hood, hat covering face, fabric near nose,
red cross, green checkmark, text, arrows, UI, photograph, dark bedroom
```

## 输出规格
- 1536×1024，横向 3:2。
- 背景使用 `#F7F4EE` 或透明。
- 不生成安全标识文字，由 UI 后置叠加。

## QA 验收
- [ ] 仰卧且口鼻无遮挡。
- [ ] 床面无倾斜。
- [ ] 除紧贴床单外，睡眠区内没有任何物品。
- [ ] 不是成人床、沙发或睡眠巢。
- [ ] 宝宝姿势自然，无过热或厚重包裹感。

---

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

---

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

---

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

---

# 07｜新生儿女宝｜前视图

## 用途
用于 Hunyuan3D 多视图建模的 `front` 输入，同时作为女宝统一身份基准，并为左、右、背视图提供唯一参考。

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
One isolated East Asian newborn girl, approximately one week old, rendered as a premium softened-realism medical 3D character asset. Strict top-down anterior orthographic view, camera directly above the chest-and-abdomen side of the body. This image maps to the Hunyuan3D `front` field. Use an 85–120 mm lens equivalent with essentially no perspective distortion.

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
open diaper, pink decoration, bow, hair accessory, gender stereotype props, text, UI, second baby
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

---

# 08｜新生儿男宝｜左视图

## 用途
用于与对应主视图组成三维重建和旋转展示所需的严格 90° 左侧正交资产。

## 参考图规则
必须使用对应 `07-newborn-boy-front` 生成图作为唯一视觉参考。


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
Using the uploaded `boy newborn front-view image` as the sole visual reference, generate exactly the same East Asian newborn identity as a strict 90-degree orthographic left side view. This is a real camera rotation around one unchanged 3D body, not a mirrored repaint and not a new pose.

Preserve exactly: head shape, facial profile, hair amount, body proportions, limb lengths, arm angle, elbow bend, hand openness, finger count, hip and knee flexion, foot separation, diaper shape, skin tone, PBR material, lighting softness, and overall scale. Do not improve, beautify, restyle, or change the pose.

Camera is positioned precisely at body midline height on the baby's left side, looking horizontally across the body. Equivalent 85–120 mm orthographic lens, no wide-angle distortion. Full body is centered and occupies about 82% of canvas width, with head, back contour, diaper, both arms, both legs, hands, feet and toes remaining readable. Where limbs overlap in true side view, preserve slight natural depth separation from the reference so individual limbs do not fuse.

Use the same softened medical 3D realism, warm ivory key, pale cyan-blue fill, faint coral/gold rim, pure white background and soft contact shadow as the main image. Output one clean asset only.
```

## 构图与硬约束
- 必须上传对应 `07-newborn-boy-front` 作为唯一参考图。
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
cropped head, cropped feet, visible genitals, props, text, UI, extra baby
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

---

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

---

# 09｜新生儿男宝｜右视图

## 用途
用于与对应主视图组成三维重建和旋转展示所需的严格 90° 右侧正交资产。

## 参考图规则
必须使用对应 `07-newborn-boy-front` 生成图作为唯一视觉参考。


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
Using the uploaded `boy newborn front-view image` as the sole visual reference, generate exactly the same East Asian newborn identity as a strict 90-degree orthographic right side view. This is a real camera rotation around one unchanged 3D body, not a mirrored repaint and not a new pose.

Preserve exactly: head shape, facial profile, hair amount, body proportions, limb lengths, arm angle, elbow bend, hand openness, finger count, hip and knee flexion, foot separation, diaper shape, skin tone, PBR material, lighting softness, and overall scale. Do not improve, beautify, restyle, or change the pose.

Camera is positioned precisely at body midline height on the baby's right side, looking horizontally across the body. Equivalent 85–120 mm orthographic lens, no wide-angle distortion. Full body is centered and occupies about 82% of canvas width, with head, back contour, diaper, both arms, both legs, hands, feet and toes remaining readable. Where limbs overlap in true side view, preserve slight natural depth separation from the reference so individual limbs do not fuse.

Use the same softened medical 3D realism, warm ivory key, pale cyan-blue fill, faint coral/gold rim, pure white background and soft contact shadow as the main image. Output one clean asset only.
```

## 构图与硬约束
- 必须上传对应 `07-newborn-boy-front` 作为唯一参考图。
- 只改变相机方位，不改变宝宝姿势、比例、表情和材质。
- 严格 90° 右侧正交。
- 本图在 Hunyuan3D 中映射为 `right`。
- 不是水平镜像；应旋转同一个三维身体。
- 身体占画面宽度约 82%。

## 该资产专属负向提示词

```text
front view, top view, three-quarter view, left side view, mirrored anatomy,
new pose, changed face, changed diaper, changed limb angle, changed lighting,
photograph, plastic toy, yellow skin, perspective distortion, fisheye,
fused arms, fused legs, missing far-side limbs, extra fingers, missing toes,
cropped head, cropped feet, visible genitals, props, text, UI, extra baby
```

## 输出规格
- 1536×1536，正方形。
- 纯白 `#FFFFFF`。
- 输出恰好一个严格侧视图。

## QA 验收
- [ ] 与主图身份完全一致。
- [ ] 相机为严格 90° 右侧。
- [ ] 姿势未改变。
- [ ] 远侧肢体没有消失或融合。
- [ ] 比例、材质、光照和缩放匹配主图。

---

# 09｜新生儿女宝｜右视图

## 用途
用于与对应主视图组成三维重建和旋转展示所需的严格 90° 右侧正交资产。

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
Using the uploaded `girl newborn front-view image` as the sole visual reference, generate exactly the same East Asian newborn identity as a strict 90-degree orthographic right side view. This is a real camera rotation around one unchanged 3D body, not a mirrored repaint and not a new pose.

Preserve exactly: head shape, facial profile, hair amount, body proportions, limb lengths, arm angle, elbow bend, hand openness, finger count, hip and knee flexion, foot separation, diaper shape, skin tone, PBR material, lighting softness, and overall scale. Do not improve, beautify, restyle, or change the pose.

Camera is positioned precisely at body midline height on the baby's right side, looking horizontally across the body. Equivalent 85–120 mm orthographic lens, no wide-angle distortion. Full body is centered and occupies about 82% of canvas width, with head, back contour, diaper, both arms, both legs, hands, feet and toes remaining readable. Where limbs overlap in true side view, preserve slight natural depth separation from the reference so individual limbs do not fuse.

Use the same softened medical 3D realism, warm ivory key, pale cyan-blue fill, faint coral/gold rim, pure white background and soft contact shadow as the main image. Output one clean asset only.
```

## 构图与硬约束
- 必须上传对应 `07-newborn-girl-front` 作为唯一参考图。
- 只改变相机方位，不改变宝宝姿势、比例、表情和材质。
- 严格 90° 右侧正交。
- 本图在 Hunyuan3D 中映射为 `right`。
- 不是水平镜像；应旋转同一个三维身体。
- 身体占画面宽度约 82%。

## 该资产专属负向提示词

```text
front view, top view, three-quarter view, left side view, mirrored anatomy,
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
- [ ] 相机为严格 90° 右侧。
- [ ] 姿势未改变。
- [ ] 远侧肢体没有消失或融合。
- [ ] 比例、材质、光照和缩放匹配主图。

---

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

---

# 10｜新生儿男宝｜背视图

## 用途
用于 Hunyuan3D 多视图建模的 `back` 输入，与前、左、右视图共同约束宝宝背侧几何、头颅后部、肩背、臀部、尿布后片和四肢厚度。

## 参考图规则
必须使用对应 `07-newborn-boy-front` 生成图作为唯一视觉参考；同时参考已经通过 QA 的左右视图，仅用于核对厚度，不得改变身份或姿势。

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
Using the uploaded `07-newborn-boy-front` image as the sole identity and geometry reference, generate exactly the same East Asian newborn boy, approximately one week old, as a strict posterior orthographic view for the Hunyuan3D `back` field.

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
photograph, hyperreal pores, plastic doll, clay render, yellow skin,
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

---

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

---

# 11｜新生儿肝脏｜左视图

## 用途
用于与肝脏主视图组成同一模型的严格 90° 左正交资产。

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
Using the uploaded `10-liver-front` image as the sole visual reference, render exactly the same neonatal liver as a strict 90-degree orthographic left view. Rotate the same 3D organ around its vertical axis; do not mirror the source image and do not redesign the anatomy.

Preserve exactly the same geometry, lobe volumes, right-to-left size relationship, superior convexity, inferior taper, groove depth, surface microtexture, reddish-brown/coral color, roughness, highlight width, scale, and lighting softness. Only the camera position changes.

Use an 85–120 mm orthographic medical-asset camera with no perspective distortion. Center the liver and fill about 78% of the square canvas. Pure white #FFFFFF background, faint warm-gray contact shadow, no plinth. The side silhouette must remain anatomically plausible and show the true depth of the same organ rather than a flattened icon.

Output exactly one left view.
```

## 构图与硬约束
- 必须使用 `10-liver-front` 作为唯一视觉参考。
- 只旋转相机，不改变几何、材质和光照。
- 严格 90° 左正交，不是三分之二侧面。
- 不是镜像翻转。
- 本图在 Hunyuan3D 中映射为 `left`。

## 该资产专属负向提示词

```text
front view, three-quarter view, right view, mirrored image, redesigned liver,
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
- [ ] 严格 90° 左正交。
- [ ] 叶段体积、颜色、纹理和缩放一致。
- [ ] 没有镜像错误。
- [ ] 无台座和附加结构。

---

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

---

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

---

# 14｜新生儿肝脏｜Hero 展示图

## 用途
用于 BabyForge 产品页面、器官卡片或课程封面的三分之四展示图；**不作为 Hunyuan3D 多视图建模输入**。

## 参考图规则
必须使用 `10-liver-front` 生成图作为唯一器官参考，保持几何、叶段比例、颜色和材质不变；只允许调整相机与展陈环境。

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
Using the uploaded `10-liver-front` reconstruction image as the sole organ reference, create a premium BabyForge Anatomy Specimen 3D hero render of exactly the same neonatal liver. Preserve the same geometry, lobe proportions, reddish-brown/deep-coral color, texture, roughness and anatomical identity.

Rotate the camera to a controlled anterior-superior three-quarter view, approximately 20 degrees horizontally and 12 degrees vertically, so the organ volume reads clearly without distortion. Place the liver as a single museum-like medical specimen at the visual center.

Use the full BabyForge exhibition lighting: warm ivory key from upper front-right, pale cyan-blue fill from left, soft coral rim from rear-left, gentle warm environment light, ACES Filmic tone mapping, broad stable highlights. Add a very subtle liver-colored ambient glow behind the organ.

The background is warm ivory with a soft radial center light. A low, matte warm-beige circular specimen plinth is optional and may appear only in this Hero asset. Keep the composition calm, spacious and premium. No labels, hotspots, arrows, text, UI cards, body silhouette or additional organs.
```

## 构图与硬约束
- 仅用于产品展示，不映射到 Hunyuan3D `front/back/left/right`。
- 与 `10-liver-front` 必须是同一个肝脏。
- 相机为克制的前上方三分之四角，避免广角。
- 可使用暖米色标本台和极淡环境辉光。

## 该资产专属负向提示词

```text
multi-view reconstruction sheet, strict orthographic front, strict side view,
redesigned liver, changed lobe ratio, diseased liver, gallbladder, cutaway,
wet organ, blood, gore, black background, neon lighting, giant pedestal,
clinical tray, human torso, multiple organs, text, labels, arrows, hotspots, UI
```

## 输出规格
- 1536×1536，正方形；产品横幅可另裁切为 3:2。
- 暖象牙白背景。
- 不作为 Hunyuan3D 建模输入。

## QA 验收
- [ ] 与建模前视图为同一器官。
- [ ] 三分之四角度自然、无广角畸变。
- [ ] 展陈风格明显，但没有文字或 UI。
- [ ] 未改变器官几何、材质和颜色。
