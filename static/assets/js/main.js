(function () {
  const root = document.documentElement;
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.site-nav');
  const themeButton = document.querySelector('.theme-toggle');
  if (menuButton && navigation) {
    const mobileMenu = window.matchMedia('(max-width: 800px)');
    const background = [document.querySelector('main'), document.querySelector('.site-footer'), document.querySelector('.site-logo')].filter(Boolean);
    const links = Array.from(navigation.querySelectorAll('a'));

    function setMenu(open, restoreFocus) {
      open = open && mobileMenu.matches;
      menuButton.setAttribute('aria-expanded', String(open));
      navigation.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      background.forEach(function (element) { element.inert = open; });
      if (open && links.length) {
        requestAnimationFrame(function () {
          if (menuButton.getAttribute('aria-expanded') === 'true') links[0].focus();
        });
      }
      else if (restoreFocus) menuButton.focus();
    }

    menuButton.addEventListener('click', function () {
      setMenu(menuButton.getAttribute('aria-expanded') !== 'true', true);
    });
    links.forEach(function (link) {
      link.addEventListener('click', function () { setMenu(false, false); });
    });
    document.addEventListener('keydown', function (event) {
      if (menuButton.getAttribute('aria-expanded') !== 'true') return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setMenu(false, true);
      } else if (event.key === 'Tab') {
        const stops = [menuButton].concat(links);
        const index = stops.indexOf(document.activeElement);
        const next = event.shiftKey ? index - 1 : index + 1;
        if (next < 0 || next >= stops.length || index === -1) {
          event.preventDefault();
          stops[event.shiftKey ? stops.length - 1 : 0].focus();
        }
      }
    });
    addMediaListener(mobileMenu, function () {
      const wasOpen = menuButton.getAttribute('aria-expanded') === 'true';
      setMenu(false, false);
      if (wasOpen && !mobileMenu.matches && links.length) links[0].focus();
      else if (mobileMenu.matches && navigation.contains(document.activeElement)) menuButton.focus();
    });
    root.classList.add('has-menu');
  }

  if (themeButton) {
    themeButton.addEventListener('click', function () {
      const current = root.dataset.theme;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const next = current ? (current === 'dark' ? 'light' : 'dark') : (prefersDark ? 'light' : 'dark');
      root.dataset.theme = next;
      try {
        localStorage.setItem('chaos-theme', next);
      } catch (error) {
        // Theme switching still works when browser storage is unavailable.
      }
    });
  }

  document.querySelectorAll('.post-content table').forEach(function (table, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    wrapper.tabIndex = 0;
    wrapper.setAttribute('role', 'region');
    wrapper.setAttribute('aria-label', 'Table ' + (index + 1) + ' — scroll horizontally');
    table.before(wrapper);
    wrapper.appendChild(table);
  });

  const quietButton = document.querySelector('.quiet-toggle');
  if (quietButton) {
    function syncQuietButton() {
      quietButton.setAttribute('aria-pressed', String(root.dataset.atlasMode === 'quiet'));
    }
    syncQuietButton();
    quietButton.hidden = false;
    quietButton.addEventListener('click', function () {
      root.dataset.atlasMode = root.dataset.atlasMode === 'quiet' ? 'live' : 'quiet';
      try { localStorage.setItem('atlas-mode', root.dataset.atlasMode); } catch (error) { /* Optional preference. */ }
      syncQuietButton();
      document.dispatchEvent(new Event('atlas-mode-change'));
    });
  }

  function addMediaListener(query, listener) {
    if (query.addEventListener) query.addEventListener('change', listener);
    else query.addListener(listener);
  }
})();
