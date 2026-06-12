# 微信小游戏合集

一个原生微信小游戏 Canvas 项目，入口文件是 `game.js`，不依赖 npm、CDN 或远程素材。项目内包含三款轻休闲玩法：

- 合成 2048
- 霓虹贪吃蛇
- 极速躲避

## 玩法选择

这三个玩法覆盖轻休闲小游戏里上手成本低、节奏明确的方向：合成数字益智、经典贪吃蛇和反应躲避。它们都适合竖屏单手触控，并且能在微信小游戏 Canvas 环境里离线运行。

## 打开

在仓库根目录运行：

```bash
npm run build:release
npm run open:devtools
```

也可以手动导入构建后的 sibling release 目录：

```text
../wechat-mini-arcade-release
```

## 验证

```bash
npm test
npm run doctor
npm run audit
npm run hygiene
npm run verify:release
npm run qa:report
unzip -t ../wechat-mini-arcade-release.zip
unzip -t ../wechat-mini-arcade.zip
```

如果要让微信开发者工具 CLI 自己做一次非 GUI 引擎构建检查，可以运行：

```bash
npm run verify:devtools-engine
```

这个命令需要本机允许微信开发者工具 CLI 启动服务端口。验证记录见 `QA.md`。
