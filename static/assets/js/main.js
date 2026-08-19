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
    const canvas = scene.querySelector('[data-fragment-canvas]');
    const hero = region.querySelector('.hero');
    const context = canvas ? canvas.getContext('2d') : null;
    const renderer = createAtlasHeatRenderer(atlasData);
    const random = mulberry32(atlasData.seed ^ 0x7f4a7c15);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 801px)');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const slots = shuffled([
      [0.02, 0.08], [0.3, 0.04], [0.66, 0.07], [0.82, 0.2],
      [0.05, 0.34], [0.35, 0.3], [0.68, 0.39], [0.12, 0.57],
      [0.46, 0.59], [0.78, 0.63], [0.05, 0.8], [0.6, 0.82]
    ], random);
    const shapes = [
      [[0.05, 0.08], [0.72, 0], [0.98, 0.18], [1, 0.75], [0.72, 1], [0, 0.88]],
      [[0, 0.16], [0.62, 0], [1, 0.3], [0.91, 0.94], [0.2, 1], [0.04, 0.64]],
      [[0.1, 0], [0.76, 0.08], [1, 0.48], [0.88, 0.9], [0.54, 1], [0, 0.78]],
      [[0, 0.05], [0.8, 0], [1, 0.64], [0.81, 1], [0.12, 0.91], [0.02, 0.42]]
    ];
    const rectangle = [[0, 0], [0.5, 0], [1, 0], [1, 1], [0.5, 1], [0, 1]];
    const fragments = slots.map(function (slot, index) {
      return {
        slot: slot,
        column: index % 4,
        row: Math.floor(index / 4),
        scale: 0.58 + random() * 0.36,
        rotation: -13 + random() * 26,
        shape: shapes[Math.floor(random() * shapes.length)]
      };
    });
    let width = 1;
    let height = 1;
    let scrollProgress = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let motionEnergy = 0;
    let heatEnergy = 0;
    let phase = 0;
    let lastPointerTime = 0;
    let pointerActive = false;
    let frameId = 0;
    let heatDirty = true;

    if (!canvas || !hero || !context) return;

    measure();
    syncMotionMode();
    scene.classList.add('is-ready');
    window.addEventListener('resize', handleResize, { passive: true });
    addMediaListener(reducedMotion, syncMotionMode);
    addMediaListener(finePointer, syncPointerMode);
    addMediaListener(systemTheme, refreshColors);
    if ('MutationObserver' in window) {
      new MutationObserver(refreshColors).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }

    function measure() {
      const ratio = window.devicePixelRatio || 1;
      width = Math.max(scene.clientWidth, 1);
      height = Math.max(hero.offsetHeight, 1);
      scene.style.height = Math.ceil(height) + 'px';
      canvas.width = Math.max(Math.round(width * ratio), 1);
      canvas.height = Math.max(Math.round(height * ratio), 1);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      renderer.resize(width, height, ratio);
      currentX = targetX = width * 0.5;
      currentY = targetY = height * 0.44;
      heatDirty = true;
      updateScrollProgress();
      renderHeat();
      drawFragments();
    }

    function updateScrollProgress() {
      if (reducedMotion.matches) {
        scrollProgress = 0.22;
        return;
      }
      const regionTop = region.getBoundingClientRect().top + window.scrollY;
      scrollProgress = clamp((window.scrollY - regionTop) / Math.max(height * 0.78, 1), 0, 1);
    }

    function renderHeat() {
      renderer.render(currentX, currentY, heatEnergy, phase);
      heatDirty = false;
    }

    function drawFragments() {
      const progress = easeInOut(scrollProgress);
      const tileWidth = width / 4;
      const tileHeight = height / 3;
      const restingWidth = Math.min(width * (width > 900 ? 0.8 : 0.94), 1360);
      const restingHeight = Math.min(height * 0.84, restingWidth * 0.625);
      const restingLeft = (width - restingWidth) / 2;
      const restingTop = (height - restingHeight) / 2;
      const restingTileWidth = restingWidth / 4;
      const restingTileHeight = restingHeight / 3;
      context.clearRect(0, 0, width, height);

      fragments.forEach(function (fragment) {
        const endX = fragment.column * tileWidth;
        const endY = fragment.row * tileHeight;
        const endCenterX = endX + tileWidth / 2;
        const endCenterY = endY + tileHeight / 2;
        const startWidth = restingTileWidth * fragment.scale;
        const startHeight = restingTileHeight * fragment.scale;
        const startCenterX = restingLeft + fragment.slot[0] * Math.max(restingWidth - startWidth, 0) + startWidth / 2;
        const startCenterY = restingTop + fragment.slot[1] * Math.max(restingHeight - startHeight, 0) + startHeight / 2;
        const currentWidth = lerp(startWidth, tileWidth, progress);
        const currentHeight = lerp(startHeight, tileHeight, progress);
        const currentCenterX = lerp(startCenterX, endCenterX, progress);
        const currentCenterY = lerp(startCenterY, endCenterY, progress);

        context.save();
        context.translate(currentCenterX, currentCenterY);
        context.rotate(lerp(fragment.rotation, 0, progress) * Math.PI / 180);
        context.scale(currentWidth / tileWidth, currentHeight / tileHeight);
        context.beginPath();
        fragment.shape.forEach(function (point, index) {
          const x = lerp(point[0], rectangle[index][0], progress) * tileWidth - tileWidth / 2;
          const y = lerp(point[1], rectangle[index][1], progress) * tileHeight - tileHeight / 2;
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.closePath();
        context.clip();
        context.globalAlpha = lerp(0.58, 0.94, progress);
        renderer.drawTo(context, width, height, -endCenterX, -endCenterY);
        context.restore();
      });
    }

    function renderFrame(time) {
      frameId = 0;
      const desiredEnergy = pointerActive ? Math.max(0.12, motionEnergy) : 0;
      currentX = lerp(currentX, targetX, 0.16);
      currentY = lerp(currentY, targetY, 0.16);
      motionEnergy *= 0.86;
      heatEnergy = lerp(heatEnergy, desiredEnergy, 0.14);
      phase += heatEnergy * 0.18;
      const needsAnotherFrame =
        Math.abs(currentX - targetX) > 0.2 ||
        Math.abs(currentY - targetY) > 0.2 ||
        Math.abs(heatEnergy - desiredEnergy) > 0.003 ||
        motionEnergy > 0.01;

      if (heatDirty || needsAnotherFrame) {
        renderHeat();
      }
      drawFragments();
      if (needsAnotherFrame || heatDirty) requestFrame();
    }

    function handleScroll() {
      updateScrollProgress();
      drawFragments();
    }

    function handlePointer(event) {
      if (reducedMotion.matches || !finePointer.matches) return;
      const rect = scene.getBoundingClientRect();
      if (event.clientY < rect.top || event.clientY > rect.bottom) {
        if (pointerActive) clearPointer();
        return;
      }
      const now = performance.now();
      const nextX = clamp(event.clientX - rect.left, 0, width);
      const nextY = clamp(event.clientY - rect.top, 0, height);
      const elapsed = Math.max(now - lastPointerTime, 16);
      const distance = Math.sqrt(Math.pow(nextX - targetX, 2) + Math.pow(nextY - targetY, 2));
      pointerActive = true;
      motionEnergy = Math.max(motionEnergy, clamp(distance / elapsed / 1.2, 0.16, 0.9));
      targetX = nextX;
      targetY = nextY;
      lastPointerTime = now;
      heatDirty = true;
      requestFrame();
    }

    function clearPointer() {
      pointerActive = false;
      motionEnergy = 0;
      targetX = width * 0.5;
      targetY = height * 0.44;
      heatDirty = true;
      requestFrame();
    }

    function requestFrame() {
      if (!frameId) frameId = requestAnimationFrame(renderFrame);
    }

    function handleResize() {
      measure();
      syncPointerMode();
    }

    function refreshColors() {
      renderer.refreshPalette();
      heatDirty = true;
      renderHeat();
      drawFragments();
    }

    function syncMotionMode() {
      window.removeEventListener('scroll', handleScroll);
      if (!reducedMotion.matches) window.addEventListener('scroll', handleScroll, { passive: true });
      syncPointerMode();
      updateScrollProgress();
      heatEnergy = 0;
      heatDirty = true;
      renderHeat();
      drawFragments();
    }

    function syncPointerMode() {
      window.removeEventListener('pointermove', handlePointer);
      document.documentElement.removeEventListener('pointerleave', clearPointer);
      if (!reducedMotion.matches && finePointer.matches) {
        window.addEventListener('pointermove', handlePointer, { passive: true });
        document.documentElement.addEventListener('pointerleave', clearPointer, { passive: true });
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
    const canvas = section.querySelector('[data-atlas-heat]');
    const probe = section.querySelector('[data-atlas-probe]');
    const fieldLabel = section.querySelector('[data-atlas-field]');
    const readoutX = section.querySelector('[data-atlas-x]');
    const readoutY = section.querySelector('[data-atlas-y]');
    const readoutAlt = section.querySelector('[data-atlas-alt]');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 801px)');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const waypoints = [[0.14, 0.3], [0.7, 0.24], [0.42, 0.62], [0.78, 0.72], [0.52, 0.48]];
    const renderer = createAtlasHeatRenderer(atlasData, canvas);
    let boardWidth = 1;
    let boardHeight = 1;
    let visible = false;
    let pointerActive = false;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let motionEnergy = 0;
    let heatEnergy = 0;
    let phase = 0;
    let lastPointerTime = 0;
    let introStart = 0;
    let mobileStart = 0;
    let frameId = 0;

    if (!board || !canvas || !probe) return;
    if (fieldLabel) fieldLabel.textContent = String(atlasData.seed >>> 0).padStart(10, '0').slice(-10);

    measureBoard();
    syncSandboxMotion();
    window.addEventListener('resize', handleSandboxResize, { passive: true });
    addMediaListener(reducedMotion, syncSandboxMotion);
    addMediaListener(finePointer, syncSandboxInputs);
    addMediaListener(systemTheme, refreshPalette);
    if ('MutationObserver' in window) {
      new MutationObserver(refreshPalette).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }

    if ('IntersectionObserver' in window) {
      const visibilityObserver = new IntersectionObserver(function (entries) {
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
      const ratio = window.devicePixelRatio || 1;
      boardWidth = Math.max(rect.width, 1);
      boardHeight = Math.max(rect.height, 1);
      renderer.resize(boardWidth, boardHeight, ratio);

      currentX = clamp(currentX || boardWidth * 0.08, 0, boardWidth);
      currentY = clamp(currentY || boardHeight * 0.42, 0, boardHeight);
      targetX = clamp(targetX || currentX, 0, boardWidth);
      targetY = clamp(targetY || currentY, 0, boardHeight);
      refreshPalette();
      updateProbe();
    }

    function refreshPalette() {
      renderer.refreshPalette();
      renderHeatField();
    }

    function renderHeatField() {
      renderer.render(currentX, currentY, heatEnergy, phase);
    }

    function setSandboxVisible(isVisible) {
      if (reducedMotion.matches) {
        visible = true;
        introStart = 0;
        mobileStart = 0;
        section.classList.add('is-active');
        targetX = currentX = boardWidth * 0.5;
        targetY = currentY = boardHeight * 0.5;
        heatEnergy = motionEnergy = 0;
        renderHeatField();
        updateProbe();
        return;
      }

      if (visible === isVisible) return;
      visible = isVisible;
      section.classList.toggle('is-active', isVisible);
      pointerActive = false;

      if (isVisible) {
        currentX = boardWidth * 0.08;
        currentY = boardHeight * 0.42;
        targetX = currentX;
        targetY = currentY;
        heatEnergy = 0;
        motionEnergy = 0;
        phase = 0;
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
        const progress = clamp((time - mobileStart) / 5200, 0, 1);
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
      motionEnergy *= 0.86;
      const desiredEnergy = pointerActive ? Math.max(0.14, motionEnergy) : (guided ? 0.3 : 0);
      heatEnergy = lerp(heatEnergy, desiredEnergy, 0.14);
      phase += heatEnergy * 0.18;
      keepAnimating = keepAnimating ||
        Math.abs(currentX - targetX) > 0.2 ||
        Math.abs(currentY - targetY) > 0.2 ||
        Math.abs(heatEnergy - desiredEnergy) > 0.003 ||
        motionEnergy > 0.01;

      renderHeatField();
      updateProbe();
      if (keepAnimating) requestSandboxFrame();
    }

    function updateProbe() {
      const normalizedX = clamp(currentX / boardWidth, 0, 1);
      const normalizedY = clamp(currentY / boardHeight, 0, 1);
      const displayAspect = boardWidth / boardHeight;
      const atlasAspect = 1.6;
      let mapX = normalizedX;
      let mapY = normalizedY;
      if (displayAspect > atlasAspect) mapY = (mapY - 0.5) * atlasAspect / displayAspect + 0.5;
      else mapX = (mapX - 0.5) * displayAspect / atlasAspect + 0.5;
      const altitude = Math.round(atlasData.sample(mapX, mapY) * 2400);
      probe.style.setProperty('--probe-x', currentX.toFixed(1) + 'px');
      probe.style.setProperty('--probe-y', currentY.toFixed(1) + 'px');
      if (readoutX) readoutX.textContent = (mapX * 100).toFixed(2).padStart(6, '0');
      if (readoutY) readoutY.textContent = (mapY * 100).toFixed(2).padStart(6, '0');
      if (readoutAlt) readoutAlt.textContent = String(altitude).padStart(4, '0');
    }

    function handleSandboxPointer(event) {
      if (!visible || reducedMotion.matches || !finePointer.matches) return;
      const rect = board.getBoundingClientRect();
      const now = performance.now();
      const nextX = clamp(event.clientX - rect.left, 0, boardWidth);
      const nextY = clamp(event.clientY - rect.top, 0, boardHeight);
      const elapsed = Math.max(now - lastPointerTime, 16);
      const distance = Math.sqrt(Math.pow(nextX - targetX, 2) + Math.pow(nextY - targetY, 2));

      pointerActive = true;
      introStart = 0;
      mobileStart = 0;
      motionEnergy = Math.max(motionEnergy, clamp(distance / elapsed / 1.2, 0.18, 1));
      targetX = nextX;
      targetY = nextY;
      lastPointerTime = now;
      requestSandboxFrame();
    }

    function handleSandboxLeave() {
      if (reducedMotion.matches) return;
      pointerActive = false;
      introStart = 0;
      mobileStart = 0;
      motionEnergy = 0;
      targetX = boardWidth * 0.5;
      targetY = boardHeight * 0.5;
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

  function createAtlasHeatRenderer(atlasData, targetCanvas) {
    let buffer = targetCanvas || document.createElement('canvas');
    let gl = buffer.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: !targetCanvas,
      powerPreference: 'high-performance'
    }) || buffer.getContext('experimental-webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      preserveDrawingBuffer: !targetCanvas
    });
    let program = gl ? createProgram(gl) : null;
    let context = null;
    let displayWidth = 1;
    let displayHeight = 1;
    let pixelRatio = 1;
    let imageData = null;
    let baseField = null;
    let paperColor = [244, 244, 242];
    let inkColor = [16, 16, 16];
    let redColor = [201, 47, 36];
    const hillValues = new Float32Array(44);
    let locations = null;

    atlasData.hills.forEach(function (hill, index) {
      hillValues[index * 4] = hill.x;
      hillValues[index * 4 + 1] = hill.y;
      hillValues[index * 4 + 2] = hill.radius;
      hillValues[index * 4 + 3] = hill.strength;
    });

    if (gl && program) {
      gl.useProgram(program);
      const vertices = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1
      ]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      locations = {
        resolution: gl.getUniformLocation(program, 'u_resolution'),
        focus: gl.getUniformLocation(program, 'u_focus'),
        energy: gl.getUniformLocation(program, 'u_energy'),
        phase: gl.getUniformLocation(program, 'u_phase'),
        minimum: gl.getUniformLocation(program, 'u_minimum'),
        range: gl.getUniformLocation(program, 'u_range'),
        hills: gl.getUniformLocation(program, 'u_hills[0]'),
        paper: gl.getUniformLocation(program, 'u_paper'),
        ink: gl.getUniformLocation(program, 'u_ink'),
        red: gl.getUniformLocation(program, 'u_red')
      };
      gl.uniform1f(locations.minimum, atlasData.minimum);
      gl.uniform1f(locations.range, atlasData.range);
      gl.uniform4fv(locations.hills, hillValues);
    } else {
      const webglWasUnavailable = !gl;
      gl = null;
      if (!webglWasUnavailable && targetCanvas) {
        buffer = targetCanvas.cloneNode(false);
        targetCanvas.replaceWith(buffer);
      } else if (!webglWasUnavailable) {
        buffer = document.createElement('canvas');
      }
      context = buffer.getContext('2d', { willReadFrequently: true });
    }

    function resize(width, height, ratio) {
      displayWidth = Math.max(width, 1);
      displayHeight = Math.max(height, 1);
      pixelRatio = Math.max(ratio || window.devicePixelRatio || 1, 1);
      buffer.width = Math.max(Math.round(displayWidth * pixelRatio), 1);
      buffer.height = Math.max(Math.round(displayHeight * pixelRatio), 1);

      if (gl) {
        gl.viewport(0, 0, buffer.width, buffer.height);
      } else if (context) {
        imageData = context.createImageData(buffer.width, buffer.height);
        baseField = new Float32Array(buffer.width * buffer.height);
        const displayAspect = displayWidth / displayHeight;
        const atlasAspect = 1.6;
        for (let row = 0; row < buffer.height; row += 1) {
          for (let column = 0; column < buffer.width; column += 1) {
            let sampleX = column / Math.max(buffer.width - 1, 1);
            let sampleY = row / Math.max(buffer.height - 1, 1);
            if (displayAspect > atlasAspect) sampleY = (sampleY - 0.5) * atlasAspect / displayAspect + 0.5;
            else sampleX = (sampleX - 0.5) * displayAspect / atlasAspect + 0.5;
            baseField[row * buffer.width + column] = atlasData.sample(
              sampleX,
              sampleY
            );
          }
        }
      }

      refreshPalette();
    }

    function refreshPalette() {
      const styles = getComputedStyle(root);
      const themePaper = parseColor(styles.getPropertyValue('--paper'), [242, 239, 230]);
      const themeInk = parseColor(styles.getPropertyValue('--ink'), [17, 17, 15]);
      const darkMode = themePaper[0] + themePaper[1] + themePaper[2] < themeInk[0] + themeInk[1] + themeInk[2];
      paperColor = darkMode ? [18, 18, 18] : [244, 244, 242];
      inkColor = darkMode ? [242, 242, 240] : [16, 16, 16];
      redColor = parseColor(styles.getPropertyValue('--accent'), [201, 47, 36]);
    }

    function render(focusX, focusY, energy, phase) {
      if (gl) {
        gl.useProgram(program);
        gl.uniform2f(locations.resolution, displayWidth, displayHeight);
        gl.uniform2f(locations.focus, focusX, focusY);
        gl.uniform1f(locations.energy, energy);
        gl.uniform1f(locations.phase, phase);
        gl.uniform3fv(locations.paper, normalizeColor(paperColor));
        gl.uniform3fv(locations.ink, normalizeColor(inkColor));
        gl.uniform3fv(locations.red, normalizeColor(redColor));
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        return;
      }

      renderCanvasFallback(focusX, focusY, energy, phase);
    }

    function renderCanvasFallback(focusX, focusY, energy, phase) {
      if (!context || !imageData || !baseField) return;
      const data = imageData.data;
      const radius = Math.max(Math.min(displayWidth, displayHeight) * 0.34, 120);
      const gridFade = clamp(energy * 5, 0, 1);

      for (let row = 0; row < buffer.height; row += 1) {
        const pixelY = row / pixelRatio;
        for (let column = 0; column < buffer.width; column += 1) {
          const index = row * buffer.width + column;
          const pixelX = column / pixelRatio;
          const dx = pixelX - focusX;
          const dy = pixelY - focusY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const falloff = distance < radius ? Math.pow(1 - distance / radius, 2) : 0;
          const ripple = falloff * Math.sin(distance / radius * Math.PI * 4 - phase) * energy * 0.055;
          const height = clamp(baseField[index] + falloff * energy * 0.18 + ripple, 0, 1);
          const band = clamp(Math.floor(height * 10) / 9, 0, 1);
          const shade = 0.16 + band * 0.72;
          let color = mixColor(inkColor, paperColor, shade);
          const contour = Math.abs(height * 9 - Math.round(height * 9)) < 0.035;
          if (contour) color = mixColor(color, inkColor, 0.82);

          const reveal = clamp(1 - distance / radius, 0, 1);
          const longitude = Math.min((column / buffer.width * 14) % 1, 1 - (column / buffer.width * 14) % 1) < 0.009;
          const latitude = Math.min((row / buffer.height * 9) % 1, 1 - (row / buffer.height * 9) % 1) < 0.009;
          const cross = Math.abs(dx) < 1.25 || Math.abs(dy) < 1.25;
          const grid = Math.max(longitude || latitude ? 0.72 : 0, cross ? 1 : 0) * reveal * gridFade;
          color = mixColor(color, redColor, grid);

          const offset = index * 4;
          data[offset] = color[0];
          data[offset + 1] = color[1];
          data[offset + 2] = color[2];
          data[offset + 3] = 250;
        }
      }

      context.putImageData(imageData, 0, 0);
    }

    function drawTo(targetContext, width, height, x, y) {
      targetContext.imageSmoothingEnabled = true;
      targetContext.drawImage(buffer, x || 0, y || 0, width, height);
    }

    function createProgram(webgl) {
      const vertexSource = [
        'attribute vec2 a_position;',
        'varying vec2 v_uv;',
        'void main() {',
        '  v_uv = a_position * 0.5 + 0.5;',
        '  gl_Position = vec4(a_position, 0.0, 1.0);',
        '}'
      ].join('\n');
      const fragmentSource = [
        'precision highp float;',
        'varying vec2 v_uv;',
        'uniform vec2 u_resolution;',
        'uniform vec2 u_focus;',
        'uniform float u_energy;',
        'uniform float u_phase;',
        'uniform float u_minimum;',
        'uniform float u_range;',
        'uniform vec4 u_hills[11];',
        'uniform vec3 u_paper;',
        'uniform vec3 u_ink;',
        'uniform vec3 u_red;',
        'const float PI = 3.141592653589793;',
        'float terrain(vec2 uv) {',
        '  float warpedX = uv.x + sin((uv.y * 5.3 + uv.x * 1.7) * PI) * 0.035 + sin(uv.y * 13.1 * PI) * 0.012;',
        '  float warpedY = uv.y + sin((uv.x * 4.7 - uv.y * 1.3) * PI) * 0.04 + cos(uv.x * 11.7 * PI) * 0.014;',
        '  float value = sin((warpedX * 2.7 + warpedY * 0.9) * PI) * 0.09;',
        '  for (int i = 0; i < 11; i++) {',
        '    vec4 hill = u_hills[i];',
        '    vec2 delta = vec2(warpedX, warpedY) - hill.xy;',
        '    value += hill.w * exp(-dot(delta, delta) / (2.0 * hill.z * hill.z));',
        '  }',
        '  value += sin((warpedX * 8.1 - warpedY * 5.7) * PI) * 0.045;',
        '  value += cos((warpedX * 15.2 + warpedY * 10.6) * PI) * 0.018;',
        '  value += sin((warpedX * 23.4 - warpedY * 17.8) * PI) * 0.009;',
        '  return clamp((value - u_minimum) / max(u_range, 0.001), 0.0, 1.0);',
        '}',
        'float gridLine(float coordinate, float cells, float width) {',
        '  float unit = fract(coordinate * cells);',
        '  float distanceToLine = min(unit, 1.0 - unit);',
        '  return 1.0 - smoothstep(width, width * 2.4, distanceToLine);',
        '}',
        'void main() {',
        '  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);',
        '  vec2 pixel = uv * u_resolution;',
        '  vec2 delta = pixel - u_focus;',
        '  float distanceToFocus = length(delta);',
        '  float radius = max(min(u_resolution.x, u_resolution.y) * 0.34, 120.0);',
        '  float falloff = 1.0 - smoothstep(radius * 0.12, radius, distanceToFocus);',
        '  vec2 direction = delta / max(distanceToFocus, 1.0);',
        '  float wave = sin(distanceToFocus / radius * PI * 4.0 - u_phase);',
        '  float displayAspect = u_resolution.x / u_resolution.y;',
        '  const float atlasAspect = 1.6;',
        '  vec2 mapUv = uv;',
        '  if (displayAspect > atlasAspect) mapUv.y = (uv.y - 0.5) * atlasAspect / displayAspect + 0.5;',
        '  else mapUv.x = (uv.x - 0.5) * displayAspect / atlasAspect + 0.5;',
        '  vec2 warpedUv = mapUv + direction * wave * falloff * u_energy * 0.026;',
        '  warpedUv += vec2(-direction.y, direction.x) * falloff * u_energy * 0.012;',
        '  float height = terrain(clamp(warpedUv, 0.0, 1.0));',
        '  height = clamp(height + falloff * u_energy * 0.16 + wave * falloff * u_energy * 0.05, 0.0, 1.0);',
        '  float band = clamp(floor(height * 10.0) / 9.0, 0.0, 1.0);',
        '  vec3 color = mix(u_ink, u_paper, 0.16 + band * 0.72);',
        '  float contourDistance = abs(height * 9.0 - floor(height * 9.0 + 0.5));',
        '  float contour = 1.0 - smoothstep(0.024, 0.052, contourDistance);',
        '  color = mix(color, u_ink, contour * 0.82);',
        '  float longitude = gridLine(warpedUv.x, 14.0, 14.0 / u_resolution.x * 1.1);',
        '  float latitude = gridLine(warpedUv.y, 9.0, 9.0 / u_resolution.y * 1.1);',
        '  float meridian = 1.0 - smoothstep(0.8, 1.8, abs(delta.x));',
        '  float parallel = 1.0 - smoothstep(0.8, 1.8, abs(delta.y));',
        '  float gridReveal = falloff * smoothstep(0.02, 0.16, u_energy);',
        '  float redGrid = max(max(longitude, latitude) * 0.72, max(meridian, parallel)) * gridReveal;',
        '  color = mix(color, u_red, clamp(redGrid, 0.0, 1.0));',
        '  gl_FragColor = vec4(color, 0.98);',
        '}'
      ].join('\n');
      const vertex = compileShader(webgl, webgl.VERTEX_SHADER, vertexSource);
      const fragment = compileShader(webgl, webgl.FRAGMENT_SHADER, fragmentSource);
      if (!vertex || !fragment) return null;
      const shaderProgram = webgl.createProgram();
      webgl.attachShader(shaderProgram, vertex);
      webgl.attachShader(shaderProgram, fragment);
      webgl.linkProgram(shaderProgram);
      if (!webgl.getProgramParameter(shaderProgram, webgl.LINK_STATUS)) return null;
      return shaderProgram;
    }

    function compileShader(webgl, type, source) {
      const shader = webgl.createShader(type);
      webgl.shaderSource(shader, source);
      webgl.compileShader(shader);
      if (!webgl.getShaderParameter(shader, webgl.COMPILE_STATUS)) return null;
      return shader;
    }

    function parseColor(value, fallback) {
      const normalized = value.trim();
      const hex = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      const rgb = normalized.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
      if (hex) {
        const code = hex[1].length === 3
          ? hex[1].split('').map(function (character) { return character + character; }).join('')
          : hex[1];
        return [parseInt(code.slice(0, 2), 16), parseInt(code.slice(2, 4), 16), parseInt(code.slice(4, 6), 16)];
      }
      if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
      return fallback;
    }

    function normalizeColor(color) {
      return new Float32Array([color[0] / 255, color[1] / 255, color[2] / 255]);
    }

    function mixColor(from, to, amount) {
      return [
        Math.round(lerp(from[0], to[0], amount)),
        Math.round(lerp(from[1], to[1], amount)),
        Math.round(lerp(from[2], to[2], amount))
      ];
    }

    return {
      resize: resize,
      refreshPalette: refreshPalette,
      render: render,
      drawTo: drawTo
    };
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

    return {
      seed: seed,
      hills: hills,
      minimum: minimum,
      range: Math.max(maximum - minimum, 0.001),
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
