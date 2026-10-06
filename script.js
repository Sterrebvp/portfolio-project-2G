(() => {
  if (window.__fastbotVideoControllerInitialized) return;
  window.__fastbotVideoControllerInitialized = true;

  const heroTitle = document.querySelector('.hero h1');
  const heroName = heroTitle?.querySelector('.hero-name');
  const heroLabel = heroTitle?.querySelector('.hero-portfolio');

  function fitHeroName() {
    if (!heroTitle || !heroName || !heroLabel) return;
    const availableWidth = Math.max(16, heroTitle.clientWidth - 8);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const nameStyle = getComputedStyle(heroName);
    const nameText = heroName.firstChild.textContent;
    let low = 16;
    let high = availableWidth;

    for (let iteration = 0; iteration < 18; iteration += 1) {
      const size = (low + high) / 2;
      context.font = `${nameStyle.fontWeight} ${size}px ${nameStyle.fontFamily}`;
      if (context.measureText(nameText).width <= availableWidth) low = size;
      else high = size;
    }

    heroName.style.setProperty('--hero-name-size', `${low}px`);
    const nameNode = heroName.firstChild;
    const finalLetter = document.createRange();
    finalLetter.setStart(nameNode, nameNode.textContent.length - 1);
    finalLetter.setEnd(nameNode, nameNode.textContent.length);
    const letterBounds = finalLetter.getBoundingClientRect();
    const nameBounds = heroName.getBoundingClientRect();
    context.font = `${nameStyle.fontWeight} 100px ${nameStyle.fontFamily}`;
    const labelWidth = context.measureText('PORTFOLIO').width;
    const portfolioSize = Math.min(low * 0.62 / labelWidth * 100, letterBounds.width * 0.34);
    heroName.style.setProperty('--portfolio-size', `${portfolioSize}px`);
    heroName.style.setProperty('--portfolio-x', `${letterBounds.left - nameBounds.left + letterBounds.width * 0.30}px`);
    heroName.style.setProperty('--portfolio-y', `${letterBounds.top - nameBounds.top + letterBounds.height / 2}px`);
  }

  if (heroTitle) {
    document.fonts.ready.then(fitHeroName);
    window.addEventListener('resize', fitHeroName);
  }

  const coverVideo = document.querySelector('.fastbot-cover');
  const fastbotVideos = [...document.querySelectorAll('.fastbot-video')];
  const motionVideos = [...document.querySelectorAll('.motion-video, .internship-page video')];
  const controlledVideos = [...new Set([...fastbotVideos, ...motionVideos])];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Ignore the temporary test URL override; only the actual system preference should affect motion.
  const reducedMotionEnabled = reducedMotion.matches;
  const states = new WeakMap();
  let pageToggle;

  function syncPageToggle() {
    if (!pageToggle) return;
    const playing = controlledVideos.some((video) => !video.paused);
    pageToggle.textContent = playing ? 'Pause videos' : 'Play videos';
    pageToggle.setAttribute('aria-label', pageToggle.textContent);
    pageToggle.setAttribute('aria-pressed', String(playing));
  }

  function stateFor(video) {
    if (!states.has(video)) {
      states.set(video, {
        autoPlaying: false,
        manualPaused: false,
        wasAutoPlayingBeforeTabHide: false,
        playRequest: 0,
        toggle: null
      });
    }
    return states.get(video);
  }

  function updateToggle(video) {
    const state = stateFor(video);
    if (!state.toggle) return;
    const paused = video.paused;
    state.toggle.textContent = paused ? 'Play preview' : 'Pause preview';
    state.toggle.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} Fastbot preview`);
    state.toggle.setAttribute('aria-pressed', String(!paused));
  }

  function showFallback(video, visible = true) {
    const state = stateFor(video);
    if (!state.toggle && controlledVideos.includes(video)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'video-toggle fastbot-fallback-toggle';
      button.textContent = 'Play';
      button.setAttribute('aria-label', 'Play video');
      const figure = video.closest('figure');
      if (figure) figure.append(button);
      state.toggle = button;
      button.addEventListener('click', () => {
        state.manualPaused = false;
        playVideo(video, 'fallback click', true);
      });
    }
    if (state.toggle && state.toggle.classList.contains('fastbot-fallback-toggle')) {
      state.toggle.hidden = !visible;
      state.toggle.textContent = video.paused ? 'Play' : 'Pause';
      state.toggle.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
    }
    if (video.classList.contains('fastbot-cover')) {
      updateToggle(video);
    }
  }

  function playVideo(video, reason, manual = false) {
    const state = stateFor(video);

    if (reducedMotionEnabled && !manual) {
      state.autoPlaying = false;
      showFallback(video, true);
      return;
    }

    if (!manual && state.manualPaused) {
      showFallback(video, true);
      return;
    }

    state.manualPaused = manual ? false : state.manualPaused;
    video.muted = true;
    const playRequest = ++state.playRequest;

    video.play().then(() => {
      if (playRequest !== state.playRequest) return;
      state.autoPlaying = true;
      state.wasAutoPlayingBeforeTabHide = false;
      showFallback(video, false);
      if (video.classList.contains('fastbot-cover')) {
        updateToggle(video);
      }
    }).catch((error) => {
      state.autoPlaying = false;
      showFallback(video, true);
      syncPageToggle();
      if (error.name !== 'AbortError') {
        console.warn(`Fastbot video playback was prevented (${reason}).`, error);
      }
    });
  }

  function pauseVideo(video, deliberate = false) {
    const state = stateFor(video);
    state.playRequest += 1;
    if (deliberate) state.manualPaused = true;
    video.pause();
    state.autoPlaying = false;
    syncPageToggle();
    if (video.classList.contains('fastbot-cover')) {
      updateToggle(video);
    }
    if (controlledVideos.includes(video)) {
      showFallback(video, true);
    }
  }

  function toggleVideo(video) {
    const state = stateFor(video);
    if (video.paused) {
      state.manualPaused = false;
      playVideo(video, 'manual control', true);
    } else {
      pauseVideo(video, true);
    }
  }

  function bindHomeCover() {
    if (!coverVideo) return;
    const toggle = coverVideo.closest('.fastbot-project')?.querySelector('.fastbot-toggle');
    if (!toggle) return;

    const syncToggle = () => {
      const paused = coverVideo.paused;
      toggle.textContent = paused ? 'Play preview' : 'Pause preview';
      toggle.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} Fastbot preview`);
      toggle.setAttribute('aria-pressed', String(!paused));
    };

    toggle.addEventListener('click', () => {
      if (coverVideo.paused) {
        coverVideo.muted = true;
        coverVideo.play().then(syncToggle).catch(() => {
          syncToggle();
        });
      } else {
        coverVideo.pause();
      }
    });

    coverVideo.addEventListener('play', syncToggle);
    coverVideo.addEventListener('pause', syncToggle);

    if (!reducedMotionEnabled) {
      coverVideo.muted = true;
      coverVideo.play().catch(() => {
        syncToggle();
      });
    }
    syncToggle();
  }

  function bindFastbotVideos() {
    if (!fastbotVideos.length) return;

    fastbotVideos.forEach((video) => {
      if (video.dataset.fastbotInitialized === 'true') return;
      video.dataset.fastbotInitialized = 'true';
      video.muted = true;
      video.controls = false;
      video.removeAttribute('controls');
      video.setAttribute('autoplay', 'autoplay');
      video.setAttribute('loop', 'loop');
      video.setAttribute('muted', 'muted');
      video.setAttribute('playsinline', 'playsinline');
      video.setAttribute('preload', 'auto');

      if (reducedMotionEnabled) {
        showFallback(video, true);
        return;
      }

      playVideo(video, 'initial autoplay');
    });
  }

  function bindMotionVideos() {
    motionVideos.forEach((video) => {
      if (video.dataset.motionInitialized === 'true') return;
      video.dataset.motionInitialized = 'true';
      video.muted = true;
      video.controls = false;
      video.removeAttribute('controls');
      video.setAttribute('autoplay', 'autoplay');
      video.setAttribute('loop', 'loop');
      video.setAttribute('muted', 'muted');
      video.setAttribute('playsinline', 'playsinline');
      if (reducedMotionEnabled) {
        showFallback(video, true);
        return;
      }
      playVideo(video, 'initial autoplay');
    });
  }

  bindHomeCover();
  bindFastbotVideos();
  bindMotionVideos();

  const cursorMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (cursorMedia.matches) {
    const cursor = document.createElement('span');
    cursor.className = 'cursor-dot';
    cursor.setAttribute('aria-hidden', 'true');
    document.body.append(cursor);
    document.body.classList.add('has-custom-cursor');

    function updateCursorColor(x, y) {
      const target = document.elementFromPoint(x, y);
      const onImage = Boolean(target?.closest('img, video'));
      cursor.classList.toggle('is-image', onImage);
      if (onImage) {
        cursor.classList.remove('is-light');
        return;
      }

      let surface = target;
      let luminance = 1;
      while (surface && surface !== document.documentElement) {
        const color = getComputedStyle(surface).backgroundColor.match(/[\d.]+/g);
        if (color?.length >= 3 && Number(color[3] ?? 1) > 0) {
          const channels = color.slice(0, 3).map((value) => Number(value) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
          luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
          break;
        }
        surface = surface.parentElement;
      }
      cursor.classList.toggle('is-light', luminance < 0.3);
    }

    document.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse') return;
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
      cursor.classList.add('is-visible');
      updateCursorColor(event.clientX, event.clientY);
      const hoverTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest('a, button, [role="button"]');
      cursor.classList.toggle('is-hovering', Boolean(hoverTarget));
    }, { passive: true });

    document.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'));
  }

  pageToggle = document.querySelector('.video-page-toggle');
  if (pageToggle && controlledVideos.length) {
    pageToggle.hidden = false;
    controlledVideos.forEach((video) => {
      video.addEventListener('play', syncPageToggle);
      video.addEventListener('pause', syncPageToggle);
    });
    syncPageToggle();
    pageToggle.addEventListener('click', () => {
      const playing = controlledVideos.some((video) => !video.paused);
      controlledVideos.forEach((video) => playing ? pauseVideo(video, true) : playVideo(video, 'page control', true));
      syncPageToggle();
    });
  }

  document.addEventListener('visibilitychange', () => {
    controlledVideos.forEach((video) => {
      const state = stateFor(video);

      if (document.hidden) {
        if (!video.paused && state.autoPlaying) {
          state.wasAutoPlayingBeforeTabHide = true;
          state.autoPlaying = false;
          video.pause();
        }
        return;
      }

      if (state.wasAutoPlayingBeforeTabHide && !state.manualPaused && !reducedMotionEnabled) {
        state.wasAutoPlayingBeforeTabHide = false;
        playVideo(video, 'tab visibility');
      }
    });
  });

  const lightbox = document.querySelector('.lightbox');
  const projectGallery = document.querySelector('#gallery');
  if (!lightbox || !projectGallery) return;

  const closeButton = lightbox.querySelector('.lightbox-close');
  const track = document.createElement('div');
  track.className = 'lightbox-track';
  track.tabIndex = 0;
  track.setAttribute('role', 'group');
  track.setAttribute('aria-label', 'Project images');

  const previousButton = document.createElement('button');
  previousButton.className = 'lightbox-previous';
  previousButton.type = 'button';
  previousButton.textContent = 'Previous';
  previousButton.setAttribute('aria-label', 'Previous image');

  const nextButton = document.createElement('button');
  nextButton.className = 'lightbox-next';
  nextButton.type = 'button';
  nextButton.textContent = 'Next';
  nextButton.setAttribute('aria-label', 'Next image');

  const counter = document.createElement('span');
  counter.className = 'lightbox-counter';
  counter.setAttribute('aria-live', 'polite');
  counter.setAttribute('aria-atomic', 'true');
  lightbox.querySelector('.lightbox-image')?.remove();
  lightbox.append(track, previousButton, counter, nextButton);

  const images = [...projectGallery.querySelectorAll('img')];
  const slides = images.map((image) => {
    let trigger = image.closest('button');
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.className = 'media-image-button';
      trigger.type = 'button';
      image.parentNode.insertBefore(trigger, image);
      trigger.append(image);
    }
    trigger.setAttribute('aria-label', `View ${image.alt || 'project image'} larger`);

    const slide = document.createElement('figure');
    slide.className = 'lightbox-slide';
    track.append(slide);
    return { trigger, image, slide };
  });

  let currentIndex = 0;
  let lastTrigger;
  let previousScrollX = 0;
  let previousScrollY = 0;

  function loadSlide(index) {
    const { image, slide } = slides[index];
    if (slide.firstElementChild) return;
    const expandedImage = document.createElement('img');
    expandedImage.src = image.currentSrc || image.src;
    expandedImage.alt = image.alt;
    slide.append(expandedImage);
  }

  function updateCounter() {
    counter.textContent = `${currentIndex + 1} / ${slides.length}`;
  }

  function syncCurrentIndex() {
    currentIndex = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
    loadSlide(currentIndex);
    if (currentIndex > 0) loadSlide(currentIndex - 1);
    if (currentIndex + 1 < slides.length) loadSlide(currentIndex + 1);
    updateCounter();
  }

  function showImage(index) {
    currentIndex = (index % slides.length + slides.length) % slides.length;
    loadSlide(currentIndex);
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    track.scrollTo({ left: currentIndex * track.clientWidth, behavior });
    updateCounter();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.classList.remove('lightbox-open');
    window.scrollTo(previousScrollX, previousScrollY);
    lastTrigger?.focus({ preventScroll: true });
  }

  slides.forEach(({ trigger }, index) => {
    trigger.addEventListener('click', () => {
      lastTrigger = trigger;
      currentIndex = index;
      previousScrollX = window.scrollX;
      previousScrollY = window.scrollY;
      lightbox.hidden = false;
      document.body.classList.add('lightbox-open');
      loadSlide(currentIndex);
      if (currentIndex + 1 < slides.length) loadSlide(currentIndex + 1);
      track.scrollLeft = currentIndex * track.clientWidth;
      updateCounter();
      closeButton.focus();
    });
  });

  track.addEventListener('scroll', syncCurrentIndex, { passive: true });
  track.addEventListener('wheel', (event) => {
    if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    event.preventDefault();
    const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? track.clientWidth : 1;
    track.scrollLeft += event.deltaY * multiplier;
  }, { passive: false });
  previousButton.addEventListener('click', () => showImage(currentIndex - 1));
  nextButton.addEventListener('click', () => showImage(currentIndex + 1));
  closeButton.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (event) => {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') closeLightbox();
    if (event.key === 'ArrowLeft') showImage(currentIndex - 1);
    if (event.key === 'ArrowRight') showImage(currentIndex + 1);
  });
})();
