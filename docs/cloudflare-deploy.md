# BabyForge Cloudflare 部署

当前部署形态是 Cloudflare Pages + Pages Functions + D1 + R2：

- Pages 托管 Vite 构建产物和 `public/assets`。
- Pages Functions 提供 `/api/login`、`/api/logout`、`/api/session`、宝宝档案 `/api/sync`，事件级 `/api/events`、`/api/events/:id`、共享记录人 `/api/actors`，以及相册 `/api/photos`、`/api/photos/:id`。
- D1 保存账号、会话、家庭成员、宝宝档案、照护数据和照片元数据；R2 保存原始照片文件。
- Cloudflare 相册目前不做 EXIF 清洗：原始图片中的拍摄时间、设备或定位等元数据可能随文件被家庭成员读取。上传前请先使用系统相册或图片编辑器移除不希望共享的元数据。
- 知识库仍然随前端版本发布，暂不开放线上编辑。

## 首次配置

不要把 Cloudflare 密码或 API token 写进代码。先在本机完成浏览器授权：

```powershell
npx wrangler login
```

数据库 `cff73234-9527-49c5-8bed-ca15bf295263` 已绑定在 [`wrangler.jsonc`](../wrangler.jsonc)。先创建生产和预览相册 bucket，再执行迁移与部署：

```powershell
npx wrangler r2 bucket create babyforge-photos
npx wrangler r2 bucket create babyforge-photos-preview
npm run cloudflare:db:migrate
npx wrangler pages project create babyforge --production-branch main
npm run cloudflare:deploy
```

## GitHub Actions 自动部署

仓库已提供 `.github/workflows/deploy-cloudflare.yml`。合并到 `main` 后，GitHub Actions 会依次执行测试、lint、构建、R2 检查、D1 迁移和 Pages 部署；R2 未开通或照片桶缺失时会在部署前停止，不会发布一个相册不可用的版本。

在 GitHub 仓库的 Settings → Secrets and variables → Actions 中添加两个 Repository secrets：

- `CLOUDFLARE_ACCOUNT_ID`：`6d27f195bf6b21f018fc46151ff0bbda`
- `CLOUDFLARE_API_TOKEN`：Cloudflare Account API Token。至少需要 Pages Edit、D1 Edit 和 Workers R2 Storage Read；如果希望自动创建桶，再增加 Workers R2 Storage Edit。

这个 Token 只放在 GitHub Secrets，不提交到仓库，也不再依赖本机 `wrangler login`。Cloudflare 官方的 Pages CI 流程同样使用 Account ID + API Token。

## R2 开通与照片桶

Cloudflare 账号需要先有 R2 subscription：进入 [R2 Overview](https://dash.cloudflare.com/6d27f195bf6b21f018fc46151ff0bbda/r2/overview)，完成开通/结算后创建以下两个桶：

```powershell
npx wrangler r2 bucket create babyforge-photos
npx wrangler r2 bucket create babyforge-photos-preview
```

如果你确认以前开通过 R2，但 Wrangler 仍返回 `Please enable R2 through the Cloudflare Dashboard`，通常是当前授权账号不是开通 R2 的账号，或当前 Token 没有 R2 scope；请先确认控制台右上角账号为 `ncz1993107@gmail.com`，再重新创建包含 R2 权限的 Account API Token。照片桶保持私有即可，应用通过 Pages Functions 的 R2 binding 读写，不需要开启公共 URL。

经验检索使用 Tavily。开发环境把密钥放在仓库根目录的 `.dev.vars`（该文件已加入 `.gitignore`）；生产环境授权 Wrangler 后执行下面的命令，按提示粘贴密钥，密钥只会保存为 Cloudflare 加密 Secret：

```powershell
npx wrangler login
npx wrangler pages secret put TAVILY_API_KEY --project-name babyforge
```

更新生产密钥后重新部署 Pages，使新的 Functions 版本读取到该 Secret。不要把密钥写入 `wrangler.jsonc`、前端代码或提交记录。

部署后访问 `https://babyforge.pages.dev`。当前初始化账号：

- 管理员：`niwa` / `niwaniwa`，可创建、填写和修改。
- 游客：`baby` / `0729`，只能查看，API 也会拒绝写入。

线上数据库只保存 PBKDF2 密码哈希，不保存明文密码。后续新增月嫂账号时，应增加 `caregiver` 成员，而不是复用只读游客账号。

## 本地预览

本地 Vite 开发环境使用演示账号，相册照片保存在浏览器 IndexedDB，不需要 D1 或 R2；生产构建不会把演示密码编译进前端。要在本地联调 Pages Functions，可使用 Wrangler 的 Pages 本地开发，它会为配置中的 D1 与 R2 binding 使用本地持久化数据。

奶爸 AI 在 Vite 开发环境读取未提交的 `.env.local` 中的 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL` 和 `OPENAI_USE_RESPONSES`。可访问 `/api/ai/local-status` 检查当前实际使用的 provider 和 model；该接口不会返回密钥。没有显式配置时不会自动连接本机或其他模型服务。

## 上线前检查

1. 检查 `wrangler.jsonc` 中的 `database_id` 与 Cloudflare 控制台一致。
2. 确认 Pages 项目绑定了 `DB` D1 binding。
3. 确认 Pages 项目绑定了 `BABY_PHOTOS` R2 binding，生产 bucket 为 `babyforge-photos`。
4. 管理员首次登录并建立宝宝档案后，再用游客账号验证只读权限。
5. 确认 `POST /api/sync` 和 `POST /api/photos` 对游客返回 `403`，已授权且未 detached 的家庭成员才能读取 `/api/photos/:id`。
6. 确认 `POST /api/events`、`PATCH /api/events/:id`、`DELETE /api/events/:id` 对游客返回 `403`，修改携带过期 `version` 时返回 `409`，纠正和作废仍保留原始事件。

## 奶爸 AI 模型配置

在 Cloudflare Pages 项目的 Settings → Variables and Secrets 中配置：

- `OPENAI_API_KEY`：加密 Secret，只供 Pages Functions 使用。
- `OPENAI_BASE_URL`：可选，自有或兼容 OpenAI 协议服务的 Base URL。
- `OPENAI_MODEL`：可选，模型 ID；默认 `gpt-4o-mini`。
- `OPENAI_USE_RESPONSES`：可选。兼容服务只支持 `/chat/completions` 时设为 `false`；未设置时使用 Agents SDK 默认 Responses 行为。

GitHub Actions 发布会从同名 Repository Secrets 同步这四项到 Cloudflare Pages，并在任何一项缺失时停止发布，避免生产环境静默退回固定本地回答。更新模型配置时应修改 GitHub Repository Secrets，再运行发布工作流；不要只修改本地 `.env.local`。

发布环境还需要独立的 `AI_HEALTH_TOKEN` Repository Secret。部署完成后，工作流使用该 Secret 调用受保护的 `/api/ai/health`，只有生产 Pages Function 真正取得模型回答后发布任务才会通过；健康检查不读取或写入家庭数据。

Windows 环境可运行 `powershell -File scripts/sync-model-secrets.ps1 -EnvFile .env.local`，从本地文件安全更新这四项 Repository Secrets；脚本只输出变量名，不输出值。

本地 Pages Functions 联调可在 `wrangler.jsonc` 同目录创建未提交的 `.dev.vars`：

```dotenv
OPENAI_API_KEY="replace-me"
OPENAI_BASE_URL="https://your-provider.example/v1"
OPENAI_MODEL="your-model-id"
OPENAI_USE_RESPONSES="false"
```

然后运行 `npx wrangler pages dev dist`。不要把 `.dev.vars` 或 API Key 提交到 Git。
7. 如使用自定义域名，在 Cloudflare 控制台完成域名绑定后再分享链接。
