# codebuddy-router

在 **Claude Code** 里直接使用 **CodeBuddy** 的模型（DeepSeek / GLM / Kimi / GPT / Gemini / MiniMax …），
并和你原本的模型服务（任何 Anthropic 兼容端点）**并列在同一个 `/model` 选择器里**切换。
默认模型是 `deepseek-v4.1-flash`，23 个模型随时可切。

```
                       ┌─────────────────────────────┐
  claude / claude-cb   │  codebuddy-router            │
  ────────────────────▶│  127.0.0.1:8788              │
                       │                             │
                       │  model ∈ CodeBuddy ? ───────┼──▶ codebuddy2api ──▶ https://www.codebuddy.ai
                       │                             │      127.0.0.1:8787
                       │  否则（fallback）────────────┼──▶ 你原有的 provider
                       └─────────────────────────────┘
```

## 特性

- **一条命令可用**：装好后直接 `claude` 即可；`claude-cb` 是**可选**的便捷入口（与 `claude` 等价，仅多一步启动前健康检查）。
- **默认 deepseek**：主模型 / 各档位 / subagent 全部默认 `deepseek-v4.1-flash`，随时可切。
- **统一选择器**：一个 `/model` 同时列出 CodeBuddy 与 fallback 两族模型。
- **动态目录**：`/model` 列表由定时器从实时模型目录生成，上游增删模型会自动跟进。
- **续接老会话不报错**：老会话里记录的旧模型 id（`MiniMax-M3`、`deepseek-flash` 等）会被自动映射到当前 CodeBuddy 模型，`--resume` 不再落到不稳定的 fallback 腿。
- **稳**：systemd `--user` 常驻、无限重启、崩溃自愈；`claude-cb doctor` 一键体检。

## 快速开始

```bash
git clone https://github.com/silverenternal/codebuddy-router.git
cd codebuddy-router
./install.sh
```

安装脚本会：克隆并构建 [codebuddy2api](https://github.com/isyntop/codebuddy2api) 网关 →
安装 `claude-cb` → 安装并启动 systemd 用户服务与选择器定时器 →
**备份** `~/.claude/settings.json` 并改写为指向路由器（同时把你原有的 provider 记入 fallback）。

随后：

1. 在 `~/codebuddy2api/config.json` 里填入你的 CodeBuddy `api_key`，然后
   `systemctl --user restart codebuddy2api.service`
2. 体检：`claude-cb doctor`
3. 启动：`claude`（或 `claude-cb`），进入会话后用 `/model` 切换模型

> 常见选项：`./install.sh --skip-gateway`（已有网关时）、`--gateway-dir=/path`、`--uninstall`。

## 使用

```bash
claude                           # 默认模型 deepseek-v4.1-flash
claude --model gpt-6-luna        # 直接指定某个模型
claude-cb doctor                 # 诊断路由器 / 网关 / 上游
```

进入交互式会话后输入 `/model`，即可在 CodeBuddy 与 fallback 两族模型间切换。

> `claude-cb` 是**可选**的：它与 `claude` 完全等价，只在启动前多做一次路由器健康检查（必要时自动拉起服务）。路由器本身有 systemd 守护，所以平时直接用 `claude` 就行；`claude-cb doctor` 用于一键诊断。

### 指定 subagent 的模型

- 全局：`~/.claude/settings.json` 的 `CLAUDE_CODE_SUBAGENT_MODEL`（默认 `deepseek-v4.1-flash`）。
- 单个 agent：在 `~/.claude/agents/<name>.md` 的 frontmatter 写 `model: gpt-6-luna` 等任意模型 id。

## 前置条件

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | ≥ 18 | 运行路由器与选择器生成脚本 |
| Go | ≥ 1.25 | 仅用于构建 `codebuddy2api` 网关（`--skip-gateway` 可跳过） |
| git | 任意 | 克隆网关 |
| Claude Code | ≥ 2.1.257 | `modelPicker` / `behavesAs` 需要较新版本 |
| systemd | — | 以 `systemd --user` 方式常驻 |

## 文档

| 文档 | 内容 |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 组件、请求流程、模型分类、模块职责 |
| [docs/CONFIGURATION.md](docs/CONFIGURATION.md) | 所有环境变量与配置文件 |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | 常见问题与排查 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 开发、测试与提交流程 |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录 |
| [SECURITY.md](SECURITY.md) | 安全策略与凭据处理 |

## 目录结构

```
codebuddy-router/
├── install.sh              # 幂等安装 / --uninstall
├── router/
│   ├── server.mjs          # Anthropic 协议路由器（入口）
│   ├── gen-picker.mjs      # /model 选择器生成器（入口）
│   ├── configure-settings.mjs  # 把 Claude Code 接到路由器（安装时调用）
│   └── lib/                # 纯逻辑：models / picker / settings
├── bin/claude-cb           # 带健康检查的启动器
├── systemd/                # 用户服务与定时器模板
├── config/                 # *.example 模板
├── test/                   # node:test 单元测试
└── docs/                   # 文档
```

## English (short)

**codebuddy-router** lets you use **CodeBuddy** models inside **Claude Code** side-by-side
with your existing provider in one `/model` picker, defaulting to `deepseek-v4.1-flash`.
A local Anthropic-API router (`127.0.0.1:8788`) forwards CodeBuddy models to a local
[codebuddy2api](https://github.com/isyntop/codebuddy2api) gateway and everything else to your
fallback provider. `./install.sh` wires it up and points `~/.claude/settings.json` at the router
(backed up first). See `./install.sh --help`.

## 致谢

- [codebuddy2api](https://github.com/isyntop/codebuddy2api) —— CodeBuddy 本地兼容 API 网关（上游依赖，本仓库不包含其源码）。

## License

[MIT](LICENSE) © 2026 silverenternal
