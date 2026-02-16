/**
 * Spring Bank – Main JavaScript
 * Handles: mega-menus, hero carousel, mobile nav, sign-in modal,
 *          advisor/solution finder, accordion, analytics stubs,
 *          lazy images, keyboard navigation, language toggle.
 */
(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     Utility helpers
  ────────────────────────────────────────────────────────── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  function on(el, ev, fn, opts) {
    if (el) el.addEventListener(ev, fn, opts);
  }
  function off(el, ev, fn) {
    if (el) el.removeEventListener(ev, fn);
  }

  /* ──────────────────────────────────────────────────────────
     Analytics stub  (swap console.log for gtag / Plausible)
  ────────────────────────────────────────────────────────── */
  function track(name, props = {}) {
    if (typeof gtag !== 'undefined') {
      gtag('event', name, props);
    } else {
      // eslint-disable-next-line no-console
      console.log('[Analytics]', name, props);
    }
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-pt-name]');
    if (el) track('click', { label: el.dataset.ptName, url: el.href || null });
  });

  /* ──────────────────────────────────────────────────────────
     Lazy images (native + manual fallback)
  ────────────────────────────────────────────────────────── */
  $$('img:not([loading])').forEach(img => img.setAttribute('loading', 'lazy'));

  /* ──────────────────────────────────────────────────────────
     Brand bar: mark active segment
  ────────────────────────────────────────────────────────── */
  (function brandBar() {
    const path = location.pathname;
    const map = {
      '/business.html': 'Business',
      '/index.html': 'Personal',
      '/': 'Personal',
    };
    const label = map[path] || (path.includes('business') ? 'Business' : 'Personal');
    $$('.brand-bar__link').forEach(a => {
      if (a.textContent.trim() === label) a.setAttribute('aria-current', 'page');
    });
  })();

  /* ──────────────────────────────────────────────────────────
     Mega-menus (hover + keyboard + click)
  ────────────────────────────────────────────────────────── */
  (function megaMenus() {
    $$('.primary-nav__item').forEach(item => {
      const btn = $('[aria-haspopup="true"]', item) || $('.primary-nav__link', item);
      const menu = $('.mega-menu', item);
      if (!menu) return;

      let leaveTimer;

      function open() {
        clearTimeout(leaveTimer);
        // close others
        $$('.mega-menu.is-open').forEach(m => {
          if (m !== menu) {
            m.classList.remove('is-open');
            m.previousElementSibling?.setAttribute('aria-expanded', 'false');
          }
        });
        menu.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
      function close() {
        menu.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      }

      on(item, 'mouseenter', open);
      on(item, 'mouseleave', () => { leaveTimer = setTimeout(close, 120); });
      on(btn, 'click', () => {
        if (menu.classList.contains('is-open')) close();
        else open();
      });
      on(btn, 'keydown', e => {
        if (e.key === 'Escape') { close(); btn.focus(); }
        if (e.key === 'ArrowDown' && menu.classList.contains('is-open')) {
          e.preventDefault();
          $('a', menu)?.focus();
        }
      });
      // Trap focus within menu
      on(menu, 'keydown', e => {
        if (e.key === 'Escape') { close(); btn.focus(); }
      });
    });

    // Close on outside click
    on(document, 'click', e => {
      if (!e.target.closest('.primary-nav__item')) {
        $$('.mega-menu.is-open').forEach(m => {
          m.classList.remove('is-open');
          m.previousElementSibling?.setAttribute('aria-expanded', 'false');
        });
      }
    });
  })();

  /* ──────────────────────────────────────────────────────────
     Mobile nav hamburger
  ────────────────────────────────────────────────────────── */
  (function mobileNav() {
    const btn = $('#hamburger');
    const nav = $('.primary-nav');
    if (!btn || !nav) return;

    function toggle() {
      const open = nav.classList.toggle('is-open');
      btn.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    }
    on(btn, 'click', toggle);

    // Close on ESC
    on(document, 'keydown', e => {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) {
        toggle();
        btn.focus();
      }
    });
  })();

  /* ──────────────────────────────────────────────────────────
     Hero Carousel
  ────────────────────────────────────────────────────────── */
  (function carousel() {
    const heroes = $$('.hero');
    heroes.forEach(hero => {
      const slides = $$('.hero__slide', hero);
      if (slides.length < 2) return;

      const dotsContainer = $('.hero__dots', hero);
      const prevBtn = $('.hero__arrow--prev', hero);
      const nextBtn = $('.hero__arrow--next', hero);
      const pauseBtn = $('.hero__pause', hero);

      let current = 0;
      let paused = false;
      let timer;

      // Build dots
      if (dotsContainer) {
        slides.forEach((_, i) => {
          const dot = document.createElement('button');
          dot.className = 'hero__dot';
          dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
          dot.addEventListener('click', () => { goTo(i); resetTimer(); });
          dotsContainer.appendChild(dot);
        });
      }

      function updateDots() {
        $$('.hero__dot', hero).forEach((d, i) => d.classList.toggle('is-active', i === current));
      }

      function show(i) {
        slides[current].classList.remove('is-active');
        current = (i + slides.length) % slides.length;
        slides[current].classList.add('is-active');
        updateDots();

        // Live region announce for screen readers
        const liveEl = $('.hero__live', hero);
        if (liveEl) liveEl.textContent = `Slide ${current + 1} of ${slides.length}`;
      }

      function goTo(i) { show(i); }
      function next() { show(current + 1); }
      function prev() { show(current - 1); }

      function resetTimer() {
        clearInterval(timer);
        if (!paused) timer = setInterval(next, 6000);
      }

      // Init
      slides[0].classList.add('is-active');
      updateDots();
      resetTimer();

      on(nextBtn, 'click', () => { next(); resetTimer(); });
      on(prevBtn, 'click', () => { prev(); resetTimer(); });

      if (pauseBtn) {
        on(pauseBtn, 'click', () => {
          paused = !paused;
          pauseBtn.textContent = paused ? '▶' : '⏸';
          pauseBtn.setAttribute('aria-label', paused ? 'Resume slideshow' : 'Pause slideshow');
          if (paused) clearInterval(timer);
          else resetTimer();
        });
      }

      // Pause on hover
      on(hero, 'mouseenter', () => { clearInterval(timer); });
      on(hero, 'mouseleave', () => { if (!paused) resetTimer(); });

      // Keyboard
      on(hero, 'keydown', e => {
        if (e.key === 'ArrowLeft') { prev(); resetTimer(); }
        if (e.key === 'ArrowRight') { next(); resetTimer(); }
      });

      // Touch swipe
      let startX = null;
      on(hero, 'touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
      on(hero, 'touchend', e => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) { dx < 0 ? next() : prev(); resetTimer(); }
        startX = null;
      });
    });
  })();

  /* ──────────────────────────────────────────────────────────
     Sign-in Modal
  ────────────────────────────────────────────────────────── */
  (function signinModal() {
    const overlay = $('#signinModal');
    if (!overlay) return;
    const modal = $('.modal', overlay);
    const closeBtns = $$('[data-modal-close]', overlay);
    const openBtns = $$('[data-modal-open="signinModal"]');
    const form = $('form', overlay);
    const alert = $('.modal__alert', overlay);

    let lastFocused;

    function openModal() {
      lastFocused = document.activeElement;
      overlay.classList.add('is-open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      // Focus first input
      const first = $('input:not([type=checkbox]), button', modal);
      setTimeout(() => first?.focus(), 50);
      track('modal_open', { modal: 'signin' });
    }

    function closeModal() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      lastFocused?.focus();
      if (alert) alert.classList.remove('is-visible');
      if (form) form.reset();
    }

    openBtns.forEach(b => on(b, 'click', openModal));
    closeBtns.forEach(b => on(b, 'click', closeModal));
    on(overlay, 'click', e => { if (e.target === overlay) closeModal(); });
    on(document, 'keydown', e => {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) closeModal();
    });

    // Focus trap
    on(modal, 'keydown', e => {
      if (e.key !== 'Tab') return;
      const focusable = $$('button, input, a[href], [tabindex]:not([tabindex="-1"])', modal);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });

    // Form validation
    if (form) {
      on(form, 'submit', e => {
        e.preventDefault();
        const uid = $('#modalUserId', form);
        const pw = $('#modalPassword', form);
        let valid = true;

        [uid, pw].forEach(f => {
          if (f && !f.value.trim()) {
            f.classList.add('is-error');
            const err = f.closest('.form-field')?.querySelector('.field-error');
            if (err) { err.textContent = 'This field is required.'; err.classList.add('is-visible'); }
            valid = false;
          } else if (f) {
            f.classList.remove('is-error');
            const err = f.closest('.form-field')?.querySelector('.field-error');
            if (err) err.classList.remove('is-visible');
          }
        });

        if (!valid) return;
        // Mock: show error (static site, no real auth)
        if (alert) {
          alert.textContent = 'This is a demo. Authentication is not enabled.';
          alert.classList.add('is-visible');
        }
        track('signin_attempt');
      });

      // Clear error on input
      $$('input', form).forEach(inp => {
        on(inp, 'input', () => {
          inp.classList.remove('is-error');
          const err = inp.closest('.form-field')?.querySelector('.field-error');
          if (err) err.classList.remove('is-visible');
        });
      });
    }
  })();

  /* ──────────────────────────────────────────────────────────
     Solution Advisor / Finder
  ────────────────────────────────────────────────────────── */
  (function advisor() {
    const form = $('#advisorForm');
    if (!form) return;

    const resultEl = $('#advisorResult');

    const recommendations = {
      '1-10': {
        'everyday-banking': {
          title: 'Spring Business Complete Checking℠',
          products: [
            'Spring Business Complete Checking℠ — No monthly fee with qualifying activity',
            'Spring Business Savings — Earn interest on your reserves',
            'Spring Ink Business Cash® Card — 5% cash back on business essentials',
          ],
          desc: 'Perfect for solo founders and micro-teams. Get a full-featured business account with no minimum balance headaches.',
        },
        lending: {
          title: 'Spring SBA Preferred Lender',
          products: [
            'SBA 7(a) Loan — Up to $5M for working capital',
            'Spring Business Line of Credit — Flexible revolving credit',
            'Spring Equipment Financing — Fixed-rate loans for equipment',
          ],
          desc: 'We\'re an SBA Preferred Lender. That means faster decisions and more loan options for your small business.',
        },
        payments: {
          title: 'Spring QuickAccept℠',
          products: [
            'Spring QuickAccept℠ — Accept cards right from your phone',
            'Spring Merchant Services — Low processing rates',
            'Spring Invoicing — Free invoicing integrated with your account',
          ],
          desc: 'Start accepting payments today with no hardware needed. Same-day deposits available.',
        },
      },
      '11-100': {
        'everyday-banking': {
          title: 'Spring Performance Business Checking℠',
          products: [
            'Spring Performance Business Checking℠ — Earn interest on balances',
            'Spring Business Premier Savings — Higher yields for growing reserves',
            'Spring Business Credit Card — Up to $0 annual fee',
          ],
          desc: 'Built for growing companies. Manage multiple users, set spending controls, and get real-time insights.',
        },
        lending: {
          title: 'Spring Business Term Loans',
          products: [
            'Spring Term Loan — $10K–$500K for expansion',
            'Spring Commercial Line of Credit — Up to $500K revolving',
            'Spring Commercial Real Estate Loan — Buy your space',
          ],
          desc: 'Scale with confidence. Our mid-market lending team delivers decisions in 2–3 business days.',
        },
        payments: {
          title: 'Spring Merchant Suite',
          products: [
            'Spring Merchant Services — Enterprise processing rates',
            'Spring Invoicing Pro — Automated AR + payment links',
            'Spring Payroll Integration — Pay employees from your account',
          ],
          desc: 'A complete payment ecosystem that grows with your team. Dedicated account manager included.',
        },
      },
      '100+': {
        'everyday-banking': {
          title: 'Spring Commercial Banking',
          products: [
            'Spring Commercial Checking — High-capacity, multi-entity support',
            'Spring Treasury Management — Optimize cash flow across accounts',
            'Spring Commercial Credit — Tailored corporate card programs',
          ],
          desc: 'Enterprise-grade treasury management, global payments, and dedicated relationship banking.',
        },
        lending: {
          title: 'Spring Commercial Lending',
          products: [
            'Spring Commercial Real Estate — Portfolio loans up to $50M',
            'Spring Syndicated Lending — Co-lead on large credit facilities',
            'Spring Private Credit — Flexible off-balance-sheet solutions',
          ],
          desc: 'Our commercial bankers work alongside your CFO to structure the right capital stack.',
        },
        payments: {
          title: 'Spring Enterprise Payments',
          products: [
            'Spring ACH/Wire Processing — High-volume, low-cost transfers',
            'Spring Global FX — 135 currencies at competitive rates',
            'Spring Virtual Cards — Automated AP with rebates',
          ],
          desc: 'End-to-end payments infrastructure with API access for custom integrations.',
        },
      },
    };

    const getBtn = $('#advisorGet', form);
    const resetBtn = $('#advisorReset', form);

    on(getBtn, 'click', () => {
      const size = $('#advisorSize', form)?.value;
      const need = $('#advisorNeed', form)?.value;

      if (!size || !need) {
        resultEl.innerHTML = '<p style="color:rgba(255,255,255,.7)">Please select both options above.</p>';
        resultEl.classList.add('is-visible');
        resultEl.focus();
        return;
      }

      const rec = recommendations[size]?.[need];
      if (!rec) return;

      resultEl.innerHTML = `
        <div class="advisor-result__title">${rec.title}</div>
        <p style="font-size:.875rem;color:rgba(255,255,255,.75);margin-bottom:10px">${rec.desc}</p>
        <div class="advisor-result__products">
          ${rec.products.map(p => `<div class="advisor-result__product">${p}</div>`).join('')}
        </div>
        <a href="signin.html" class="btn btn-primary btn-sm" style="margin-top:16px;display:inline-flex"
           data-pt-name="advisor_cta">Get started →</a>
      `;
      resultEl.classList.add('is-visible');
      resultEl.focus();
      track('advisor_recommendation', { size, need });
    });

    on(resetBtn, 'click', () => {
      $$('select', form).forEach(s => s.value = '');
      resultEl.classList.remove('is-visible');
      resultEl.innerHTML = '';
    });
  })();

  /* ──────────────────────────────────────────────────────────
     FAQ Accordion
  ────────────────────────────────────────────────────────── */
  (function accordion() {
    $$('.accordion__btn').forEach(btn => {
      on(btn, 'click', () => {
        const panel = document.getElementById(btn.getAttribute('aria-controls'));
        const open = btn.getAttribute('aria-expanded') === 'true';

        // Close all
        $$('.accordion__btn[aria-expanded="true"]').forEach(b => {
          b.setAttribute('aria-expanded', 'false');
          document.getElementById(b.getAttribute('aria-controls'))?.classList.remove('is-open');
        });

        if (!open) {
          btn.setAttribute('aria-expanded', 'true');
          panel?.classList.add('is-open');
        }
      });
    });
  })();

  /* ──────────────────────────────────────────────────────────
     Search
  ────────────────────────────────────────────────────────── */
  (function search() {
    const form = $('.search-form');
    if (!form) return;
    on(form, 'submit', e => {
      e.preventDefault();
      const q = $('input', form).value.trim();
      if (q) track('search', { query: q });
      // Static: no results, just clear
      $('input', form).value = '';
    });
  })();

  /* ──────────────────────────────────────────────────────────
     Language toggle (Español)
  ────────────────────────────────────────────────────────── */
  (function langToggle() {
    const btn = $('#langToggle');
    if (!btn) return;
    on(btn, 'click', () => {
      const isEs = document.documentElement.lang === 'es';
      if (isEs) {
        window.location.href = '/index.html';
      } else {
        window.location.href = '/es/index.html';
      }
    });
  })();

  /* ──────────────────────────────────────────────────────────
     Sticky header scroll shadow
  ────────────────────────────────────────────────────────── */
  (function stickyHeader() {
    const header = $('.site-header');
    if (!header) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          header.classList.toggle('is-scrolled', window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  })();

  /* ──────────────────────────────────────────────────────────
     Animate sections on scroll (Intersection Observer)
  ────────────────────────────────────────────────────────── */
  (function scrollReveal() {
    if (!('IntersectionObserver' in window)) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    $$('.card, .quad-tile, .industry-item, .why-block').forEach(el => {
      el.classList.add('reveal');
      obs.observe(el);
    });
  })();

  /* ──────────────────────────────────────────────────────────
     Spinner (signin page)
  ────────────────────────────────────────────────────────── */
  (function spinner() {
    const sp = $('#loadingSpinner');
    if (!sp) return;
    setTimeout(() => {
      sp.classList.add('fade-out');
      on(sp, 'transitionend', () => sp.remove(), { once: true });
    }, 900);
  })();

})();

/* ─── Scroll reveal CSS injected at runtime ─────────────── */
(function injectRevealStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .reveal { opacity: 0; transform: translateY(20px); transition: opacity .5s ease, transform .5s ease; }
    .reveal.revealed { opacity: 1; transform: translateY(0); }
  `;
  document.head.appendChild(style);
})();
