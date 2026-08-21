// Helper: Normalize a route by removing leading/trailing slashes and duplicates
const normalizeRoute = (route) => {
  if (!route) return '';
  return `/${route.replace(/^\/+|\/+$/g, '')}`.replace(/\/+/g, '/');
};

// Helper: Clean a path segment (e.g., for slugs)
const cleanPathSegment = (segment) => {
  return segment
    .trim()
    .replace(/\.[^.]+$/, '') // Remove file extensions
    .replace(/['"]/g, '') // Remove quotes
    .replace(/[^A-Za-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, '') // Trim hyphens
    .toLowerCase();
};

// Helper: Convert a value to a slug
const toSlug = (value, strategy = 'vitepress') => {
  if (strategy === 'preserve') return value;

  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\\/g, '/') // Normalize path separators
    .split('/')
    .map(cleanPathSegment)
    .filter(Boolean)
    .join('/');
};

// Helper: Normalize a generated route (e.g., remove .md, clean slashes)
const normalizeGeneratedRoute = (route, routeBase) => {
  const cleanRoute = String(route)
    .replace(/\\/g, '/')
    .replace(/\.md$/i, '')
    .replace(/^\/+|\/+$/g, '');
  return normalizeRoute(`${routeBase}/${cleanRoute}`);
};

// Helper: Join route parts and normalize
const joinRoutes = (...parts) => {
  const clean = parts
    .filter(Boolean)
    .map((part) => String(part).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return normalizeRoute(clean);
};

// Helper: Determine target basename taking order and home rewrite options into account
const getTargetBasename = (note, config) => {
  // Check for Home Rewrite rule first
  if (config.useHomeRewrite && String(note.frontmatter?.layout).trim().toLowerCase() === 'home') {
    return 'index';
  }

  // Check for Order Property rule second
  if (config.useOrderProperty) {
    const orderVal = note.frontmatter?.order;
    if (orderVal !== undefined && orderVal !== null && orderVal !== '' && !isNaN(Number(orderVal))) {
      return `${orderVal}-${note.basename}`;
    }
  }

  return note.basename;
};

// --- Exported Functions ---

export const createSlug = toSlug;

export const normalizeRouteBase = (routeBase = '') => normalizeRoute(routeBase);

export const routeForNote = (note, config) => {
  return joinRoutes(config.outputRouteBase, outputRouteForNote(note, config));
};

export const outputRouteForNote = (note, config) => {
  const routeBase = normalizeRouteBase(note.vault.routeBase);
  const strategy = config.slug?.strategy ?? 'vitepress';
  const custom = config.slug?.custom;
  const useParentProperty = config.useParentProperty;

  const targetBasename = getTargetBasename(note, config);

  // Use parent property if enabled
  if (useParentProperty) {
    const parent = note.frontmatter?.parent ? String(note.frontmatter.parent).trim() : '';
    const parentPath = parent ? `${parent}/${targetBasename}` : targetBasename;
    return normalizeGeneratedRoute(toSlug(parentPath, strategy), routeBase);
  }

  // Custom slug strategy
  if (strategy === 'custom') {
    if (typeof custom !== 'function') {
      throw new Error('slug.strategy is custom, but slug.custom is not a function.');
    }
    return normalizeGeneratedRoute(
      custom({
        vaultName: note.vault.name,
        sourcePath: note.relativePath,
        basename: targetBasename,
      }),
      routeBase
    );
  }

  let relativePath = note.relativePath;
  if (targetBasename !== note.basename) {
    const dir = note.relativePath.includes('/')
      ? note.relativePath.substring(0, note.relativePath.lastIndexOf('/'))
      : '';
    relativePath = dir ? `${dir}/${targetBasename}.md` : `${targetBasename}.md`;
  }

  return normalizeGeneratedRoute(toSlug(relativePath, strategy), routeBase);
};

export const routeForUncreatedNote = (target, sourceNote, config) => {
  const routeBase = normalizeRouteBase(sourceNote?.vault?.routeBase);
  const strategy = config.slug?.strategy ?? 'vitepress';
  const withoutAnchor = target.split('#')[0];
  return joinRoutes(
    config.outputRouteBase,
    normalizeGeneratedRoute(toSlug(withoutAnchor, strategy), routeBase)
  );
};

export const anchorSlug = (value) => toSlug(value, 'vitepress');