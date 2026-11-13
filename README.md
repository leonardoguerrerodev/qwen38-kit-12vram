# qwen38-kit-12vram

**[Español](README.es.md)**

A coding agent that runs **entirely on your PC**, with no cloud and no accounts. It uses **Qwen3.8-27B (GSQ-RCO IQ3_XXS + MTP)** on an NVIDIA GPU, with **[little-coder](https://github.com/itayinbarr/little-coder)** as the agent and a skills kit on top.

One command does everything: it starts the model, opens the agent, and shuts the model down when you leave.

Tested on an RTX 3060 (12 GB) with 32 GB of RAM.

> **How I run it:** the NVIDIA card is dedicated to the model and the desktop runs on the **integrated GPU** (monitor plugged into the motherboard), so the whole 12 GB of VRAM goes to the model. If the same card also draws your screen, the desktop takes some of that VRAM and you will have to lower the context in `models/q38.json`.

---

## 1. What you need

| | Linux | Windows 10/11 |
|---|---|---|
| GPU | NVIDIA with 12 GB of VRAM and its driver installed | same |
| System | x86_64 with glibc 2.38+: Ubuntu 24.04+, Debian 13+, Fedora 39+, Mint 22+, Arch | x64, with the **[Visual C++ Redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe)** (many PCs already have it) |
| Software | `curl`, `tar`, `xz` (almost always already installed) | **[Git for Windows](https://git-scm.com/download/win)** (default options are fine) |
| Free disk | ~12 GB (10.4 GB model + ~1.3 GB tools) | same |

You do **not** need to install Python, Node, CUDA or llama.cpp: the launcher downloads what it needs into its own folder.

---

## 2. Installation

### Linux

```bash
git clone <this-repo-url> qwen38-kit-12vram
cd qwen38-kit-12vram
./q38
```

### Windows

1. Get this repo: green **Code → Download ZIP** button and unzip it, or use `git clone`.
2. Open the `qwen38-kit-12vram` folder and **double-click `q38.cmd`**.
   If Windows shows "Windows protected your PC", choose **More info → Run anyway**.
   Use `q38.cmd` (double-click, cmd or PowerShell), not `./q38` from Git Bash.

### What happens the first time (both systems)

1. It downloads Node, llama.cpp and little-coder's parts (~1.3 GB). This happens only once.
2. It asks which name you want to start it with from any folder (suggested: `qwen`; see [Everyday use](#3-everyday-use)).
3. It asks:
   ```
   Model missing: Qwen3.8-27B-GSQ-RCO-IQ3_XXS-mtp.gguf (10.4 GB)
     Hugging Face: https://huggingface.co/ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF
   Download it now into …/models? [Y/n]
   ```
   - Press **Enter** and it downloads the model. If the download stops, run it again and it resumes where it left off.
   - To download it yourself: answer `n`, get **`Qwen3.8-27B-GSQ-RCO-IQ3_XXS-mtp.gguf`** from [that link](https://huggingface.co/ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF/blob/main/Qwen3.8-27B-GSQ-RCO-IQ3_XXS-mtp.gguf), put it in the `models/` folder, and run it again.
4. It loads the model on the GPU (you will see `loading… 12s`) and opens the agent.

Every download is checked against its sha256 fingerprint, so a damaged file is never used.

---

## 3. Everyday use

**The agent works in the folder you start it from.** Open your terminal in your project and launch it there.

### One command to start it from any folder

The first time, the installer asks:

```
You can start it from any folder with a short command.
  Command name [qwen] (Enter = qwen, - = none):
```

- Press **Enter** to use `qwen`, or type any name you like (`ai`, `coder`, …).
- If another program already uses that name, it tells you and asks again.
- Type `-` if you do not want a command.

Then, in any project folder:

```
qwen
```

On Windows it works the same in PowerShell and in cmd. To open a terminal in a folder: right-click → "Open in Terminal".

**Change or remove the command:**

```
qwen --alias          # asks for a new name (the old one is removed)
qwen --alias ai       # renames it to "ai" directly
qwen --alias -        # removes it
```

> If your shell already has an alias or function with that name (for example in `~/.bashrc`), that one wins. Pick another name.

<details><summary>Where it lives (to delete it by hand)</summary>

- Linux: a link in `~/.local/bin/<name>`. If that folder is not on your PATH, the installer tells you which line to add to `~/.bashrc`.
- Windows: a `<name>.cmd` file in `%LOCALAPPDATA%\Microsoft\WindowsApps`, a folder Windows 10/11 already has on the PATH.

</details>

### Commands

| I want to… | I type |
|---|---|
| Open the agent | `qwen` (or the name you chose; `./q38` on Linux or `.\q38` on Windows always works inside the folder) |
| Resume the last conversation in this folder | `qwen --continue` |
| Ask one question without the interface | `qwen -p "explain this repo"` |
| See the llama-server command being used | `qwen --print` |
| Repair the install (downloads whatever is missing) | `qwen --setup` |
| Quit | `Ctrl+D` with an empty input, or `Ctrl+C` twice |

When you quit, the model shuts down and frees the GPU.

---

## 4. Mini tutorial: your first session

Type what you want in plain words, in English or Spanish. The agent reads and edits files and runs commands in your project.

### Skills load by themselves

A *skill* is a work method the agent follows step by step. You do not need to call them: the **oficio** extension reads your request and loads the right one. The skills are written in Spanish, and the model answers in your language.

| If you write something like… | It loads | What the agent does |
|---|---|---|
| "the game crashes when I open the menu", "it used to work" | `diagnosticar` | finds the cause with evidence **before** touching code |
| "add Google login", "build a tasks API" | `planificar` | writes a staged plan in `tareas/001-….md` |
| "do stage 1 of tareas/001-login.md" | `etapas` | does **only** that stage, checks it, and stops |
| "review this change", "audit the payments module" | `revisar` | reviews and reports findings by severity |
| "check the page works on mobile" | `ver-web` | opens the page in a real headless browser and reports in text |

Every task ends with `LISTO` (done), `PARCIAL` (partial) or `BLOQUEADO` (blocked), plus the command used to check it and what it could **not** check.

### Recommended flow for something big

1. **Ask for a plan.** Write "plan: add PDF export", or press **`Ctrl+Q`** (plan mode: the agent only reads and proposes). Once you approve it, it is saved as `tareas/001-pdf-export.md`.
2. **One stage at a time.** "do stage 1 of tareas/001-pdf-export.md". When it answers `ETAPA 1 LISTA`, type **`/sigue 2`**, then `/sigue 3`, and so on.
3. **Conversation getting long?** Type **`/handoff continue with stage 3`**. The agent pulls out what matters and opens a fresh session with that summary as a draft, for you to review before sending. It keeps more than the automatic compaction does.

### Handy shortcuts

| Shortcut / command | What for |
|---|---|
| `Alt+K` (or `/oficio`) | panel to switch skills on and off |
| `/oficio off` · `/oficio on` | turn automatic skill loading off or on |
| `Ctrl+Q` | enter or leave plan mode |
| `/sigue N` | go to stage N |
| `/handoff <what next>` | fresh session with the context summarized |
| `!ls -la` | run a command yourself, without the model |
| `what's in !{git status --short}?` | put a command's output inside your message |
| `/resume` | pick an earlier conversation |

### Permissions

Before running a command that is not on its safe list (for example `rm`), the agent asks you: **Yes** · **Yes, and don't ask again for this program** · **No**.

### Status bar

At the bottom you see the model's speed in tokens per second while it writes.

### `ver-web` (optional)

For the agent to open your pages in a browser it needs Python with Playwright: `pip install playwright`, then `python -m playwright install chromium`. Without it, the other skills work the same.

---

## 5. Common problems

| Message | What to do |
|---|---|
| `port 8001 is busy` | another model is already running. Close it, or use another port: `Q38_PORT=8002 qwen` (Linux) / `$env:Q38_PORT=8002; qwen` (Windows PowerShell) |
| `llama-server exited before becoming ready` | check `.state/llama-server.log`. Most often there is not enough free VRAM: close games, browsers or other programs using the GPU |
| `an NVIDIA GPU with its driver is required` | install the NVIDIA driver; `nvidia-smi` must work |
| `your system has glibc 2.xx and llama.cpp needs 2.38+` (Linux) | the prebuilt llama.cpp needs a newer distro (see [What you need](#1-what-you-need)) |
| `Microsoft Visual C++ Redistributable (x64) is missing` (Windows) | install it from [that link](https://aka.ms/vs/17/release/vc_redist.x64.exe) and run it again |
| `little-coder needs Git Bash` (Windows) | install [Git for Windows](https://git-scm.com/download/win) |
| Something half-installed | delete the `.state` folder and run `./q38` (or `q38.cmd`) again |

---

## 6. Under the hood

### The profile

`models/q38.json` holds the profile tuned for 12 GB:
- 49,000-token context;
- `q4_0` KV cache;
- MTP speculative decoding (the head inside the GGUF) plus ngram;
- a 6,000-token reasoning budget before the model has to act.

### Another model

Copy `models/q38.json` to `models/<name>.json` and edit it:
- `pattern`: the file name; one `*` is allowed;
- `hf`, `url`, `sha256`, `size`: for the download;
- the llama-server parameters, plus `extra` for any other flags.

Run it with `qwen <name>`. Values are quoted strings so they reach llama-server exactly as written.

### Variables

| Variable | Default | What it does |
|---|---|---|
| `Q38_PORT` | `8001` | llama-server port |
| `Q38_MODELS_DIR` | `models/` | folder with the `.gguf` files |
| `Q38_LANG` | from your system | `es` or `en`: language of the messages and of the replies |

### What is in the folder

| Path | What |
|---|---|
| `q38`, `q38.cmd`, `q38.ps1` | Linux and Windows starters: they fetch Node and run `q38.mjs` |
| `q38.mjs` | the launcher: setup, model, llama-server, little-coder |
| `kit/extensions/` | `oficio` (skill loading + guards), `handoff`, `tps` (speed), `inline-bash` (`!{cmd}`), `lc-permisos`, `lc-plan` (plan → `tareas/`), `lc-temperatura`, `razonamiento` (drops old reasoning from the context) |
| `kit/skills/` | the 5 skills; add a folder to add a skill |
| `kit/oficio.md` | the work rules added to the agent's prompt |
| `little-coder/` | little-coder 1.20.0 pinned to Pi 1.5.0 |
| `.state/` | everything downloaded plus the agent's settings; delete it to start fresh |
| `q38.test.mjs` · `check.mjs` | `node --test q38.test.mjs` checks the profile; `node check.mjs` flags personal paths before you publish |

### Updating llama.cpp or Node

- **llama.cpp:** change `TAG`, the file names and their sha256 in `q38.mjs`, then run `qwen --setup`. Take them from the release page or from `https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/<tag>`.
- **Node:** change `NODE_VER`/`NODE_SHA` in `q38` and `q38.ps1`, then delete `.state/node`.

---

## Credits and license

MIT (see `LICENSE`). `little-coder/` is © Itay Inbar, Apache-2.0 (`little-coder/LICENSE`, `little-coder/NOTICE`). `kit/extensions/inline-bash.ts` and `handoff.ts` are Pi example extensions (MIT). Model by [ISTA-DASLab](https://huggingface.co/ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF). Built on [llama.cpp](https://github.com/ggml-org/llama.cpp) and [Pi](https://github.com/earendil-works/pi).
