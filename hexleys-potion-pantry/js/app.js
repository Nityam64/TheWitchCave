var KEY = 'hexley-site-v1';

// ---- sample data ----
// usage = units used per day for the last 7 days (last number = today)
function startData() {
  return {
    day: todayText(), festival: true, buffer: 5, mult: 3,
    ingredients: [
      { id: 'ghost', name: 'Ghost Pepper', category: 'Spices', quantity: 15, unit: 'jars', minimum: 8, supplier: 'Moon Market', days: 2, festival: true, usage: [2,2,2,2,2,2,2] },
      { id: 'moon', name: 'Moonpetal Dust', category: 'Powders', quantity: 12, unit: 'pouches', minimum: 6, supplier: 'Silver Vale', days: 3, festival: true, usage: [1,1,1,1,1,1,1] },
      { id: 'bat', name: 'Bat Wing Ash', category: 'Ash', quantity: 9, unit: 'pouches', minimum: 5, supplier: "Crow's Corner", days: 4, festival: true, usage: [1,1,1,1,1,1,4] },
      { id: 'rose', name: 'Rose Root', category: 'Herbs', quantity: 30, unit: 'bundles', minimum: 10, supplier: 'Greenhollow', days: 1, festival: false, usage: [3,3,3,3,3,3,3] },
      { id: 'honey', name: 'Frost Honey', category: 'Sweeteners', quantity: 4, unit: 'jars', minimum: 5, supplier: 'Hollow Hive', days: 2, festival: false, usage: [1,1,1,1,1,1,1] }
    ],
    potions: [
      { name: 'Health Potion', uses: [{ id: 'ghost', amount: 2 }, { id: 'rose', amount: 1 }] },
      { name: 'Moon Elixir', uses: [{ id: 'moon', amount: 1 }, { id: 'bat', amount: 1 }] },
      { name: 'Night Sight Draught', uses: [{ id: 'bat', amount: 2 }, { id: 'honey', amount: 1 }] }
    ],
    sales: [],
    moves: []
  };
}

// ---- loading and saving ----
function loadData() {
  var d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
  if (!d) d = startData();
  if (d.day !== todayText()) {          // new day: shift usage history by one day
    for (var i = 0; i < d.ingredients.length; i++) {
      d.ingredients[i].usage.shift();
      d.ingredients[i].usage.push(0);
    }
    d.day = todayText();
  }
  return d;
}

function saveData(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
  catch (e) { return false; }
}

var data = loadData();

// ---- small helpers ----
function todayText() { return new Date().toDateString(); }
function clone(d) { return JSON.parse(JSON.stringify(d)); }
function val(id) { return document.getElementById(id).value.trim(); }
function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function fail(el, msg) { el.className = 'err'; el.textContent = msg; return false; }
function round1(x) { return Math.round(x * 10) / 10; }
function stat(label, n) { return '<div class="card"><div class="big">' + n + '</div>' + label + '</div>'; }
function dayName(back) {
  var d = new Date();
  d.setDate(d.getDate() - back);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}
function findIng(d, id) {
  for (var i = 0; i < d.ingredients.length; i++) {
    if (d.ingredients[i].id === id) return i;
  }
  return -1;
}

// ---- forecast math ----
function avgOf(g) {
  var t = 0;
  for (var i = 0; i < 7; i++) t += g.usage[i];
  return t / 7;
}
function normalWeek(g) { return Math.round(avgOf(g) * 7); }
function festOn(g) { return data.festival && g.festival; }
function weekDemand(g) { return normalWeek(g) * (festOn(g) ? data.mult : 1); }
function orderFor(g) { return Math.max(0, weekDemand(g) + data.buffer - g.quantity); }
function statusOf(g) {
  if (g.quantity <= 0) return 'Out';
  if (g.quantity <= g.minimum) return 'Running low';
  return 'In stock';
}
// Unusual drop: today is more than twice the average of the 6 days before it
function unusualOf(g) {
  var prev = 0;
  for (var i = 0; i < 6; i++) prev += g.usage[i];
  prev = prev / 6;
  var today = g.usage[6];
  if (prev > 0 && today > 2 * prev) {
    return '<b>Unusual stock drop:</b> ' + esc(g.name) + ' — ' + today + ' ' + esc(g.unit) +
      ' used today; recent average is ' + round1(prev) + ' per day. Check the sales and adjustment history.';
  }
  return '';
}

// ---- drawing the pages ----
function renderAll() {
  renderBanner();
  renderDash();
  renderIng();
  renderForecast();
  renderActivity();
}

function renderBanner() {
  var names = [];
  for (var i = 0; i < data.ingredients.length; i++) {
    if (data.ingredients[i].festival) names.push(data.ingredients[i].name);
  }
  var b = document.getElementById('banner');
  b.hidden = !data.festival;
  b.innerHTML = '<b>🌕 Full Moon Festival.</b> The Midnight Curse multiplies demand by ' + data.mult +
    ' for ' + esc(names.join(', ')) + ' this week.';
  document.getElementById('festBtn').textContent = 'Festival: ' + (data.festival ? 'ON' : 'OFF');
}

function renderDash() {
  var low = 0, runOut = 0, soldToday = 0, alerts = '';
  for (var i = 0; i < data.ingredients.length; i++) {
    var g = data.ingredients[i];
    if (statusOf(g) !== 'In stock') low++;
    if (g.quantity < weekDemand(g)) runOut++;
    if (festOn(g)) {
      alerts += '<div class="card warn" onclick="editIng(\'' + g.id + '\')">' +
        '<b>Festival warning:</b> ' + esc(g.name) + ' demand is forecast at ' + weekDemand(g) + ' ' + esc(g.unit) + ' this week.<br>' +
        'In stock: ' + g.quantity + ' ' + esc(g.unit) + ' · Suggested order: ' + orderFor(g) + ' ' + esc(g.unit) +
        '<br><small>Tap to open this ingredient</small></div>';
    }
    var u = unusualOf(g);
    if (u) alerts += '<div class="card odd">' + u + '</div>';
  }
  for (var s = 0; s < data.sales.length; s++) {
    if (data.sales[s].day === todayText()) soldToday += data.sales[s].qty;
  }
  document.getElementById('stats').innerHTML =
    stat('Ingredients', data.ingredients.length) + stat('Low stock', low) +
    stat('Predicted to run out', runOut) + stat('Sales today', soldToday);
  document.getElementById('alerts').innerHTML = alerts || '<div class="card">All quiet in the pantry. 🌙</div>';
}

function renderIng() {
  var q = val('search').toLowerCase();
  var html = '';
  for (var i = 0; i < data.ingredients.length; i++) {
    var g = data.ingredients[i];
    if (q && g.name.toLowerCase().indexOf(q) < 0) continue;
    var st = statusOf(g);
    var cls = st === 'In stock' ? 'ok' : (st === 'Running low' ? 'low' : 'out');
    var target = weekDemand(g) + data.buffer;
    var pct = target > 0 ? Math.min(100, Math.round(g.quantity / target * 100)) : 100;
    html += '<div class="card ing">' +
      '<div class="bottle"><div class="liquid" style="height:' + pct + '%"></div></div>' +
      '<h3 style="margin:0 0 4px">' + esc(g.name) + (festOn(g) ? ' 🌕' : '') + '</h3>' +
      '<div>' + esc(g.category) + ' · ' + g.quantity + ' ' + esc(g.unit) + '</div>' +
      '<p><span class="tag ' + cls + '">' + st + '</span></p>' +
      '<div>Forecast this week: <b>' + weekDemand(g) + '</b> ' + esc(g.unit) + '</div>' +
      '<p><button class="btn2" onclick="editIng(\'' + g.id + '\')">Edit</button> ' +
      '<button class="btn" onclick="saleFor(\'' + g.id + '\')">Record sale</button></p>' +
      '</div>';
  }
  document.getElementById('ingList').innerHTML = html || '<div class="card">No ingredients match.</div>';
}

function renderForecast() {
  var rows = '<tr><th>Ingredient</th><th>Normal week</th><th>Festival week</th><th>In stock</th><th>Shortfall</th><th>Order</th></tr>';
  var opts = '';
  var sel = document.getElementById('chartIng');
  var cur = sel.value;
  for (var i = 0; i < data.ingredients.length; i++) {
    var g = data.ingredients[i];
    var wk = weekDemand(g);
    rows += '<tr><td>' + esc(g.name) + '</td><td>' + normalWeek(g) + '</td><td>' + wk + '</td><td>' +
      g.quantity + '</td><td>' + Math.max(0, wk - g.quantity) + '</td><td><b>' + orderFor(g) + '</b></td></tr>';
    opts += '<option value="' + g.id + '">' + esc(g.name) + '</option>';
  }
  document.getElementById('fcTable').innerHTML = rows;
  sel.innerHTML = opts;
  if (cur) sel.value = cur;
  document.getElementById('fcNote').textContent = 'Suggested order = festival demand + safety buffer (' +
    data.buffer + ') − in stock. Festival ingredients are multiplied by ' + data.mult + ' while the festival is on.';
  renderChart();
}

function renderChart() {
  var i = findIng(data, document.getElementById('chartIng').value);
  if (i < 0) return;
  var g = data.ingredients[i];
  var normal = normalWeek(g), wk = weekDemand(g);

  // 7 past days, then the normal week and the forecast week
  var bars = [];
  for (var d = 0; d < 7; d++) bars.push({ v: g.usage[d], t: dayName(6 - d), c: '' });
  bars.push({ v: normal, t: 'Normal wk', c: 'norm' });
  bars.push({ v: wk, t: festOn(g) ? 'Festival wk' : 'Forecast wk', c: 'fest' });

  var max = 1;
  for (var b = 0; b < bars.length; b++) if (bars[b].v > max) max = bars[b].v;
  var html = '';
  for (b = 0; b < bars.length; b++) {
    html += '<div class="col"><span>' + bars[b].v + '</span>' +
      '<div class="bar ' + bars[b].c + '" style="height:' + Math.max(3, Math.round(bars[b].v / max * 110)) + 'px"></div>' +
      '<small>' + bars[b].t + '</small></div>';
  }
  document.getElementById('chart').innerHTML = html;

  var raw = wk + data.buffer - g.quantity;
  document.getElementById('math').innerHTML =
    '<div class="card"><b>' + esc(g.name) + ': how the order is worked out</b><br>' +
    'Typical use: ' + round1(avgOf(g)) + ' ' + esc(g.unit) + ' a day (last 7 days)<br>' +
    'Normal week: ' + round1(avgOf(g)) + ' × 7 = ' + normal + '<br>' +
    (festOn(g) ? 'Festival: ' + normal + ' × ' + data.mult + ' = ' + wk + '<br>' : 'No festival multiplier for this ingredient<br>') +
    'Expected shortfall: ' + wk + ' − ' + g.quantity + ' in stock = ' + Math.max(0, wk - g.quantity) + '<br>' +
    'Suggested order: ' + wk + ' + ' + data.buffer + ' buffer − ' + g.quantity + ' in stock = ' + raw +
    (raw > 0 ? ' → order <b>' + raw + ' ' + esc(g.unit) + '</b>' : ' → no order needed') + '</div>';
}

function renderActivity() {
  var f = val('actFilter');
  var html = '';
  var n = 0;
  for (var i = 0; i < data.moves.length && n < 30; i++) {
    var m = data.moves[i];
    if (f && m.type !== f) continue;
    n++;
    var g = data.ingredients[findIng(data, m.ing)];
    var name = g ? g.name : 'Unknown ingredient';
    var unit = g ? g.unit : '';
    html += '<div class="card"><b>' + esc(m.type) + '</b>: ' + (m.change > 0 ? '+' : '') + m.change + ' ' +
      esc(unit) + ' ' + esc(name) + '<br><small>' + esc(m.day) + ' · ' + esc(m.reason) + '</small></div>';
  }
  document.getElementById('moves').innerHTML = html || 'No activity yet. Record a sale or change a quantity to see it here.';
}

function renderSaleOptions() {
  var html = '';
  for (var i = 0; i < data.potions.length; i++) html += '<option>' + esc(data.potions[i].name) + '</option>';
  document.getElementById('potion').innerHTML = html;
}

// ---- pages (hash routing: #home, #dash, #ing, #sale, #fc, #act, #set, #help) ----
var PAGES = ['home', 'dash', 'ing', 'sale', 'fc', 'act', 'set', 'help'];

function route() {
  var name = location.hash.replace('#', '') || 'home';
  if (PAGES.indexOf(name) < 0) name = 'home';
  for (var i = 0; i < PAGES.length; i++) {
    var p = PAGES[i];
    document.getElementById('pg-' + p).hidden = p !== name;
    document.getElementById('l-' + p).className = p === name ? 'on' : '';
  }
  if (name === 'sale') previewSale();
  if (name === 'set') fillSettings();
  window.scrollTo(0, 0);
}

function toggleFest() {
  var copy = clone(data);
  copy.festival = !copy.festival;
  saveData(copy);
  data = copy;
  renderAll();
  fillSettings();
}

// ---- settings ----
function fillSettings() {
  document.getElementById('setFest').checked = data.festival;
  document.getElementById('setBuf').value = data.buffer;
  document.getElementById('setMult').value = data.mult;
  document.getElementById('setErr').textContent = '';
}

function saveSettings() {
  var err = document.getElementById('setErr');
  var buf = parseInt(val('setBuf'), 10);
  var mult = parseInt(val('setMult'), 10);
  if (isNaN(buf) || buf < 0) return fail(err, 'Safety buffer must be 0 or more.');
  if (isNaN(mult) || mult < 1) return fail(err, 'Multiplier must be 1 or more.');
  var copy = clone(data);
  copy.festival = document.getElementById('setFest').checked;
  copy.buffer = buf;
  copy.mult = mult;
  if (!saveData(copy)) return fail(err, 'Could not save settings. Check browser storage and try again.');
  data = copy;
  renderAll();
  err.className = 'good';
  err.textContent = 'Settings saved.';
}

function resetDemo() {
  var fresh = startData();
  var err = document.getElementById('setErr');
  if (!saveData(fresh)) return fail(err, 'Could not reset. Check browser storage and try again.');
  data = fresh;
  renderAll();
  fillSettings();
  err.className = 'good';
  err.textContent = 'Demo data restored.';
}

// ---- ingredient form ----
function editIng(id) {
  var i = findIng(data, id);
  if (i < 0) return;
  var g = data.ingredients[i];
  document.getElementById('fId').value = g.id;
  document.getElementById('fName').value = g.name;
  document.getElementById('fCat').value = g.category;
  document.getElementById('fQty').value = g.quantity;
  document.getElementById('fUnit').value = g.unit;
  document.getElementById('fMin').value = g.minimum;
  document.getElementById('fSup').value = g.supplier;
  document.getElementById('fDays').value = g.days;
  document.getElementById('fFest').checked = g.festival;
  document.getElementById('fReason').value = '';
  document.getElementById('formTitle').textContent = 'Edit ' + g.name;
  document.getElementById('ingErr').textContent = '';
  location.hash = 'ing';
}

function clearForm() {
  var ids = ['fId', 'fName', 'fCat', 'fQty', 'fUnit', 'fMin', 'fSup', 'fDays', 'fReason'];
  for (var i = 0; i < ids.length; i++) document.getElementById(ids[i]).value = '';
  document.getElementById('fFest').checked = false;
  document.getElementById('formTitle').textContent = 'Add an ingredient';
  document.getElementById('ingErr').textContent = '';
}

function saveIng() {
  var err = document.getElementById('ingErr');
  var id = val('fId');
  var name = val('fName');
  var qty = parseInt(val('fQty'), 10);
  var reason = val('fReason');
  if (!name) return fail(err, 'Please enter a name.');
  if (isNaN(qty) || qty < 0) return fail(err, 'Quantity must be 0 or more.');

  var copy = clone(data);   // change a copy first
  var g = {
    id: id || 'ing' + Date.now(),
    name: name,
    category: val('fCat'),
    quantity: qty,
    unit: val('fUnit') || 'units',
    minimum: parseInt(val('fMin'), 10) || 0,
    supplier: val('fSup'),
    days: parseInt(val('fDays'), 10) || 0,
    festival: document.getElementById('fFest').checked,
    usage: [0, 0, 0, 0, 0, 0, 0]
  };
  if (id) {
    var i = findIng(copy, id);
    var change = qty - copy.ingredients[i].quantity;
    g.usage = copy.ingredients[i].usage;
    if (change !== 0) {
      if (!reason) return fail(err, 'Please write a reason, since the quantity changed.');
      copy.moves.unshift({ day: todayText(), ing: id, change: change,
        type: change > 0 ? 'New delivery' : 'Manual correction', reason: reason });
    }
    copy.ingredients[i] = g;
  } else {
    copy.ingredients.push(g);
  }
  if (!saveData(copy)) return fail(err, 'Could not save. Check that your browser allows local storage, then try again.');
  data = copy;
  clearForm();
  renderAll();
}

// ---- record a sale ----
function saleFor(id) {
  var found = false;
  for (var i = 0; i < data.potions.length; i++) {
    var uses = data.potions[i].uses;
    for (var k = 0; k < uses.length; k++) {
      if (uses[k].id === id && !found) {
        document.getElementById('potion').selectedIndex = i;
        found = true;
      }
    }
  }
  previewSale();
  location.hash = 'sale';
}

function previewSale() {
  var p = data.potions[document.getElementById('potion').selectedIndex];
  var qty = parseInt(val('sQty'), 10) || 0;
  var ok = qty > 0;
  var html = '<p>This sale uses:</p>';
  for (var k = 0; k < p.uses.length; k++) {
    var g = data.ingredients[findIng(data, p.uses[k].id)];
    var need = p.uses[k].amount * qty;
    var enough = need <= g.quantity;
    if (!enough) ok = false;
    html += '<p class="' + (enough ? '' : 'bad') + '">' + esc(g.name) + ': ' + need + ' ' + esc(g.unit) +
      ' (in stock: ' + g.quantity + ')' + (enough ? '' : ' — not enough stock') + '</p>';
  }
  document.getElementById('preview').innerHTML = html;
  return ok;
}

function confirmSale() {
  var err = document.getElementById('saleErr');
  var okText = document.getElementById('saleOk');
  err.textContent = '';
  okText.textContent = '';
  var p = data.potions[document.getElementById('potion').selectedIndex];
  var qty = parseInt(val('sQty'), 10);
  if (!qty || qty < 1) return fail(err, 'Enter how many potions were sold.');
  if (!previewSale()) return fail(err, 'Not enough stock for this sale, so nothing was changed.');

  var copy = clone(data);   // apply everything to a copy first
  for (var k = 0; k < p.uses.length; k++) {
    var need = p.uses[k].amount * qty;
    var g = copy.ingredients[findIng(copy, p.uses[k].id)];
    g.quantity -= need;
    g.usage[6] += need;
    copy.moves.unshift({ day: todayText(), ing: g.id, change: -need, type: 'Sale', reason: p.name + ' × ' + qty });
  }
  copy.sales.unshift({ day: todayText(), potion: p.name, qty: qty });
  if (!saveData(copy)) return fail(err, 'Could not save the sale. Stock was not changed. Check your browser storage and try again.');
  data = copy;
  okText.textContent = 'Sold ' + qty + ' × ' + p.name + '. Stock and history updated.';
  document.getElementById('sQty').value = 1;
  renderAll();
  previewSale();
}

// ---- start ----
renderSaleOptions();
renderAll();
route();
window.addEventListener('hashchange', route);
