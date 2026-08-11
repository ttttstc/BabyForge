# 子议题 7：LLM API Key 应用层加密

## 唯一目标

把 `account_llm_configs` 中的用户 API Key 从 D1 明文迁移为应用层密文，并保持现有 masked API 响应。

## 设计

- Cloudflare Secret 保存主加密密钥；仓库和 D1 不保存主密钥。
- 使用 Web Crypto AES-GCM；每条记录随机 nonce，数据库保存 `ciphertext`、`nonce`、`key_version`。
- 读取时仅在服务端解密后调用上游；API 永远只返回 mask。
- 迁移支持明文读取一次并写回密文，完成后禁止新明文写入；迁移失败保留可控回滚窗口。
- 主密钥轮换通过 `key_version` 支持新旧密钥解密，旧密钥只保留到迁移完成。

## 非目标

与 Better Auth/Household cutover 同次修改账号 ID、权限或认证 Session。

## 验收

新写入不出现明文 API Key；旧配置可安全迁移；主密钥缺失时 fail closed；任何 API 响应不包含完整 Key。
