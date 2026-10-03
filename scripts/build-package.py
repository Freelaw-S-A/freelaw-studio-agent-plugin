from pathlib import Path
from datetime import datetime, timezone
import json
import os
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
subprocess.run(['bun', 'scripts/validate-release.mjs'], cwd=root, check=True)
plugin = root / 'plugins/freelaw-studio'
version = json.loads((plugin / 'plugin.json').read_text())['version']
output_dir = Path(os.environ.get('FREELAW_PLUGIN_DIST_DIR', root / 'dist')).expanduser().resolve()
output = output_dir / f'freelaw-studio-{version}.zip'
output.parent.mkdir(exist_ok=True)
allowed = {'plugin.json', 'mcp.json', '.mcp.json', '.claude-plugin', '.codex-plugin', '.grok-plugin', 'gemini-extension.json', 'GEMINI.md', 'assets', 'skills', 'commands', 'README.md', 'SECURITY.md', 'LICENSE'}
source_epoch = int(os.environ.get('SOURCE_DATE_EPOCH') or subprocess.check_output(
    ['git', 'show', '-s', '--format=%ct', 'HEAD'], cwd=root, text=True
).strip())
archive_time = datetime.fromtimestamp(max(source_epoch, 315532800), timezone.utc)
date_time = (archive_time.year, archive_time.month, archive_time.day, archive_time.hour, archive_time.minute, archive_time.second)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(plugin.rglob('*')):
        if not file.is_file():
            continue
        relative = file.relative_to(plugin)
        if relative.parts[0] not in allowed:
            continue
        if file.is_symlink() or any(part in {'.env', '.git'} for part in relative.parts):
            raise RuntimeError('Unsafe package input')
        info = zipfile.ZipInfo(relative.as_posix(), date_time=date_time)
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, file.read_bytes())
print(output)
