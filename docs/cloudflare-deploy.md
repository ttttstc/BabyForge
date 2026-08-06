# BabyForge Cloudflare 部署

当前部署形态是 Cloudflare Pages + Pages Functions + D1：

- Pages 托管 Vite 构建产物和 `public/assets`。
- Pages Functions 提供 `/api/login`、`/api/logout`、`/api/session`、兼容旧数据的 `/api/sync`，以及事件级 `/api/events`、`/api/events/:id` 和共享记录人 `/api/actors`。
- D1 保存账号、会话、家庭成员、宝宝档案、照护事件、计划项、关注事项、记录人和事件修订历史。
- 知识库仍然随前端版本发布，暂不开放线上编辑。

## 首次配置

不要把 Cloudflare 密码或 API token 写进代码。先在本机完成浏览器授权：

```powershell
npx wrangler login
```

数据库 `cff73234-9527-49c5-8bed-ca15bf295263` 已绑定在 [`wrangler.jsonc`](../wrangler.jsonc)，然后执行：

```powershell
npm run cloudflare:db:migrate
npx wrangler pages project create babyforge --production-branch main
npm run cloudflare:deploy
```

部署后访问 `https://babyforge.pages.dev`。当前初始化账号：

- 管理员：`niwa` / `niwaniwa`，可创建、填写和修改。
- 游客：`baby` / `0729`，只能查看，API 也会拒绝写入。

线上数据库只保存 PBKDF2 密码哈希，不保存明文密码。后续新增月嫂账号时，应增加 `caregiver` 成员，而不是复用只读游客账号。

## 本地预览

本地 Vite 开发环境使用演示账号，不需要 D1；生产构建不会把演示密码编译进前端。要在本地联调 Pages Functions，可使用 Wrangler 的 Pages 本地开发和本地 D1 数据库，再单独执行迁移。

## 上线前检查

1. 检查 `wrangler.jsonc` 中的 `database_id` 与 Cloudflare 控制台一致。
2. 确认 Pages 项目绑定了 `DB` D1 binding。
3. 管理员首次登录并建立宝宝档案后，再用游客账号验证只读权限。
4. 确认 `POST /api/sync` 对游客返回 `403`。
5. 确认 `POST /api/events`、`PATCH /api/events/:id`、`DELETE /api/events/:id` 对游客返回 `403`，同一事件修改后修订历史仍可查询。
6. 如使用自定义域名，在 Cloudflare 控制台完成域名绑定后再分享链接。
