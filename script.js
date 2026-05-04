/* ==========================================================================
   Synexis — interactivity
   - Sticky navbar w/ scroll state
   - Mobile menu toggle
   - Scroll-spy active nav link (IntersectionObserver)
   - Reveal-on-scroll animations (IntersectionObserver)
   - Contact form validation + mailto fallback
   ========================================================================== */

(() => {
  'use strict';

  /* ---------- Helpers ---------- */
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------- Footer year ---------- */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Navbar scroll state ---------- */
  const nav = $('#nav');
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle('is-scrolled', window.scrollY > 12);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile menu toggle ---------- */
  const navToggle = $('#navToggle');
  const navLinks  = $('#navLinks');

  const closeMenu = () => {
    if (!navToggle || !navLinks) return;
    navToggle.classList.remove('is-open');
    navLinks.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  };

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('is-open');
      navToggle.classList.toggle('is-open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
    // Close menu on link tap (mobile)
    navLinks.addEventListener('click', (e) => {
      if (e.target.matches('a')) closeMenu();
    });
  }

  /* ---------- Scroll-spy active link ---------- */
  const sections  = $$('section[id]');
  const linkMap   = new Map(
    $$('.nav-link').map(a => [a.getAttribute('href')?.slice(1), a])
  );

  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id;
        const link = linkMap.get(id);
        if (!link) return;
        if (entry.isIntersecting) {
          $$('.nav-link').forEach(l => l.classList.remove('is-active'));
          link.classList.add('is-active');
        }
      });
    }, {
      rootMargin: '-45% 0px -50% 0px',
      threshold: 0
    });
    sections.forEach(s => spy.observe(s));
  }

  /* ---------- Reveal animations ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const reveal = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // Tiny stagger for grouped items
          const delay = entry.target.dataset.delay || (i * 60);
          entry.target.style.transitionDelay = `${delay}ms`;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
    reveals.forEach(el => reveal.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('is-visible'));
  }

  /* ---------- Pinned phases (scroll-driven) ----------
     Section is 300vh tall with a sticky inner of 100vh. As the user scrolls
     through that runway, we map scroll progress -> active phase index. */
  const phasesEl = $('#phases');
  if (phasesEl) {
    const phases = $$('.phase', phasesEl);
    const dots   = $$('.phase-dot', phasesEl);

    const setActive = (i) => {
      phases.forEach((p, idx) => p.classList.toggle('is-active', idx === i));
      dots.forEach((d, idx)   => d.classList.toggle('is-active', idx === i));
    };

    let ticking = false;
    let currentIdx = 0;

    const updatePhases = () => {
      const rect  = phasesEl.getBoundingClientRect();
      const total = phasesEl.offsetHeight - window.innerHeight;
      // progress: 0 when section top hits viewport top, 1 when bottom-of-runway hits viewport top
      const progress = Math.max(0, Math.min(0.999, -rect.top / total));
      const idx = Math.floor(progress * phases.length);
      if (idx !== currentIdx) {
        currentIdx = idx;
        setActive(idx);
      }
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updatePhases);
        ticking = true;
      }
    }, { passive: true });
    updatePhases();
  }

  /* ---------- Lenis-style smooth wheel scroll ----------
     Hijacks wheel events, lerps a virtual target toward current scroll.
     Skipped on touch devices and when prefers-reduced-motion is set —
     native momentum scrolling on mobile feels better untouched. */
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isTouch      = matchMedia('(hover: none) and (pointer: coarse)').matches;

  if (!reduceMotion && !isTouch) {
    let target  = window.scrollY;
    let current = window.scrollY;
    let raf     = null;
    const ease  = 0.12;          // 0.08 = silky, 0.2 = snappy
    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

    const tick = () => {
      const delta = target - current;
      if (Math.abs(delta) < 0.5) {
        current = target;
        window.scrollTo(0, current);
        raf = null;
        return;
      }
      current += delta * ease;
      window.scrollTo(0, current);
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (!raf) raf = requestAnimationFrame(tick); };

    window.addEventListener('wheel', (e) => {
      // Allow modifier-key wheel (zoom, horizontal scroll containers, etc.)
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      // Normalize deltaMode: 1 = lines, 2 = pages
      const dy = e.deltaMode === 1 ? e.deltaY * 16
              : e.deltaMode === 2 ? e.deltaY * window.innerHeight
              : e.deltaY;
      target = Math.max(0, Math.min(maxScroll(), target + dy));
      start();
    }, { passive: false });

    // Anchor links — animate via target instead of native jump
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      const navOffset = 60;
      target = Math.max(0, Math.min(
        maxScroll(),
        el.getBoundingClientRect().top + window.scrollY - navOffset
      ));
      start();
    });

    // Resync if user uses scrollbar / keyboard / browser-restored scroll
    let lastWheelAt = 0;
    window.addEventListener('wheel', () => { lastWheelAt = performance.now(); }, { passive: true });
    window.addEventListener('scroll', () => {
      if (raf) return;
      if (performance.now() - lastWheelAt < 200) return;
      target  = window.scrollY;
      current = window.scrollY;
    }, { passive: true });

    // Disable CSS smooth-scroll so the JS easing isn't double-applied
    document.documentElement.style.scrollBehavior = 'auto';
  }

  /* ---------- Contact form ---------- */
  const form = $('#contactForm');
  if (form) {
    const status = $('#formStatus');
    const setError = (name, msg) => {
      const field = form.querySelector(`[name="${name}"]`)?.closest('.field');
      const err   = form.querySelector(`.error[data-for="${name}"]`);
      if (!field || !err) return;
      field.classList.toggle('has-error', Boolean(msg));
      err.textContent = msg || '';
    };

    const validate = (data) => {
      let ok = true;
      if (!data.name.trim()) { setError('name', 'Please enter your name.'); ok = false; }
      else setError('name', '');

      const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRx.test(data.email.trim())) { setError('email', 'Enter a valid email.'); ok = false; }
      else setError('email', '');

      if (data.message.trim().length < 10) { setError('message', 'Message should be at least 10 characters.'); ok = false; }
      else setError('message', '');

      return ok;
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = {
        name: form.name.value,
        email: form.email.value,
        message: form.message.value
      };

      if (!validate(data)) {
        if (status) {
          status.textContent = 'Please fix the errors above.';
          status.classList.remove('is-success');
        }
        return;
      }

      // Mailto fallback — opens user's mail client.
      const subject = encodeURIComponent(`New project inquiry from ${data.name}`);
      const body = encodeURIComponent(
        `Name: ${data.name}\nEmail: ${data.email}\n\n${data.message}`
      );
      window.location.href = `mailto:hello@thesynexis.com?subject=${subject}&body=${body}`;

      if (status) {
        status.textContent = 'Thanks! Opening your mail app…';
        status.classList.add('is-success');
      }
      form.reset();
    });

    // Live-clear errors as user fixes them
    ['name', 'email', 'message'].forEach((n) => {
      form[n]?.addEventListener('input', () => setError(n, ''));
    });
  }
})();
