"""Exercise draft policy against a disposable Git index, never the working repository."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='draft-policy-') as directory:
    repo = Path(directory)
    subprocess.run(['git', 'init', '-q', str(repo)], check=True)
    def git(*args):
        return subprocess.run(['git', '-C', str(repo), *args], check=True, capture_output=True)
    def policy(command, expected=0):
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/drafts.py'), command], cwd=repo, capture_output=True)
        assert result.returncode == expected, result.stderr.decode()
        return result
    git('config', 'user.name', 'Fixture')
    git('config', 'user.email', 'fixture@example.invalid')
    article = repo / 'content/writing/private [1].md'
    article.parent.mkdir(parents=True)
    published = b'+++\ntitle = "Fixture"\ndraft = false\n+++\nOriginal body\n'
    draft = published.replace(b'false', b'true')
    article.write_bytes(published)
    git('add', '.')
    git('commit', '-qm', 'Published fixture')
    article.write_bytes(draft)
    git('add', '.')
    article.write_bytes(published)
    # Index, not working tree, determines what would be committed.
    policy('check', 1)
    article.write_bytes(draft)
    policy('sync')
    assert article.read_bytes() == draft
    assert not git('ls-files', '--', str(article)).stdout
    git('check-ignore', str(article))  # Spaces and glob characters are literal.
    policy('check')
    # Publishing removes the managed local exclusion without staging the file.
    article.write_bytes(published)
    policy('sync')
    result = subprocess.run(['git', '-C', str(repo), 'check-ignore', str(article)], capture_output=True)
    assert result.returncode == 1
    assert not git('ls-files', '--', str(article)).stdout
    # Forced staging still fails the actual hook.
    article.write_bytes(draft)
    git('add', '-f', str(article))
    (repo / 'scripts').mkdir()
    shutil.copy(ROOT / 'scripts/drafts.py', repo / 'scripts/drafts.py')
    shutil.copytree(ROOT / '.githooks', repo / '.githooks')
    git('config', 'core.hooksPath', '.githooks')
    result = subprocess.run(['git', '-C', str(repo), 'commit', '-qm', 'Must fail'], capture_output=True)
    assert result.returncode != 0 and b'Drafts are present' in result.stderr
    # Sync must not discard a different staged edit.
    article.write_bytes(draft + b'Unstaged addition\n')
    policy('sync', 1)
    assert git('show', ':content/writing/private [1].md').stdout == draft
    assert article.read_bytes() == draft + b'Unstaged addition\n'
print('PASS: staged draft detection, local file preservation, literal ignores, publishing, commit hook, staged edit protection')
