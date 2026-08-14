(function () {
  const root = document.documentElement;
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.site-nav');
  const themeButton = document.querySelector('.theme-toggle');
  const storedTheme = localStorage.getItem('chaos-theme');

  if (storedTheme) {
    root.dataset.theme = storedTheme;
  }

  if (menuButton && navigation) {
    menuButton.addEventListener('click', function () {
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!isOpen));
      navigation.classList.toggle('is-open', !isOpen);
      document.body.classList.toggle('menu-open', !isOpen);
    });

    navigation.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        menuButton.setAttribute('aria-expanded', 'false');
        navigation.classList.remove('is-open');
        document.body.classList.remove('menu-open');
      });
    });
  }

  if (themeButton) {
    themeButton.addEventListener('click', function () {
      const current = root.dataset.theme;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const next = current ? (current === 'dark' ? 'light' : 'dark') : (prefersDark ? 'light' : 'dark');
      root.dataset.theme = next;
      localStorage.setItem('chaos-theme', next);
    });
  }

  document.querySelectorAll('.post-content a').forEach(function (link) {
    if (link.hostname && link.hostname !== window.location.hostname) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  });
})();
