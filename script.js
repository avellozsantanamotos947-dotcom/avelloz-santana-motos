// Avelloz Santana Motos — JS

// Header: scroll-aware state + mobile menu toggle + close-on-link
(function () {
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  const toggle = document.querySelector('.menu-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
    links.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => links.classList.remove('open'));
    });
  }
})();

// Pre-fill "modelo de interesse" from ?modelo= query param (linked from moto cards)
(function () {
  const params = new URLSearchParams(window.location.search);
  const modelo = params.get('modelo');
  const select = document.querySelector('#modelo');
  if (modelo && select) {
    // try direct match
    const opt = Array.from(select.options).find(
      (o) => o.value.toLowerCase() === modelo.toLowerCase()
    );
    if (opt) select.value = opt.value;
  }
})();

// Filter chips on motos.html
(function () {
  const chips = document.querySelectorAll('.filter-chip');
  const cards = document.querySelectorAll('.moto-card[data-category]');
  if (!chips.length || !cards.length) return;
  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const cat = chip.dataset.filter;
      cards.forEach((card) => {
        const matches = cat === 'all' || card.dataset.category === cat;
        card.style.display = matches ? '' : 'none';
      });
    });
  });
})();

// Color switcher + angle gallery on model strips (motos.html)
(function () {
  const angleLabels = ['Diagonal', 'Lateral direita', 'Frente', 'Lateral esquerda'];
  document.querySelectorAll('.model-strip').forEach((strip) => {
    const img = strip.querySelector('[data-model-img]');
    const cta = strip.querySelector('[data-cta]');
    const corLabel = strip.querySelector('[data-cor-label]');
    const thumbsBox = strip.querySelector('[data-thumbs]');
    const swatches = strip.querySelectorAll('.swatch');
    if (!swatches.length) return;
    const baseHref = cta ? cta.getAttribute('href') : null;
    const titleEl = strip.querySelector('h3');
    const modelName = titleEl ? titleEl.textContent.trim() : '';

    function setMain(src, cor) {
      if (!img) return;
      img.src = src;
      img.alt = (modelName + ' ' + cor).trim();
    }

    function renderThumbs(list, cor) {
      if (!thumbsBox) return;
      thumbsBox.innerHTML = '';
      list.forEach((src, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'thumb' + (i === 0 ? ' active' : '');
        b.setAttribute('aria-label', (modelName + ' ' + cor + ' — ' + (angleLabels[i] || 'foto')).trim());
        const t = document.createElement('img');
        t.src = src;
        t.loading = 'lazy';
        t.alt = (modelName + ' ' + cor).trim();
        b.appendChild(t);
        b.addEventListener('click', () => {
          thumbsBox.querySelectorAll('.thumb').forEach((x) => x.classList.remove('active'));
          b.classList.add('active');
          setMain(src, cor);
        });
        thumbsBox.appendChild(b);
      });
    }

    function selectColor(sw) {
      swatches.forEach((s) => s.classList.remove('active'));
      sw.classList.add('active');
      const cor = sw.dataset.cor || '';
      const list = (sw.dataset.imgs || sw.dataset.img || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (list[0]) setMain(list[0], cor);
      if (corLabel) corLabel.textContent = cor;
      if (cta && baseHref) {
        const sep = baseHref.indexOf('?') > -1 ? '&' : '?';
        cta.href = baseHref + sep + 'cor=' + encodeURIComponent(cor);
      }
      renderThumbs(list, cor);
    }

    swatches.forEach((sw) => sw.addEventListener('click', () => selectColor(sw)));
    const initial = strip.querySelector('.swatch.active') || swatches[0];
    if (initial) selectColor(initial);
  });
})();

// Contact form submission is now handled by crm-integration.js
// to allow real-time validation, masking, and direct integration with nortee CRM.

// Year in footer
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = new Date().getFullYear();
});

// Floating WhatsApp button (all pages)
(function () {
  if (document.querySelector('.whatsapp-fab')) return;
  const a = document.createElement('a');
  a.className = 'whatsapp-fab';
  a.href =
    'https://wa.me/5577981034163?text=' +
    encodeURIComponent('Olá! Tenho interesse em uma moto Avelloz.');
  a.target = '_blank';
  a.rel = 'noopener';
  a.setAttribute('aria-label', 'Falar no WhatsApp');
  a.innerHTML =
    '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M20.5 3.5A10.5 10.5 0 0 0 3.6 17.2L2 22l4.9-1.6A10.4 10.4 0 0 0 12 22h.1a10.5 10.5 0 0 0 7.4-3 10.5 10.5 0 0 0 1-15.5zM12 20a8.7 8.7 0 0 1-4.4-1.2l-.3-.2-3 1 1-2.9-.2-.3a8.7 8.7 0 1 1 6.9 3.6zm5-6.5c-.3-.1-1.6-.8-1.9-.9-.3-.1-.4-.1-.6.2-.2.3-.7.9-.8 1.1-.2.2-.3.2-.6.1-1.7-.9-2.9-1.5-4-3.5-.3-.5.3-.5.9-1.5.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2 0 1.3.9 2.6 1.1 2.8.1.2 1.9 2.9 4.6 4.1 1.7.7 2.3.7 3.1.6.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.2-1.3-.1-.1-.2-.2-.5-.3z"/></svg>';
  document.body.appendChild(a);
})();

// Hero stats counter animation
(function () {
  const stats = document.querySelectorAll('.hero-stats .stat strong');
  if (!stats.length || !('IntersectionObserver' in window)) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  const animate = (el) => {
    const text = el.textContent.trim();
    const m = text.match(/^(\d+)(.*)$/);
    if (!m) return;
    const target = parseInt(m[1], 10);
    const suffix = m[2];
    if (target === 0) { el.textContent = '0' + suffix; return; }
    const dur = 1200;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        animate(e.target);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  stats.forEach((s) => obs.observe(s));
})();

// Scroll reveal (respects reduced-motion; no flash for above-the-fold)
(function () {
  const targets = document.querySelectorAll(
    '.moto-card, .feature, .model-strip, .section-header, .reel-card, .cta-banner, .lifestyle-banner .container, .contact-channel, .form-card'
  );
  if (!targets.length) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    targets.forEach((t) => t.classList.add('reveal', 'reveal-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('reveal-visible');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  targets.forEach((t) => {
    t.classList.add('reveal');
    if (t.getBoundingClientRect().top < window.innerHeight * 0.92) {
      t.classList.add('reveal-visible'); // already visible: avoid flash
    } else {
      io.observe(t);
    }
  });
})();
