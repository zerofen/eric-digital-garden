---
title: "单卡 RTX 3090 部署 Qwen3.8-27B：TurboQuant 全 TB4 KV Cache 与 128K 上下文"
description: "在 RTX 3090 24GB 上运行 Qwen3.8-27B Q4_K_M 的实战记录：llama.cpp、全 TB4 KV Cache、128K 上下文、Tailscale、CPA 与可交互 HTML 效果展示。"
date: "2026-09-21"
tags:
  - Qwen3.8
  - llama.cpp
  - TurboQuant
  - RTX 3090
  - GGUF
  - Long Context
  - Tailscale
  - Kilo Code
draft: false
---

这是一套面向个人 Coding Agent 的单卡部署：在 RTX 3090 24GB 上运行 `Qwen3.8-27B-Q4_K_M.gguf`，用 TurboQuant 将 K/V Cache 都压缩为 `turbo4`，把服务端上下文扩展到 128K，并通过 OpenAI 兼容接口给 Kilo、curl 和 Python 使用。

本文记录实际配置、启动命令和验证方法。TurboQuant 仍是实验性方案，强制 K/V 均为 TB4 前，应先接受质量与稳定性的回归测试。

## 最终部署架构

![Qwen3.8-27B 本地部署架构：Windows 客户端经 Tailscale 或 CPA 访问 Ubuntu GPU Server；llama-server 运行在 RTX 3090 上，使用 128K 上下文与 turbo4 K/V Cache。](/images/QW/local-deployment-architecture.png)

最终架构以图为准，分为两条调用链路。

### 主链路：客户端直连 GPU Server

Windows 笔记本上的 Kilo、curl 或 Python 客户端，经 Tailscale 访问 Ubuntu 22.04 GPU Server 上的 `llama-server:9015`。服务加载 `Qwen3.8-27B-Q4_K_M.gguf`，运行参数为 128K Context、K Cache `turbo4`、V Cache `turbo4`，并通过 `CUDA_VISIBLE_DEVICES=1` 固定使用 RTX 3090 24GB。

### 可选链路：Cloud CPA 统一中转

需要统一模型入口、鉴权或 Provider 管理时，客户端先调用 Cloud CPA 的 `:8317`，CPA 再通过 Tailscale 转发到 GPU Server `:9015`。对客户端而言，模型名可被收敛为稳定别名，不必暴露本地 GGUF 文件路径。

## 目标与实测环境

| 项目 | 配置 / 实测 |
| --- | --- |
| GPU | NVIDIA GeForce RTX 3090 24GB（物理 GPU 1） |
| 系统 | Ubuntu 22.04 |
| Driver / CUDA Runtime | 555.42.02 / 12.5 |
| 模型 | `Qwen3.8-27B-Q4_K_M.gguf` |
| 参数量 / GGUF 大小 | 27.32B / 约 16.8GB |
| 推理运行时 | CUDA 版 `llama.cpp-turboquant` |
| 上下文 | 128000 tokens（训练上限 262144） |
| KV Cache | `turbo4(K) + turbo4(V)` |
| API | OpenAI Compatible，端口 `9015` |
| 远程访问 | Tailscale；可选 Cloud CPA |

一次持续生成测试中的 GPU 状态为：显存 `23225 / 24576 MiB`、GPU 利用率 `98%`、功耗 `349 / 350W`、温度 `61°C`。这套配置已经处于 RTX 3090 的高利用率工作点，适合单用户与低并发长上下文任务。

## 部署 llama.cpp-turboquant

TurboQuant 不是所有 llama.cpp 版本都提供的能力。先准备带 CUDA TurboQuant KV Cache 支持的分支，再进行 Release 构建：

```bash
git clone <你的-llama-cpp-turboquant-仓库地址>
cd llama-cpp-turboquant

cmake -B build -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build -j$(nproc)
```

构建完成后必须检查实际二进制支持的缓存类型，而不要只根据仓库说明判断：

```bash
./build/bin/llama-server --help | grep -Ei "cache-type|turbo|reasoning"
```

输出中应能确认 `--cache-type-k`、`--cache-type-v` 与 `turbo4`。如果没有 `turbo4`，当前构建不能使用本文的缓存配置。

模型放置示例：

```text
llama-cpp-turboquant/
├── build/
└── models/
    └── Qwen3.8-27B-Q4_K_M.gguf
```

## 强制 K/V 使用 TB4

仅写入 `-ctk turbo4 -ctv turbo4` 仍不足以保证运行时 K/V 都是 TB4。部分 TurboQuant 分支会针对高 GQA Ratio 自动启用非对称保护，并在日志中提示：

```text
auto-asymmetric: GQA ratio 6:1 (n_head=24, n_head_kv=4)
upgrading K from turbo4 to q8_0 to prevent quality degradation
```

此时实际配置是 `q8_0(K) + turbo4(V)`。若实验目标明确要求全 TB4，需要关闭该保护：

```bash
export TURBO_AUTO_ASYMMETRIC=0
```

这是一项有意的质量取舍。生产场景建议保留默认保护，或至少对长上下文检索、代码生成和目标业务任务做回归测试后再强制全 TB4。

## 启动服务

### Coding Agent 默认：关闭长推理

Kilo 等 Agent 不只传递用户消息，还会携带工具定义、工作区上下文和历史工具调用。让模型无限生成 reasoning，容易耗尽输出预算而没有执行 `write` 或 `edit`。默认建议关闭 reasoning：

```bash
TURBO_AUTO_ASYMMETRIC=0 CUDA_VISIBLE_DEVICES=1 ./build/bin/llama-server \
  -m ./models/Qwen3.8-27B-Q4_K_M.gguf \
  -c 128000 -np 1 -ngl 999 -fa 1 \
  -ctk turbo4 -ctv turbo4 \
  --reasoning off --no-reasoning-preserve \
  --chat-template-kwargs '{"enable_thinking":false,"preserve_thinking":false}' \
  --host 0.0.0.0 --port 9015
```

参数含义：

| 参数 | 用途 |
| --- | --- |
| `CUDA_VISIBLE_DEVICES=1` | 固定使用物理编号为 1 的 GPU。 |
| `-c 128000` | 设置服务端上下文窗口。 |
| `-np 1` | 单并发，给长上下文 KV Cache 留出空间。 |
| `-ngl 999` | 尽可能将可卸载层放到 GPU。 |
| `-fa 1` | 启用 Flash Attention。 |
| `-ctk turbo4 -ctv turbo4` | 请求 K/V 均使用 TurboQuant 4-bit。 |

### 需要推理时：限制预算

复杂任务可打开 reasoning，但应限定 token 预算：

```bash
TURBO_AUTO_ASYMMETRIC=0 CUDA_VISIBLE_DEVICES=1 ./build/bin/llama-server \
  -m ./models/Qwen3.8-27B-Q4_K_M.gguf \
  -c 128000 -np 1 -ngl 999 -fa 1 \
  -ctk turbo4 -ctv turbo4 \
  --reasoning on --reasoning-preserve --reasoning-budget 4096 \
  --chat-template-kwargs '{"enable_thinking":true,"preserve_thinking":true}' \
  --host 0.0.0.0 --port 9015
```

通常可从 `2048~4096` 开始；简单编码任务保持关闭，复杂任务再提高到 `4096~8192`。`-c` 要同时容纳系统提示、工具 Schema、代码上下文、历史消息、reasoning 和最终回答，不能只按用户输入长度估算。

## 验证模型、缓存与 API

服务启动后，先确认监听与模型信息：

```bash
ss -lntp | grep 9015
curl http://127.0.0.1:9015/v1/models
```

`/v1/models` 的核心字段应与实际模型相符：

```json
{
  "id": "./models/Qwen3.8-27B-Q4_K_M.gguf",
  "owned_by": "llamacpp",
  "meta": {
    "n_ctx": 128000,
    "n_ctx_train": 262144,
    "n_params": 27320697856
  }
}
```

再请求最小聊天补全：

```bash
curl http://127.0.0.1:9015/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model":"./models/Qwen3.8-27B-Q4_K_M.gguf",
    "messages":[{"role":"user","content":"只回复OK"}],
    "stream":false,
    "max_tokens":16
  }'
```

同时检查 llama-server 启动日志。只有日志与预期都显示 `turbo4` 时，才能确认没有被自动保护改写为 `q8_0(K) + turbo4(V)`。

## Python、Tailscale 与 Kilo 接入

Python SDK 可直连本地服务：

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:9015/v1",
    api_key="dummy",
)

response = client.chat.completions.create(
    model="./models/Qwen3.8-27B-Q4_K_M.gguf",
    messages=[
        {"role": "user", "content": "解释一下 Transformer 的注意力机制。"}
    ],
    max_tokens=1024,
)

print(response.choices[0].message.content)
```

远程客户端与 GPU Server 加入同一 Tailnet 后，在服务端取得 Tailscale IPv4：

```bash
tailscale ip -4
```

Windows 客户端验证连通性：

```powershell
tailscale ping <SERVER_TAILSCALE_IP>
curl.exe http://<SERVER_TAILSCALE_IP>:9015/v1/models
```

在 VS Code + Kilo 中选择 OpenAI Compatible Provider：

```text
Base URL: http://<SERVER_TAILSCALE_IP>:9015/v1
API Key:  dummy
Model:    ./models/Qwen3.8-27B-Q4_K_M.gguf
```

Agent 场景建议从 `Context=128000`、`Output=8192~16384`、`Reasoning=Off/Low`、`Tool Call=Enabled` 开始。看到 `The model hit its output limit while reasoning` 时，优先降低 reasoning 预算，而不是盲目继续增加输出上限。

## 可选：经 CPA 统一中转

Cloud CPA 能把 GPU Server 封装为统一 Provider。概念配置如下，字段名应以你的 CPA 版本为准：

```yaml
openai-compatibility:
  - name: "3090"
    base-url: "http://<GPU_SERVER_TAILSCALE_IP>:9015/v1"
    api-key-entries:
      - api-key: "dummy"
        proxy-url: "direct"
    models:
      - name: "./models/Qwen3.8-27B-Q4_K_M.gguf"
        alias: "qwen3.8-27b"
```

此后客户端使用 CPA 地址和别名：

```text
Base URL: http(s)://<CPA_HOST>/v1
Model:    qwen3.8-27b
```

测试时先分别验证上游 GPU Server 和 CPA 的 `/v1/models`。如果直接请求上游成功而 CPA 代理出现 EOF，应依次检查 CPA 日志、上游 `base-url` 是否含 `/v1`、鉴权、流式转发以及 Tailscale 路由。

## 性能与容量边界

本次实测的持续生成速度约为 `40~42 tokens/s`，其中一轮记录为：

| 指标 | 结果 |
| --- | ---: |
| Prompt Eval | 223.83 tok/s（134 tokens，受 Prompt Cache/LCP 复用影响） |
| Decode | 41.80 tok/s（931 tokens） |
| 持续生成经验值 | 约 40~42 tok/s |
| 显存 | 23225 / 24576 MiB |
| GPU Util | 98% |
| 功耗 | 349 / 350W |

因此 `223.83 tok/s` 只代表该轮有缓存复用的小 prompt，不应当作冷启动长 prompt 的通用 prefill 性能。继续提高 `-np`、Context、batch size 或 KV 精度时，都应重新确认显存余量与生成质量。

## 常见问题

### 明明设置 TB4/TB4，实际却是 K=q8_0

原因是 TurboQuant 的自动非对称保护。检查启动日志；只有确实需要实验全 TB4 时才设置 `TURBO_AUTO_ASYMMETRIC=0`。

### 请求超出上下文窗口

`request (...) exceeds the available context size (...)` 表示请求总 token 超过 `-c`。上下文中还包括工具 Schema、文件内容与历史调用，不能仅按聊天文本估算。提高 `-c` 前先评估 KV Cache 显存。

### Agent 没有调用写文件工具

`The model hit its output limit while reasoning and produced no actionable output` 通常是 reasoning 吃完了输出预算。关闭 reasoning，或将 `--reasoning-budget` 控制在 2048~4096，并让大文件分块写入。

### TCP 可连但 curl 返回空响应或超时

先排查本机代理/TUN 虚拟网卡是否接管 Tailscale 或内网流量，再确认 GPU Server `9015` 的监听地址、防火墙和 Tailnet 路由。`via DERP` 代表在走中继，通常仍可用，只是延迟会更高。

## HTML 动画效果展示

下面是模型生成的 HTML 动画效果。为兼顾页面加载速度与移动端浏览体验，这里使用 GIF 展示实际运行效果。

### 孙悟空开飞机

![孙悟空开飞机 HTML 动画效果](/images/QW/test3090/wukong-plane.gif)

### 蹲下来玩手机

![蹲下来玩手机 HTML 动画效果](/images/QW/test3090/crouch-phone.gif)

### 派大星骑自行车

![派大星骑自行车 HTML 动画效果](/images/QW/test3090/patrick-bike.gif)

### 鹈鹕骑自行车

![鹈鹕骑自行车 HTML 动画效果](/images/QW/test3090/pelican-bicycle.gif)

### 秦始皇骑北极熊

![秦始皇骑北极熊 HTML 动画效果](/images/QW/test3090/qin-shihuang-polar-bear.gif)

### iOS 18 天气卡片

![iOS 18 天气卡片 HTML 动画效果](/images/QW/test3090/weather-cards.gif)

### 卡冈图雅交互式黑洞

![卡冈图雅交互式黑洞 HTML 动画效果](/images/QW/test3090/gargantua-blackhole.gif)

## 参考资料

- [llama.cpp Server 文档](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)
- [llama.cpp TurboQuant 文档](https://github.com/Pascal-SAPUI5/llama.cpp-turboquant/blob/master/docs/turboquant.md)
- [CUDA TurboQuant Fork 参考](https://github.com/TiredOfEverything/llama-cpp-turboquant)
- [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B)
- [Tailscale Connection Types](https://tailscale.com/docs/reference/connection-types)

> 本文整理于 2026 年 9 月。llama.cpp、Qwen 模板和 TurboQuant CUDA 分支都在快速迭代；实际参数请以当前分支的 `llama-server --help`、启动日志和运行时结果为准。
