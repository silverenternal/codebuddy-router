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
│   └── lib/                # 纯逻辑：models / picker / settings
├── bin/claude-cb           # 启动器
├── systemd/                # 用户服务与定时器模板
├── config/                 # *.example 模板
├── test/                   # node:test 单元测试
└── docs/                   # 文档
```

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
