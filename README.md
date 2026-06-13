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

## 微信登录与云存档

- 将 `project.config.json` 里的 `appid` 从 `touristappid` 改成你的真实小游戏 AppID；游客号只能离线体验，不能使用云开发。
- 在微信开发者工具开通云开发并创建环境，把环境 ID 填入 `js/cloud-config.js` 的 `envId`。
- 上传部署 `cloudfunctions/playerState` 云函数，并在云端安装 `wx-server-sdk`。
- 创建 `game_player_state` 数据库集合，权限建议设为“仅创建者可读写”。
- 画面右上角的“微信登录/离线存档”入口由用户点击触发 `wx.getUserProfile`，云函数使用 `getWXContext().OPENID` 隔离用户存档；`wx.login` code 会随云请求上送，云端只保存摘要。
- 如果 AppID、env 或云函数未配置，画面会显示“离线存档”，进度只保存在本机，不再静默伪装成联网。

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
