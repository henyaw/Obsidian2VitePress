import { promises as fs } from 'node:fs';
import path from 'node:path';
import { outputRouteForNote, routeForNote } from './slug.js';
import { parseFrontmatter } from './frontmatter.js';

// Helper: Normalize path separators
const slash = (value) => value.replace(/\\/g, '/');

// Helper: Check if a relative path is included in the vault
const isIncluded = (relativePath, vault) => {
  if (vault.include?.length && !vault.include.some((prefix) => relativePath.startsWith(prefix))) {
    return false;
  }
  if (vault.exclude?.some((prefix) => relativePath.startsWith(prefix))) {
    return false;
  }
  return true;
};

// Helper: Normalize the generated relative root
const normalizeGeneratedRelativeRoot = (outputRouteBase) => {
  return String(outputRouteBase ?? '').replace(/^\/+|\/+$/g, '');
};

// Helper: Check if a path is inside the generated output directory
const isGeneratedOutputPath = (candidate, options) => {
  if (!options.generatedRelativeRoot) return false;
  const relative = slash(path.relative(options.root, candidate));
  return (
    relative === options.generatedRelativeRoot ||
    relative.startsWith(`${options.generatedRelativeRoot}/`)
  );
};

// Helper: Normalize a target for indexing
export const normalizeTarget = (target) => {
  return target
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .trim()
    .toLowerCase();
};

// Helper: Add a note to the target index
const addTarget = (map, target, note) => {
  const key = normalizeTarget(target);
  const matches = map.get(key) ?? [];
  if (!matches.includes(note)) {
    matches.push(note);
    map.set(key, matches);
  }
};

// Helper: Recursively walk a directory
const walk = async (dir, options) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === '.obsidian' || entry.name === '.git') continue;

    const fullPath = path.join(dir, entry.name);
    if (fullPath === options.outDir || fullPath.startsWith(`${options.outDir}/`)) continue;
    if (isGeneratedOutputPath(fullPath, options)) continue;

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath, options)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
};

// Main: Scan all vaults and create an index
export const scanVaults = async (config) => {
  const notes = [];
  const outDir = path.resolve(config.outDir);
  const generatedRelativeRoot = normalizeGeneratedRelativeRoot(config.outputRouteBase);

  for (const vault of config.vaults) {
    const root = path.resolve(vault.root);
    const files = await walk(root, {
      root,
      outDir,
      generatedRelativeRoot,
    });

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const relativePath = slash(path.relative(root, file));
      if (!isIncluded(relativePath, vault)) continue;

      const content = await fs.readFile(file, 'utf8');
      const basename = path.basename(relativePath, '.md');
      const frontmatter = parseFrontmatter(content);

      // Skip if not published (if filtering is enabled)
      if (config.filterByPublished && !frontmatter.published) continue;

      notes.push({
        vault,
        root,
        absolutePath: file,
        relativePath,
        basename,
        content,
        frontmatter,
      });
    }
  }

  return {
    notes,
    index: createNoteIndex(notes, config),
  };
};

// Helper: Create an index of notes by route and target
const createNoteIndex = (notes, config) => {
  const byRoute = new Map();
  const byTarget = new Map();

  for (const note of notes) {
    note.outputRoute = outputRouteForNote(note, config);
    note.route = routeForNote(note, config);

    // Check for route collisions
    if (byRoute.has(note.route)) {
      const existing = byRoute.get(note.route);
      throw new Error(
        `Route collision: ${existing.relativePath} and ${note.relativePath} both resolve to ${note.route}`
      );
    }
    byRoute.set(note.route, note);

    // Index by original basename, relative path (with/without .md)
    addTarget(byTarget, note.basename, note);
    addTarget(byTarget, note.relativePath.replace(/\.md$/i, ''), note);
    addTarget(byTarget, note.relativePath, note);

    // If home rewrite is active and note is marked as home layout, also index under 'index'
    if (config.useHomeRewrite && String(note.frontmatter?.layout).trim().toLowerCase() === 'home') {
      addTarget(byTarget, 'index', note);
    }

    // If order property is active, also index by ordered target name
    if (config.useOrderProperty && note.frontmatter?.order !== undefined && note.frontmatter?.order !== null && note.frontmatter?.order !== '' && !isNaN(Number(note.frontmatter.order))) {
      const orderedName = `${note.frontmatter.order}-${note.basename}`;
      addTarget(byTarget, orderedName, note);
    }
  }

  return { byRoute, byTarget };
};