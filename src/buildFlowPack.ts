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
};

type QueryResults = {
  query: string;
  rankedFiles: RankedFile[];
};

type FlowPackFile = {
  filePath: string;
  score: number;
  imports: string[];
  exports: string[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
};

const SKELETONS_FILE = path.resolve('outputs/skeletons.json');
const QUERY_RESULTS_FILE = path.resolve('outputs/query-results.json');
const OUTPUT_FILE = path.resolve('outputs/flowpack.json');

function main() {
  const skeletons: SkeletonFile[] = JSON.parse(fs.readFileSync(SKELETONS_FILE, 'utf8'));
  const queryResults: QueryResults = JSON.parse(fs.readFileSync(QUERY_RESULTS_FILE, 'utf8'));

  const topFiles = queryResults.rankedFiles.filter((file) => file.score > 0).slice(0, 4);

  const files: FlowPackFile[] = topFiles
    .map((ranked) => {
    const skeleton = skeletons.find((s) => s.filePath === ranked.filePath);
    if (!skeleton) {
      return null;
    }

    return {
      filePath: ranked.filePath,
      score: ranked.score,
      imports: skeleton.imports,
      exports: skeleton.exports,
      functions: skeleton.functions,
      classes: skeleton.classes,
    };
    })
    .filter((file): file is FlowPackFile => file !== null);

  const flowPack = {
    query: queryResults.query,
    selectedCount: files.length,
    files,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(flowPack, null, 2), 'utf8');
  console.log(`Saved flow pack to ${OUTPUT_FILE}`);
}

main();
