// ── Game items ─────────────────────────────────────────
// (The spell-card system — play/arm/disarm, +6 toggle, card-cost teleport,
// cancel, and the card discard picker — was removed in the Credit Score
// redesign. This file keeps only the shared helpers below.)

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function leaveGame() {
  const goOverlay = document.getElementById("game-over-overlay");
  if (goOverlay) goOverlay.style.display = "none";
  if (gameId && gs && gs.state === "finished") {
    // Signal this player is ready to return to lobby
    window._returnedToLobby = true;
    socket.emit("return_to_lobby", { gameId });
    route();
  } else {
    if (gameId) socket.emit("leave_game", { gameId });
    gameId = null;
    gs = null;
    showScreen("screen-menu");
  }
}
