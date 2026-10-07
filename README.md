# 霓虹突围 · NEON BREACH

单文件 3D 射击游戏，纯 `index.html` 实现，无构建步骤、无外部依赖。

## 运行

直接用浏览器打开 `index.html` 即可，或起一个本地静态服务：

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000
```

## 操作

| 按键 | 动作 |
| --- | --- |
| W / A / S / D | 移动 |
| 鼠标 | 视角 / 射击 |
| 右键 | 开镜 |
| R | 换弹 |
| Shift | 冲刺 |
| 空格 | 跳跃 |
| ESC | 暂停 |

## 玩法

- **波次协议**：敌人按波次进攻，逐波增强。
- **Loadout**：局前/复活时选择配装。
- 击杀得分，阵亡后可重新部署。

## 目录

- `index.html` — 游戏本体（唯一运行时文件）
- `test/` — Playwright 测试与调试脚本（`flow.js`、`test.js`、`vis.js` 等）
