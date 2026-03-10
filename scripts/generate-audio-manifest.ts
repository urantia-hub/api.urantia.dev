import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MP3_DIR =
	process.env.MP3_DIR ??
	join(import.meta.dir, "../../urantia-data-sources/data/audio/eng");

const CDN_BASE = "https://audio.urantia.dev";
const OUTPUT_PATH = join(import.meta.dir, "../data/audio-manifest.json");

// Ordered longest-first so "tts-1-hd" matches before "tts-1"
const MODEL_PREFIXES = ["tts-1-hd", "tts-1"] as const;

type AudioEntry = {
	format: string;
	url: string;
};

type AudioManifest = Record<
	string, // globalId
	Record<
		string, // model
		Record<string, AudioEntry> // voice -> entry
	>
>;

function parseFilename(
	filename: string,
): { model: string; voice: string; globalId: string } | null {
	if (!filename.endsWith(".mp3")) return null;

	const stem = filename.slice(0, -4); // strip .mp3

	for (const prefix of MODEL_PREFIXES) {
		if (!stem.startsWith(`${prefix}-`)) continue;

		// After the model prefix + hyphen, the rest is "voice-globalId"
		const remainder = stem.slice(prefix.length + 1);

		// The voice is the next token before the first hyphen that precedes the globalId.
		// globalId starts with a digit (e.g. "0:0.0.1") or "Part" (e.g. "Part1").
		// Voice names are alphabetic (alloy, echo, fable, nova, onyx, shimmer).
		const hyphenIdx = remainder.indexOf("-");
		if (hyphenIdx === -1) return null;

		const voice = remainder.slice(0, hyphenIdx);
		const globalId = remainder.slice(hyphenIdx + 1);

		if (!voice || !globalId) return null;

		return { model: prefix, voice, globalId };
	}

	return null;
}

function generateManifest(): void {
	if (!existsSync(MP3_DIR)) {
		console.error(`MP3 directory not found: ${MP3_DIR}`);
		process.exit(1);
	}

	console.log(`Scanning: ${MP3_DIR}`);

	const entries = readdirSync(MP3_DIR);
	const manifest: AudioManifest = {};

	let parsed = 0;
	let skipped = 0;

	for (const entry of entries) {
		const result = parseFilename(entry);
		if (!result) {
			skipped++;
			continue;
		}

		const { model, voice, globalId } = result;

		manifest[globalId] ??= {};
		manifest[globalId][model] ??= {};
		manifest[globalId][model][voice] = {
			format: "mp3",
			url: `${CDN_BASE}/${entry}`,
		};

		parsed++;
	}

	// Sort manifest keys for deterministic output
	const sorted: AudioManifest = {};
	for (const globalId of Object.keys(manifest).sort()) {
		const models = manifest[globalId];
		if (!models) continue;
		sorted[globalId] = {};
		for (const model of Object.keys(models).sort()) {
			const voices = models[model];
			if (!voices) continue;
			sorted[globalId][model] = {};
			for (const voice of Object.keys(voices).sort()) {
				const entry = voices[voice];
				if (!entry) continue;
				sorted[globalId][model][voice] = entry;
			}
		}
	}

	const outputDir = dirname(OUTPUT_PATH);
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
	}

	writeFileSync(OUTPUT_PATH, `${JSON.stringify(sorted, null, 2)}\n`);

	console.log(`Parsed: ${parsed} files`);
	console.log(`Skipped: ${skipped} entries (non-mp3 or unparseable)`);
	console.log(`Unique globalIds: ${Object.keys(sorted).length}`);
	console.log(`Written to: ${OUTPUT_PATH}`);
}

generateManifest();
