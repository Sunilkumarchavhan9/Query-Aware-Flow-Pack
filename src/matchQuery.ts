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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function splitCamelCase(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function collectSearchableTerms(file: SkeletonFile): string[] {
  const terms: string[] = [];

  terms.push(...tokenize(file.filePath));

  for (const item of file.imports) {
    terms.push(...tokenize(item));
    terms.push(...splitCamelCase(item));
  }

  for (const item of file.exports) {
    terms.push(...tokenize(item));
    terms.push(...splitCamelCase(item));
  }

  for (const fn of file.functions) {
    terms.push(...tokenize(fn.name));
    terms.push(...splitCamelCase(fn.name));
    terms.push(...tokenize(fn.signature));
  }

  for (const cls of file.classes) {
    terms.push(...tokenize(cls.name));
    terms.push(...splitCamelCase(cls.name));

    for (const method of cls.methods) {
      terms.push(...tokenize(method.name));
      terms.push(...splitCamelCase(method.name));
      terms.push(...tokenize(method.signature));
    }
  }

  for (const item of file.interfaces) {
    terms.push(...tokenize(item));
    terms.push(...splitCamelCase(item));
  }

  for (const item of file.typeAliases) {
    terms.push(...tokenize(item));
    terms.push(...splitCamelCase(item));
  }

  return terms;
}

function scoreFile(file: SkeletonFile, query: string): RankedFile {
  const queryTerms = tokenize(query);
  const searchableTerms = collectSearchableTerms(file);

  let score = 0;
  const matchedTerms = new Set<string>();

  for (const q of queryTerms) {
    const matches = searchableTerms.filter((term) => term === q).length;

    if (matches > 0) {
      score += matches;
      matchedTerms.add(q);
    }
  }

  const fileName = path.basename(file.filePath).toLowerCase();

  if (fileName.includes('sendmessage') && query.toLowerCase().includes('send')) {
    score += 5;
  }

  if (fileName.includes('notification') && query.toLowerCase().includes('message')) {
    score += 2;
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

  const ranked = skeletons
    .map((file) => scoreFile(file, query))
    .sort((a, b) => b.score - a.score);

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(
      {
        query,
        rankedFiles: ranked,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Saved ranked results to ${OUTPUT_FILE}`);
}

main();
