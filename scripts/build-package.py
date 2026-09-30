from pathlib import Path
import json
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
subprocess.run(['bun', 'scripts/validate-release.mjs'], cwd=root, check=True)
plugin = root / 'plugins/freelaw-studio'
version = json.loads((plugin / 'plugin.json').read_text())['version']
output = root / 'dist' / f'freelaw-studio-{version}.zip'
output.parent.mkdir(exist_ok=True)
allowed = {'plugin.json', 'mcp.json', '.mcp.json', '.claude-plugin', '.codex-plugin', '.grok-plugin', 'gemini-extension.json', 'GEMINI.md', 'assets', 'skills', 'commands', 'README.md', 'SECURITY.md', 'LICENSE'}
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(plugin.rglob('*')):
        if not file.is_file():
            continue
        relative = file.relative_to(plugin)
        if relative.parts[0] not in allowed:
            continue
        if file.is_symlink() or any(part in {'.env', '.git'} for part in relative.parts):
            raise RuntimeError('Unsafe package input')
        archive.write(file, relative.as_posix())
print(output)
