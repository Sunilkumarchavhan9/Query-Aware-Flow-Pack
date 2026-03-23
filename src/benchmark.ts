import fs from 'node:fs';
import path from 'node:path';

type SkeletonFile = {
  filePath: string;
};

type FlowPackFile = {
  filePath: string;
};

type FlowPack = {
  query: string;
  files: FlowPackFile[];
};

type QueryResults = {
  query: string;
};

type SizeMetrics = {
  fileCount: number;
  chars: number;
  lines: number;
  approxTokens: number;
};

const SAMPLE_FILES = path.resolve('inputs/sample-files.txt');
const SKELETONS_FILE = path.resolve('outputs/skeletons.json');
const FLOWPACK_FILE = path.resolve('outputs/flowpack.json');
const QUERY_RESULTS_FILE = path.resolve('outputs/query-results.json');
const OUTPUT_FILE = path.resolve('outputs/benchmark-results.json');

function resolveRocketChatRoot(): string {
  const candidates = [
    process.env.ROCKET_CHAT_ROOT,
    path.resolve('.'),
    path.resolve('..'),
    path.resolve('../Rocket.Chat'),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'apps', 'meteor'))) {
      return candidate;
    }
  }

  throw new Error(
    `Could not resolve Rocket.Chat root. Set ROCKET_CHAT_ROOT env var. Tried: ${candidates.join(', ')}`
  );
}

function countLines(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  return text.split(/\r?\n/).length;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function percentReduction(from: number, to: number): number {
  if (from <= 0) {
    return 0;
  }
  return Number((((from - to) / from) * 100).toFixed(2));
}

function readSampleFiles(): string[] {
  return fs
    .readFileSync(SAMPLE_FILES, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildRawMetrics(rocketChatRoot: string, files: string[]): SizeMetrics {
  let chars = 0;
  let lines = 0;
  let approxTokens = 0;
  let fileCount = 0;

  for (const relativePath of files) {
    const absolutePath = path.join(rocketChatRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      continue;
    }

    const text = fs.readFileSync(absolutePath, 'utf8');
    chars += text.length;
    lines += countLines(text);
    approxTokens += estimateTokens(text);
    fileCount += 1;
  }

  return { fileCount, chars, lines, approxTokens };
}

function buildJsonMetrics(jsonPath: string, fileCount: number): SizeMetrics {
  const text = fs.readFileSync(jsonPath, 'utf8');
  return {
    fileCount,
    chars: text.length,
    lines: countLines(text),
    approxTokens: estimateTokens(text),
  };
}

function main() {
  const rocketChatRoot = resolveRocketChatRoot();
  const sampleFiles = readSampleFiles();
  const queryResults: QueryResults = JSON.parse(fs.readFileSync(QUERY_RESULTS_FILE, 'utf8'));
  const skeletons: SkeletonFile[] = JSON.parse(fs.readFileSync(SKELETONS_FILE, 'utf8'));
  const flowpack: FlowPack = JSON.parse(fs.readFileSync(FLOWPACK_FILE, 'utf8'));

  const raw = buildRawMetrics(rocketChatRoot, sampleFiles);
  const skeletonsMetrics = buildJsonMetrics(SKELETONS_FILE, skeletons.length);
  const flowpackMetrics = buildJsonMetrics(FLOWPACK_FILE, flowpack.files.length);

  const result = {
    query: queryResults.query ?? flowpack.query,
    raw,
    skeletons: skeletonsMetrics,
    flowpack: flowpackMetrics,
    reduction: {
      rawToSkeletonPercent: percentReduction(raw.chars, skeletonsMetrics.chars),
      rawToFlowpackPercent: percentReduction(raw.chars, flowpackMetrics.chars),
      rawToSkeletonTokenPercent: percentReduction(raw.approxTokens, skeletonsMetrics.approxTokens),
      rawToFlowpackTokenPercent: percentReduction(raw.approxTokens, flowpackMetrics.approxTokens),
    },
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
  console.log(`Saved benchmark results to ${OUTPUT_FILE}`);
}

main();
