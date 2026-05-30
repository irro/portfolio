/* =====================================================================
   Alex Rivera Photography — WebGL globe (lazy-loaded enhancement)
   ---------------------------------------------------------------------
   A textured 3D earth rendered with Three.js. This module is imported on
   demand by js/globe.js only when the visitor switches to 3D, so the
   ~Three.js payload is never downloaded otherwise. If WebGL is missing or
   anything here throws, js/globe.js stays on the verified 2D SVG globe.

   The earth texture is drawn from the same world land data used by the 2D
   globe (window.WORLD_LAND) onto a canvas — clean and dependency-free.
   To use a photorealistic satellite image instead, set options.textureUrl
   to an equirectangular JPG/PNG (see README).

   Materials are UNLIT (MeshBasicMaterial) so the earth always shows its
   texture colours regardless of lighting.
   ===================================================================== */
import * as THREE from "./vendor/three/three.module.min.js";

/* ---- Pure helpers (unit-tested in Node) --------------------------- */

// Convert lat/lng (degrees) to a point on a sphere of the given radius.
// Longitude 0 faces +Z; this matches how we orient the equirectangular
// texture below, so markers land on the right place.
export function latLngToVector3(lat, lng, radius) {
  var phi = (90 - lat) * (Math.PI / 180);
  var theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Project a world-space point to {x, y} pixel coordinates and report
// whether it faces the camera (front of the globe).
export function projectToScreen(worldPos, camera, width, height) {
  var v = worldPos.clone().project(camera);
  return {
    x: (v.x * 0.5 + 0.5) * width,
    y: (-v.y * 0.5 + 0.5) * height,
    // z < 1 means in front of the far plane; combined with the facing test
    // in the caller this is enough to hide points behind the globe.
    inFront: v.z < 1
  };
}

// Draw the land outline onto a 2D canvas in equirectangular projection,
// returning the canvas to use as a texture.
export function drawEarthTexture(land, d3, palette, w, h) {
  var canvas =
    typeof document !== "undefined"
      ? document.createElement("canvas")
      : { width: w, height: h, getContext: function () { return null; } };
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }
  ctx.fillStyle = palette.ocean;
  ctx.fillRect(0, 0, w, h);
  var projection = d3
    .geoEquirectangular()
    .fitSize([w, h], { type: "Sphere" });
  var path = d3.geoPath(projection, ctx);
  ctx.beginPath();
  path(land);
  ctx.fillStyle = palette.land;
  ctx.fill();
  ctx.lineWidth = Math.max(1, w / 2048);
  ctx.strokeStyle = palette.landStroke;
  ctx.stroke();
  return canvas;
}

/* ---- Factory: build and mount the 3D globe ------------------------ */
export function createGlobe3D(options) {
  var stage = options.stage;
  var locations = options.locations;
  var d3 = options.d3;
  var land = options.land;
  var onActivate = options.onActivate; // (loc, openerEl) => void
  var buildClusters = options.buildClusters; // shared with the 2D globe
  var prefersReduced = options.prefersReduced;
  var palette = options.palette;

  var RADIUS = 100;
  var width = Math.max(1, stage.clientWidth);
  var height = Math.max(1, stage.clientHeight);

  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.domElement.className = "globe__canvas";
  stage.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, width / height, 1, 4000);
  var camDist = RADIUS * 3;
  camera.position.set(0, 0, camDist);

  var earthGroup = new THREE.Group();
  scene.add(earthGroup);

  // Earth — unlit textured sphere.
  var textureCanvas = drawEarthTexture(land, d3, palette, 2048, 1024);
  var texture = options.textureUrl
    ? new THREE.TextureLoader().load(options.textureUrl)
    : new THREE.CanvasTexture(textureCanvas);
  if ("colorSpace" in texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
  }
  var earth = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 64, 48),
    new THREE.MeshBasicMaterial({ map: texture })
  );
  earthGroup.add(earth);

  // Thin atmosphere halo (a slightly larger back-side sphere).
  var atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS * 1.06, 48, 32),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.atmosphere),
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide
    })
  );
  earthGroup.add(atmosphere);

  // Marker anchor points (children of the earth so they rotate with it).
  locations.forEach(function (loc) {
    loc._vec3d = latLngToVector3(loc.lat, loc.lng, RADIUS * 1.01);
  });

  // HTML overlay for accessible marker / cluster buttons.
  var overlay = document.createElement("div");
  overlay.className = "globe__overlay";
  stage.appendChild(overlay);

  var markerEls = locations.map(function (loc) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "globe__pin";
    btn.style.display = "none";
    btn.setAttribute(
      "aria-label",
      loc.name + ", " + loc.count + (loc.count === 1 ? " photo" : " photos")
    );
    btn.innerHTML = '<span class="globe__pin-dot" aria-hidden="true"></span>';
    btn.addEventListener("click", function () {
      if (!dragMoved) {
        onActivate(loc, btn);
      }
    });
    overlay.appendChild(btn);
    return btn;
  });

  // Cluster bubble pool.
  var clusterPool = locations.map(function () {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "globe__pin globe__pin--cluster";
    btn.style.display = "none";
    var entry = { el: btn, target: null };
    btn.addEventListener("click", function () {
      if (!dragMoved && entry.target) {
        spinning = false;
        focusOn(entry.target, camDist * 0.7);
      }
    });
    overlay.appendChild(btn);
    return entry;
  });

  /* ---- Rotation state -------------------------------------------- */
  var rotX = 0; // pitch (radians)
  var rotY = 0; // yaw (radians)
  var spinning = !prefersReduced;
  var dragMoved = false;
  var tmp = new THREE.Vector3();

  function applyRotation() {
    earthGroup.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
    earthGroup.rotation.y = rotY;
  }

  // Rotate so a given local point faces the camera, and set zoom distance.
  function focusOn(localVec, distance) {
    var targetY = Math.atan2(localVec.x, localVec.z);
    var targetX = Math.asin(
      Math.max(-1, Math.min(1, localVec.y / localVec.length()))
    );
    rotY = -targetY;
    rotX = targetX;
    if (distance) {
      camDist = Math.max(RADIUS * 1.4, Math.min(RADIUS * 3.4, distance));
      camera.position.z = camDist;
    }
    applyRotation();
  }

  /* ---- Overlay sync ---------------------------------------------- */
  function updateOverlay() {
    var visible = [];
    locations.forEach(function (loc, i) {
      tmp.copy(loc._vec3d).applyEuler(earthGroup.rotation);
      var screen = projectToScreen(tmp, camera, width, height);
      // Facing test: marker normal vs camera direction.
      var facing = tmp.clone().normalize().dot(camera.position.clone().normalize());
      markerEls[i].style.display = "none";
      if (facing > 0.12 && screen.inFront) {
        visible.push({ loc: loc, x: screen.x, y: screen.y, i: i });
      }
    });

    clusterPool.forEach(function (c) {
      c.el.style.display = "none";
    });

    var clusters = buildClusters(visible);
    var pool = 0;
    clusters.forEach(function (members) {
      if (members.length === 1) {
        var m = members[0];
        var el = markerEls[m.i];
        el.style.display = "";
        el.style.transform = "translate(-50%, -50%) translate(" + m.x + "px," + m.y + "px)";
        return;
      }
      var entry = clusterPool[pool++];
      var sx = 0;
      var sy = 0;
      var avg = new THREE.Vector3();
      members.forEach(function (m) {
        sx += m.x;
        sy += m.y;
        avg.add(m.loc._vec3d);
      });
      var n = members.length;
      avg.multiplyScalar(1 / n);
      entry.target = avg;
      entry.el.textContent = String(n);
      entry.el.setAttribute("aria-label", n + " locations here; activate to zoom in");
      entry.el.style.display = "";
      entry.el.style.transform =
        "translate(-50%, -50%) translate(" + sx / n + "px," + sy / n + "px)";
    });
  }

  /* ---- Render loop ----------------------------------------------- */
  var running = true;
  var lastT = 0;
  function frame(now) {
    if (!running) {
      return;
    }
    if (spinning) {
      if (lastT) {
        rotY += 0.00018 * (now - lastT);
        applyRotation();
      }
      lastT = now;
    } else {
      lastT = 0;
    }
    renderer.render(scene, camera);
    updateOverlay();
    requestAnimationFrame(frame);
  }

  /* ---- Interaction ----------------------------------------------- */
  var pointers = new Map();
  var last = null;
  var pinchDist = 0;
  var pinchCam = 0;
  var canvas = renderer.domElement;
  canvas.style.touchAction = "none";

  function distance() {
    var p = Array.from(pointers.values());
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) {
      return;
    }
    spinning = false;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragMoved = false;
      last = { x: e.clientX, y: e.clientY };
    } else if (pointers.size === 2) {
      pinchDist = distance();
      pinchCam = camDist;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  });

  function onMove(e) {
    if (!pointers.has(e.pointerId)) {
      return;
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2 && pinchDist > 0) {
      setCamDist((pinchCam * pinchDist) / distance());
      return;
    }
    if (last) {
      var dx = e.clientX - last.x;
      var dy = e.clientY - last.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        dragMoved = true;
      }
      rotY += dx * 0.005;
      rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX + dy * 0.005));
      applyRotation();
      last = { x: e.clientX, y: e.clientY };
    }
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) {
      pinchDist = 0;
    }
    if (pointers.size === 1) {
      var r = pointers.values().next().value;
      last = { x: r.x, y: r.y };
    }
    if (pointers.size === 0) {
      last = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    }
  }

  function setCamDist(d) {
    camDist = Math.max(RADIUS * 1.4, Math.min(RADIUS * 3.4, d));
    camera.position.z = camDist;
  }

  canvas.addEventListener(
    "wheel",
    function (e) {
      e.preventDefault();
      spinning = false;
      setCamDist(camDist * (e.deltaY < 0 ? 1 / 1.12 : 1.12));
    },
    { passive: false }
  );

  function resize() {
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  var ro =
    typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  if (ro) {
    ro.observe(stage);
  }

  // Start centred on the first location.
  focusOn(locations[0]._vec3d);
  requestAnimationFrame(frame);

  return {
    setSpinning: function (v) {
      spinning = v && !prefersReduced;
      lastT = 0;
    },
    isSpinning: function () {
      return spinning;
    },
    resetView: function () {
      focusOn(locations[0]._vec3d, RADIUS * 3);
    },
    destroy: function () {
      running = false;
      if (ro) {
        ro.disconnect();
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      overlay.remove();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }
  };
}
