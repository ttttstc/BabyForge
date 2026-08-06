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
