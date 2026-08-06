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
