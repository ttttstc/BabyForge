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
