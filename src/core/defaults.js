export const defaultConfig = {
  docsDir: 'docs',
  outDir: 'docs/generated',
  outputRouteBase: undefined,
  cleanOutDir: true,
  slug: {
    strategy: 'vitepress'
  },
  brokenLinks: 'route',
  unsupportedSyntax: 'fail',
  assets: {
    outDir: 'assets',
    preserveFilenames: true
  },
  embeds: {
    notes: 'inline',
    assets: 'copy'
  },
  backlinks: {
    enabled: true,
    heading: 'Backlinks'
  },
  filterByPublished: false,
  useParentProperty: false,
  useOrderProperty: false,
  useHomeRewrite: false
}

export function resolveConfig(config) {
  if (!config || !Array.isArray(config.vaults) || config.vaults.length === 0) {
    throw new Error('Obsidian2VitePress requires at least one configured vault.')
  }

  const resolved = {
    ...defaultConfig,
    ...config,
    slug: {
      ...defaultConfig.slug,
      ...config.slug
    },
    assets: {
      ...defaultConfig.assets,
      ...config.assets
    },
    embeds: {
      ...defaultConfig.embeds,
      ...config.embeds
    },
    backlinks: {
      ...defaultConfig.backlinks,
      ...config.backlinks
    }
  }

  resolved.outputRouteBase = config.outputRouteBase ?? deriveOutputRouteBase(resolved.outDir, resolved.docsDir)
  return {
    ...resolved,
    useParentProperty: config.useParentProperty ?? defaultConfig.useParentProperty,
    useOrderProperty: config.useOrderProperty ?? defaultConfig.useOrderProperty,
    useHomeRewrite: config.useHomeRewrite ?? defaultConfig.useHomeRewrite
  }
}

function deriveOutputRouteBase(outDir, docsDir) {
  if (!outDir || outDir.startsWith('/')) return ''

  const cleanOutDir = outDir.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+$/g, '')
  const cleanDocsDir = docsDir.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+$/g, '')

  if (cleanOutDir === cleanDocsDir) return ''
  if (cleanOutDir.startsWith(`${cleanDocsDir}/`)) {
    return `/${cleanOutDir.slice(cleanDocsDir.length + 1)}`
  }

  return ''
}