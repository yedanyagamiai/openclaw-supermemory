# SuperMemory — Free Memory Plugin for OpenClaw

**Local-first. Zero API keys. Fully offline. For everyone.**

> Built by a person with severe disabilities who believes
> technology should serve all people equally.

SuperMemory gives your OpenClaw agent persistent memory using
local SQLite with full-text search (FTS5). No cloud services,
no paid plans, no API keys.

## Features

- Full-Text Search with BM25 ranking
- Auto-Capture: extracts facts from conversations
- Auto-Recall: injects relevant memories each turn
- Smart Categories: preference, fact, decision, entity, other
- Selective Forget: delete by ID or keyword
- Memory Profile: view stats and recent entries
- Local SQLite: all data stays on your machine
- Zero Config: works out of the box
## Quick Start
```bash
cat >> README.md << 'R2'
## Quick Start
```bash
git clone https://github.com/yedanyagamiai/openclaw-supermemory.git
openclaw plugins install ./openclaw-supermemory
openclaw gateway stop && sleep 5 && openclaw gateway start
```

## Tools

| Tool | Description |
|------|-------------|
| memory_search | Search memories by keywords |
| memory_store | Store information for future use |
| memory_forget | Delete memories by ID or keyword |
| memory_profile | View memory stats |
## Configuration

Edit `~/.openclaw/openclaw.json`:

| Option | Default | Description |
|--------|---------|-------------|
| dbPath | ~/.openclaw/supermemory/memories.db | SQLite location |
| autoRecall | true | Inject memories before each turn |
| autoCapture | true | Extract memories after each turn |
| maxRecallResults | 5 | Max memories per turn |
| debug | false | Verbose logging |

## Requirements

- OpenClaw >= 2026.1.29
- Node.js >= 20.0.0
- That's it.

## License

MIT — Use it, modify it, share it. Free forever.
---

# SuperMemory — OpenClaw 免費記憶插件

**本地優先。零 API 金鑰。完全離線。為所有人而生。**

> 由一位重度身心障礙者所開發——
> 他相信科技應平等地服務所有人，不分國籍、性別、種族或地區。

## 快速開始
```bash
cat >> README.md << 'R4'
---

# SuperMemory — OpenClaw 免費記憶插件

**本地優先。零 API 金鑰。完全離線。為所有人而生。**

> 由一位重度身心障礙者所開發——
> 他相信科技應平等地服務所有人，不分國籍、性別、種族或地區。

## 快速開始
```bash
git clone https://github.com/yedanyagamiai/openclaw-supermemory.git
openclaw plugins install ./openclaw-supermemory
openclaw gateway stop && sleep 5 && openclaw gateway start
```

## 為什麼要做這個

記憶功能應該免費。向量搜尋和持久記憶不應該需要付費。
每個人都應享有存取權。不分國籍、性別、種族或經濟狀況。
身心障礙不代表無法貢獻。身心障礙者一樣能推動世界前進。
