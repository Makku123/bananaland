// Twemoji: consistent cross-platform emoji rendering.
// Controlled by a localStorage toggle ("twemoji-enabled").
(function () {
  if (typeof twemoji === "undefined") return;

  var STORAGE_KEY = "twemoji-enabled";
  var parseOpts = {
    folder: "svg",
    ext: ".svg",
    className: "tw-emoji",
  };

  var observer = null;
  var parsing = false; // guard to prevent re-entrant parsing loops
  var pendingParse = null; // debounce handle

  function isEnabled() {
    var val = localStorage.getItem(STORAGE_KEY);
    // Default to OFF (native emojis) if never set
    return val === "true";
  }

  // Remove all twemoji <img> tags and restore their alt text (the original emoji)
  function stripTwemoji() {
    var imgs = document.querySelectorAll("img.tw-emoji");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.alt && img.parentNode) {
        img.parentNode.replaceChild(document.createTextNode(img.alt), img);
      }
    }
  }

  // Parse a single DOM node, guarded against re-entrance
  function safeParse(node) {
    if (parsing) return;
    parsing = true;
    try {
      twemoji.parse(node, parseOpts);
    } finally {
      parsing = false;
    }
  }

  // Batch DOM mutations into a single parse per animation frame
  function scheduleParse(nodes) {
    if (!isEnabled()) return;
    if (pendingParse) return; // already scheduled
    pendingParse = requestAnimationFrame(function () {
      pendingParse = null;
      if (!isEnabled()) return;
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].isConnected !== false) {
          safeParse(nodes[i]);
        }
      }
    });
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(function (mutations) {
      if (parsing || !isEnabled()) return;
      var targets = [];
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.addedNodes.length) {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var node = m.addedNodes[j];
            // Skip twemoji img tags we just inserted
            if (
              node.nodeType === 1 &&
              !(node.tagName === "IMG" && node.classList.contains("tw-emoji"))
            ) {
              targets.push(node);
            }
          }
        }
        if (m.type === "characterData" && m.target.parentElement) {
          targets.push(m.target.parentElement);
        }
      }
      if (targets.length) scheduleParse(targets);
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (pendingParse) {
      cancelAnimationFrame(pendingParse);
      pendingParse = null;
    }
  }

  // Public API for the toggle
  window.twemojiSetEnabled = function (enabled) {
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
    if (enabled) {
      safeParse(document.body);
      startObserver();
    } else {
      stopObserver();
      stripTwemoji();
    }
  };

  window.twemojiIsEnabled = isEnabled;

  // Initialize based on saved preference
  if (isEnabled()) {
    safeParse(document.body);
    startObserver();
  }
})();
