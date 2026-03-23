import fs from 'node:fs';
import path from 'node:path';

type FunctionInfo = {
  name: string;
  signature: string;
};

type ClassInfo = {
  name: string;
  methods: FunctionInfo[];
};

type SkeletonFile = {
  filePath: string;
  imports: string[];
  exports: string[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  interfaces: string[];
  typeAliases: string[];
};

type RankedFile = {
  filePath: string;
  score: number;
  matchedTerms: string[];
};

const INPUT_FILE = path.resolve('outputs/skeletons.json');
const OUTPUT_FILE = path.resolve('outputs/query-results.json');

const STOP_WORDS = new Set([
  'how',
  'are',
  'the',
  'is',
  'a',
  'an',
  'in',
  'on',
  'of',
  'to',
  'for',
  'and',
]);

function splitWords(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeWord(word: string): string {
  if (word === 'sent' || word === 'sending') return 'send';
  if (word === 'messages') return 'message';
  if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
  return word;
}

function normalizeWords(words: string[]): string[] {
  return words.map(normalizeWord).filter((w) => !STOP_WORDS.has(w));
}

function textToTerms(text: string): string[] {
  return normalizeWords(splitWords(text));
}

function collectTerms(file: SkeletonFile): string[] {
  const terms: string[] = [];

  terms.push(...textToTerms(file.filePath));

  const baseName = path.basename(file.filePath);
  terms.push(...textToTerms(baseName));

  for (const item of file.imports) {
    terms.push(...textToTerms(item));
  }

  for (const item of file.exports) {
    terms.push(...textToTerms(item));
  }

  for (const fn of file.functions) {
    terms.push(...textToTerms(fn.name));
    terms.push(...textToTerms(fn.signature));
  }

  for (const cls of file.classes) {
    terms.push(...textToTerms(cls.name));

    for (const method of cls.methods) {
      terms.push(...textToTerms(method.name));
      terms.push(...textToTerms(method.signature));
    }
  }

  for (const item of file.interfaces) {
    terms.push(...textToTerms(item));
  }

  for (const item of file.typeAliases) {
    terms.push(...textToTerms(item));
  }

  return terms;
}

function scoreFile(file: SkeletonFile, query: string): RankedFile {
  const queryTerms = textToTerms(query);
  const fileTerms = collectTerms(file);
  const queryHasAuthIntent = queryTerms.some((term) =>
    ['permission', 'auth', 'access'].includes(term)
  );

  let score = 0;
  const matchedTerms = new Set<string>();

  for (const q of queryTerms) {
    const count = fileTerms.filter((t) => t === q).length;
    if (count > 0) {
      score += count;
      matchedTerms.add(q);
    }
  }

  const baseName = path.basename(file.filePath).toLowerCase();
  const filePathLower = file.filePath.toLowerCase();

  if (baseName.includes('sendmessage')) score += 10;
  if (baseName.includes('insertmessage')) score += 6;
  if (baseName.includes('sendnotificationsonmessage')) score += 5;
  if (baseName.includes('cansendmessage')) score += 5;

  // Exact-path boosts for the core sendMessage entry points.
  if (baseName === 'sendmessage.ts') score += 12;
  if (filePathLower.endsWith('/methods/sendmessage.ts')) score += 10;
  if (filePathLower.endsWith('/functions/sendmessage.ts')) score += 8;

  if (filePathLower.includes('/methods/')) score += 2;
  if (filePathLower.includes('/functions/')) score += 2;
  if (filePathLower.includes('/lib/')) score += 1;

  // Authorization files should rank lower unless auth intent is explicit.
  if (filePathLower.includes('/authorization/') && !queryHasAuthIntent) {
    score -= 6;
  }

  if (fileTerms.includes('send') && fileTerms.includes('message')) {
    score += 8;
  }

  return {
    filePath: file.filePath,
    score,
    matchedTerms: Array.from(matchedTerms),
  };
}

function main() {
  const raw = fs.readFileSync(INPUT_FILE, 'utf8');
  const skeletons: SkeletonFile[] = JSON.parse(raw);

  const query = 'how are messages sent';

  const rankedFiles = skeletons
    .map((file) => scoreFile(file, query))
    .sort((a, b) => b.score - a.score);

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify({ query, rankedFiles }, null, 2),
    'utf8'
  );

  console.log(`Saved ranked results to ${OUTPUT_FILE}`);
}

main();
