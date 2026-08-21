export function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
  const match = content.match(frontmatterRegex);
  if (!match) return {};

  const frontmatter = {};
  const frontmatterString = match[1];

  frontmatterString.split('\n').forEach((line) => {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) return;

    let value = rest.join(':').trim();
    value = value.replace(/^['"]|['"]$/g, ''); // Remove surrounding quotes

    // Handle boolean values
    if (value === 'true') value = true;
    else if (value === 'false') value = false;

    frontmatter[key.trim()] = value;
  });

  return frontmatter;
}