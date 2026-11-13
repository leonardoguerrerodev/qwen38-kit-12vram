// q38.mjs — the whole launcher, same code on Linux and Windows (the q38 / q38.cmd bootstraps only fetch Node).
// First run: downloads llama.cpp (pinned, sha256-checked) and little-coder's dependencies into .state/,
// and offers to download the model if it is missing.
// Every run: llama-server with the model's profile → wait for /health → little-coder → server off on exit.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	closeSync, cpSync, createReadStream, createWriteStream, existsSync, mkdirSync, openSync, readFileSync,
	lstatSync, readSync, readdirSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync,
} from "node:fs";
import net from "node:net";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const R = dirname(fileURLToPath(import.meta.url));
const STATE = join(R, ".state");
const WIN = process.platform === "win32";

// ── Pinned llama.cpp build (to update: change TAG, the file names and their sha256) ──
const TAG = "b12242";
const LLAMA = {
	linux: {
		files: [
			["llama-b12242-bin-ubuntu-cuda-12.8-x64.tar.gz", "1aa0b3d24f54161560109c4f4fe20e54e7a1db9b0c6774f990110ec1bf57a4a1"],
			["cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64.tar.gz", "fc33b4280968cb645f98fa78ae6377e40911ff08292161b3aa02df3c6a94ee57"],
		],
		dest: "",
		bin: "llama-b12242/llama-server",
		libs: ["llama-b12242", "cudart-llama-b12242-bin-ubuntu-cuda-12.8-x64"],
	},
	win32: {
		files: [
			["llama-b12242-bin-win-cuda-12.4-x64.zip", "f5269d7d4c3738e09d6bcaf837a72bdadaa85f7fce64f78147bb39b3751fb52c"],
			["cudart-llama-bin-win-cuda-12.4-x64.zip", "8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6"],
		],
		dest: "win", // both zips are flat: the CUDA DLLs end up next to llama-server.exe
		bin: "win/llama-server.exe",
	},
}[process.platform];

// Skills = every folder in kit/skills (drop a folder there to add one). Tools: little-coder's benchmark tools left out.
const KIT = join(R, "kit");
const NO_TOOLS = "BrowserNavigate,BrowserClick,BrowserType,BrowserScroll,BrowserExtract,BrowserBack,BrowserHistory,EvidenceAdd,EvidenceGet,EvidenceList,dispatch,ShellSession,ShellSessionCwd,ShellSessionReset";

const LANG = (process.env.Q38_LANG || process.env.LC_ALL || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || "")
	.toLowerCase().startsWith("es") ? "es" : "en";
const t = (es, en) => (LANG === "es" ? es : en);
const REPLY_IN = t("Responde siempre en español, aunque el usuario escriba en otro idioma.",
	"Always reply in English, even if the user writes in another language.");
const die = (msg) => { console.error(`q38: ${msg}`); process.exit(1); };
const SELF = WIN ? ".\\q38" : "./q38";   // how to run it inside its folder (PowerShell needs the .\)

// ── Pure helpers (tested in q38.test.mjs) ──
export const matchPattern = (pattern, name) =>
	new RegExp("^" + pattern.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$").test(name);

// Same order as the original launcher's command builder
export const buildArgs = (c, { model, alias, port, mtp }) => [
	"-m", model, "--alias", alias, "--host", "127.0.0.1", "--port", String(port),
	"-ngl", c.ngl, "-c", c.ctx, "-b", c.batch, "-ub", c.ub,
	"-fa", "on", "-ctk", c.kv, "-ctv", c.kv, "--load-mode", "none", "--jinja",
	"--temp", c.temp, "--top-p", c.top_p, "--top-k", c.top_k, "--min-p", c.min_p,
	...(mtp ? ["--spec-type", "draft-mtp", "--spec-draft-n-max", c.draft, "-np", "1"] : []),
	"-cram", c.cram, ...(c.extra ?? []),
];

// The Linux llama.cpp builds need glibc 2.38+ (objdump -T libggml-base.so → GLIBC_2.38)
export const glibcOk = (v) => { const [a, b] = v.split(".").map(Number); return a > 2 || (a === 2 && b >= 38); };

// ── Setup ──
// Downloads url → dest, sha256-checked. An interrupted download stays as dest.part and resumes on the next run.
async function download(url, dest, sha) {
	const name = basename(dest), part = dest + ".part";
	if (existsSync(dest)) return dest;
	let h = createHash("sha256"), got = 0;
	if (existsSync(part)) {   // re-hash what is already there, then ask only for the rest
		for await (const chunk of createReadStream(part)) { h.update(chunk); got += chunk.length; }
	}
	let res = await fetch(url, got ? { headers: { Range: `bytes=${got}-` } } : {});
	if (got && res.status === 416) return finish(part, dest, h, sha);   // .part was already complete
	if (got && res.status !== 206) { h = createHash("sha256"); got = 0; }   // server ignored the range: start over
	if (!res.ok) die(`${name}: HTTP ${res.status}`);
	const total = got + (Number(res.headers.get("content-length")) || 0);
	let last = 0;
	await pipeline(Readable.fromWeb(res.body), async function* (src) {
		for await (const chunk of src) {
			h.update(chunk); got += chunk.length;
			if (process.stdout.isTTY && Date.now() - last > 500) {
				last = Date.now();
				process.stdout.write(`\r  ${name}: ${(got / 2 ** 20).toFixed(0)}${total ? ` / ${(total / 2 ** 20).toFixed(0)}` : ""} MB`);
			}
			yield chunk;
		}
	}, createWriteStream(part, { flags: got && res.status === 206 ? "a" : "w" }));
	if (process.stdout.isTTY) process.stdout.write("\n");
	return finish(part, dest, h, sha);
}

function finish(part, dest, h, sha) {
	if (h.digest("hex") !== sha) { rmSync(part, { force: true }); die(t(`sha256 no coincide: ${basename(dest)}`, `sha256 mismatch: ${basename(dest)}`)); }
	renameSync(part, dest);
	return dest;
}

function extract(file, dir) {
	mkdirSync(dir, { recursive: true });
	// tar: Linux, and the bsdtar that ships with Windows 10+ (reads zip, much faster than Expand-Archive)
	if (spawnSync("tar", ["-xf", file, "-C", dir], { stdio: "inherit" }).status === 0) return;
	const q = (p) => `'${p.replaceAll("'", "''")}'`;
	if (WIN && spawnSync("powershell", ["-NoProfile", "-Command", `Expand-Archive -LiteralPath ${q(file)} -DestinationPath ${q(dir)} -Force`], { stdio: "inherit" }).status === 0) return;
	die(t(`no pude extraer ${file}`, `could not extract ${file}`));
}

// Prepends dir to PATH, reusing the existing key: on Windows it is usually "Path", and a second "PATH" is ambiguous
const withPath = (env, dir) => {
	const k = Object.keys(env).find((x) => x.toUpperCase() === "PATH") ?? "PATH";
	return { ...env, [k]: [dir, env[k]].filter(Boolean).join(WIN ? ";" : ":") };
};
const nodeEnv = () => withPath(process.env, dirname(process.execPath));

async function setup() {
	if (!LLAMA) die(t(`sistema no soportado: ${process.platform}`, `unsupported platform: ${process.platform}`));
	const glibc = WIN ? undefined : process.report.getReport().header.glibcVersionRuntime;   // undefined on musl: not checked
	if (glibc && !glibcOk(glibc)) die(t(`tu sistema tiene glibc ${glibc} y llama.cpp necesita 2.38+ (Ubuntu 24.04+, Debian 13+, Fedora 39+, Mint 22+)`,
		`your system has glibc ${glibc} and llama.cpp needs 2.38+ (Ubuntu 24.04+, Debian 13+, Fedora 39+, Mint 22+)`));
	if (spawnSync("nvidia-smi", ["-L"]).status !== 0) die(t("se necesita una GPU NVIDIA con su driver (no encuentro nvidia-smi)", "an NVIDIA GPU with its driver is required (nvidia-smi not found)"));
	mkdirSync(STATE, { recursive: true });
	console.log(t(`Instalando llama.cpp ${TAG} y little-coder (solo la primera vez)...`, `Installing llama.cpp ${TAG} and little-coder (first run only)...`));
	for (const [name, sha] of LLAMA.files) {
		const ok = join(STATE, "llama", name + ".ok");   // already extracted: a retry after a later failure skips it
		if (existsSync(ok)) continue;
		const f = await download(`https://github.com/ggml-org/llama.cpp/releases/download/${TAG}/${name}`, join(STATE, name), sha);
		extract(f, join(STATE, "llama", LLAMA.dest));
		rmSync(f);
		writeFileSync(ok, "");
	}
	if (!existsSync(join(STATE, "llama", LLAMA.bin))) die(t("llama-server no quedó donde esperaba", "llama-server is not where expected"));

	const lc = join(R, "little-coder");
	if (!existsSync(join(lc, "node_modules", "@earendil-works", "pi-coding-agent"))) {
		const nd = dirname(process.execPath);
		const npm = [join(nd, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"), join(nd, "node_modules", "npm", "bin", "npm-cli.js")].find(existsSync);
		if (!npm) die(t("no encuentro npm junto a Node", "npm not found next to Node"));
		const r = spawnSync(process.execPath, [npm, "ci", "--ignore-scripts", "--no-audit", "--no-fund", "--no-update-notifier"], { cwd: lc, stdio: "inherit", env: nodeEnv() });
		if (r.status !== 0) die("npm ci");
	}
	mkdirSync(join(R, "models"), { recursive: true });
	writeFileSync(join(STATE, "ready"), TAG + "\n");
	console.log(t("Listo.", "Done."));
}

// ── Alias: a command to start it from any folder ──
// Linux: symlink in ~/.local/bin. Windows: <name>.cmd in %LOCALAPPDATA%\Microsoft\WindowsApps, which Windows 10/11
// already put on the user's PATH; it works in PowerShell and cmd alike (a PowerShell alias would only work in PowerShell).
const ALIAS_FILE = join(STATE, "alias");   // the name chosen ("-" = none), so it can be changed or removed later
const aliasDir = () => (WIN ? join(process.env.LOCALAPPDATA ?? homedir(), "Microsoft", "WindowsApps") : join(homedir(), ".local", "bin"));
const aliasPath = (name) => join(aliasDir(), WIN ? name + ".cmd" : name);
const PS1 = join(R, "q38.ps1");
const isOurs = (p) => {
	try { return WIN ? readFileSync(p, "utf8").includes(PS1) : realpathSync(p) === realpathSync(join(R, "q38")); } catch { return false; }
};
// A leftover from a moved or deleted copy of this launcher: safe to replace
const isStale = (p) => {
	try {
		if (WIN) { const m = readFileSync(p, "utf8").match(/-File "([^"]*q38\.ps1)"/); return !!m && !existsSync(m[1]); }
		return lstatSync(p).isSymbolicLink() && !existsSync(p);   // dangling link
	} catch { return false; }
};
const addWinPath = () => `[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path','User') + ';${aliasDir()}', 'User')`;
const pathDirs = () => (process.env[Object.keys(process.env).find((k) => k.toUpperCase() === "PATH")] ?? "").split(WIN ? ";" : ":").filter(Boolean);

async function ask(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	rl.on("SIGINT", () => { console.log(); process.exit(130); });
	try { return (await rl.question(question)).trim(); }
	catch { console.log(); process.exit(130); }   // Ctrl+D: readline rejects with AbortError
	finally { rl.close(); }
}

function setAlias(name) {   // true = done; false = pick another name (the reason was already printed)
	const old = existsSync(ALIAS_FILE) ? readFileSync(ALIAS_FILE, "utf8").trim() : "";
	const removeOld = () => { if (old && old !== "-" && old !== name && isOurs(aliasPath(old))) rmSync(aliasPath(old)); };
	if (name === "-") {
		removeOld(); mkdirSync(STATE, { recursive: true }); writeFileSync(ALIAS_FILE, "-\n");
		const again = `${SELF} --alias`;
		console.log(t(`Sin alias. Para crearlo después, dentro de esta carpeta: ${again}`, `No alias. To create one later, inside this folder: ${again}`));
		return true;
	}
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) { console.log(t("  Usa solo letras, números, punto, guion o guion bajo.", "  Use only letters, digits, dot, dash or underscore.")); return false; }
	const p = aliasPath(name);
	if (isStale(p)) rmSync(p);
	if (!isOurs(p)) {
		const exts = WIN ? [".cmd", ".exe", ".bat", ".ps1", ".com"] : [""];
		const clash = existsSync(p) ? p : pathDirs().flatMap((d) => exts.map((e) => join(d, name + e))).find(existsSync);
		if (clash) { console.log(t(`  Ya existe un comando «${name}» (${clash}). Elige otro nombre.`, `  A "${name}" command already exists (${clash}). Pick another name.`)); return false; }
		mkdirSync(aliasDir(), { recursive: true });
		// cmd reads .cmd files in the OEM code page: a path with accents (C:\Users\José\…) needs UTF-8 first.
		// ponytail: chcp leaves that console in UTF-8 after exit, harmless on Windows 10+.
		const utf8 = /[^\x00-\x7f]/.test(PS1) ? "@chcp 65001 >nul\r\n" : "";
		if (WIN) writeFileSync(p, `${utf8}@powershell -NoProfile -ExecutionPolicy Bypass -File "${PS1}" %*\r\n`);
		else symlinkSync(join(R, "q38"), p);
	}
	removeOld();
	mkdirSync(STATE, { recursive: true });
	writeFileSync(ALIAS_FILE, name + "\n");
	console.log(t(`  Listo: escribe «${name}» en cualquier carpeta para abrirlo.`, `  Done: type "${name}" in any folder to start it.`));
	const norm = (d) => resolve(d).toLowerCase();
	if (!pathDirs().some((d) => norm(d) === norm(aliasDir())))
		console.log(WIN
			? t(`  Aviso: ${aliasDir()} no está en tu PATH. Pega esto en PowerShell y abre otra terminal:\n    ${addWinPath()}`,
				`  Note: ${aliasDir()} is not on your PATH. Paste this in PowerShell and open a new terminal:\n    ${addWinPath()}`)
			: t(`  Aviso: ~/.local/bin no está en tu PATH. Agrega esta línea a ~/.bashrc y abre otra terminal:\n    export PATH="$HOME/.local/bin:$PATH"`,
				`  Note: ~/.local/bin is not on your PATH. Add this line to ~/.bashrc and open a new terminal:\n    export PATH="$HOME/.local/bin:$PATH"`));
	return true;
}

async function askAlias() {
	console.log(t("\nPuedes abrirlo desde cualquier carpeta con un comando corto.", "\nYou can start it from any folder with a short command."));
	for (;;) {
		const name = (await ask(t("  Nombre del comando [qwen] (Enter = qwen, - = ninguno): ", "  Command name [qwen] (Enter = qwen, - = none): "))) || "qwen";
		if (setAlias(name)) return;
	}
}

// ── Agent config: little-coder's models.json and compaction sized to the context ──
function prepareAgent(dir, alias, ctx, port) {
	mkdirSync(dir, { recursive: true });
	cpSync(join(KIT, "prompts"), join(dir, "prompts"), { recursive: true });   // /sigue N
	const tope = Math.min(32768, Math.max(512, Math.floor(ctx / 2)));
	const m = {
		id: alias, name: alias, reasoning: true, input: ["text"], contextWindow: ctx, maxTokens: tope,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		compat: { supportsDeveloperRole: false, supportsReasoningEffort: true },
		thinkingLevelMap: { off: "none", minimal: null, low: "low", medium: "medium", high: null, xhigh: "xhigh", max: null },
	};
	writeFileSync(join(dir, "models.json"), JSON.stringify({
		default: "llamacpp/" + alias,
		providers: { llamacpp: { api: "openai-completions", baseUrl: `http://127.0.0.1:${port}/v1`, apiKey: "LLAMACPP_API_KEY", models: [m] } },
	}, null, 2));
	const sp = join(dir, "settings.json");
	let s = {};
	try { s = JSON.parse(readFileSync(sp, "utf8")); } catch {}
	s.compaction = { ...(s.compaction ?? {}), enabled: true,
		reserveTokens: Math.min(16384, Math.max(1024, Math.floor(ctx / 4))),
		keepRecentTokens: Math.min(20000, Math.max(1000, Math.floor(ctx / 4))) };
	writeFileSync(sp, JSON.stringify(s, null, 2));
}

const portOpen = (port) => new Promise((ok) => {
	const s = net.connect(port, "127.0.0.1", () => { s.destroy(); ok(true); });
	s.on("error", () => ok(false));
});

function hasMtpHead(model) {
	// GSQ Qwen3.8 files put the MTP key after the vocabulary (~10.9 MB): 24 MB covers it
	const fd = openSync(model, "r"), buf = Buffer.alloc(24_000_000);
	const n = readSync(fd, buf, 0, buf.length, 0);
	closeSync(fd);
	return buf.subarray(0, n).includes("nextn_predict_layers");
}

// Windows: the folder of Git Bash (it goes first on little-coder's PATH), undefined when there is none.
// Covers per-machine and per-user installs, and any Git whose git.exe is on PATH.
function gitBashDir() {
	const env = process.env, where = (exe) => (spawnSync("where", [exe], { encoding: "utf8" }).stdout ?? "").split(/\r?\n/).filter(Boolean);
	return [
		...[env.ProgramFiles, env["ProgramFiles(x86)"], env.LOCALAPPDATA && join(env.LOCALAPPDATA, "Programs")].filter(Boolean).map((p) => join(p, "Git", "bin")),
		...where("git.exe").map((g) => join(dirname(dirname(g)), "bin")),   // …\Git\cmd\git.exe → …\Git\bin
		...where("bash.exe").filter((b) => !/\\system32\\/i.test(b)).map(dirname),   // System32\bash.exe is WSL, not Git Bash
	].find((d) => existsSync(join(d, "bash.exe")));
}

const NEEDED = ["pattern", "ctx", "kv", "ub", "batch", "ngl", "temp", "top_p", "top_k", "min_p", "draft", "cram"];
function loadConf(id) {
	const f = join(R, "models", id + ".json");
	let c;
	try { c = JSON.parse(readFileSync(f, "utf8")); } catch (e) { die(`models/${id}.json: ${e.message}`); }
	const bad = NEEDED.filter((k) => typeof c[k] !== "string" || !c[k]);
	if (bad.length) die(t(`models/${id}.json: faltan o no van entre comillas: ${bad.join(", ")}`, `models/${id}.json: missing or not quoted: ${bad.join(", ")}`));
	if (c.extra !== undefined && !(Array.isArray(c.extra) && c.extra.every((x) => typeof x === "string")))
		die(t(`models/${id}.json: "extra" debe ser una lista de textos`, `models/${id}.json: "extra" must be a list of strings`));
	// without it, a whole download would end in "sha256 mismatch" and be deleted
	if (c.url && !/^[0-9a-f]{64}$/.test(c.sha256 ?? ""))
		die(t(`models/${id}.json: "url" necesita su "sha256" (64 caracteres hex)`, `models/${id}.json: "url" needs its "sha256" (64 hex characters)`));
	return c;
}

async function main() {
	let argv = process.argv.slice(2);
	const flag = (f) => (argv.includes(f) ? ((argv = argv.filter((a) => a !== f)), true) : false);
	const forceSetup = flag("--setup"), print = flag("--print");
	if (flag("--alias")) {   // q38 --alias [name|-]: create, change or remove the alias, then exit
		const name = argv[0];
		if (name) process.exit(setAlias(name) ? 0 : 1);
		if (!process.stdin.isTTY) die(t("uso: q38 --alias <nombre>  (o - para quitarlo)", "usage: q38 --alias <name>  (or - to remove it)"));
		await askAlias();
		return;
	}

	const ready = existsSync(join(STATE, "ready")) && readFileSync(join(STATE, "ready"), "utf8").trim() === TAG
		&& !!LLAMA && existsSync(join(STATE, "llama", LLAMA.bin))
		&& existsSync(join(R, "little-coder", "node_modules", "@earendil-works", "pi-coding-agent"));
	if (forceSetup || !ready) await setup();
	if (!existsSync(ALIAS_FILE) && process.stdin.isTTY && !print) await askAlias();   // asked once; q38 --alias changes it

	const confs = readdirSync(join(R, "models")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
	let id = "q38";
	if (confs.includes(argv[0])) id = argv.shift();   // anything else goes to little-coder as is
	const conf = loadConf(id);
	const mdir = process.env.Q38_MODELS_DIR || join(R, "models");
	const find = () => (existsSync(mdir) ? readdirSync(mdir).sort().find((f) => matchPattern(conf.pattern, f)) : undefined);
	let file = find();
	if (!file) {
		const gb = conf.size ? ` (${(Number(conf.size) / 1e9).toFixed(1)} GB)` : "";
		console.log(t(`\nFalta el modelo: ${conf.pattern}${gb}\n  Hugging Face: ${conf.hf}`, `\nModel missing: ${conf.pattern}${gb}\n  Hugging Face: ${conf.hf}`));
		const manual = t(`Descárgalo de ese link y déjalo en ${mdir}`, `Download it from that link and put it in ${mdir}`);
		if (!conf.url || !process.stdin.isTTY) die(manual);
		const yes = !/^n/i.test(await ask(t(`¿Descargarlo ahora en ${mdir}? [S/n] `, `Download it now into ${mdir}? [Y/n] `)));
		if (!yes) die(manual);
		mkdirSync(mdir, { recursive: true });
		await download(conf.url, join(mdir, decodeURIComponent(basename(new URL(conf.url).pathname))), conf.sha256);
		file = find();
		if (!file) die(t("el archivo descargado no calza con 'pattern' del .json", "the downloaded file does not match the .json 'pattern'"));
	}
	const model = join(mdir, file), alias = file.replace(/\.gguf$/, "");
	const port = process.env.Q38_PORT || "8001";
	if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) die(t(`Q38_PORT inválido: ${port}`, `invalid Q38_PORT: ${port}`));
	const bin = join(STATE, "llama", LLAMA.bin);
	const args = buildArgs(conf, { model, alias, port, mtp: hasMtpHead(model) });

	if (print) {
		console.log([bin, ...args].map((a) => (/[\s"]/.test(a) ? JSON.stringify(a) : a)).join(" "));
		return;
	}
	const bashDir = WIN ? gitBashDir() : "";
	if (bashDir === undefined) die(t("little-coder necesita Git Bash: instala Git for Windows → https://git-scm.com/download/win",
		"little-coder needs Git Bash: install Git for Windows → https://git-scm.com/download/win"));
	if (WIN) {   // llama.cpp's Windows build links the Visual C++ runtime but does not ship it
		const sys32 = join(process.env.SystemRoot ?? "C:\\Windows", "System32"), llamaDir = dirname(bin);
		if (!["vcruntime140.dll", "msvcp140.dll"].every((d) => existsSync(join(sys32, d)) || existsSync(join(llamaDir, d))))
			die(t("falta Microsoft Visual C++ Redistributable (x64). Instálalo y vuelve a abrir: https://aka.ms/vs/17/release/vc_redist.x64.exe",
				"Microsoft Visual C++ Redistributable (x64) is missing. Install it and run again: https://aka.ms/vs/17/release/vc_redist.x64.exe"));
	}
	if (await portOpen(port)) die(t(`el puerto ${port} está ocupado (¿otro llama-server?). Usa Q38_PORT para cambiarlo.`,
		`port ${port} is busy (another llama-server?). Set Q38_PORT to change it.`));

	// ── llama-server ──
	const log = join(STATE, "llama-server.log"), fd = openSync(log, "w");
	// Windows loads the DLLs next to llama-server.exe by itself
	const env = WIN ? process.env : { ...process.env, LD_LIBRARY_PATH: [...LLAMA.libs.map((l) => join(STATE, "llama", l)), process.env.LD_LIBRARY_PATH].filter(Boolean).join(":") };
	const server = spawn(bin, args, { stdio: ["ignore", fd, fd], env });
	closeSync(fd);
	let serverDead = false;
	server.on("exit", () => { serverDead = true; });
	server.on("error", (e) => { serverDead = true; die(t(`no pude arrancar llama-server: ${e.message}. Prueba: ${SELF} --setup`, `could not start llama-server: ${e.message}. Try: ${SELF} --setup`)); });
	const stop = () => { if (!serverDead) try { server.kill(); } catch {} };
	process.on("exit", stop);
	for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(s, () => process.exit(130));

	const t0 = Date.now();
	for (;;) {
		if (serverDead) {
			console.error(readFileSync(log, "utf8").split("\n").slice(-20).join("\n"));
			die(t(`llama-server terminó antes de estar listo (log: ${log})`, `llama-server exited before becoming ready (log: ${log})`));
		}
		if (Date.now() - t0 > 900_000) die(t("llama-server no respondió en 900 s", "llama-server did not answer within 900 s"));
		try { if ((await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(2000) })).ok) break; } catch {}
		if (process.stdout.isTTY) process.stdout.write(`\r  ${t("cargando", "loading")} ${alias}... ${Math.round((Date.now() - t0) / 1000)}s`);
		await new Promise((r) => setTimeout(r, 200));
	}
	console.log(`\n  ${alias} ${t("listo", "ready")} (${Math.round((Date.now() - t0) / 1000)}s)`);

	// ── little-coder ──
	const agent = join(STATE, "agent"), lc = join(R, "little-coder");
	prepareAgent(agent, alias, Number(conf.ctx), port);
	const lcArgs = [join(lc, "bin", "little-coder.mjs"), "--no-update-check", "--model", "llamacpp/" + alias,
		"--append-system-prompt", join(R, "kit", "oficio.md"), "--exclude-tools", NO_TOOLS, "--no-skills",
		...readdirSync(join(KIT, "skills")).sort().flatMap((s) => ["--skill", join(KIT, "skills", s)]),
		"--append-system-prompt", REPLY_IN, ...argv];
	const child = spawn(process.execPath, lcArgs, {
		stdio: "inherit",
		env: { ...(bashDir ? withPath(nodeEnv(), bashDir) : nodeEnv()), PI_CODING_AGENT_DIR: agent, LITTLE_CODER_MODELS_FILE: join(agent, "models.json"),
			LITTLE_CODER_EXTENSIONS_DIR: join(R, "kit", "extensions"), LLAMACPP_API_KEY: "local",
			LITTLE_CODER_NO_UPDATE_CHECK: "1", QWEN_LC_TEMP: conf.temp, LITTLE_CODER_PERMISSION_MODE: "accept-all",
			QWEN_LC_PKG: lc, QWEN_SKILLS_OFF: join(agent, "skills-off.json"),
			Q38_KIT: KIT },
	});
	process.removeAllListeners("SIGINT").on("SIGINT", () => {});   // Ctrl+C belongs to little-coder now
	for (const s of ["SIGTERM", "SIGHUP"]) process.removeAllListeners(s).on(s, () => child.kill(s));
	child.on("error", (e) => die(t(`no pude arrancar little-coder: ${e.message}`, `could not start little-coder: ${e.message}`)));
	child.on("exit", (code) => process.exit(code ?? 1));   // killed by a signal: not a clean exit
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
	main().catch((e) => die(`${e?.message ?? e}${e?.cause ? ` (${e.cause.message ?? e.cause})` : ""}`));
