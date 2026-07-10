/**
 * window.TF — shared motion helpers for the Taskflow landing page.
 *
 * This file is loaded once, deferred, from Layout.astro's <head> — AFTER
 * an inline seed script (also in <head>, executed synchronously during
 * parsing) that already sets `window.TF = { reducedMotion, fmtClock }`.
 * This file only EXTENDS that object via Object.assign; it never
 * reassigns `window.TF`.
 *
 * LOAD-ORDER GUARANTEE (read this before calling any of these from a
 * section component's `is:inline` script):
 *   1. `TF.reducedMotion` and `TF.fmtClock` are seeded synchronously in
 *      <head>, before the page body is parsed. Safe to call from
 *      top-level `is:inline` script code (no callback needed).
 *   2. Everything in THIS file (`onVisible`, `drawPath`, `flipBetween`,
 *      `ticker`) is attached by a script tag that Astro bundles as a
 *      deferred ES module. Deferred/module scripts run after the whole
 *      document has been parsed (including every section's own
 *      `is:inline` body script, which run synchronously as the parser
 *      reaches them) but before `DOMContentLoaded` fires.
 *   Net effect: do NOT call TF.onVisible / TF.drawPath / TF.flipBetween /
 *   TF.ticker from top-level `is:inline` script code — they may not exist
 *   yet at that point. Call them from inside a
 *   `document.addEventListener('DOMContentLoaded', fn)` handler (or any
 *   later event/timer/IO callback); by the time DOMContentLoaded fires,
 *   this file has always already run.
 */
(function () {
  'use strict';

  /**
   * Observe an element's visibility with a single IntersectionObserver.
   *
   * @param {Element} el - element to observe.
   * @param {(isVisible?: boolean) => void} cb - `once:true` calls
   *   `cb()` with no args, exactly once. `once:false` calls
   *   `cb(isVisible)` on every crossing of `threshold`, forever.
   * @param {{once?: boolean, threshold?: number}} [opts]
   *   `once` defaults to true. `threshold` defaults to 0.
   * @returns {IntersectionObserver|null} the observer (so a caller that
   *   wants to disconnect a `once:false` observer early can), or null if
   *   IntersectionObserver isn't available / el is falsy (cb still fires
   *   once, synchronously, as if immediately visible).
   */
  function onVisible(el, cb, opts) {
    var once = !opts || opts.once === undefined ? true : opts.once;
    var threshold = opts && opts.threshold !== undefined ? opts.threshold : 0;

    if (!el || typeof IntersectionObserver === 'undefined') {
      if (once) cb();
      else cb(true);
      return null;
    }

    var io = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          var entry = entries[i];
          if (once) {
            if (entry.isIntersecting) {
              cb();
              io.disconnect();
            }
          } else {
            cb(entry.isIntersecting);
          }
        }
      },
      { threshold: threshold }
    );
    io.observe(el);
    return io;
  }

  /**
   * Stroke-draw / undraw choreography for one SVG <path>.
   *
   * Sets `stroke-dasharray` to the path's real length L, then animates
   * `stroke-dashoffset` L -> 0 over `duration`ms (linear), starting after
   * `delay`ms — the line appears to draw itself in from its start point.
   *
   * If `undraw` is given, a second phase runs after the draw phase
   * finishes: `stroke-dashoffset` animates 0 -> -L over `undraw.duration`
   * (after `undraw.delay`ms), which erases the line from its start point
   * ("undraws behind" the leading edge, rather than fading).
   *
   * Under `TF.reducedMotion`, jumps straight to the end state (fully
   * drawn, or fully undrawn if `undraw` was requested) with no animation.
   *
   * @param {SVGPathElement} pathEl
   * @param {{delay?: number, duration: number, undraw?: {delay?: number, duration: number}}} opts
   * @returns {Promise<void>} resolves once the final phase completes.
   */
  function drawPath(pathEl, opts) {
    opts = opts || {};
    var duration = opts.duration || 0;
    var delay = opts.delay || 0;
    var L = 0;
    try {
      L = pathEl.getTotalLength();
    } catch (e) {
      L = 0;
    }
    pathEl.style.strokeDasharray = String(L);

    if (window.TF.reducedMotion) {
      pathEl.style.strokeDashoffset = opts.undraw ? String(-L) : '0';
      return Promise.resolve();
    }

    pathEl.style.strokeDashoffset = String(L);

    var draw = pathEl
      .animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], {
        duration: duration,
        delay: delay,
        easing: 'linear',
        fill: 'forwards',
      })
      .finished.catch(function () {});

    if (!opts.undraw) return draw;

    return draw.then(function () {
      var u = opts.undraw;
      return pathEl
        .animate([{ strokeDashoffset: 0 }, { strokeDashoffset: -L }], {
          duration: u.duration,
          delay: u.delay || 0,
          easing: 'linear',
          fill: 'forwards',
        })
        .finished.catch(function () {});
    });
  }

  /**
   * Play a FLIP transform on `el` from `fromRect` to `toRect`.
   *
   * `el` is assumed already laid out at `toRect`. This computes the
   * translate+scale delta that makes it LOOK like it is still at
   * `fromRect`, applies that as a transform with no transition, flushes
   * layout, then animates the transform back to identity — so `el`
   * appears to travel from `fromRect` to `toRect`.
   *
   * Under `TF.reducedMotion`, jumps straight to identity transform.
   *
   * @param {HTMLElement} el
   * @param {{left: number, top: number, width: number, height: number}} fromRect
   * @param {{left: number, top: number, width: number, height: number}} toRect
   * @param {{duration?: number, easing?: string, delay?: number}} [opts]
   *   `duration` defaults to 480, `easing` to the brand settle curve,
   *   `delay` to 0.
   * @returns {Promise<void>} resolves when the flip animation ends.
   */
  function flipBetween(el, fromRect, toRect, opts) {
    opts = opts || {};
    var duration = opts.duration !== undefined ? opts.duration : 480;
    var easing = opts.easing || 'cubic-bezier(0.16,1,0.3,1)';
    var delay = opts.delay || 0;

    if (window.TF.reducedMotion) {
      el.style.transform = 'none';
      return Promise.resolve();
    }

    var dx = fromRect.left - toRect.left;
    var dy = fromRect.top - toRect.top;
    var sx = toRect.width ? fromRect.width / toRect.width : 1;
    var sy = toRect.height ? fromRect.height / toRect.height : 1;
    var invert =
      'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';

    el.style.transition = 'none';
    el.style.transform = invert;
    void el.offsetWidth; // flush: commit the "from" transform before animating away from it

    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        var anim = el.animate([{ transform: invert }, { transform: 'none' }], {
          duration: duration,
          delay: delay,
          easing: easing,
          fill: 'forwards',
        });
        anim.finished
          .then(function () {
            el.style.transform = 'none';
            resolve();
          })
          .catch(resolve);
      });
    });
  }

  /**
   * Play a batched FLIP over many elements with a single forced layout.
   *
   * `flipBetween` flushes layout (`void el.offsetWidth`) once per element,
   * so flipping N nodes in a loop triggers N synchronous layouts. This
   * variant applies every element's invert transform first, does ONE flush
   * for the whole batch, then starts all the WAAPI animations on the next
   * frame — one forced layout regardless of N.
   *
   * Each item is `{el, fromRect, toRect, opts}`; `opts` matches
   * `flipBetween`'s (duration/easing/delay). Callers must have already laid
   * every `el` out at its `toRect` and captured both rects before calling.
   *
   * @param {Array<{el: HTMLElement, fromRect: DOMRect, toRect: DOMRect, opts?: object}>} items
   * @returns {Promise<void>} resolves once every flip animation ends.
   */
  function flipBatch(items) {
    if (window.TF.reducedMotion) {
      items.forEach(function (it) {
        it.el.style.transform = 'none';
      });
      return Promise.resolve();
    }

    var inverts = items.map(function (it) {
      var f = it.fromRect;
      var t = it.toRect;
      var dx = f.left - t.left;
      var dy = f.top - t.top;
      var sx = t.width ? f.width / t.width : 1;
      var sy = t.height ? f.height / t.height : 1;
      var inv =
        'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';
      it.el.style.transition = 'none';
      it.el.style.transform = inv;
      return inv;
    });

    void document.documentElement.offsetWidth; // single flush for the whole batch

    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        var proms = items.map(function (it, i) {
          var opts = it.opts || {};
          var anim = it.el.animate(
            [{ transform: inverts[i] }, { transform: 'none' }],
            {
              duration: opts.duration !== undefined ? opts.duration : 480,
              delay: opts.delay || 0,
              easing: opts.easing || 'cubic-bezier(0.16,1,0.3,1)',
              fill: 'forwards',
            }
          );
          return anim.finished
            .then(function () {
              it.el.style.transform = 'none';
            })
            .catch(function () {});
        });
        Promise.all(proms).then(function () {
          resolve();
        });
      });
    });
  }

  /**
   * TF.ticker — one shared requestAnimationFrame loop for the whole page,
   * so multiple sections don't each spin up their own rAF.
   *
   * @property {(fn: (now: number, dt: number) => void) => void} add -
   *   registers `fn` to run every frame with `(now, dt)` (dt in ms since
   *   the previous frame, 0 on the first frame after (re)start). Starts
   *   the loop if it wasn't already running. No-op if `fn` is already
   *   registered.
   * @property {(fn: Function) => void} remove - unregisters `fn`. Stops
   *   the loop once no functions remain registered.
   */
  var tickerFns = [];
  var tickerLast = 0;
  // Single source of truth for the outstanding rAF: a live handle when the
  // loop is scheduled, null when it isn't. Tracking the handle (rather than
  // a boolean) closes the remove()->add() race where a stale queued frame
  // and a freshly scheduled one could both keep looping and double-drive
  // every registered fn (dt double-counted, sweep speed doubled).
  var rafId = null;

  function tickerFrame(now) {
    rafId = null; // this frame has fired; add()/end-of-frame decide the next one
    var dt = tickerLast ? now - tickerLast : 0;
    tickerLast = now;
    for (var i = 0; i < tickerFns.length; i++) {
      tickerFns[i](now, dt);
    }
    // A fn may have (re)added during the loop and already scheduled; only
    // schedule here if nothing else did and work still remains.
    if (tickerFns.length && rafId == null) {
      rafId = requestAnimationFrame(tickerFrame);
    }
  }

  var ticker = {
    add: function (fn) {
      if (tickerFns.indexOf(fn) !== -1) return;
      tickerFns.push(fn);
      if (rafId == null) {
        tickerLast = 0;
        rafId = requestAnimationFrame(tickerFrame);
      }
    },
    remove: function (fn) {
      var i = tickerFns.indexOf(fn);
      if (i !== -1) tickerFns.splice(i, 1);
      if (tickerFns.length === 0 && rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };

  Object.assign(window.TF, {
    onVisible: onVisible,
    drawPath: drawPath,
    flipBetween: flipBetween,
    flipBatch: flipBatch,
    ticker: ticker,
  });
})();
