# PairLink 中文导读

[English README](../README.md)

PairLink 是一款自托管的浏览器端端到端文件传输工具：WebRTC 优先，失败时走加密 WebSocket 中继回退。

## 快速开始（零配置）

```bash
git clone https://github.com/hanakokoizumi/PairLink.git
cd PairLink
make dev
```

打开 **http://localhost:3000** → 启动连接 → 分享 5 位连接码 → 传输文件。

无需创建 `.env` 即可本地试用。

## Docker 部署

```bash
docker compose up -d --build
# 或
make docker-up
```

生产环境建议复制 `.env.example` 为 `.env`，设置 `JWT_SECRET`、`PUBLIC_URL`（HTTPS）、`PAIRLINK_USERS` 或 OIDC，以及 TURN（`RTC_CONFIG`）。

若从 GHCR 拉取镜像失败（中国大陆网络），可使用镜像：

`ghcr.nju.edu.cn/hanakokoizumi/pairlink`

## 文档

| 文档 | 说明 |
|------|------|
| [browser-qa.md](browser-qa.md) | 三浏览器手动 QA 清单 |
| [SECURITY.md](SECURITY.md) | 威胁模型与安全加固 |
| [.env.example](../.env.example) | 全部环境变量说明 |

## 常用命令

```bash
make test              # Go + Vitest
make hash-password PASSWORD=secret   # 生成 bcrypt 供 PAIRLINK_USERS
make docker-pull       # 拉取 GHCR 镜像并启动
```

## 许可证

MIT © [Hanako](https://github.com/hanakokoizumi)
