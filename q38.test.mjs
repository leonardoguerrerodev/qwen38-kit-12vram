// node --test q38.test.mjs — the llama-server arguments must stay identical to the tuned profile.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildArgs, glibcOk, matchPattern } from "./q38.mjs";

const conf = JSON.parse(readFileSync(new URL("./models/q38.json", import.meta.url), "utf8"));

test("q38 profile = tuned command (from --host on)", () => {
	const args = buildArgs(conf, { model: "/m/x.gguf", alias: "x", port: "8001", mtp: true }).slice(4);
	assert.deepEqual(args, ["--host", "127.0.0.1", "--port", "8001", "-ngl", "99", "-c", "49000", "-b", "2048",
		"-ub", "256", "-fa", "on", "-ctk", "q4_0", "-ctv", "q4_0", "--load-mode", "none", "--jinja",
		"--temp", "0.6", "--top-p", "0.95", "--top-k", "20", "--min-p", "0.0",
		"--spec-type", "draft-mtp", "--spec-draft-n-max", "2", "-np", "1", "-cram", "2048",
		"--spec-type", "ngram-mod", "-bs", "--reasoning-budget", "6000",
		"--reasoning-budget-message", "Basta de planear: crea o edita el archivo ahora con la herramienta y mejóralo después."]);
});

test("no MTP head → no draft-mtp", () => {
	assert.ok(!buildArgs(conf, { model: "m", alias: "x", port: "8001", mtp: false }).includes("draft-mtp"));
});

test("model pattern", () => {
	assert.ok(matchPattern(conf.pattern, "Qwen3.8-27B-GSQ-RCO-IQ3_XXS-mtp.gguf"));
	assert.ok(!matchPattern(conf.pattern, "Qwen3.8-27B-GSQ-RCO-IQ3_XXS.gguf"));   // same quant without the MTP head
	assert.ok(matchPattern("a*b.gguf", "a-x-b.gguf") && !matchPattern("a*b.gguf", "a-x-bXgguf"));
	assert.ok(!matchPattern(conf.pattern, "Swift-1.5-Qwen3.8-27B-heretic-GSQ-RCO-IQ2_S-mtp.gguf"));
});

test("glibc 2.38+ for the Linux llama.cpp build", () => {
	assert.deepEqual(["2.35", "2.36", "2.38", "2.39", "3.0"].map(glibcOk), [false, false, true, true, true]);
});
