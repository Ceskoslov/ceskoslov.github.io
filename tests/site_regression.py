"""Build a disposable site and verify publishing boundaries and public HTML."""
from html.parser import HTMLParser
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


class Head(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.meta = {}
        self.links = {}
        self.language = None
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            self.meta[attrs.get('name', attrs.get('property'))] = attrs.get('content')
        if tag == 'link':
            self.links[attrs.get('rel')] = attrs.get('href')
        if tag == 'html':
            self.language = attrs.get('lang')


with tempfile.TemporaryDirectory(prefix='atlas-regression-') as directory:
    site = Path(directory)
    for name in ('templates', 'content', 'static'):
        shutil.copytree(ROOT / name, site / name)
    shutil.copy(ROOT / 'zola.toml', site / 'zola.toml')
    writing = site / 'content/writing'
    for date in ('2025-12-31', '2026-01-01', '2026-10-01', '2026-11-01', '2026-12-01'):
        (writing / f'fixture-{date}.md').write_text(
            f'+++\ntitle = "Fixture {date}"\ndate = {date}\n+++\nTest.\n')
    (writing / 'fixture-draft.md').write_text(
        '+++\ntitle = "Hidden fixture"\ndate = 2026-09-21\ndraft = true\n+++' )
    (writing / 'fixture.md:Zone.Identifier').write_text('Must not be published')
    (writing / 'fixture-language.md').write_text('''+++
title = "中文测试"
date = 2026-09-21
updated = 2026-09-22
[extra]
language = "zh-CN"
social_image = "assets/images/social-card.png"
social_image_alt = "Custom sharing image"
+++
## One
Text.
## Two
Text.
## Three
Text.
''')
    subprocess.run(['zola', '--root', str(site), 'check', '--skip-external-links'], check=True)
    subprocess.run(['zola', '--root', str(site), 'build'], check=True)
    public = site / 'public'
    for route in ('index.html', 'writing/index.html', 'archive/index.html', 'tags/index.html', 'about/index.html'):
        html = (public / route).read_text()
        assert 'Welcome to Zola!' not in html, route
        assert Head(html).links.get('canonical'), route
    archive = (public / 'archive/index.html').read_text()
    dates = re.findall(r'<time datetime=["\']?([0-9-]{10})', archive)
    assert dates == sorted(dates, reverse=True), dates
    assert not list(public.rglob('*:Zone.Identifier'))
    assert not (public / 'writing/fixture-draft/index.html').exists()
    for path in public.rglob('*.xml'):
        assert 'fixture-draft' not in path.read_text(), path
    for route in ('index.html', 'writing/index.html', 'archive/index.html'):
        assert 'Hidden fixture' not in (public / route).read_text()
    home = (public / 'index.html').read_text()
    assert len(re.findall(r'<article class=["\']?post-card', home)) == 6
    article = (public / 'writing/fixture-language/index.html').read_text()
    head = Head(article)
    assert head.language == 'zh-CN'
    assert head.meta['og:image:alt'] == 'Custom sharing image'
    assert head.meta['article:modified_time'].startswith('2026-09-22')
    assert 'post-toc' in article
    for path in (public / 'tags').glob('*/index.html'):
        html = path.read_text()
        assert Head(html).meta['og:title'] == re.search(r'<title>(.*?)</title>', html).group(1)
    entries = ET.parse(public / 'atom.xml').findall('{http://www.w3.org/2005/Atom}entry')
    assert len(entries) > 6  # Home is capped, subscription remains complete.
    print('PASS: public routes, cross-year/month ordering, draft/metadata exclusion, language, sharing, feed completeness')
