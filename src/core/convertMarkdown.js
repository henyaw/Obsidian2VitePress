import path from 'node:path'
import { findWikilinks, resolveWikiLink } from './links.js'

export function convertMarkdown(note, context) {
  const { index, config, backlinks } = context
  let markdown = note.content

  markdown = fixFencedCodeBlocks(markdown)
  markdown = convertCallouts(markdown)
  markdown = convertWikilinks(markdown, note, index, config)

  if (config.backlinks?.enabled) {
    markdown = appendBacklinks(markdown, note, backlinks, config)
  }

  return markdown
}

export function collectBacklinks(notes, index, config) {
  const backlinks = new Map()

  for (const sourceNote of notes) {
    for (const link of findWikilinks(sourceNote.content)) {
      if (link.isEmbed) continue

      const resolved = resolveWikiLink(link, sourceNote, index, {
        ...config,
        brokenLinks: config.brokenLinks === 'fail' ? 'route' : config.brokenLinks
      })

      if (!resolved.exists) continue

      const existing = backlinks.get(resolved.note.route) ?? []
      existing.push({
        source: sourceNote,
        label: sourceNote.basename
      })
      backlinks.set(resolved.note.route, existing)
    }
  }

  return backlinks
}

function convertWikilinks(markdown, note, index, config) {
  return markdown.replace(/(!)?\[\[([^\]\n]+)\]\]/g, (raw, embedMarker, rawTarget) => {
    const link = {
      raw,
      isEmbed: Boolean(embedMarker),
      ...parseInlineTarget(rawTarget)
    }
    const resolved = resolveWikiLink(link, note, index, config)

    if (resolved.preserve) return raw

    if (link.isEmbed) {
      return convertEmbed(link, resolved, note)
    }

    return `[${escapeMarkdownLinkText(resolved.label)}](${resolved.route})`
  })
}

function convertEmbed(link, resolved, sourceNote) {
  if (isAssetTarget(link.target)) {
    const label = path.basename(link.target)
    return `![${escapeMarkdownLinkText(link.alias || label)}](${resolved.route})`
  }

  if (!resolved.exists) {
    return `[${escapeMarkdownLinkText(resolved.label)}](${resolved.route})`
  }

  return `<div class="obsidian-note-embed" data-source="${escapeHtml(sourceNote.relativePath)}"><a href="${resolved.route}">${escapeHtml(resolved.label)}</a></div>`
}

function convertCallouts(markdown) {
  const lines = markdown.split('\n')
  const output = []
  let inCallout = false

  for (const line of lines) {
    const callout = line.match(/^>\s*\[!([A-Za-z]+)\]\s*(.*)$/)

    if (callout) {
      if (inCallout) output.push(':::')
      output.push(`::: ${calloutType(callout[1])}${callout[2] ? ` ${callout[2]}` : ''}`)
      inCallout = true
      continue
    }

    if (inCallout && line.startsWith('>')) {
      output.push(line.replace(/^>\s?/, ''))
      continue
    }

    if (inCallout) {
      output.push(':::')
      inCallout = false
    }

    output.push(line)
  }

  if (inCallout) output.push(':::')

  return output.join('\n')
}

function calloutType(type) {
  const mapping = {
    note: 'info',
    abstract: 'info',
    summary: 'info',
    tldr: 'info',
    info: 'info',
    todo: 'info',
    tip: 'tip',
    hint: 'tip',
    important: 'tip',
    success: 'tip',
    check: 'tip',
    done: 'tip',
    question: 'details',
    help: 'details',
    faq: 'details',
    warning: 'warning',
    caution: 'warning',
    attention: 'warning',
    failure: 'danger',
    fail: 'danger',
    missing: 'danger',
    danger: 'danger',
    error: 'danger',
    bug: 'danger',
    example: 'details',
    quote: 'details',
    cite: 'details'
  }

  return mapping[type.toLowerCase()] ?? 'info'
}

function fixFencedCodeBlocks(markdown) {
  const lines = markdown.split('\n')
  const output = []
  let fenceChar = null
  let fenceLen = 0

  for (const line of lines) {
    const match = line.match(/^(`{3,}|~{3,})/)

    if (fenceChar === null) {
      if (match) {
        fenceChar = match[0][0]
        fenceLen = match[0].length
      }
      output.push(line)
    } else {
      if (match && match[0][0] === fenceChar && match[0].length >= fenceLen) {
        output.push(fenceChar.repeat(fenceLen))
        fenceChar = null
        fenceLen = 0
      } else {
        output.push(line)
      }
    }
  }

  return output.join('\n')
}

function appendBacklinks(markdown, note, backlinks, config) {
  const links = backlinks.get(note.route) ?? []
  if (links.length === 0) return markdown

  const uniqueLinks = [...new Map(links.map((link) => [link.source.route, link])).values()]
    .sort((a, b) => a.label.localeCompare(b.label))

  const heading = config.backlinks?.heading ?? 'Backlinks'
  const section = [
    '',
    `## ${heading}`,
    '',
    ...uniqueLinks.map((link) => `- [${escapeMarkdownLinkText(link.label)}](${link.source.route})`)
  ].join('\n')

  return `${markdown.trimEnd()}\n${section}\n`
}

function parseInlineTarget(rawTarget) {
  const [targetAndAnchor, alias] = rawTarget.split('|')
  const [target, anchor] = targetAndAnchor.split('#')

  return {
    target: target.trim(),
    anchor: anchor?.trim() || '',
    alias: alias?.trim() || ''
  }
}

function isAssetTarget(target) {
  return /\.(png|jpe?g|gif|webp|svg|pdf|mp3|mp4|wav|mov)$/i.test(target)
}

function escapeMarkdownLinkText(value) {
  return String(value).replace(/[[\]]/g, '\\$&')
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
