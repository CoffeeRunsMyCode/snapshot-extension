// Prepare review folders only. This does not change a Git repository or publish.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';

const root = resolve('.');
await mkdir(join(root, 'artifacts'), { recursive: true });
const review = await mkdtemp(join(root, 'artifacts/release-review-'));
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', cwd: root }).split('\0').filter(Boolean);
const publicRoot = new Set(['.gitattributes', '.gitignore', 'README.md', 'CHANGELOG.md', 'PRIVACY.md', 'SECURITY.md', 'VALIDATION.md', 'LICENSE', 'manifest.json', 'package.json', 'package-lock.json', 'tsconfig.json', 'gallery.html', 'gallery.css', 'capture-help.html', 'capture-help.css']);
const guide = path => ['docs/index.html', 'docs/guide.css', 'docs/_config.yml'].includes(path) || /^docs\/images\/[^/]+\.png$/.test(path);
const sourceFiles = tracked.filter(path => publicRoot.has(path) || /^(src|dist|icons|tests|scripts)\//.test(path) || guide(path));
// Include this helper before its first commit, but no arbitrary untracked files.
if (!sourceFiles.includes('scripts/prepare-release.mjs')) sourceFiles.push('scripts/prepare-release.mjs');
const runtimeRoot = new Set(['manifest.json', 'gallery.html', 'gallery.css', 'capture-help.html', 'capture-help.css', 'README.md', 'PRIVACY.md', 'SECURITY.md', 'CHANGELOG.md', 'LICENSE']);
const installFiles = sourceFiles.filter(path => runtimeRoot.has(path) || /^(dist|icons)\//.test(path) || guide(path));
for (const [name, files] of [['source', sourceFiles], ['install', installFiles]]) {
  for (const path of files) {
    const destination = join(review, name, path);
    await mkdir(dirname(destination), { recursive: true });
    await cp(join(root, path), destination);
  }
}
// Private development tracks project instructions/skills; public releases do not.
const publicIgnorePath = join(review, 'source/.gitignore');
const publicIgnore = await readFile(publicIgnorePath, 'utf8');
await writeFile(publicIgnorePath, publicIgnore.trimEnd() + '\n\n# Exclude private AI development instructions and configuration\nAGENTS.md\nCLAUDE.md\n.agents/\n.claude/\n.codex/\n');

// Repository-relative GitHub links cannot resolve when opening a ZIP offline.
const installedReadme = (await readFile(join(review, 'install/README.md'), 'utf8'))
  .replace('[Releases](../../releases)', 'Releases')
  .replace('[Releases](https://github.com/CoffeeRunsMyCode/snapshot-extension/releases)', 'Releases')
  .replace(/## Development\r?\n[\s\S]*?(?=## License)/, '');
await writeFile(join(review, 'install/README.md'), installedReadme);
await writeFile(join(review, 'inventory.json'), JSON.stringify({ version: JSON.parse(await readFile('manifest.json', 'utf8')).version, source: sourceFiles.sort(), install: installFiles.sort() }, null, 2) + '\n');
console.log(review);
