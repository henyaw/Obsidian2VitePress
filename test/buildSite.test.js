import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { buildSite } from '../src/core/buildSite.js'

test('converts wikilinks and appends backlinks', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'o2vp-'))
  const vault = path.join(tmp, 'vault')
  const outDir = path.join(tmp, 'docs')

  await mkdir(vault, { recursive: true })
  await writeFile(path.join(vault, 'Alpha.md'), 'Alpha links to [[Beta]].\n', 'utf8')
  await writeFile(path.join(vault, 'Beta.md'), '# Beta\n', 'utf8')

  await buildSite({
    vaults: [{ name: 'main', root: vault }],
    outDir
  })

  const alpha = await readFile(path.join(outDir, 'alpha.md'), 'utf8')
  const beta = await readFile(path.join(outDir, 'beta.md'), 'utf8')

  assert.match(alpha, /\[Beta\]\(\/beta\)/)
  assert.match(beta, /## Backlinks/)
  assert.match(beta, /- \[Alpha\]\(\/alpha\)/)
})

test('renders broken wikilinks as html anchor tags to avoid rollup import failures', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'o2vp-'))
  const vault = path.join(tmp, 'vault')
  const outDir = path.join(tmp, 'docs')

  await mkdir(vault, { recursive: true })
  await writeFile(path.join(vault, 'Alpha.md'), 'Alpha links to [[Missing Note]] and embeds ![[Missing Embed]].\n', 'utf8')

  await buildSite({
    vaults: [{ name: 'main', root: vault }],
    outDir
  })

  const alpha = await readFile(path.join(outDir, 'alpha.md'), 'utf8')

  assert.match(alpha, /<a href="\/missing-note" class="obsidian-missing-note">Missing Note<\/a>/)
  assert.match(alpha, /<a href="\/missing-embed" class="obsidian-missing-note">Missing Embed<\/a>/)
  assert.doesNotMatch(alpha, /\[Missing Note\]\(/)
  assert.doesNotMatch(alpha, /\[Missing Embed\]\(/)
})

test('supports multiple vault route bases for backlinks', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'o2vp-'))
  const personal = path.join(tmp, 'personal')
  const work = path.join(tmp, 'work')
  const outDir = path.join(tmp, 'docs')

  await mkdir(personal, { recursive: true })
  await mkdir(work, { recursive: true })
  await writeFile(path.join(personal, 'Alpha.md'), 'Alpha links to [[Beta]].\n', 'utf8')
  await writeFile(path.join(work, 'Beta.md'), '# Beta\n', 'utf8')

  await buildSite({
    vaults: [
      { name: 'personal', root: personal, routeBase: '/personal' },
      { name: 'work', root: work, routeBase: '/work' }
    ],
    outDir
  })

  const alpha = await readFile(path.join(outDir, 'personal/alpha.md'), 'utf8')
  const beta = await readFile(path.join(outDir, 'work/beta.md'), 'utf8')

  assert.match(alpha, /\[Beta\]\(\/work\/beta\)/)
  assert.match(beta, /- \[Alpha\]\(\/personal\/alpha\)/)
})

test('can fail unresolved links when configured', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'o2vp-'))
  const vault = path.join(tmp, 'vault')
  const outDir = path.join(tmp, 'docs')

  await mkdir(vault, { recursive: true })
  await writeFile(path.join(vault, 'Alpha.md'), 'Alpha links to [[Missing Note]].\n', 'utf8')

  await assert.rejects(
    () => buildSite({
      vaults: [{ name: 'main', root: vault }],
      outDir,
      brokenLinks: 'fail'
    }),
    /Unresolved wikilink/
  )
})

test('uses generated route prefix when outDir is inside docs', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'o2vp-'))
  const cwd = process.cwd()

  process.chdir(tmp)

  try {
    const vault = path.join(tmp, 'vault')

    await mkdir(vault, { recursive: true })
    await writeFile(path.join(vault, 'Alpha.md'), 'Alpha links to [[Beta]] and [[Missing Note]].\n', 'utf8')
    await writeFile(path.join(vault, 'Beta.md'), '# Beta\n', 'utf8')

    await buildSite({
      vaults: [{ name: 'main', root: vault, routeBase: '/' }],
      outDir: 'docs/generated',
      brokenLinks: 'route'
    })

    const alpha = await readFile(path.join(tmp, 'docs/generated/alpha.md'), 'utf8')
    const beta = await readFile(path.join(tmp, 'docs/generated/beta.md'), 'utf8')

    assert.match(alpha, /\[Beta\]\(\/generated\/beta\)/)
    assert.match(alpha, /<a href="\/generated\/missing-note" class="obsidian-missing-note">Missing Note<\/a>/)
    assert.match(beta, /- \[Alpha\]\(\/generated\/alpha\)/)
  } finally {
    process.chdir(cwd)
  }
})

test('does not skip notes in a vault subfolder that happens to match outputRouteBase', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'o2vp-'))
  const cwd = process.cwd()

  process.chdir(tmp)

  try {
    const vault = path.join(tmp, 'vault')

    await mkdir(path.join(vault, 'generated'), { recursive: true })
    await writeFile(path.join(vault, 'Alpha.md'), 'Alpha links to [[Beta]].\n', 'utf8')
    await writeFile(path.join(vault, 'generated', 'Beta.md'), '# Beta\n', 'utf8')

    await buildSite({
      vaults: [{ name: 'main', root: vault, routeBase: '/' }],
      outDir: 'docs/generated',
      brokenLinks: 'route'
    })

    const alpha = await readFile(path.join(tmp, 'docs/generated/alpha.md'), 'utf8')
    const beta = await readFile(path.join(tmp, 'docs/generated/generated/beta.md'), 'utf8')

    assert.match(alpha, /\[Beta\]\(\/generated\/generated\/beta\)/)
    assert.match(beta, /- \[Alpha\]\(\/generated\/alpha\)/)
  } finally {
    process.chdir(cwd)
  }
})

test('multiple vaults with outDir nested under docsDir use correct route prefix', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'o2vp-'))
  const cwd = process.cwd()

  process.chdir(tmp)

  try {
    const personal = path.join(tmp, 'personal')
    const work = path.join(tmp, 'work')

    await mkdir(personal, { recursive: true })
    await mkdir(work, { recursive: true })
    await writeFile(path.join(personal, 'Alpha.md'), 'Alpha links to [[Beta]].\n', 'utf8')
    await writeFile(path.join(work, 'Beta.md'), '# Beta\n', 'utf8')

    await buildSite({
      vaults: [
        { name: 'personal', root: personal, routeBase: '/personal' },
        { name: 'work', root: work, routeBase: '/work' }
      ],
      outDir: 'docs/generated',
      brokenLinks: 'route'
    })

    const alpha = await readFile(path.join(tmp, 'docs/generated/personal/alpha.md'), 'utf8')
    const beta = await readFile(path.join(tmp, 'docs/generated/work/beta.md'), 'utf8')

    assert.match(alpha, /\[Beta\]\(\/generated\/work\/beta\)/)
    assert.match(beta, /- \[Alpha\]\(\/generated\/personal\/alpha\)/)
  } finally {
    process.chdir(cwd)
  }
})

test('does not scan its own generated output when vault root contains outDir', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'o2vp-'))
  const cwd = process.cwd()

  process.chdir(tmp)

  try {
    const docs = path.join(tmp, 'docs')

    await mkdir(path.join(docs, 'generated'), { recursive: true })
    await writeFile(path.join(docs, 'Alpha.md'), 'Alpha links to [[Beta]].\n', 'utf8')
    await writeFile(path.join(docs, 'Beta.md'), '# Beta\n', 'utf8')
    await writeFile(path.join(docs, 'generated', 'Old.md'), 'Old generated file.\n', 'utf8')

    await buildSite({
      vaults: [{ name: 'main', root: docs, routeBase: '/' }],
      outDir: 'docs/generated',
      brokenLinks: 'route'
    })

    const alpha = await readFile(path.join(tmp, 'docs/generated/alpha.md'), 'utf8')

    assert.match(alpha, /\[Beta\]\(\/generated\/beta\)/)
    await assert.rejects(
      () => readFile(path.join(tmp, 'docs/generated/generated/old.md'), 'utf8'),
      /ENOENT/
    )
  } finally {
    process.chdir(cwd)
  }
})

test('resolves wikilinks by basename when path hint does not match the file location', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'o2vp-'))
  const vault = path.join(tmp, 'vault')
  const outDir = path.join(tmp, 'docs')

  await mkdir(path.join(vault, 'may'), { recursive: true })
  await writeFile(path.join(vault, 'may', '06-05-2026.md'), '# Daily\n', 'utf8')
  await writeFile(
    path.join(vault, 'Today.md'),
    'Yesterday: [[daily/2026/May/06-05-2026|Yesterday]]\n',
    'utf8'
  )

  await buildSite({
    vaults: [{ name: 'journal', root: vault, routeBase: '/journal' }],
    outDir
  })

  const today = await readFile(path.join(outDir, 'journal/today.md'), 'utf8')
  assert.match(today, /\[Yesterday\]\(\/journal\/may\/06-05-2026\)/)
  assert.doesNotMatch(today, /daily\/2026/)
  assert.doesNotMatch(today, /obsidian-missing-note/)
})

test('normalises malformed fenced code block closing fences', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'o2vp-'))
  const vault = path.join(tmp, 'vault')
  const outDir = path.join(tmp, 'docs')

  await mkdir(vault, { recursive: true })
  await writeFile(path.join(vault, 'Note.md'), [
    '# Note',
    '```dataview',
    'LIST FROM #daily',
    '```by',
    'trailing paragraph'
  ].join('\n'), 'utf8')

  await buildSite({ vaults: [{ name: 'main', root: vault }], outDir })

  const note = await readFile(path.join(outDir, 'note.md'), 'utf8')
  assert.match(note, /trailing paragraph/)
})

test('converts all standard Obsidian callout types without throwing', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'o2vp-'))
  const vault = path.join(tmp, 'vault')
  const outDir = path.join(tmp, 'docs')
  const extraTypes = ['abstract', 'summary', 'tldr', 'hint', 'important', 'check', 'done',
    'help', 'faq', 'caution', 'attention', 'fail', 'missing', 'error', 'cite', 'unknown-type']

  await mkdir(vault, { recursive: true })
  const content = extraTypes.map((t) => `> [!${t}]\n> content\n`).join('\n')
  await writeFile(path.join(vault, 'Callouts.md'), content, 'utf8')

  await assert.doesNotReject(() =>
    buildSite({ vaults: [{ name: 'main', root: vault }], outDir })
  )

  const out = await readFile(path.join(outDir, 'callouts.md'), 'utf8')
  assert.match(out, /:::/)
})
