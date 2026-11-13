// node check.mjs — fails if a publishable file contains absolute paths or personal data.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { homedir, userInfo } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const R = dirname(fileURLToPath(import.meta.url));
const SKIP = new Set([".state", "node_modules", ".git"]);
// Your home folder, your user name and mounted drives; extra words (handles, emails...) in Q38_CHECK_WORDS="a|b",
// never written in the repo (mount paths are split so this file does not match itself). Example paths like /home/me in little-coder's tests are fine.
const words = [homedir(), userInfo().username, "/run/" + "media/", "/media" + "/", ...(process.env.Q38_CHECK_WORDS ?? "").split("|").filter(Boolean)];
const BAD = new RegExp(words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
let hits = 0;
const walk = (d) => {
	for (const n of readdirSync(d)) {
		const p = join(d, n);
		if (SKIP.has(n) || n.endsWith(".gguf")) continue;
		if (statSync(p).isDirectory()) { walk(p); continue; }
		readFileSync(p, "utf8").split("\n").forEach((l, i) => {
			if (BAD.test(l)) { hits++; console.log(`${relative(R, p)}:${i + 1}: ${l.trim().slice(0, 120)}`); }
		});
	}
};
walk(R);
console.log(hits ? `${hits} hallazgo(s) / finding(s)` : "OK");
process.exit(hits ? 1 : 0);
