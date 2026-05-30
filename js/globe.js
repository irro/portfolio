/* =====================================================================
   Alex Rivera Photography — interactive globe
   ---------------------------------------------------------------------
   Renders an orthographic (3D-looking) globe with d3-geo and places a
   marker at every photo location. Locations are read from the static
   markup ([data-locations]), so that block is the single source of truth
   and the no-JavaScript fallback.

   Features: drag to rotate, wheel/pinch to zoom, gentle auto-rotation
   until the user interacts, and screen-space clustering of nearby markers
   when zoomed out. Activating a marker (or a button in the location list)
   opens an accessible <dialog> gallery of that location's photos.

   Interaction uses Pointer Events so it behaves the same with a mouse,
   touch or pen. Honours prefers-reduced-motion (no auto-rotation).
   ===================================================================== */
(function () {
  "use strict";

  var d3 = window.d3;
  var land = window.WORLD_LAND;
  var stage = document.querySelector("[data-globe]");
  var indexWrap = document.querySelector("[data-globe-index]");
  var locationsRoot = document.querySelector("[data-locations]");
  var dialog = document.getElementById("location-gallery");

  // Bail out (leaving the static fallback in place) if anything required
  // is missing or the browser lacks <dialog>/geo support.
  if (
    !d3 ||
    !d3.geoOrthographic ||
    !land ||
    !stage ||
    !indexWrap ||
    !locationsRoot ||
    !dialog ||
    typeof dialog.showModal !== "function"
  ) {
    return;
  }

  var SVG_NS = "http://www.w3.org/2000/svg";
  var prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  var CLUSTER_PX = 38; // markers closer than this on screen are grouped

  /* ---- Read locations from the DOM -------------------------------- */
  var locations = Array.prototype.map.call(
    locationsRoot.querySelectorAll(".location"),
    function (node) {
      var nameEl = node.querySelector(".location__name");
      return {
        id: node.id,
        name: nameEl ? nameEl.textContent.trim() : node.id,
        lat: parseFloat(node.getAttribute("data-lat")),
        lng: parseFloat(node.getAttribute("data-lng")),
        gallery: node.querySelector(".gallery"),
        count: node.querySelectorAll(".gallery__item").length
      };
    }
  ).filter(function (loc) {
    return !isNaN(loc.lat) && !isNaN(loc.lng) && loc.gallery;
  });

  if (!locations.length) {
    return;
  }

  /* ---- Build the SVG scene ---------------------------------------- */
  function el(tag, cls) {
    var node = document.createElementNS(SVG_NS, tag);
    if (cls) {
      node.setAttribute("class", cls);
    }
    return node;
  }

  var svg = el("svg", "globe__svg");
  svg.setAttribute("role", "group");
  svg.setAttribute(
    "aria-label",
    "World globe. Drag to rotate, scroll or pinch to zoom, then activate a " +
      "location marker to view its photos. Every location is also listed below."
  );

  var spherePath = el("path", "globe__sphere");
  var graticulePath = el("path", "globe__graticule");
  var landPath = el("path", "globe__land");
  var markersGroup = el("g", "globe__markers");
  svg.appendChild(spherePath);
  svg.appendChild(graticulePath);
  svg.appendChild(landPath);
  svg.appendChild(markersGroup);
  stage.appendChild(svg);

  var projection = d3.geoOrthographic().clipAngle(90).precision(0.5);
  var geoPath = d3.geoPath(projection);
  var graticule = d3.geoGraticule10();
  var sphere = { type: "Sphere" };

  var width = 0;
  var height = 0;
  var baseScale = 1;
  var zoom = 1;
  var MIN_ZOOM = 0.85;
  var MAX_ZOOM = 6;
  var SENSITIVITY = 75; // degrees-per-pixel factor, divided by scale

  // Start centred on the first location.
  var initialRotate = [-locations[0].lng, -locations[0].lat];
  var rotate = initialRotate.slice();
  var moved = false; // set true while dragging, to suppress the click

  /* ---- Markers ---------------------------------------------------- */
  locations.forEach(function (loc) {
    var marker = el("g", "globe__marker");
    marker.setAttribute("tabindex", "0");
    marker.setAttribute("role", "button");
    marker.setAttribute(
      "aria-label",
      loc.name + ", " + loc.count + (loc.count === 1 ? " photo" : " photos")
    );

    var inner = el("g", "globe__marker-inner");
    var pulse = el("circle", "globe__marker-pulse");
    pulse.setAttribute("r", "5");
    var dot = el("circle", "globe__marker-dot");
    dot.setAttribute("r", "5");
    var title = el("title");
    title.textContent = loc.name;

    inner.appendChild(pulse);
    inner.appendChild(dot);
    marker.appendChild(inner);
    marker.appendChild(title);
    markersGroup.appendChild(marker);
    loc.marker = marker;

    marker.addEventListener("click", function () {
      if (moved) {
        return; // this was a drag, not a tap
      }
      openLocation(loc, marker);
    });
    marker.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        openLocation(loc, marker);
      }
    });
  });

  /* ---- Cluster pool (reused across renders, so focus is stable) --- */
  var clusterPool = [];
  for (var p = 0; p < locations.length; p++) {
    clusterPool.push(makeCluster());
  }

  function makeCluster() {
    var g = el("g", "globe__cluster");
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.style.display = "none";
    var bg = el("circle", "globe__cluster-bg");
    bg.setAttribute("r", "14");
    var text = el("text", "globe__cluster-count");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dy", "0.34em");
    g.appendChild(bg);
    g.appendChild(text);
    markersGroup.appendChild(g);

    var entry = { el: g, count: text, targetRotate: null };
    var activate = function () {
      if (moved || !entry.targetRotate) {
        return;
      }
      stopSpin();
      setZoom(zoom * 1.8);
      animateRotation(entry.targetRotate.slice());
    };
    g.addEventListener("click", activate);
    g.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        activate();
      }
    });
    return entry;
  }

  /* ---- Clustering ------------------------------------------------- */
  // Greedy single-pass grouping of visible markers within CLUSTER_PX.
  function buildClusters(visible) {
    var clusters = [];
    var used = new Array(visible.length);
    for (var i = 0; i < visible.length; i++) {
      if (used[i]) {
        continue;
      }
      var members = [visible[i]];
      used[i] = true;
      for (var j = i + 1; j < visible.length; j++) {
        if (used[j]) {
          continue;
        }
        var dx = visible[i].x - visible[j].x;
        var dy = visible[i].y - visible[j].y;
        if (dx * dx + dy * dy < CLUSTER_PX * CLUSTER_PX) {
          members.push(visible[j]);
          used[j] = true;
        }
      }
      clusters.push(members);
    }
    return clusters;
  }

  /* ---- Rendering -------------------------------------------------- */
  var rafId = null;
  function scheduleRender() {
    if (rafId) {
      return;
    }
    rafId = requestAnimationFrame(function () {
      rafId = null;
      render();
    });
  }

  function render() {
    projection
      .scale(baseScale * zoom)
      .translate([width / 2, height / 2])
      .rotate(rotate);

    spherePath.setAttribute("d", geoPath(sphere) || "");
    graticulePath.setAttribute("d", geoPath(graticule) || "");
    landPath.setAttribute("d", geoPath(land) || "");

    var center = [-rotate[0], -rotate[1]];
    var visible = [];
    locations.forEach(function (loc) {
      var point = projection([loc.lng, loc.lat]);
      var isVisible =
        point && d3.geoDistance([loc.lng, loc.lat], center) < Math.PI / 2 - 1e-3;
      loc.marker.style.display = "none"; // shown below if a singleton
      if (isVisible) {
        visible.push({ loc: loc, x: point[0], y: point[1] });
      }
    });

    for (var c = 0; c < clusterPool.length; c++) {
      clusterPool[c].el.style.display = "none";
    }

    var clusters = buildClusters(visible);
    var poolIndex = 0;
    clusters.forEach(function (members) {
      if (members.length === 1) {
        var m = members[0];
        m.loc.marker.style.display = "";
        m.loc.marker.setAttribute("transform", "translate(" + m.x + "," + m.y + ")");
        return;
      }
      var entry = clusterPool[poolIndex++];
      var sx = 0;
      var sy = 0;
      var slat = 0;
      var slng = 0;
      members.forEach(function (m) {
        sx += m.x;
        sy += m.y;
        slat += m.loc.lat;
        slng += m.loc.lng;
      });
      var n = members.length;
      entry.el.style.display = "";
      entry.el.setAttribute("transform", "translate(" + sx / n + "," + sy / n + ")");
      entry.count.textContent = String(n);
      entry.el.setAttribute("aria-label", n + " locations here; activate to zoom in");
      entry.targetRotate = [-(slng / n), -(slat / n)];
    });
  }

  function measure() {
    var rect = stage.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    baseScale = (Math.min(width, height) / 2) * 0.92;
    render();
  }

  /* ---- Zoom helpers ----------------------------------------------- */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setZoom(next) {
    zoom = clamp(next, MIN_ZOOM, MAX_ZOOM);
    scheduleRender();
  }

  /* ---- Auto-rotation ---------------------------------------------- */
  var spinning = false;
  var spinRAF = null;
  var spinLast = 0;
  var SPIN_SPEED = 0.004; // degrees per millisecond (~4°/s)
  var spinButton = null;

  function spinFrame(now) {
    if (!spinning) {
      spinRAF = null;
      return;
    }
    if (spinLast) {
      rotate[0] += SPIN_SPEED * (now - spinLast);
      render();
    }
    spinLast = now;
    spinRAF = requestAnimationFrame(spinFrame);
  }

  function startSpin() {
    if (prefersReduced || spinning) {
      return;
    }
    spinning = true;
    spinLast = 0;
    updateSpinButton();
    spinRAF = requestAnimationFrame(spinFrame);
  }

  function stopSpin() {
    if (!spinning) {
      return;
    }
    spinning = false;
    if (spinRAF) {
      cancelAnimationFrame(spinRAF);
      spinRAF = null;
    }
    updateSpinButton();
  }

  function updateSpinButton() {
    if (!spinButton) {
      return;
    }
    spinButton.setAttribute("aria-pressed", String(spinning));
    spinButton.setAttribute("aria-label", spinning ? "Pause rotation" : "Start rotation");
    spinButton.textContent = spinning ? "⏸" : "▶";
  }

  /* ---- Pointer interaction (rotate + pinch zoom) ------------------ */
  var pointers = new Map();
  var dragging = false;
  var last = null;
  var pinchStartDist = 0;
  var pinchStartZoom = 1;

  function pointerDistance() {
    var pts = Array.from(pointers.values());
    var dx = pts[0].x - pts[1].x;
    var dy = pts[0].y - pts[1].y;
    return Math.hypot(dx, dy);
  }

  var windowListening = false;
  function startWindowListening() {
    if (windowListening) {
      return;
    }
    windowListening = true;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }
  function stopWindowListening() {
    if (!windowListening) {
      return;
    }
    windowListening = false;
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  }

  // We deliberately avoid setPointerCapture: in some browsers it re-targets
  // the synthesized click to the captured element, which would stop marker
  // clicks from opening their gallery. Window-level listeners keep the drag
  // working outside the SVG without that side effect.
  svg.addEventListener("pointerdown", function (event) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return; // ignore non-primary mouse buttons
    }
    stopSpin();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stopAnimation();

    if (pointers.size === 1) {
      dragging = true;
      moved = false;
      last = { x: event.clientX, y: event.clientY };
      svg.classList.add("is-grabbing");
    } else if (pointers.size === 2) {
      pinchStartDist = pointerDistance();
      pinchStartZoom = zoom;
    }
    startWindowListening();
  });

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) {
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size >= 2) {
      if (pinchStartDist > 0) {
        setZoom((pinchStartZoom * pointerDistance()) / pinchStartDist);
      }
      return;
    }

    if (dragging && last) {
      var dx = event.clientX - last.x;
      var dy = event.clientY - last.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        moved = true;
      }
      var k = SENSITIVITY / projection.scale();
      rotate[0] += dx * k;
      rotate[1] = clamp(rotate[1] - dy * k, -90, 90);
      last = { x: event.clientX, y: event.clientY };
      scheduleRender();
    }
  }

  function onPointerUp(event) {
    if (!pointers.has(event.pointerId)) {
      return;
    }
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      pinchStartDist = 0;
    }
    if (pointers.size === 1) {
      // Resume single-pointer drag cleanly after a pinch ends.
      var remaining = pointers.values().next().value;
      last = { x: remaining.x, y: remaining.y };
      dragging = true;
    }
    if (pointers.size === 0) {
      dragging = false;
      last = null;
      svg.classList.remove("is-grabbing");
      stopWindowListening();
    }
  }

  svg.addEventListener(
    "wheel",
    function (event) {
      event.preventDefault();
      stopSpin();
      stopAnimation();
      var factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      setZoom(zoom * factor);
    },
    { passive: false }
  );

  /* ---- Animated rotation (index list + cluster zoom) -------------- */
  var animId = null;
  function stopAnimation() {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  function shortestDelta(from, to) {
    return ((to - from + 540) % 360) - 180;
  }

  function animateRotation(target) {
    if (prefersReduced) {
      rotate = target.slice();
      scheduleRender();
      return;
    }
    stopAnimation();
    var start = rotate.slice();
    var dLambda = shortestDelta(start[0], target[0]);
    var dPhi = target[1] - start[1];
    var startTime = performance.now();
    var duration = 350;
    function step(now) {
      var t = Math.min(1, (now - startTime) / duration);
      var eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      rotate[0] = start[0] + dLambda * eased;
      rotate[1] = start[1] + dPhi * eased;
      scheduleRender();
      if (t < 1) {
        animId = requestAnimationFrame(step);
      } else {
        animId = null;
      }
    }
    animId = requestAnimationFrame(step);
  }

  function rotateTo(loc) {
    animateRotation([-loc.lng, -loc.lat]);
  }

  function setActiveMarker(loc, active) {
    if (loc.marker) {
      loc.marker.classList.toggle("is-active", active);
    }
  }

  /* ---- Controls (zoom, reset, rotation toggle) -------------------- */
  function makeControl(label, text, modifier, onClick) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "globe__control" + (modifier ? " " + modifier : "");
    button.setAttribute("aria-label", label);
    button.textContent = text;
    button.addEventListener("click", onClick);
    return button;
  }

  var controls = document.createElement("div");
  controls.className = "globe__controls";
  controls.appendChild(
    makeControl("Zoom in", "+", null, function () {
      stopSpin();
      stopAnimation();
      setZoom(zoom * 1.3);
    })
  );
  controls.appendChild(
    makeControl("Zoom out", "−", null, function () {
      stopSpin();
      stopAnimation();
      setZoom(zoom / 1.3);
    })
  );
  controls.appendChild(
    makeControl("Reset view", "Reset", "globe__control--reset", function () {
      stopSpin();
      stopAnimation();
      rotate = initialRotate.slice();
      zoom = 1;
      scheduleRender();
    })
  );
  if (!prefersReduced) {
    spinButton = makeControl("Pause rotation", "⏸", "globe__control--spin", function () {
      if (spinning) {
        stopSpin();
      } else {
        startSpin();
      }
    });
    controls.appendChild(spinButton);
  }
  stage.appendChild(controls);

  var hint = document.createElement("p");
  hint.className = "globe__hint";
  hint.textContent = "Drag to rotate · scroll or pinch to zoom";
  stage.appendChild(hint);

  /* ---- Location index list ---------------------------------------- */
  var indexList = document.createElement("ul");
  indexList.className = "globe__index";
  indexList.setAttribute("role", "list");

  locations.forEach(function (loc) {
    var item = document.createElement("li");
    var button = document.createElement("button");
    button.type = "button";
    button.className = "globe__index-btn";

    var name = document.createElement("span");
    name.className = "globe__index-name";
    name.textContent = loc.name;

    var count = document.createElement("span");
    count.className = "globe__index-count";
    count.textContent = loc.count + (loc.count === 1 ? " photo" : " photos");

    button.appendChild(name);
    button.appendChild(count);

    var preview = function () {
      stopSpin();
      rotateTo(loc);
      setActiveMarker(loc, true);
    };
    var clearPreview = function () {
      setActiveMarker(loc, false);
    };
    button.addEventListener("mouseenter", preview);
    button.addEventListener("focus", preview);
    button.addEventListener("mouseleave", clearPreview);
    button.addEventListener("blur", clearPreview);
    button.addEventListener("click", function () {
      openLocation(loc, button);
    });

    item.appendChild(button);
    indexList.appendChild(item);
  });
  indexWrap.appendChild(indexList);

  /* ---- Modal (location gallery) ----------------------------------- */
  var dialogTitle = dialog.querySelector("[data-locgallery-title]");
  var dialogBody = dialog.querySelector("[data-locgallery-body]");
  var dialogClose = dialog.querySelector("[data-locgallery-close]");
  var lastOpener = null;

  function openLocation(loc, opener) {
    stopSpin();
    lastOpener = opener || null;
    dialogTitle.textContent = loc.name;
    dialogBody.textContent = "";
    var clone = loc.gallery.cloneNode(true);
    clone.removeAttribute("id");
    dialogBody.appendChild(clone);
    dialog.showModal();
    dialogBody.scrollTop = 0;
  }

  dialogClose.addEventListener("click", function () {
    dialog.close();
  });

  // Click on the backdrop (outside the dialog's content) closes it.
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  dialog.addEventListener("close", function () {
    dialogBody.textContent = "";
    if (lastOpener && typeof lastOpener.focus === "function") {
      lastOpener.focus();
    }
    lastOpener = null;
  });

  /* ---- Boot ------------------------------------------------------- */
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(measure).observe(stage);
  } else {
    window.addEventListener("resize", measure);
  }
  measure();
  startSpin();
})();
