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
