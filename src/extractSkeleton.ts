import fs from 'node:fs';
import path from 'node:path';
import { Project } from 'ts-morph';

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

const ROCKET_CHAT_ROOT = resolveRocketChatRoot();
const INPUT_FILE = path.resolve('inputs/sample-files.txt');
const OUTPUT_FILE = path.resolve('outputs/skeletons.json');

function readSampleFiles(): string[] {
  const content = fs.readFileSync(INPUT_FILE, 'utf8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function getFunctionSignature(fn: any): string {
  try {
    return fn.getText().split('{')[0].trim();
  } catch {
    return fn.getName?.() ?? 'anonymous';
  }
}

function extractSkeleton(project: Project, relativeFilePath: string): SkeletonFile | null {
  const absolutePath = path.join(ROCKET_CHAT_ROOT, relativeFilePath);

  if (!fs.existsSync(absolutePath)) {
    console.warn(`File not found: ${absolutePath}`);
    return null;
  }

  const sourceFile = project.addSourceFileAtPath(absolutePath);

  const imports = sourceFile.getImportDeclarations().map((imp) => imp.getModuleSpecifierValue());
  const exports = sourceFile.getExportSymbols().map((sym) => sym.getName());

  const functions: FunctionInfo[] = sourceFile.getFunctions().map((fn) => ({
    name: fn.getName() ?? 'anonymous',
    signature: getFunctionSignature(fn),
  }));

  const classes: ClassInfo[] = sourceFile.getClasses().map((cls) => ({
    name: cls.getName() ?? 'AnonymousClass',
    methods: cls.getMethods().map((method) => ({
      name: method.getName(),
      signature: getFunctionSignature(method),
    })),
  }));

  const interfaces = sourceFile.getInterfaces().map((i) => i.getName());
  const typeAliases = sourceFile.getTypeAliases().map((t) => t.getName());

  return {
    filePath: relativeFilePath,
    imports,
    exports,
    functions,
    classes,
    interfaces,
    typeAliases,
  };
}

function main() {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
  });

  const filePaths = readSampleFiles();
  const skeletons: SkeletonFile[] = [];

  for (const filePath of filePaths) {
    const result = extractSkeleton(project, filePath);
    if (result) skeletons.push(result);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(skeletons, null, 2), 'utf8');
  console.log(`Saved ${skeletons.length} skeletons to ${OUTPUT_FILE}`);
}

main();
