#!/usr/bin/env python3
"""Keep TOML-marked drafts local; inspect the Git index before committing."""
import argparse
from pathlib import Path
import subprocess
import sys
import tomllib

START = '# BEGIN local draft exclusions (scripts/drafts.py)'
END = '# END local draft exclusions'


def git(*args):
    return subprocess.check_output(['git', *args])


def is_draft(source):
    lines = source.decode('utf-8-sig').splitlines()
    if not lines or lines[0].strip() != '+++':
        return False
    try:
        end = next(i for i, line in enumerate(lines[1:], 1) if line.strip() == '+++')
    except StopIteration:
        raise ValueError('Unclosed TOML front matter') from None
    return tomllib.loads('\n'.join(lines[1:end])).get('draft') is True


def indexed_paths():
    return [name.decode() for name in git('ls-files', '-z', '--', 'content').split(b'\0') if name.endswith(b'.md')]


def check():
    rejected = []
    for name in indexed_paths():
        try:
            if is_draft(git('show', ':' + name)):
                rejected.append(name)
        except (ValueError, UnicodeError) as error:
            print(f'Cannot validate {name}: {error}', file=sys.stderr)
            return 1
    if rejected:
        print('Drafts are present in the Git index:', file=sys.stderr)
        for name in rejected:
            print('  ' + name, file=sys.stderr)
        print('Run python3 scripts/drafts.py sync to keep them local, then commit again.', file=sys.stderr)
        return 1
    print('PASS: no draft=true Markdown files in the Git index')
    return 0


def ignore_path(name):
    # Literal anchored gitignore pattern (including unusual filenames).
    return '/' + ''.join('\\' + c if c in '\\*?[] !#' else c for c in name)


def sync():
    drafts = sorted(p.as_posix() for p in Path('content').rglob('*.md') if is_draft(p.read_bytes()))
    if any('\n' in name or '\r' in name for name in drafts):
        raise ValueError('Draft filenames containing newlines are unsupported')
    tracked = set(indexed_paths())
    # --cached preserves local files; omit --force to protect staged edits.
    removals = [name for name in drafts if name in tracked]
    if removals:
        subprocess.run(['git', 'rm', '--cached', '--', *removals], check=True)
    exclude = Path(git('rev-parse', '--git-path', 'info/exclude').decode().strip())
    content = exclude.read_text() if exclude.exists() else ''
    if START in content:
        before, tail = content.split(START, 1)
        if END not in tail:
            raise ValueError('Unclosed managed draft exclusions block')
        content = before + tail.split(END, 1)[1]
    exclude.parent.mkdir(parents=True, exist_ok=True)
    exclude.write_text(content.rstrip() + '\n\n' + START + '\n' + '\n'.join(ignore_path(p) for p in drafts) + '\n' + END + '\n')
    print(f'{len(drafts)} local draft(s) ignored; {len(removals)} removed from the index. Markdown files preserved.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('check', 'sync'))
    args = parser.parse_args()
    root = git('rev-parse', '--show-toplevel').decode().strip()
    import os
    os.chdir(root)
    try:
        if args.command == 'check':
            sys.exit(check())
        sync()
    except (ValueError, UnicodeError, subprocess.CalledProcessError) as error:
        print(error, file=sys.stderr)
        sys.exit(1)
