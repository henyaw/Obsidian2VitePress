import { anchorSlug, routeForUncreatedNote } from './slug.js'
import { normalizeTarget } from './scanVault.js'

const wikilinkPattern = /(!)?\[\[([^\]\n]+)\]\]/g

export function parseWikiTarget(rawTarget) {
  const [targetAndAnchor, alias] = rawTarget.split('|')
  const [target, anchor] = targetAndAnchor.split('#')

  return {
    target: target.trim(),
    anchor: anchor?.trim() || '',
    alias: alias?.trim() || ''
  }
}

export function findWikilinks(markdown) {
  const links = []

  for (const match of markdown.matchAll(wikilinkPattern)) {
    links.push({
      raw: match[0],
      isEmbed: Boolean(match[1]),
      ...parseWikiTarget(match[2])
    })
  }

  return links
}

export function resolveWikiLink(link, sourceNote, index, config) {
  let matches = index.byTarget.get(normalizeTarget(link.target)) ?? []

  if (matches.length === 0) {
    const segments = link.target.replace(/\\/g, '/').split('/')
    const basename = segments[segments.length - 1]
    if (basename && basename !== link.target) {
      matches = index.byTarget.get(normalizeTarget(basename)) ?? []
    }
  }

  if (matches.length > 1) {
    throw new Error(`Ambiguous wikilink [[${link.target}]] in ${sourceNote.relativePath}. Matches: ${matches.map((note) => note.relativePath).join(', ')}`)
  }

  if (matches.length === 1) {
    const targetNote = matches[0]
    return {
      exists: true,
      note: targetNote,
      route: withAnchor(targetNote.route, link.anchor),
      label: link.alias || targetNote.basename
    }
  }

  if (config.brokenLinks === 'fail') {
    throw new Error(`Unresolved wikilink [[${link.target}]] in ${sourceNote.relativePath}`)
  }

  if (config.brokenLinks === 'preserve') {
    return {
      exists: false,
      preserve: true,
      route: '',
      label: link.alias || link.target
    }
  }

  if (config.brokenLinks === 'warn') {
    console.warn(`Obsidian2VitePress: unresolved wikilink [[${link.target}]] in ${sourceNote.relativePath}`)
  }

  return {
    exists: false,
    route: withAnchor(routeForUncreatedNote(link.target, sourceNote, config), link.anchor),
    label: link.alias || link.target
  }
}

function withAnchor(route, anchor) {
  if (!anchor) return route
  if (anchor.startsWith('^')) return `${route}#${anchorSlug(anchor.slice(1))}`
  return `${route}#${anchorSlug(anchor)}`
}
