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
