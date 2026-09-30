from argparse import ArgumentParser
from pathlib import Path
import json
import re


def update_catalog(catalog_path: Path, entry_path: Path) -> None:
    catalog = json.loads(catalog_path.read_text())
    entry = json.loads(entry_path.read_text())
    sha = entry.get("source", {}).get("sha", "")
    if not re.fullmatch(r"[a-f0-9]{40}", sha):
        raise ValueError("Grok catalog source must use a full lowercase commit SHA")
    plugins = catalog.get("plugins")
    if not isinstance(plugins, list):
        raise ValueError("Grok marketplace catalog has no plugins array")
    indexes = [index for index, plugin in enumerate(plugins) if plugin.get("name") == entry["name"]]
    if len(indexes) > 1:
        raise ValueError("Grok marketplace catalog contains duplicate plugin entries")
    if indexes:
        plugins[indexes[0]] = entry
    else:
        plugins.append(entry)
    plugins.sort(key=lambda plugin: plugin.get("name", ""))
    catalog_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    parser = ArgumentParser()
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--entry", type=Path, required=True)
    arguments = parser.parse_args()
    update_catalog(arguments.catalog, arguments.entry)
