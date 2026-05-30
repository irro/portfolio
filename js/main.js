/* =====================================================================
   Alex Rivera Photography — progressive enhancement
   ---------------------------------------------------------------------
   Everything here is an enhancement: the site is fully usable with
   JavaScript disabled. The mobile navigation falls back to a visible
   list, and gallery links fall back to opening the full-size image in
   a new tab.
   ===================================================================== */
(function () {
  "use strict";

  /* ---- Mobile navigation toggle ----------------------------------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");

  if (toggle && nav) {
    // JS is available, so start collapsed on small screens.
    var setNavState = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      nav.hidden = !open;
    };

    // Collapse only when the viewport is narrow; the CSS keeps the nav
    // visible on wide screens regardless of the [hidden] attribute.
    var mq = window.matchMedia("(max-width: 48rem)");
    var syncToViewport = function () {
      if (mq.matches) {
        setNavState(false);
      } else {
        toggle.setAttribute("aria-expanded", "false");
        nav.hidden = false;
      }
    };
    syncToViewport();
    mq.addEventListener("change", syncToViewport);

    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      setNavState(!open);
    });

    // Close the menu when a link is chosen or Escape is pressed.
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a") && mq.matches) {
        setNavState(false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (
        event.key === "Escape" &&
        mq.matches &&
        toggle.getAttribute("aria-expanded") === "true"
      ) {
        setNavState(false);
        toggle.focus();
      }
    });
  }

  /* ---- Accessible lightbox ---------------------------------------- */
  // Uses the native <dialog> element, which provides focus trapping,
  // Escape-to-close and inert background handling for free.
  var dialog = document.getElementById("lightbox");
  var gallery = document.querySelector("[data-gallery]");

  // Skip enhancement if the browser lacks <dialog> support.
  if (dialog && gallery && typeof dialog.showModal === "function") {
    var dialogImage = dialog.querySelector(".lightbox__image");
    var dialogCaption = dialog.querySelector(".lightbox__caption");
    var closeButton = dialog.querySelector(".lightbox__close");
    var lastFocused = null;
    // Remember the transparent placeholder to restore on close.
    var blankSrc = dialogImage.getAttribute("src");

    gallery.addEventListener("click", function (event) {
      var link = event.target.closest(".gallery__link");
      if (!link) {
        return;
      }
      // Let modified clicks (open in new tab) behave normally.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();
      lastFocused = link;

      var fullSrc = link.getAttribute("href");
      var caption = link.getAttribute("data-caption") || "";
      var alt = link.getAttribute("data-alt") || caption;

      dialogImage.setAttribute("src", fullSrc);
      dialogImage.setAttribute("alt", alt);
      dialogCaption.textContent = caption;

      dialog.showModal();
    });

    closeButton.addEventListener("click", function () {
      dialog.close();
    });

    // Click on the backdrop (outside the figure) closes the dialog.
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        dialog.close();
      }
    });

    // Return focus to the originating thumbnail when closed.
    dialog.addEventListener("close", function () {
      dialogImage.setAttribute("src", blankSrc);
      dialogImage.setAttribute("alt", "");
      dialogCaption.textContent = "";
      if (lastFocused) {
        lastFocused.focus();
        lastFocused = null;
      }
    });
  }

  /* ---- Auto-update copyright year --------------------------------- */
  var yearEl = document.querySelector("[data-current-year]");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();
