# codebuddy-router

在 **Claude Code** 里直接使用 **CodeBuddy** 的模型（DeepSeek / GLM / Kimi / GPT / Gemini / MiniMax …），
并和你原本的模型服务（任何 Anthropic 兼容端点）**并列在同一个 `/model` 选择器里**切换——
**不改动**你现有的 `~/.claude/settings.json`，普通的 `claude` 命令也完全不受影响。

```
                       ┌─────────────────────────────┐
  claude-cb  ─────────▶│  codebuddy-router            │
  (Claude Code         │  127.0.0.1:8788              │
   --settings ...)     │                             │
                       │  model ∈ CodeBuddy ? ───────┼──▶ codebuddy2api ──▶ https://www.codebuddy.ai
                       │                             │      127.0.0.1:8787
                       │  否则（fallback）────────────┼──▶ 你原有的 provider
                       └─────────────────────────────┘
```

## 特性

- **零侵入**：通过 `claude --settings <file>` 覆盖配置，不写盘、不碰 `~/.claude/settings.json`。
- **统一入口**：一条命令 `claude-cb`，一个 `/model` 选择器同时列出两个 provider 的模型。
- **动态目录**：`/model` 列表由定时器从实时模型目录生成，上游增删模型会自动跟进。
- **回退热读取**：fallback 的地址与 token 直接读你现有的 `~/.claude/settings.json`，改了就生效，无需重启。
- **稳**：systemd `--user` 常驻、无限重启、崩溃自愈；`claude-cb doctor` 一键体检。

## 前置条件

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | ≥ 18 | 运行路由器与选择器生成脚本 |
| Go | ≥ 1.25 | 仅用于构建 `codebuddy2api` 网关（`--skip-gateway` 可跳过） |
| git | 任意 | 克隆网关 |
| Claude Code | ≥ 2.1.257 | `modelPicker` / `behavesAs` 需要较新版本 |
| systemd | — | 以 `systemd --user` 方式常驻 |

## 快速开始

```bash
git clone https://github.com/silverenternal/codebuddy-router.git
cd codebuddy-router
./install.sh
```

安装脚本会：克隆并构建 [codebuddy2api](https://github.com/isyntop/codebuddy2api) 网关 →
安装 `claude-cb` 到 `~/.local/bin` → 安装并启动 systemd 用户服务与选择器定时器。

随后：

1. 在 `~/codebuddy2api/config.json` 里填入你的 CodeBuddy `api_key`，然后
   `systemctl --user restart codebuddy2api.service`
2. 确认 `~/.claude/settings.json` 指向你原本的 provider（fallback）
3. 体检：`claude-cb doctor`
4. 启动：`claude-cb`，进入会话后用 `/model` 切换模型

> 常见选项：`./install.sh --skip-gateway`（已有网关时）、`--gateway-dir=/path`、`--uninstall`。

## 使用

```bash
claude-cb                        # 默认模型（deepseek-v4.1-flash）
claude-cb --model gpt-6-luna     # 直接指定某个模型
claude-cb doctor                 # 诊断路由器 / 网关 / 上游
```

进入交互式会话后输入 `/model`，即可在 CodeBuddy 与 fallback 两族模型间切换。

## 配置

| 文件 | 作用 |
|---|---|
| `~/.config/codebuddy-router.env` | 路由器端口、网关地址；可选覆盖 fallback |
| `~/.config/codebuddy2api.env` | 网关运行环境（如出网代理 `HTTP(S)_PROXY`） |
| `~/.claude/codebuddy-proxy.settings.json` | `claude-cb` 传给 Claude Code 的覆盖配置（`env` + 生成的 `modelPicker`） |

这些文件在首次安装时由 `config/*.example` 生成，之后**不会被覆盖**。

### fallback provider

路由器默认从 `~/.claude/settings.json` 读取 fallback 的 `ANTHROPIC_BASE_URL` 与
`ANTHROPIC_AUTH_TOKEN`。若想在环境变量里显式覆盖，可在 `codebuddy-router.env` 中设置
`FALLBACK_BASE` / `FALLBACK_TOKEN` / `FALLBACK_MODELS`。

## 工作原理

- `router/server.mjs`：一个本地 Anthropic Messages API 端点。按模型名判断归属——
  命中 CodeBuddy 模型集合（实时从网关 `/v1/models` 拉取）或前缀正则的请求转发给
  `codebuddy2api`；其余转发给 fallback provider，并注入其 Bearer token。
- `router/gen-picker.mjs`：定时（`codebuddy-picker.timer`，每 30 分钟）拉取合并后的模型目录，
  仅重写 `codebuddy-proxy.settings.json` 的 `modelPicker` 块；目录不可达时保持原样。
- `bin/claude-cb`：启动前探活路由器，必要时拉起服务，然后 `exec claude --settings ...`。

## 目录结构

```
codebuddy-router/
├── install.sh              # 幂等安装 / --uninstall
├── router/
│   ├── server.mjs          # Anthropic 协议路由器
│   └── gen-picker.mjs      # /model 选择器生成器
├── bin/claude-cb           # 启动器
├── systemd/                # 用户服务与定时器模板
└── config/                 # *.example 模板
```

## 故障排查

```bash
claude-cb doctor                                   # 总览
systemctl --user status codebuddy-router.service
journalctl --user -u codebuddy-router -n 50
journalctl --user -u codebuddy2api   -n 50
```

- **网关连不上上游 / 卡住**：多为出网代理问题，检查 `~/.config/codebuddy2api.env` 的
  `HTTP_PROXY` / `HTTPS_PROXY`（若主机把 `www.codebuddy.ai` 解析到 fake-IP，代理是必需的）。
- **`/model` 里模型不全**：手动跑一次 `systemctl --user start codebuddy-picker.service`。
- **某个模型报错**：可在 `router/gen-picker.mjs` 的 `DENY` 集合里把它排除。

## English (short)

**codebuddy-router** lets you use **CodeBuddy** models inside **Claude Code** side-by-side
with your existing provider, without touching `~/.claude/settings.json`. A local Anthropic-API
router (`127.0.0.1:8788`) forwards CodeBuddy models to a local [codebuddy2api](https://github.com/isyntop/codebuddy2api)
gateway and everything else to your normal provider (read live from your existing Claude settings).
One entry point (`claude-cb`), one `/model` picker, systemd-supervised. See `./install.sh --help`.

## 致谢

- [codebuddy2api](https://github.com/isyntop/codebuddy2api) —— CodeBuddy 本地兼容 API 网关（上游依赖，本仓库不包含其源码）。

## License

[MIT](LICENSE) © 2026 silverenternal
