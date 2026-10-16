const GOAL = 100_000_000;
const SAVE_KEY = "cow-clicker-save";

// perClick adds to each manual click; perSec clicks automatically
const UPGRADES = [
  { id: "glove",   name: "Clicking Glove",  desc: "+1 per click",   base: 15,        perClick: 1 },
  { id: "hand",    name: "Farmhand",        desc: "+1 per second",  base: 100,       perSec: 1 },
  { id: "bell",    name: "Cow Bell",        desc: "+10 per click",  base: 1_000,     perClick: 10 },
  { id: "milker",  name: "Milking Machine", desc: "+25 per second", base: 5_000,     perSec: 25 },
  { id: "barn",    name: "Bigger Barn",     desc: "+300 per second", base: 60_000,   perSec: 300 },
  { id: "tractor", name: "Tractor",         desc: "+500 per click", base: 250_000,   perClick: 500 },
  { id: "herd",    name: "Entire Herd",     desc: "+5,000 per second", base: 2_000_000, perSec: 5_000 },
  { id: "ufo",     name: "Cow Abduction",   desc: "+60,000 per second", base: 30_000_000, perSec: 60_000 },
];

let state = load();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s.clicks === "number") return { clicks: s.clicks, owned: s.owned || {}, won: !!s.won };
  } catch {}
  return { clicks: 0, owned: {}, won: false };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {}
}

const owned = (u) => state.owned[u.id] || 0;
const cost = (u) => Math.ceil(u.base * 1.15 ** owned(u));
const perClick = () => 1 + UPGRADES.reduce((n, u) => n + (u.perClick || 0) * owned(u), 0);
const perSec = () => UPGRADES.reduce((n, u) => n + (u.perSec || 0) * owned(u), 0);
const fmt = (n) => Math.floor(n).toLocaleString("en-US");

const $ = (id) => document.getElementById(id);

function buildShop() {
  $("shop").innerHTML = "";
  for (const u of UPGRADES) {
    const b = document.createElement("button");
    b.className = "item";
    b.id = "buy-" + u.id;
    b.innerHTML = `<div class="row"><span>${u.name}</span><span class="owned"></span></div>
      <div class="desc">${u.desc} · cost <span class="cost"></span></div>`;
    b.addEventListener("click", () => buy(u));
    $("shop").appendChild(b);
  }
}

function buy(u) {
  const c = cost(u);
  if (state.clicks < c) return;
  state.clicks -= c;
  state.owned[u.id] = owned(u) + 1;
  save();
  render();
}

function render() {
  $("clicks").textContent = fmt(state.clicks);
  $("perClick").textContent = fmt(perClick());
  $("perSec").textContent = fmt(perSec());
  const pct = Math.min(100, (state.clicks / GOAL) * 100);
  $("bar").style.width = pct + "%";
  $("pct").textContent = pct < 1 ? pct.toFixed(4) + "%" : pct.toFixed(1) + "%";

  for (const u of UPGRADES) {
    const b = $("buy-" + u.id);
    b.disabled = state.clicks < cost(u);
    b.querySelector(".owned").textContent = owned(u) ? "×" + owned(u) : "";
    b.querySelector(".cost").textContent = fmt(cost(u));
  }

  if (!state.won && state.clicks >= GOAL) {
    state.won = true;
    save();
    $("win").hidden = false;
  }
}

function popup(x, y, text) {
  const el = document.createElement("div");
  el.className = "pop";
  el.textContent = text;
  el.style.left = x - 10 + "px";
  el.style.top = y - 20 + "px";
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

$("cow").addEventListener("click", (e) => {
  const gain = perClick();
  state.clicks += gain;
  // keyboard activation has no pointer position; fall back to the cow's centre
  const r = $("cow").getBoundingClientRect();
  const x = e.clientX || r.left + r.width / 2;
  const y = e.clientY || r.top + r.height / 2;
  popup(x, y, "+" + fmt(gain));
  render();
});

$("reset").addEventListener("click", () => {
  if (!confirm("Reset all your clicks and upgrades?")) return;
  state = { clicks: 0, owned: {}, won: false };
  save();
  render();
});

$("winClose").addEventListener("click", () => ($("win").hidden = true));

// Passive income, ticked 10x per second for a smooth counter
setInterval(() => {
  const ps = perSec();
  if (ps) {
    state.clicks += ps / 10;
    render();
  }
}, 100);
setInterval(save, 5000);
window.addEventListener("beforeunload", save);

buildShop();
render();
