// ─── Toast Notification System ──────────────────────────────────────

const TOAST_DEFAULTS = { duration: 4000, maxToasts: 5 };

const TOAST_ICONS = {
  error: "\u274C",
  success: "\u2705",
  warning: "\u26A0\uFE0F",
  info: "\u2139\uFE0F",
};

function showToast(message, type, duration) {
  type = type || "error";
  duration = duration || TOAST_DEFAULTS.duration;

  const container = document.getElementById("toast-container");
  if (!container) return;

  // Limit visible toasts
  while (container.children.length >= TOAST_DEFAULTS.maxToasts) {
    container.removeChild(container.firstChild);
  }

  const toast = document.createElement("div");
  toast.className = "toast toast-" + type;

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = TOAST_ICONS[type] || TOAST_ICONS.info;

  const body = document.createElement("span");
  body.className = "toast-body";
  body.textContent = message;

  const close = document.createElement("button");
  close.className = "toast-close";
  close.innerHTML = "&times;";
  close.onclick = function (e) {
    e.stopPropagation();
    dismissToast(toast);
  };

  toast.appendChild(icon);
  toast.appendChild(body);
  toast.appendChild(close);

  // Click anywhere on toast to dismiss
  toast.onclick = function () { dismissToast(toast); };

  container.appendChild(toast);

  // Auto-dismiss
  toast._timeout = setTimeout(function () { dismissToast(toast); }, duration);
}

function dismissToast(toast) {
  if (toast._dismissed) return;
  toast._dismissed = true;
  clearTimeout(toast._timeout);
  toast.classList.add("toast-exit");
  toast.addEventListener("animationend", function () { toast.remove(); });
}
