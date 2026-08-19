(function () {
  const root = document.documentElement;
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.site-nav');
  const themeButton = document.querySelector('.theme-toggle');
  let storedTheme = null;

  try {
    storedTheme = localStorage.getItem('chaos-theme');
  } catch (error) {
    storedTheme = null;
  }

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
      try {
        localStorage.setItem('chaos-theme', next);
      } catch (error) {
        // Theme switching still works when browser storage is unavailable.
      }
    });
  }

  document.querySelectorAll('.post-content a').forEach(function (link) {
    if (link.hostname && link.hostname !== window.location.hostname) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  });

  const fragmentScene = document.querySelector('[data-fragment-scene]');
  const fragmentRegion = document.querySelector('[data-fragment-region]');
  const atlasSandbox = document.querySelector('[data-atlas-sandbox]');
  const atlasMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let atlas = null;

  if ((fragmentScene && fragmentRegion) || atlasSandbox) {
    atlas = makeContourAtlas(getSessionSeed());
  }

  if (fragmentScene && fragmentRegion && atlas) {
    initContourFragments(fragmentScene, fragmentRegion, atlas);
  }

  if (atlasSandbox && atlas) {
    initAtlasSandbox(atlasSandbox, atlas, atlasMotion);
  }

  initAtlasReveals(atlasMotion);
  initCardSurvey(atlas ? atlas.seed : 1);

  function initContourFragments(scene, region, atlasData) {
    const seed = atlasData.seed;
    const random = mulberry32(seed);
    const texture = atlasData.svg;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 801px)');
    const fragments = [];
    const fragmentCount = 12;
    const shapes = [
      'polygon(5% 8%, 92% 0, 100% 72%, 75% 100%, 0 88%)',
      'polygon(0 18%, 83% 0, 100% 24%, 91% 93%, 17% 100%)',
      'polygon(12% 0, 100% 9%, 91% 79%, 57% 100%, 0 82%, 4% 21%)',
      'polygon(0 5%, 79% 0, 100% 63%, 82% 100%, 9% 92%)',
      'polygon(8% 0, 92% 12%, 100% 91%, 34% 100%, 0 69%)'
    ];
    const stateSlots = [
      [0.02, 0.08], [0.32, 0.04], [0.69, 0.09], [0.84, 0.25],
      [0.04, 0.34], [0.38, 0.31], [0.68, 0.39], [0.14, 0.58],
      [0.48, 0.61], [0.79, 0.64], [0.06, 0.82], [0.61, 0.84]
    ];
    let regionWidth = 1;
    let travelHeight = 1;
    let mapWidth = 960;
    let mapHeight = 608;
    let scrollProgress = 0;
    let frameRequested = false;
    let pointerActive = false;
    let pointerX = 0;
    let pointerY = 0;

    scene.style.setProperty('--atlas-texture', 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(texture) + '")');

    const layouts = [0, 1, 2].map(function () {
      return shuffled(stateSlots, random).map(function (slot) {
        return {
          x: clamp(slot[0] + (random() - 0.5) * 0.1, 0, 0.9),
          y: clamp(slot[1] + (random() - 0.5) * 0.08, 0, 0.92),
          rotation: -14 + random() * 28,
          scale: 0.9 + random() * 0.2
        };
      });
    });

    for (let index = 0; index < fragmentCount; index += 1) {
      const element = document.createElement('span');
      const map = document.createElement('span');
      const widthRatio = 0.18 + random() * 0.12;
      const aspectRatio = 0.58 + random() * 0.4;

      element.className = 'map-fragment';
      map.className = 'map-fragment__texture';
      element.appendChild(map);
      scene.appendChild(element);

      fragments.push({
        element: element,
        widthRatio: widthRatio,
        aspectRatio: aspectRatio,
        cropX: random(),
        cropY: random(),
        opacity: 0.42 + random() * 0.22,
        pointerX: 0,
        pointerY: 0,
        pointerRotation: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0
      });

      element.style.setProperty('--fragment-shape', shapes[Math.floor(random() * shapes.length)]);
    }

    scene.classList.add('is-ready');
    measure();
    syncMotionMode();
    window.addEventListener('resize', handleResize, { passive: true });
    addMediaListener(reducedMotion, syncMotionMode);
    addMediaListener(finePointer, syncPointerListener);

    function measure() {
      const regionRect = region.getBoundingClientRect();
      const cards = region.querySelectorAll('.post-card');
      const mobile = window.innerWidth <= 800;
      const lastFirstRowCard = cards.length ? cards[Math.min(mobile ? 0 : 1, cards.length - 1)] : null;
      const hero = region.querySelector('.hero');
      const targetBottom = lastFirstRowCard ? lastFirstRowCard.getBoundingClientRect().bottom : hero.getBoundingClientRect().bottom;

      regionWidth = Math.max(region.clientWidth, 1);
      travelHeight = Math.max(targetBottom - regionRect.top, hero.offsetHeight);
      mapWidth = Math.max(820, Math.min(1320, regionWidth * (mobile ? 2 : 1.22)));
      mapHeight = mapWidth * (760 / 1200);
      scene.style.height = Math.ceil(travelHeight) + 'px';

      fragments.forEach(function (fragment) {
        fragment.width = clamp(regionWidth * fragment.widthRatio * (mobile ? 1.2 : 1), mobile ? 128 : 180, mobile ? 240 : 390);
        fragment.height = fragment.width * fragment.aspectRatio;
        const maxCropX = Math.max(mapWidth - fragment.width, 0);
        const maxCropY = Math.max(mapHeight - fragment.height, 0);

        fragment.element.style.setProperty('--fragment-width', fragment.width.toFixed(1) + 'px');
        fragment.element.style.setProperty('--fragment-height', fragment.height.toFixed(1) + 'px');
        fragment.element.style.setProperty('--fragment-opacity', (fragment.opacity * (mobile ? 0.76 : 1)).toFixed(3));
        fragment.element.style.setProperty('--map-width', mapWidth.toFixed(1) + 'px');
        fragment.element.style.setProperty('--map-height', mapHeight.toFixed(1) + 'px');
        fragment.element.style.setProperty('--map-left', (-fragment.cropX * maxCropX).toFixed(1) + 'px');
        fragment.element.style.setProperty('--map-top', (-fragment.cropY * maxCropY).toFixed(1) + 'px');
      });

      updateScrollProgress();
    }

    function updateScrollProgress() {
      if (reducedMotion.matches) {
        scrollProgress = 0.34;
        return;
      }

      const regionTop = region.getBoundingClientRect().top + window.scrollY;
      const start = Math.max(0, regionTop - window.innerHeight * 0.12);
      const end = Math.max(start + 1, regionTop + travelHeight - window.innerHeight * 0.5);
      scrollProgress = clamp((window.scrollY - start) / (end - start), 0, 1);
    }

    function render() {
      frameRequested = false;
      const segment = scrollProgress < 0.5 ? 0 : 1;
      const localProgress = easeInOut((scrollProgress - segment * 0.5) * 2);
      const fade = scrollProgress > 0.82 ? 1 - (scrollProgress - 0.82) / 0.18 : 1;
      const regionRect = region.getBoundingClientRect();
      let pointerSettling = false;

      scene.style.setProperty('--scene-opacity', clamp(fade, 0, 1).toFixed(3));

      fragments.forEach(function (fragment, index) {
        const from = layouts[segment][index];
        const to = layouts[segment + 1][index];
        const availableX = Math.max(regionWidth - fragment.width, 0);
        const availableY = Math.max(travelHeight - fragment.height, 0);
        const x = lerp(from.x, to.x, localProgress) * availableX;
        const y = lerp(from.y, to.y, localProgress) * availableY;
        const centerX = x + fragment.width / 2;
        const centerY = y + fragment.height / 2;
        let targetPointerX = 0;
        let targetPointerY = 0;
        let targetPointerRotation = 0;

        if (pointerActive && finePointer.matches && !reducedMotion.matches) {
          const localPointerX = pointerX - regionRect.left;
          const localPointerY = pointerY - regionRect.top;
          const dx = centerX - localPointerX;
          const dy = centerY - localPointerY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const radius = 180;

          if (distance < radius) {
            const strength = (1 - distance / radius) * 24;
            const safeDistance = Math.max(distance, 1);
            targetPointerX = dx / safeDistance * strength;
            targetPointerY = dy / safeDistance * strength;
            targetPointerRotation = (dx < 0 ? -1 : 1) * strength / 6;
          }
        }

        fragment.pointerX = lerp(fragment.pointerX, targetPointerX, 0.16);
        fragment.pointerY = lerp(fragment.pointerY, targetPointerY, 0.16);
        fragment.pointerRotation = lerp(fragment.pointerRotation, targetPointerRotation, 0.16);
        pointerSettling = pointerSettling || Math.abs(fragment.pointerX - targetPointerX) > 0.1 || Math.abs(fragment.pointerY - targetPointerY) > 0.1;
        fragment.x = x;
        fragment.y = y;

        fragment.element.style.setProperty('--fragment-x', x.toFixed(2) + 'px');
        fragment.element.style.setProperty('--fragment-y', y.toFixed(2) + 'px');
        fragment.element.style.setProperty('--fragment-rotation', lerp(from.rotation, to.rotation, localProgress).toFixed(2) + 'deg');
        fragment.element.style.setProperty('--fragment-scale', lerp(from.scale, to.scale, localProgress).toFixed(3));
        fragment.element.style.setProperty('--pointer-x', fragment.pointerX.toFixed(2) + 'px');
        fragment.element.style.setProperty('--pointer-y', fragment.pointerY.toFixed(2) + 'px');
        fragment.element.style.setProperty('--pointer-rotation', fragment.pointerRotation.toFixed(2) + 'deg');
      });

      if (pointerSettling) {
        requestFrame();
      }
    }

    function requestFrame() {
      if (!frameRequested) {
        frameRequested = true;
        window.requestAnimationFrame(render);
      }
    }

    function handleScroll() {
      updateScrollProgress();
      requestFrame();
    }

    function handlePointer(event) {
      pointerActive = true;
      pointerX = event.clientX;
      pointerY = event.clientY;
      requestFrame();
    }

    function clearPointer() {
      pointerActive = false;
      requestFrame();
    }

    function handleResize() {
      measure();
      syncPointerListener();
      requestFrame();
    }

    function syncMotionMode() {
      window.removeEventListener('scroll', handleScroll);
      if (!reducedMotion.matches) {
        window.addEventListener('scroll', handleScroll, { passive: true });
      }
      pointerActive = false;
      syncPointerListener();
      updateScrollProgress();
      requestFrame();
    }

    function syncPointerListener() {
      window.removeEventListener('pointermove', handlePointer);
      document.documentElement.removeEventListener('pointerleave', clearPointer);
      if (!reducedMotion.matches && finePointer.matches) {
        window.addEventListener('pointermove', handlePointer, { passive: true });
        document.documentElement.addEventListener('pointerleave', clearPointer, { passive: true });
      } else {
        pointerActive = false;
      }
    }
  }

  function initAtlasReveals(reducedMotion) {
    const elements = Array.from(document.querySelectorAll('[data-atlas-reveal]'));
    let observer = null;

    if (!elements.length) return;

    function syncRevealMode() {
      if (observer) {
        observer.disconnect();
        observer = null;
      }

      if (reducedMotion.matches || !('IntersectionObserver' in window)) {
        root.classList.remove('has-atlas-motion');
        elements.forEach(function (element) {
          element.classList.add('is-revealed');
        });
        return;
      }

      root.classList.add('has-atlas-motion');
      elements.forEach(function (element) {
        element.classList.remove('is-revealed');
      });
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          entry.target.classList.toggle('is-revealed', entry.isIntersecting);
        });
      }, { threshold: 0.32, rootMargin: '0px 0px -8% 0px' });
      elements.forEach(function (element) {
        observer.observe(element);
      });
    }

    syncRevealMode();
    addMediaListener(reducedMotion, syncRevealMode);
  }

  function initCardSurvey(seed) {
    const random = mulberry32(seed ^ 0x51ed270b);
    document.querySelectorAll('[data-card-coordinate]').forEach(function (coordinate) {
      const x = (8 + random() * 84).toFixed(2).padStart(5, '0');
      const y = (8 + random() * 84).toFixed(2).padStart(5, '0');
      coordinate.textContent = x + ' / ' + y;
    });
  }

  function initAtlasSandbox(section, atlasData, reducedMotion) {
    const board = section.querySelector('[data-atlas-board]');
    const shardLayer = section.querySelector('[data-atlas-shards]');
    const probe = section.querySelector('[data-atlas-probe]');
    const measureLine = section.querySelector('[data-atlas-measure]');
    const fieldLabel = section.querySelector('[data-atlas-field]');
    const readoutX = section.querySelector('[data-atlas-x]');
    const readoutY = section.querySelector('[data-atlas-y]');
    const readoutAlt = section.querySelector('[data-atlas-alt]');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 801px)');
    const random = mulberry32(atlasData.seed ^ 0xa5a5a5a5);
    const textureUrl = 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(atlasData.svg) + '")';
    const shapes = [
      'polygon(4% 7%, 91% 0, 100% 76%, 74% 100%, 0 88%)',
      'polygon(0 16%, 86% 0, 100% 31%, 90% 94%, 14% 100%)',
      'polygon(10% 0, 100% 10%, 93% 82%, 55% 100%, 0 79%, 5% 20%)',
      'polygon(0 4%, 80% 0, 100% 64%, 81% 100%, 8% 91%)'
    ];
    const slots = shuffled([
      [0.03, 0.08], [0.34, 0.04], [0.7, 0.1], [0.11, 0.39],
      [0.46, 0.35], [0.74, 0.48], [0.24, 0.7], [0.61, 0.72]
    ], random);
    const waypoints = [[0.14, 0.3], [0.7, 0.24], [0.42, 0.62], [0.78, 0.72], [0.52, 0.48]];
    const shards = [];
    let boardWidth = 1;
    let boardHeight = 1;
    let visibleCount = 8;
    let visible = false;
    let pointerActive = false;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let activeIndex = -1;
    let introStart = 0;
    let mobileStart = 0;
    let frameId = 0;
    let visibilityObserver = null;

    if (!board || !shardLayer || !probe || !measureLine) return;

    section.style.setProperty('--atlas-texture', textureUrl);
    if (fieldLabel) fieldLabel.textContent = String(atlasData.seed >>> 0).padStart(10, '0').slice(-10);

    slots.forEach(function (slot, index) {
      const element = document.createElement('span');
      const texture = document.createElement('span');
      element.className = 'atlas-sandbox__shard';
      element.dataset.sheet = 'F-' + String(index + 1).padStart(2, '0');
      texture.className = 'atlas-sandbox__shard-texture';
      element.appendChild(texture);
      shardLayer.appendChild(element);
      shards.push({
        element: element,
        slot: slot,
        widthRatio: 0.18 + random() * 0.1,
        aspect: 0.55 + random() * 0.32,
        rotation: -10 + random() * 20,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        centerX: 0,
        centerY: 0
      });
      element.style.setProperty('--shard-shape', shapes[Math.floor(random() * shapes.length)]);
    });

    measureBoard();
    syncSandboxMotion();
    window.addEventListener('resize', handleSandboxResize, { passive: true });
    addMediaListener(reducedMotion, syncSandboxMotion);
    addMediaListener(finePointer, syncSandboxInputs);

    if ('IntersectionObserver' in window) {
      visibilityObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          setSandboxVisible(entry.isIntersecting && entry.intersectionRatio >= 0.18);
        });
      }, { threshold: [0, 0.18, 0.45] });
      visibilityObserver.observe(section);
    } else {
      setSandboxVisible(true);
    }

    function measureBoard() {
      const rect = board.getBoundingClientRect();
      const mobile = window.innerWidth <= 800;
      boardWidth = Math.max(rect.width, 1);
      boardHeight = Math.max(rect.height, 1);
      visibleCount = mobile ? 5 : shards.length;

      shards.forEach(function (shard) {
        shard.width = clamp(boardWidth * shard.widthRatio * (mobile ? 1.12 : 1), mobile ? 116 : 170, mobile ? 210 : 330);
        shard.height = shard.width * shard.aspect;
        shard.x = shard.slot[0] * Math.max(boardWidth - shard.width, 0);
        shard.y = shard.slot[1] * Math.max(boardHeight - shard.height, 0);
        shard.centerX = shard.x + shard.width / 2;
        shard.centerY = shard.y + shard.height / 2;
        shard.element.style.setProperty('--shard-x', shard.x.toFixed(1) + 'px');
        shard.element.style.setProperty('--shard-y', shard.y.toFixed(1) + 'px');
        shard.element.style.setProperty('--shard-width', shard.width.toFixed(1) + 'px');
        shard.element.style.setProperty('--shard-height', shard.height.toFixed(1) + 'px');
        shard.element.style.setProperty('--shard-rotation', shard.rotation.toFixed(2) + 'deg');
        shard.element.style.setProperty('--board-width', boardWidth.toFixed(1) + 'px');
        shard.element.style.setProperty('--board-height', boardHeight.toFixed(1) + 'px');
        shard.element.style.setProperty('--shard-map-left', (-shard.x).toFixed(1) + 'px');
        shard.element.style.setProperty('--shard-map-top', (-shard.y).toFixed(1) + 'px');
      });

      currentX = clamp(currentX || boardWidth * 0.08, 0, boardWidth);
      currentY = clamp(currentY || boardHeight * 0.42, 0, boardHeight);
      targetX = clamp(targetX || currentX, 0, boardWidth);
      targetY = clamp(targetY || currentY, 0, boardHeight);
      updateProbe();
    }

    function setSandboxVisible(isVisible) {
      if (reducedMotion.matches) {
        visible = true;
        introStart = 0;
        mobileStart = 0;
        section.classList.add('is-active');
        targetX = currentX = boardWidth * 0.5;
        targetY = currentY = boardHeight * 0.5;
        clearFocus();
        updateProbe();
        return;
      }

      if (visible === isVisible) return;

      visible = isVisible;
      section.classList.toggle('is-active', isVisible);
      pointerActive = false;
      clearFocus();

      if (isVisible) {
        currentX = boardWidth * 0.08;
        currentY = boardHeight * 0.42;
        targetX = currentX;
        targetY = currentY;
        introStart = performance.now();
        mobileStart = introStart;
        requestSandboxFrame();
      } else {
        introStart = 0;
        mobileStart = 0;
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
      }
    }

    function renderSandbox(time) {
      frameId = 0;
      if (!visible || reducedMotion.matches) return;

      let guided = false;
      let keepAnimating = false;

      if (!pointerActive && finePointer.matches && introStart) {
        const progress = clamp((time - introStart) / 1450, 0, 1);
        targetX = lerp(boardWidth * 0.08, boardWidth * 0.5, easeInOut(progress));
        targetY = boardHeight * (0.42 + Math.sin(progress * Math.PI) * 0.08);
        guided = true;
        keepAnimating = progress < 1;
      } else if (!pointerActive && !finePointer.matches && mobileStart) {
        const duration = 5200;
        const progress = clamp((time - mobileStart) / duration, 0, 1);
        const scaled = progress * (waypoints.length - 1);
        const segment = Math.min(Math.floor(scaled), waypoints.length - 2);
        const amount = easeInOut(scaled - segment);
        targetX = lerp(waypoints[segment][0], waypoints[segment + 1][0], amount) * boardWidth;
        targetY = lerp(waypoints[segment][1], waypoints[segment + 1][1], amount) * boardHeight;
        guided = true;
        keepAnimating = progress < 1;
      }

      currentX = lerp(currentX, targetX, 0.18);
      currentY = lerp(currentY, targetY, 0.18);
      keepAnimating = keepAnimating || Math.abs(currentX - targetX) > 0.2 || Math.abs(currentY - targetY) > 0.2;

      if (pointerActive || guided) focusNearestShard(currentX, currentY);
      else clearFocus();
      updateProbe();

      if (keepAnimating) requestSandboxFrame();
    }

    function focusNearestShard(x, y) {
      let nearestIndex = -1;
      let nearestDistance = Infinity;
      const radius = Math.max(220, boardWidth * 0.28);

      for (let index = 0; index < visibleCount; index += 1) {
        const shard = shards[index];
        const dx = shard.centerX - x;
        const dy = shard.centerY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < nearestDistance && distance < radius) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      }

      setFocusedShard(nearestIndex);
    }

    function setFocusedShard(index) {
      if (activeIndex === index) return;
      activeIndex = index;
      board.classList.toggle('has-focus', index >= 0);
      shards.forEach(function (shard, shardIndex) {
        shard.element.classList.toggle('is-focused', shardIndex === index);
      });
    }

    function clearFocus() {
      setFocusedShard(-1);
    }

    function updateProbe() {
      const normalizedX = clamp(currentX / boardWidth, 0, 1);
      const normalizedY = clamp(currentY / boardHeight, 0, 1);
      const altitude = Math.round(atlasData.sample(normalizedX, normalizedY) * 2400);
      probe.style.setProperty('--probe-x', currentX.toFixed(1) + 'px');
      probe.style.setProperty('--probe-y', currentY.toFixed(1) + 'px');

      if (readoutX) readoutX.textContent = (normalizedX * 100).toFixed(2).padStart(6, '0');
      if (readoutY) readoutY.textContent = (normalizedY * 100).toFixed(2).padStart(6, '0');
      if (readoutAlt) readoutAlt.textContent = String(altitude).padStart(4, '0');

      if (activeIndex >= 0) {
        const shard = shards[activeIndex];
        const dx = shard.centerX - currentX;
        const dy = shard.centerY - currentY;
        measureLine.style.setProperty('--measure-x', currentX.toFixed(1) + 'px');
        measureLine.style.setProperty('--measure-y', currentY.toFixed(1) + 'px');
        measureLine.style.setProperty('--measure-length', Math.sqrt(dx * dx + dy * dy).toFixed(1) + 'px');
        measureLine.style.setProperty('--measure-angle', (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(2) + 'deg');
      }
    }

    function handleSandboxPointer(event) {
      if (!visible || reducedMotion.matches || !finePointer.matches) return;
      const rect = board.getBoundingClientRect();
      pointerActive = true;
      introStart = 0;
      targetX = clamp(event.clientX - rect.left, 0, boardWidth);
      targetY = clamp(event.clientY - rect.top, 0, boardHeight);
      requestSandboxFrame();
    }

    function handleSandboxLeave() {
      if (reducedMotion.matches) return;
      pointerActive = false;
      introStart = 0;
      targetX = boardWidth * 0.5;
      targetY = boardHeight * 0.5;
      clearFocus();
      requestSandboxFrame();
    }

    function requestSandboxFrame() {
      if (visible && !frameId) frameId = requestAnimationFrame(renderSandbox);
    }

    function handleSandboxResize() {
      measureBoard();
      requestSandboxFrame();
    }

    function syncSandboxInputs() {
      board.removeEventListener('pointermove', handleSandboxPointer);
      board.removeEventListener('pointerleave', handleSandboxLeave);
      if (!reducedMotion.matches && finePointer.matches) {
        board.addEventListener('pointermove', handleSandboxPointer, { passive: true });
        board.addEventListener('pointerleave', handleSandboxLeave, { passive: true });
      }
    }

    function syncSandboxMotion() {
      syncSandboxInputs();
      if (reducedMotion.matches) {
        setSandboxVisible(true);
      } else {
        const rect = section.getBoundingClientRect();
        const shouldBeVisible = rect.bottom > window.innerHeight * 0.18 && rect.top < window.innerHeight * 0.82;
        if (shouldBeVisible && visible && !introStart) visible = false;
        setSandboxVisible(shouldBeVisible);
      }
    }
  }

  function getSessionSeed() {
    const key = 'chaos-contour-seed-v1';
    let seed = 0;

    try {
      seed = Number(sessionStorage.getItem(key)) >>> 0;
    } catch (error) {
      seed = 0;
    }

    if (!seed) {
      if (window.crypto && window.crypto.getRandomValues) {
        const values = new Uint32Array(1);
        window.crypto.getRandomValues(values);
        seed = values[0] || 1;
      } else {
        seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
      }

      try {
        sessionStorage.setItem(key, String(seed));
      } catch (error) {
        // The in-memory seed still gives this page a stable composition.
      }
    }

    return seed;
  }

  function makeContourAtlas(seed) {
    const random = mulberry32(seed ^ 0x9e3779b9);
    const width = 1200;
    const height = 760;
    const columns = 56;
    const rows = 38;
    const hills = [];
    const values = [];
    let minimum = Infinity;
    let maximum = -Infinity;

    for (let index = 0; index < 11; index += 1) {
      hills.push({
        x: random(),
        y: random(),
        radius: 0.08 + random() * 0.22,
        strength: (index > 7 && random() > 0.5 ? -0.45 : 0.4) + random() * 0.85
      });
    }

    for (let row = 0; row <= rows; row += 1) {
      values[row] = [];
      for (let column = 0; column <= columns; column += 1) {
        const x = column / columns;
        const y = row / rows;
        const warpedX = x + Math.sin((y * 5.3 + x * 1.7) * Math.PI) * 0.035 + Math.sin(y * 13.1 * Math.PI) * 0.012;
        const warpedY = y + Math.sin((x * 4.7 - y * 1.3) * Math.PI) * 0.04 + Math.cos(x * 11.7 * Math.PI) * 0.014;
        let value = Math.sin((warpedX * 2.7 + warpedY * 0.9) * Math.PI) * 0.09;

        hills.forEach(function (hill) {
          const dx = warpedX - hill.x;
          const dy = warpedY - hill.y;
          value += hill.strength * Math.exp(-(dx * dx + dy * dy) / (2 * hill.radius * hill.radius));
        });

        value += Math.sin((warpedX * 8.1 - warpedY * 5.7) * Math.PI) * 0.045;
        value += Math.cos((warpedX * 15.2 + warpedY * 10.6) * Math.PI) * 0.018;
        value += Math.sin((warpedX * 23.4 - warpedY * 17.8) * Math.PI) * 0.009;
        values[row][column] = value;
        minimum = Math.min(minimum, value);
        maximum = Math.max(maximum, value);
      }
    }

    values.forEach(function (row) {
      row.forEach(function (value, column) {
        row[column] = (value - minimum) / Math.max(maximum - minimum, 0.001);
      });
    });

    const levels = [0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9];
    const contours = levels.map(function (level, index) {
      const segments = contourSegments(values, columns, rows, width, height, level);
      return '<path d="' + segments + '" fill="none" stroke="white" stroke-width="' + (index % 3 === 0 ? '2' : '1.15') + '" opacity="' + (index % 3 === 0 ? '0.94' : '0.68') + '"/>';
    }).join('');
    const label = String(seed >>> 0).padStart(10, '0').slice(-10);

    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760">' +
      '<g fill="none" stroke="white" opacity="0.18" stroke-width="1">' +
      '<path d="M0 152H1200M0 304H1200M0 456H1200M0 608H1200M240 0V760M480 0V760M720 0V760M960 0V760"/>' +
      '</g>' + contours +
      '<g fill="white" opacity="0.65" font-family="monospace" font-size="15" letter-spacing="3">' +
      '<text x="32" y="42">FIELD / ' + label + '</text><text x="982" y="724">ALT 001—∞</text>' +
      '</g></svg>';

    return {
      seed: seed,
      svg: svg,
      sample: function (normalizedX, normalizedY) {
        const gridX = clamp(normalizedX, 0, 1) * columns;
        const gridY = clamp(normalizedY, 0, 1) * rows;
        const left = Math.min(Math.floor(gridX), columns - 1);
        const top = Math.min(Math.floor(gridY), rows - 1);
        const amountX = gridX - left;
        const amountY = gridY - top;
        const upper = lerp(values[top][left], values[top][left + 1], amountX);
        const lower = lerp(values[top + 1][left], values[top + 1][left + 1], amountX);
        return lerp(upper, lower, amountY);
      }
    };
  }

  function contourSegments(values, columns, rows, width, height, level) {
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    const lookup = {
      1: [['left', 'top']], 2: [['top', 'right']], 3: [['left', 'right']],
      4: [['right', 'bottom']], 5: [['left', 'bottom'], ['top', 'right']],
      6: [['top', 'bottom']], 7: [['left', 'bottom']], 8: [['bottom', 'left']],
      9: [['top', 'bottom']], 10: [['top', 'left'], ['right', 'bottom']],
      11: [['right', 'bottom']], 12: [['left', 'right']], 13: [['top', 'right']],
      14: [['left', 'top']]
    };
    let path = '';

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const corners = [
          values[row][column], values[row][column + 1],
          values[row + 1][column + 1], values[row + 1][column]
        ];
        const state = (corners[0] >= level ? 1 : 0) |
          (corners[1] >= level ? 2 : 0) |
          (corners[2] >= level ? 4 : 0) |
          (corners[3] >= level ? 8 : 0);
        const segments = lookup[state] || [];
        const x = column * cellWidth;
        const y = row * cellHeight;

        segments.forEach(function (segment) {
          const start = edgePoint(segment[0], corners, level, x, y, cellWidth, cellHeight);
          const end = edgePoint(segment[1], corners, level, x, y, cellWidth, cellHeight);
          path += 'M' + start[0].toFixed(1) + ' ' + start[1].toFixed(1) + 'L' + end[0].toFixed(1) + ' ' + end[1].toFixed(1);
        });
      }
    }

    return path;
  }

  function edgePoint(edge, corners, level, x, y, cellWidth, cellHeight) {
    function ratio(from, to) {
      return clamp((level - from) / ((to - from) || 0.0001), 0, 1);
    }

    if (edge === 'top') return [x + ratio(corners[0], corners[1]) * cellWidth, y];
    if (edge === 'right') return [x + cellWidth, y + ratio(corners[1], corners[2]) * cellHeight];
    if (edge === 'bottom') return [x + ratio(corners[3], corners[2]) * cellWidth, y + cellHeight];
    return [x, y + ratio(corners[0], corners[3]) * cellHeight];
  }

  function mulberry32(seed) {
    return function () {
      let value = seed += 0x6d2b79f5;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffled(items, random) {
    const copy = items.slice();
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      const item = copy[index];
      copy[index] = copy[target];
      copy[target] = item;
    }
    return copy;
  }

  function addMediaListener(query, listener) {
    if (query.addEventListener) query.addEventListener('change', listener);
    else query.addListener(listener);
  }

  function easeInOut(value) {
    return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
  }

  function lerp(from, to, amount) {
    return from + (to - from) * amount;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), maximum);
  }
})();
