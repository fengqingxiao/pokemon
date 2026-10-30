# 宝可梦先锋 Web

把 RPG Maker XP / Pokémon Essentials 的《宝可梦先锋》移植成浏览器可玩的网页版：直接解析原作的 `Data/*.rxdata` 与 `Graphics/`、`Audio/` 素材，用 TypeScript + Phaser 重新实现地图渲染、行走与事件系统。

## 在线试玩

**https://fengqingxiao.github.io/pokemon/**

- 移动：方向键 / WASD / 屏幕方向键
- 交互：Z / 空格 / 回车 / 屏幕 A 键
- URL 参数：`?map=56` 指定地图，`&x=22&y=58` 指定出生坐标

手机建议横屏；触屏方向键与 A 键在屏幕左右下角。

## 无缝大地图

原作的地图之间没有自动连接数据（`map_connections.dat` 只有 21 字节），全部靠事件里的 `201 传送`。`tools/map-graph.mjs` 从事件里还原出 822 条传送、593 对地图关系，其中「亚伦市」被切成上下两块：

| 地图 | 尺寸 | 图块集 | 边缘传送 |
|---|---|---|---|
| 12 亚伦市 | 140×65 | #7 rwMWQBg | 9 处，(65,0) → (65,67) |
| 132 亚伦市 | 140×69 | #7 rwMWQBg | 9 处，(65,68) → (65,1) |

两块图块集相同、宽度同为 140，132 的 y=68 行正好落在 12 的 y=0 行上方（相差 69 行）。`tools/merge-maps.mjs` 按 `dy=-69` 把两块拼起来，得到 **地图 1000「亚伦市（无缝）」140×134**：

- 三图层逐格合并，重叠处不覆盖已有内容
- 事件坐标平移，132 的事件 id 加 1000 避免冲突
- **跨缝的 18 条 201 传送被移除**，所以能直接走过去；指向合并体内部的传送改写为同图坐标

默认进入就是这张图（`?map=1000`），其他原作地图仍可用 `?map=<id>` 访问，例如 `?map=56`（一号道路）、`?map=191`（地铁站内部）、`?map=34`（亚伦市室内）。

## 已实现

- **数据**：Ruby Marshal 4.8 解析器，319 张地图、7,547 个事件、107,110 条指令转成 JSON
- **渲染**：32×32 图块，48 组合自动图块拼接，按行 + 优先级的 RGSS 层级排序（`y*32 + priority*32 + 32`），水面动画
- **通行**：移植 `Game_Map#playerPassable?`，支持方向位、地形标签（悬崖、桥、`ignore_passability`）
- **角色**：帧尺寸 = 行走图 / 4，脚底居中锚点，四方向四帧，行走速度 128 px/s（RGSS 3 档）
- **事件**：文本/选项、条件分支、循环、开关/变量/独立开关、地图传送、等待、BGM/SE、移动路线
- **NPC**：随机走动的 NPC、`step_anime` 待机动画、对话时转身面向玩家

## 未实现

- 战斗与野生遇敌（`species.dat`、`moves.dat` 已可解析，尚未接入）
- 存档
- `355/655` Ruby 脚本指令（全包 6,564 次调用，会记录到 HUD 的 `u=` 计数）
- autorun / parallel 事件、悬崖跳跃、桥面状态

## 本地运行

```bash
npm install
npm run dev          # http://localhost:5173/?map=56
npm run test         # 19 项单元测试
npm run build        # 产物在 dist/
```

仓库内的 `public/data` 与 `public/assets` 是已生成的数据与切片素材，克隆后无需原始游戏包即可运行。若要重新生成：

```bash
node tools/build-data.mjs        # 需要 assets-src/宝可梦先锋/Data
node tools/extract-assets.mjs 56 # 按地图 id 提取素材
```

## 目录

```
src/engine/     图块渲染、自动图块、通行判定、角色、事件解释器、音频
src/scenes/     地图场景（装配、交互、传送、NPC）
src/ui/         对话框、触屏按键
tools/          Marshal 解析、数据管线、素材提取
tests/          marshal / autotile / character / passability
```

## 版权

原作与美术、音频素材版权归原作者及素材来源方所有（见游戏包内 `Credits/`，含 Gen 8 Project 等）。本项目仅供学习与研究，请勿用于商业用途。
