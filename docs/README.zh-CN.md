<!-- 1. HEADER -->
<p align="center">
  <img src="assets/wordmark.svg" alt="PairLink" width="280" />
  <br />
  <strong>自托管、浏览器端端到端文件传输。</strong>
  <br />
  <sub>WebRTC 优先 · 断点续传 · 中继回退 · 无数据库</sub>
</p>

<p align="center">
  <a href="https://github.com/hanakokoizumi/PairLink/actions/workflows/test.yml"><img src="https://github.com/hanakokoizumi/PairLink/actions/workflows/test.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/hanakokoizumi/PairLink/releases"><img src="https://img.shields.io/github/v/release/hanakokoizumi/PairLink" alt="Release" /></a>
  <a href="../LICENSE"><img src="https://img.shields.io/badge/License-MIT-teal.svg" alt="License: MIT" /></a>
  <a href="https://goreportcard.com/report/github.com/hanakokoizumi/pairlink/server"><img src="https://goreportcard.com/badge/github.com/hanakokoizumi/pairlink/server" alt="Go Report Card" /></a>
  <a href="https://github.com/hanakokoizumi/PairLink/pkgs/container/pairlink"><img src="https://img.shields.io/badge/docker-ghcr.io-blue" alt="Docker" /></a>
</p>

<p align="center">
  <table>
    <tr>
      <td align="center"><strong>P2P 传输</strong><br/>WebRTC DataChannel</td>
      <td align="center"><strong>加密中继</strong><br/>ECDH + AES-GCM</td>
      <td align="center"><strong>零配置</strong><br/><code>make dev</code> — 无需 .env</td>
    </tr>
  </table>
</p>

[English README](../README.md)

## 快速开始

### 本地试用（无需配置）

```bash
git clone https://github.com/hanakokoizumi/PairLink.git
cd PairLink
make dev
```

打开 **http://localhost:3000** → 启动连接 → 分享 5 位连接码 → 传输。

无需 `.env` 即可本地试用；默认允许无密码创建房间。

### Docker

```bash
docker compose up -d --build
# 或
make docker-up
```

本地试用同样无需 `.env`。生产环境覆盖项见下方[配置](#配置)。

## 工作原理

```mermaid
flowchart LR
  Host[主机浏览器] <-->|WebRTC 或 WS 中继| Guest[访客浏览器]
  Host --> API[PairLink Go 服务]
  Guest --> API
```

1. 主机创建房间（配置 `PAIRLINK_USERS` 或 OIDC 时可要求认证）。
2. 访客通过 5 位连接码或链接加入，无需登录。
3. 文件与 Markdown 消息点对点传输；中继路径端到端加密。

## 功能

- **零配置开发** — 克隆后 `make dev`，无需 `.env`
- **断点续传** — IndexedDB 持久化进度
- **Markdown 消息** — GFM、语法高亮、发送时可打码
- **国际化** — zh-CN、en、zh-TW、ja、ko
- **自托管** — Go API + Next.js 前端，无数据库
- **安全** — CSP、速率限制、可选 bcrypt / OIDC 认证

## 配置

<details>
<summary>环境变量（可选）</summary>

所有项均有合理默认值。仅在需要覆盖时复制 `.env.example`。

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `JWT_SECRET` | 自动生成 | 生产环境请设固定值 |
| `PAIRLINK_USERS` | 空 | `user:bcrypt\|...` — 启用本地登录 |
| `PUBLIC_URL` | `http://localhost:8080` | 公开 URL，用于链接与 CORS |
| `DISABLE_AUTH` | 自动 | 无用户且未开 OIDC 时为 `true` |
| `RTC_CONFIG` | Google STUN | JSON ICE 服务器；严格 NAT 需 TURN |
| `OIDC_ENABLED` | `false` | 启用 OpenID Connect |
| `WS_FALLBACK` | `true` | WebRTC 失败时使用加密 WebSocket 中继 |

完整列表见 [`.env.example`](../.env.example)。

```bash
make hash-password PASSWORD=secret   # 启用本地认证时
make setup                           # 可选：cp .env.example .env
```
</details>

## 部署

| 方式 | 命令 / 镜像 |
|------|-------------|
| Docker Compose | `docker compose up -d` 或 `make docker-up` |
| GHCR 镜像 | `ghcr.io/hanakokoizumi/pairlink:latest` |
| 拉取并运行 | `make docker-pull` |
| 二进制 | `make build && ./bin/pairlink` |

生产清单：设置 `JWT_SECRET`、`PUBLIC_URL`（HTTPS）、`PAIRLINK_USERS` 或 OIDC，以及严格 NAT 下的 TURN（`deploy/coturn/` + `RTC_CONFIG`）。

若从 GHCR 拉取失败，可尝试镜像 `ghcr.nju.edu.cn/hanakokoizumi/pairlink`（标签相同）。

## 浏览器支持

| Chrome | Firefox | Safari |
|:------:|:-------:|:------:|
| 90+ | 90+ | 15.4+ |

手动 QA：[browser-qa.md](browser-qa.md)

## 开发

本地搭建、调试与测试详见 [DEVELOPMENT.md](../DEVELOPMENT.md)。

```bash
make test    # Go（race）+ Vitest
make lint
make build   # 生产构建：web + server 二进制
```

## 安全

威胁模型：[SECURITY.md](SECURITY.md) · 漏洞报告：[GitHub Security Advisories](https://github.com/hanakokoizumi/PairLink/security/advisories/new)

## 许可证

MIT © [Hanako](https://github.com/hanakokoizumi)

<p align="center">
  <a href="../README.md">English</a>
</p>
