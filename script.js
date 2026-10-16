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
    if (s && typeof s.clicks === "number") return { clicks: s.clicks, owned: s.owned || {}, won: !!s.won, muted: !!s.muted };
  } catch {}
  return { clicks: 0, owned: {}, won: false, muted: false };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {}
}

const owned = (u) => state.owned[u.id] || 0;
const cost = (u) => u.base;
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

// Synthesized "moo". A cow's voice is a low, rough buzz shaped by the mouth:
// closed ("mmm") at first, then opening into "ooo" while the pitch rises and
// falls. Two slightly detuned sawtooths give the roughness, a pair of formant
// filters gives the "oo" vowel, and a little filtered noise adds breath.
let audio, noiseBuffer, currentMoo;
function moo() {
  if (state.muted) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const t = audio.currentTime;
    const p = 0.85 + Math.random() * 0.3; // each moo a slightly different cow
    const len = 0.75 + Math.random() * 0.25;

    // Cut off the previous moo so rapid clicking doesn't pile up into a choir
    if (currentMoo) {
      currentMoo.gain.cancelScheduledValues(t);
      currentMoo.gain.setTargetAtTime(0, t, 0.03);
    }

    const out = audio.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
    out.gain.setValueAtTime(0.5, t + len * 0.6);
    out.gain.exponentialRampToValueAtTime(0.0001, t + len);
    out.connect(audio.destination);
    currentMoo = out;

    // Mouth: starts nearly closed, opens, then closes a little as it trails off
    const mouth = audio.createBiquadFilter();
    mouth.type = "lowpass";
    mouth.Q.value = 1;
    mouth.frequency.setValueAtTime(250, t);
    mouth.frequency.exponentialRampToValueAtTime(1100, t + len * 0.3);
    mouth.frequency.exponentialRampToValueAtTime(500, t + len);

    // "oo" vowel formants
    const f1 = audio.createBiquadFilter();
    f1.type = "peaking"; f1.frequency.value = 320; f1.Q.value = 2; f1.gain.value = 10;
    const f2 = audio.createBiquadFilter();
    f2.type = "peaking"; f2.frequency.value = 800; f2.Q.value = 3; f2.gain.value = 6;
    mouth.connect(f1).connect(f2).connect(out);

    // Voice: pitch rises then sags
    const voice = audio.createGain();
    voice.gain.value = 0.35;
    voice.connect(mouth);
    const pitch = (o, detune) => {
      o.type = "sawtooth";
      o.detune.value = detune;
      o.frequency.setValueAtTime(92 * p, t);
      o.frequency.exponentialRampToValueAtTime(128 * p, t + len * 0.3);
      o.frequency.exponentialRampToValueAtTime(82 * p, t + len);
      o.connect(voice);
      o.start(t);
      o.stop(t + len + 0.05);
    };
    const a = audio.createOscillator(), b = audio.createOscillator();
    pitch(a, -7);
    pitch(b, 9);

    // Slow, uneven wobble in the throat
    const wob = audio.createOscillator(), wobAmt = audio.createGain();
    wob.frequency.value = 4.5 + Math.random() * 2;
    wobAmt.gain.value = 2.5 * p;
    wob.connect(wobAmt);
    wobAmt.connect(a.frequency);
    wobAmt.connect(b.frequency);
    wob.start(t);
    wob.stop(t + len + 0.05);

    // Breath
    if (!noiseBuffer) {
      noiseBuffer = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const noise = audio.createBufferSource();
    noise.buffer = noiseBuffer;
    const breathFilter = audio.createBiquadFilter();
    breathFilter.type = "bandpass"; breathFilter.frequency.value = 900; breathFilter.Q.value = 0.8;
    const breath = audio.createGain();
    breath.gain.value = 0.04;
    noise.connect(breathFilter).connect(breath).connect(mouth);
    noise.start(t);
    noise.stop(t + len + 0.05);
  } catch {}
}

function renderMute() {
  $("mute").textContent = state.muted ? "Sound: Off" : "Sound: On";
  $("mute").setAttribute("aria-pressed", String(!state.muted));
}

$("mute").addEventListener("click", () => {
  state.muted = !state.muted;
  save();
  renderMute();
});

$("cow").addEventListener("click", (e) => {
  moo();
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
  state = { clicks: 0, owned: {}, won: false, muted: state.muted };
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
renderMute();
render();
