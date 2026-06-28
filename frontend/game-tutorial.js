/* ── Tutorial Mode ─────────────────────────────────────────────── */

let _tutStep = 0;
let _tutVisited = new Set();

const TUTORIAL_STEPS = [
  // 0: Welcome
  {
    title: "Welcome to Monkey Business!",
    icon: "🐒",
    render() {
      return `
        <div class="tut-icon">🐒🍌💰</div>
        <h2>Welcome to Monkey Business!</h2>
        <p>Ready to become the <span class="tut-highlight">top banana tycoon</span>? This tutorial will teach you everything you need to dominate the board.</p>
        <p>You'll learn how to buy farms, grow bananas, outsmart opponents, and race for the Super Banana.</p>
        <div class="tut-tip"><strong>Tip:</strong> You can click the dots below to jump to any section, or use the arrow buttons to go step by step.</div>
        <p style="text-align:center;margin-top:12px;font-size:0.85em;color:#aaa;">Click <span class="tut-highlight">Next →</span> to begin!</p>`;
    },
  },
  // 1: The Board
  {
    title: "The Board",
    icon: "🗺️",
    render() {
      return `
        <div class="tut-icon">🗺️</div>
        <h2>The Board</h2>
        <p>The board has <span class="tut-highlight">48 spaces</span> arranged in a cornerless square loop. Every game shuffles the tiles, so no two games are the same!</p>
        <p>The board holds:</p>
        <p>🌴 <strong>6 GROW tiles</strong> — labeled 1–6, hidden until discovered</p>
        <p>🏞️ <strong>40 farms</strong> — labelled F1..F40 by yield</p>
        <p>⭐ <strong>1 Super Banana</strong> — buy it for 2000🍌 to win the game</p>
        <p>🌵 <strong>1 Desert</strong> — auctioned like a farm, but it grows nothing</p>
        <p>You start <span class="tut-highlight">off the board</span> — your very first turn is choosing any tile to start on.</p>`;
    },
  },
  // 2: Dice & Movement
  {
    title: "Dice & Movement",
    icon: "🎲",
    render() {
      return `
        <div class="tut-icon">🎲</div>
        <h2>Rolling the Dice</h2>
        <p>Each turn you <span class="tut-highlight">roll 2 dice</span> and move their sum — or, if you'd rather pick your move, play a <span class="tut-highlight">Spell Card</span> instead (more on those soon).</p>
        <p><strong>Low-roll twist:</strong> if your roll is <span class="tut-highlight">below 7</span>, you move <span class="tut-highlight">7 − your roll</span> instead (a 6 → 1 step, a 2 → 5 steps); 7 or more moves normally. This applies to <strong>every</strong> roll — both dice and Spell Cards.</p>
        <div class="tut-dice-demo">
          <div class="tut-die" onclick="tutRollDie(this)">3</div>
          <div class="tut-die" onclick="tutRollDie(this)">5</div>
        </div>
        <p>If your <span class="tut-highlight">roll number equals a revealed GROW's number</span> (1–6), that GROW fires <strong>before you move</strong> (you still walk the 7 − roll distance). With 2 dice the sum is 2–12, so sums of 7+ match nothing — but a Spell Card of 1–6 always fires its matching GROW. Hidden GROWs stay dormant.</p>
        <p>As you move, you <span class="tut-highlight">collect the whole pile</span> on your <strong>own</strong> farms when you cross or land on them. <strong>Land</strong> on an <strong>opponent's</strong> farm and you <span class="tut-highlight">steal its whole pile</span> right away (a <strong>"Stolen"</strong>) — but only by landing; just <strong>crossing</strong> it takes nothing, and bananas that grow there after you land stay with the owner. See Banana Economy.</p>
        <div class="tut-tip"><strong>Tip:</strong> Landing on a GROW reveals it and unlocks its number trigger for everyone, so picking when to reveal one is a tactical decision.</div>`;
    },
  },
  // 3: Buying Farms
  {
    title: "Buying Farms",
    icon: "🏞️",
    render() {
      return `
        <div class="tut-icon">🏞️</div>
        <h2>Buying Farms</h2>
        <p>Every farm is labeled <span class="tut-highlight">F1..F40</span>. The number is the farm's yield — how many bananas it grows each time a GROW fires on it.</p>
        <p>You don't auto-buy a farm by landing on it — instead, every unowned farm goes to an <span class="tut-highlight">auction</span> when someone lands on it.</p>
        <p>Owning a farm doesn't collect rent. Instead, GROW tiles deposit bananas onto your farms over time — and that pile is what you (or anyone walking past) can collect.</p>
        <div class="tut-tip"><strong>Tip:</strong> Higher-numbered farms grow faster but cost more to win in auction. Pick your battles.</div>`;
    },
  },
  // 4: Banana Economy
  {
    title: "Banana Economy",
    icon: "🍌",
    render() {
      return `
        <div class="tut-icon">🍌</div>
        <h2>The Banana Economy</h2>
        <p>Bananas are your currency. You start with <span class="tut-highlight">2,222 bananas</span> (customizable). Here's how to earn more:</p>
        <p>🌴 <strong>GROW tiles</strong> — a fired GROW sweeps clockwise and grows every <em>revealed</em> farm you own until it hits the next revealed GROW (yield = farm number)</p>
        <p>🚶 <strong>Piles</strong> — own a farm with a pile? Cross or land on it to harvest it ALL. LAND on an opponent's farm and you STEAL its whole pile on the spot (a "Stolen") — but only by landing; crossing takes nothing, and later growth stays with the owner</p>
        <p>🏆 <strong>Win the game</strong> — be the first to afford and buy the <span class="tut-highlight">Super Banana</span> (2000🍌)</p>`;
    },
  },
  // 5: Auctions
  {
    title: "Auctions",
    icon: "🔨",
    render() {
      return `
        <div class="tut-icon">🔨</div>
        <h2>Auctions</h2>
        <p>Land on an <span class="tut-highlight">unowned farm</span> and it goes to a live auction. You (the lander) run it:</p>
        <p>1️⃣ <strong>Pitch</strong> — you name a price (min 1🍌, capped at the richest opponent's total)</p>
        <p>2️⃣ <strong>Respond</strong> — everyone who can afford it secretly <span style="color:#4caf50;">accepts</span> or <span style="color:#e74c3c;">rejects</span>. Nobody accepts? It's yours at your price. One accepts? They buy it</p>
        <p>3️⃣ <strong>Silent tie-breaker</strong> — if 2+ accept, each secretly adds a top-up; highest wins. A tied top-up means <strong>you keep the farm</strong> at the pitch price</p>
        <p>Broke when you land? It's a one-round <span class="tut-highlight">sealed bid</span> instead — highest bid wins, and a tie leaves the farm with you.</p>
        <div class="tut-tip"><strong>Strategy:</strong> Pitch low and you invite a steal; pitch high and you overpay when nobody bites. If you're strictly the richest, <strong>Buy Now</strong> takes it instantly for the richest opponent's total + 1.</div>`;
    },
  },
  // 6: Spell Cards
  {
    title: "Spell Cards",
    icon: "🔮",
    render() {
      return `
        <div class="tut-icon">🔮🔮</div>
        <h2>Spell Cards</h2>
        <p>You start every game with <span class="tut-highlight">7 Spell Cards</span>. Each card is a random number from <strong>1 to 6</strong> (duplicates are common). They're <span class="tut-highlight">concealed</span> — yours alone: opponents see only how many you hold, never the numbers.</p>
        <p>🔄 <strong>Pre-game reveal:</strong> before play begins you'll see your 7 cards dealt in (while the board is shuffled). The hand you're dealt is the hand you keep.</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:12px 0;">
          <div style="display:flex;border-radius:8px;overflow:hidden;border:2px solid rgba(150,100,240,0.55);font-size:1.3em;font-weight:800;line-height:1;">
            <span style="background:linear-gradient(160deg,#4ad15a,#1c6c30);color:#fff;padding:9px 13px;">4</span>
            <span style="background:linear-gradient(160deg,#7a4fd0,#311c61);color:#f3e9ff;padding:9px 13px;border-left:2px solid rgba(255,255,255,0.5);">3</span>
          </div>
          <div style="display:flex;border-radius:8px;overflow:hidden;border:2px solid rgba(150,100,240,0.55);font-size:1.3em;font-weight:800;line-height:1;">
            <span style="background:linear-gradient(160deg,#4ad15a,#1c6c30);color:#fff;padding:9px 13px;">1</span>
            <span style="background:linear-gradient(160deg,#7a4fd0,#311c61);color:#f3e9ff;padding:9px 13px;border-left:2px solid rgba(255,255,255,0.5);">6</span>
          </div>
          <div style="display:flex;border-radius:8px;overflow:hidden;border:2px solid rgba(150,100,240,0.55);font-size:1.3em;font-weight:800;line-height:1;">
            <span style="background:linear-gradient(160deg,#4ad15a,#1c6c30);color:#fff;padding:9px 13px;">6</span>
            <span style="background:linear-gradient(160deg,#7a4fd0,#311c61);color:#f3e9ff;padding:9px 13px;border-left:2px solid rgba(255,255,255,0.5);">1</span>
          </div>
          <div style="display:flex;border-radius:8px;overflow:hidden;border:2px solid rgba(150,100,240,0.55);font-size:1.3em;font-weight:800;line-height:1;">
            <span style="background:linear-gradient(160deg,#4ad15a,#1c6c30);color:#fff;padding:9px 13px;">3</span>
            <span style="background:linear-gradient(160deg,#7a4fd0,#311c61);color:#f3e9ff;padding:9px 13px;border-left:2px solid rgba(255,255,255,0.5);">4</span>
          </div>
        </div>
        <p style="text-align:center;font-size:0.85em;color:#aaa;margin-top:-4px;"><span style="color:#4ad15a;font-weight:700;">green</span> = the GROW it triggers (if revealed) · <span style="color:#b98cff;font-weight:700;">purple</span> = steps it walks (7 − value)</p>
        <p>On your turn, <strong>before you roll</strong>, click a card to play it — no luck involved. Since cards are 1–6 they always invert: you <span class="tut-highlight">move 7 − the card's value</span> (the purple number). It counts as your roll for the turn: the matching <strong>GROW fires first</strong> (the green number, if revealed), then you move, collecting and stealing along the way just like a dice roll. <strong>One Spell Card (or one dice roll) per turn.</strong></p>
        <p>🌟 <strong>Earning more (with a redraw):</strong> you earn an extra Spell Card from the <span class="tut-highlight">Super Banana</span> (land on it when you can't afford it, or cross an already-revealed one while you <em>can</em> afford it) <em>and</em> from a <span class="tut-highlight">successful Cancel Opponent Card</span>. You <strong>draw a card and may Keep it or Reroll</strong> — up to one reroll (2 draws max, no take-backs). (A <em>missed</em> cancel instead costs you two cards — see Cancel.)</p>
        <div class="tut-tip"><strong>Tip:</strong> Want to land somewhere exact? Pick the card whose <strong>purple</strong> number (7 − value) equals the distance — a guaranteed move beats gambling when it counts.</div>`;
    },
  },
  // 7: The Super Banana
  {
    title: "The Super Banana",
    icon: "⭐",
    render() {
      return `
        <div class="tut-icon">⭐</div>
        <h2>The Super Banana</h2>
        <p>One tile hides the <strong>Super Banana</strong> (default <span class="tut-highlight">2000🍌</span>). It stays put for the whole game — you find it by <strong>landing</strong> on it, which reveals it for good. You must <strong>LAND</strong> on it to interact — in <strong>every</strong> mode. Just crossing over it does <strong>nothing</strong>.</p>
        <p>💰 <strong>Can you afford it?</strong> You buy it and <strong>win the game!</strong> (In team mode the whole team wins.) Remember: you have to land on it, not cross it.</p>
        <p>🔮 <strong>Can't afford it?</strong> You don't win — instead the Super Banana rolls a <strong>hidden number 0–2</strong> (how many Spell Cards the winner will draw). You <strong>name a price</strong> and your opponents bid <strong>blind</strong> — only you know the number. The first to <strong>accept</strong> pays and draws that many random cards; even a <strong>0</strong> can be sold for nothing (bluff it!). You never draw — you're selling the mystery.</p>
        <div style="text-align:center;font-size:2em;margin:10px 0;animation:pulse 1.5s infinite;">⭐🐵👑</div>
        <div class="tut-tip"><strong>Strategy:</strong> Line up a Spell Card whose walk distance (7 − value) lands you exactly on the Super Banana — crossing it wastes the trip.</div>`;
    },
  },
  // 8: Game Modes & Tips
  {
    title: "Game Modes & Tips",
    icon: "🏆",
    render() {
      return `
        <div class="tut-icon">🏆</div>
        <h2>Game Modes</h2>
        <p><strong>🐒 Classic (2-6 players)</strong> — Free-for-all. Win by buying the Super Banana for 2000🍌.</p>
        <p><strong>🤝 Team mode — 2v2 (4) or 3v3 (6)</strong> — Work with your team. Win when either teammate buys the Super Banana.</p>
        <h2 style="font-size:1em;margin-top:14px;">Top Tips for Success</h2>
        <p>🧠 <strong>Reveal high-number GROWs early</strong> — landing on a GROW unlocks its number trigger for the whole game</p>
        <p>🎯 <strong>Pick which farms you actually want</strong> — every unowned farm goes to auction, so save bananas for the ones that matter</p>
        <p>💰 <strong>Mind your piles</strong> — bananas sit on farms waiting to be collected. Don't leave them parked for opponents</p>
        <p>🔮 <strong>Hoard the right Spell Cards</strong> — keep a die with the exact number to LAND on the Super Banana or fire a key GROW</p>
        <p>👀 <strong>Watch the Super Banana</strong> — once anyone is close to 2000, race them to it (and remember you must LAND on it)</p>
        <div class="tut-tip"><strong>Ready?</strong> Click <span class="tut-highlight">Start Playing!</span> to head back to the menu and create or join a game!</div>`;
    },
  },
];

function startTutorial() {
  _tutStep = 0;
  _tutVisited = new Set([0]);
  showScreen("screen-tutorial");
  renderTutorialStep();
}

function renderTutorialStep() {
  const step = TUTORIAL_STEPS[_tutStep];
  const content = document.getElementById("tutorial-content");
  content.innerHTML = `<div class="tutorial-step">${step.render()}</div>`;

  // Progress bar
  const pct = ((_tutStep + 1) / TUTORIAL_STEPS.length) * 100;
  document.getElementById("tutorial-progress-bar").style.width = pct + "%";

  // Step counter
  document.getElementById("tutorial-step-counter").textContent =
    `Step ${_tutStep + 1} / ${TUTORIAL_STEPS.length}`;

  // Dots
  const dotsEl = document.getElementById("tutorial-dots");
  dotsEl.innerHTML = TUTORIAL_STEPS.map(
    (_, i) =>
      `<div class="tutorial-dot${i === _tutStep ? " active" : ""}${_tutVisited.has(i) ? " visited" : ""}" onclick="tutorialGoTo(${i})"></div>`
  ).join("");

  // Nav buttons
  const prevBtn = document.getElementById("tutorial-prev");
  const nextBtn = document.getElementById("tutorial-next");

  if (_tutStep === 0) {
    prevBtn.textContent = "← Menu";
    prevBtn.onclick = () => showScreen("screen-menu");
  } else {
    prevBtn.textContent = "← Back";
    prevBtn.onclick = tutorialPrev;
  }

  if (_tutStep === TUTORIAL_STEPS.length - 1) {
    nextBtn.textContent = "Start Playing! 🎮";
    nextBtn.onclick = () => showScreen("screen-menu");
  } else {
    nextBtn.textContent = "Next →";
    nextBtn.onclick = tutorialNext;
  }
}

function tutorialNext() {
  if (_tutStep < TUTORIAL_STEPS.length - 1) {
    _tutStep++;
    _tutVisited.add(_tutStep);
    renderTutorialStep();
  }
}

function tutorialPrev() {
  if (_tutStep > 0) {
    _tutStep--;
    renderTutorialStep();
  }
}

function tutorialGoTo(i) {
  _tutStep = i;
  _tutVisited.add(i);
  renderTutorialStep();
}

function tutRollDie(el) {
  const val = Math.floor(Math.random() * 6) + 1;
  el.textContent = val;
  el.classList.remove("tut-die-roll");
  void el.offsetWidth; // force reflow
  el.classList.add("tut-die-roll");
  try { playDiceRoll(); } catch (e) {}
}
