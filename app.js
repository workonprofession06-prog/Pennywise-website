'use strict';
/* Pennywise — single state object -> commit() persists + re-renders. DOM built with textContent (no innerHTML). */
const KEY = 'pennywise.v1', WARN = 0.8;
const INCOME = ['Salary', 'Freelance'];
const COLORS = { Housing: '#193D32', Food: '#C28A2C', Transport: '#5B7B8C', Utilities: '#8A9A7B', Leisure: '#A65D57', Health: '#6E5A7E', Shopping: '#B9A27A', Salary: '#2F6B4F', Freelance: '#7FA38C' };
const EXPENSE = Object.keys(COLORS).filter(c => !INCOME.includes(c));
const LOCALES = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB' };
const $ = (q, r = document) => r.querySelector(q);

/* ---------- DOM helpers ---------- */
const h = (t, a = {}, ...k) => {
  const e = document.createElement(t);
  for (const [n, v] of Object.entries(a)) {
    if (n === 'class') e.className = v;
    else if (n.startsWith('on')) e.addEventListener(n.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(n, v);
  }
  e.append(...k.filter(x => x != null && x !== false));
  return e;
};
const s = (t, a = {}, ...k) => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', t);
  for (const [n, v] of Object.entries(a)) e.setAttribute(n, v);
  e.append(...k);
  return e;
};

/* ---------- Formatting & dates ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = d => ymd(d).slice(0, 7);
const months = n => { const t = new Date(); return Array.from({ length: n }, (_, i) => monthKey(new Date(t.getFullYear(), t.getMonth() - (n - 1 - i), 1))); };
const mLabel = (k, long) => new Intl.DateTimeFormat('en-GB', long ? { month: 'long', year: 'numeric' } : { month: 'short' }).format(new Date(k + '-01T00:00:00'));
const fdate = iso => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso + 'T00:00:00'));
const money = n => new Intl.NumberFormat(LOCALES[state.settings.currency], { style: 'currency', currency: state.settings.currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- State ---------- */
function seed() {
  const tx = [];
  months(6).forEach((ym, i) => {
    const add = (day, description, amount, type, category) => tx.push({ id: uid(), description, amount, type, category, date: `${ym}-${pad(day)}`, notes: '' });
    add(1, 'Monthly salary', 85000, 'income', 'Salary');
    if (i % 2 === 0) add(10, 'Freelance project', 12000, 'income', 'Freelance');
    add(2, 'Rent', 24000, 'expense', 'Housing');
    add(3, 'Electricity & internet', 2600 + i * 90, 'expense', 'Utilities');
    add(4, 'Groceries', 3400 + i * 150, 'expense', 'Food');
    add(6, 'Metro & cabs', 1800 + (i % 3) * 400, 'expense', 'Transport');
    add(8, 'Dinner out', 1900 + (i % 2) * 900, 'expense', 'Food');
    add(9, i === 5 ? 'Concert tickets' : 'Streaming & books', i === 5 ? 6500 : 1400, 'expense', 'Leisure');
    if (i % 2) add(7, 'Clothes', 4200, 'expense', 'Shopping');
    if (i === 3) add(7, 'Dental checkup', 3500, 'expense', 'Health');
  });
  return tx;
}
const fresh = () => ({ tx: seed(), budgets: { Housing: 25000, Food: 9000, Transport: 4000, Leisure: 4000, Shopping: 5000 }, settings: { name: 'Faika', currency: 'INR', monthlyBudget: 60000 }, hintDismissed: false });
function load() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && Array.isArray(r.tx) && r.budgets && r.settings && LOCALES[r.settings.currency]) return r;
  } catch { /* corrupted or unavailable storage: fall back */ }
  return fresh();
}
let state = load();
const ui = { view: 'overview', editing: null, editBudget: null, f: { q: '', type: '', cat: '', from: '', to: '', sort: 'date-desc' } };
function commit() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast('Could not save to local storage', true); } render(); }

/* ---------- Derived data (one source of truth) ---------- */
const inMonth = k => state.tx.filter(t => t.date.startsWith(k));
const sum = (l, type) => l.filter(t => t.type === type).reduce((a, t) => a + t.amount, 0);
const spendBy = k => inMonth(k).filter(t => t.type === 'expense').reduce((m, t) => (m[t.category] = (m[t.category] || 0) + t.amount, m), {});
const status = (spent, limit) => spent > limit ? 'over' : spent >= limit * WARN ? 'warn' : 'ok';
const rate = (i, e) => i > 0 ? Math.round((i - e) / i * 100) + '%' : '—';

function insightText() {
  const [prev, cur] = months(2), now = spendBy(cur), before = spendBy(prev);
  const top = Object.entries(now).sort((a, b) => b[1] - a[1])[0];
  if (!top) return 'No spending recorded yet this month. Add a transaction to start seeing patterns.';
  const total = Object.values(now).reduce((a, b) => a + b, 0);
  let t = `${top[0]} is your largest category this month at ${money(top[1])} (${Math.round(top[1] / total * 100)}% of spending).`;
  if (before[top[0]]) { const d = Math.round((top[1] - before[top[0]]) / before[top[0]] * 100); t += ` That is ${Math.abs(d)}% ${d >= 0 ? 'higher' : 'lower'} than last month.`; }
  const over = Object.entries(state.budgets).filter(([c, l]) => (now[c] || 0) > l).map(([c]) => c);
  if (over.length) t += ` Over budget: ${over.join(', ')}.`;
  return t;
}

/* ---------- Charts (SVG) ---------- */
function barChart(ms) {
  const data = ms.map(k => ({ k, i: sum(inMonth(k), 'income'), e: sum(inMonth(k), 'expense') }));
  const max = Math.max(1, ...data.flatMap(d => [d.i, d.e])), W = 360, H = 170, base = 140, bw = 16, step = W / ms.length;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Income versus expenses by month. ' + data.map(d => `${mLabel(d.k)}: income ${money(d.i)}, expenses ${money(d.e)}`).join('; ') });
  svg.append(s('line', { x1: 0, x2: W, y1: base, y2: base, stroke: '#E4E1D7' }));
  data.forEach((d, n) => {
    const x = n * step + step / 2;
    [[d.i, 'var(--income)', -bw - 1, 'Income'], [d.e, 'var(--expense)', 1, 'Expenses']].forEach(([v, fill, o, lbl]) => {
      const ht = v / max * (base - 10);
      svg.append(s('rect', { x: x + o, y: base - ht, width: bw, height: v ? Math.max(ht, 1) : 0, fill, rx: 2 }, s('title', {}, `${mLabel(d.k)} ${lbl}: ${money(v)}`)));
    });
    svg.append(s('text', { x, y: H - 8, 'text-anchor': 'middle', class: 'axis' }, mLabel(d.k)));
  });
  return h('div', {}, svg, h('div', { class: 'key' }, h('span', {}, h('i', { style: 'background:var(--income)' }), 'Income'), h('span', {}, h('i', { style: 'background:var(--expense)' }), 'Expenses')));
}
function donut(map) {
  const ent = Object.entries(map).sort((a, b) => b[1] - a[1]), tot = ent.reduce((a, [, v]) => a + v, 0), R = 40, C = 2 * Math.PI * R;
  const svg = s('svg', { viewBox: '0 0 100 100', role: 'img', 'aria-label': tot ? 'Spending by category: ' + ent.map(([c, v]) => `${c} ${Math.round(v / tot * 100)}%`).join(', ') : 'No spending recorded this month' });
  svg.append(s('circle', { cx: 50, cy: 50, r: R, fill: 'none', stroke: '#E4E1D7', 'stroke-width': 14 }));
  let off = 0;
  ent.forEach(([c, v]) => {
    const len = v / tot * C;
    svg.append(s('circle', { cx: 50, cy: 50, r: R, fill: 'none', stroke: COLORS[c], 'stroke-width': 14, 'stroke-dasharray': `${len} ${C - len}`, 'stroke-dashoffset': -off, transform: 'rotate(-90 50 50)' }, s('title', {}, `${c}: ${money(v)}`)));
    off += len;
  });
  svg.append(s('text', { x: 50, y: 53, 'text-anchor': 'middle', class: 'donut-total' }, tot ? money(tot) : '—'));
  const legend = h('ul', { class: 'legend' }, ...ent.map(([c, v]) => h('li', {}, h('i', { style: `background:${COLORS[c]}` }), c, h('b', {}, money(v)))));
  if (!ent.length) legend.append(h('li', { class: 'muted' }, 'No spending yet this month.'));
  return h('div', { class: 'donut' }, svg, legend);
}
const budgetBar = (label, spent, limit) => {
  const st = status(spent, limit), pct = Math.min(100, spent / limit * 100), left = limit - spent;
  return h('div', { class: `bud ${st}` },
    h('div', { class: 'top' }, h('strong', {}, label), h('span', { class: 'badge' }, st === 'over' ? 'Over budget' : st === 'warn' ? 'Near limit' : 'On track')),
    h('div', { class: 'bar', role: 'progressbar', 'aria-label': `${label} budget used`, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pct) }, h('i', { style: `width:${pct}%` })),
    h('span', { class: 'muted' }, `${money(spent)} of ${money(limit)} · ${left >= 0 ? money(left) + ' left' : money(-left) + ' over'}`));
};

/* ---------- Views ---------- */
const txRow = (t, actions) => h('li', { class: 'tx' },
  h('i', { class: 'dot', style: `background:${COLORS[t.category] || '#999'}` }),
  h('div', { class: 'tx-main' }, h('strong', {}, t.description), h('span', { class: 'muted' }, `${t.category} · ${fdate(t.date)}${t.notes ? ' · ' + t.notes : ''}`)),
  h('span', { class: `amt ${t.type}` }, (t.type === 'income' ? '+' : '−') + money(t.amount)),
  actions ? h('div', { class: 'row-actions' }, h('button', { class: 'btn sm', 'data-edit': t.id, 'aria-label': `Edit ${t.description}` }, 'Edit'), h('button', { class: 'btn sm danger', 'data-del': t.id, 'aria-label': `Delete ${t.description}` }, 'Delete')) : null);

function renderOverview() {
  const cur = months(1)[0], list = inMonth(cur), inc = sum(list, 'income'), exp = sum(list, 'expense');
  const bal = sum(state.tx, 'income') - sum(state.tx, 'expense'), hr = new Date().getHours();
  const stat = (l, v) => h('div', { class: 'panel stat' }, h('span', {}, l), h('b', {}, v));
  const recent = [...state.tx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  $('#overview').replaceChildren(
    h('header', { class: 'head' }, h('div', {}, h('h1', {}, `Good ${hr < 12 ? 'morning' : hr < 18 ? 'afternoon' : 'evening'}, ${state.settings.name}`), h('p', { class: 'muted' }, mLabel(cur, true))), h('button', { class: 'btn primary', 'data-add': '' }, 'Add transaction')),
    state.hintDismissed ? null : h('div', { class: 'hint' }, h('span', {}, 'This is sample data. Edit or delete any transaction, or replace it with your own.'), h('button', { class: 'btn sm', id: 'hintOk' }, 'Dismiss')),
    h('div', { class: 'stats' }, stat('Total balance', money(bal)), stat('Income this month', money(inc)), stat('Expenses this month', money(exp)), stat('Savings rate', rate(inc, exp))),
    h('div', { class: 'panel insight' }, insightText()),
    h('div', { class: 'grid2' }, h('div', { class: 'panel' }, h('h2', {}, 'Income vs expenses'), barChart(months(6))), h('div', { class: 'panel' }, h('h2', {}, 'Where your money went'), donut(spendBy(cur)))),
    h('div', { class: 'grid2' },
      h('div', { class: 'panel' }, h('h2', {}, 'Monthly budget'), budgetBar('All spending', exp, state.settings.monthlyBudget)),
      h('div', { class: 'panel' }, h('h2', {}, 'Recent transactions'), recent.length ? h('ul', { class: 'list' }, ...recent.map(t => txRow(t))) : h('p', { class: 'muted' }, 'Nothing yet.'))));
}

function visibleTx() {
  const f = ui.f, q = f.q.trim().toLowerCase();
  const l = state.tx.filter(t => (!q || t.description.toLowerCase().includes(q)) && (!f.type || t.type === f.type) && (!f.cat || t.category === f.cat) && (!f.from || t.date >= f.from) && (!f.to || t.date <= f.to));
  const [k, d] = f.sort.split('-');
  return l.sort((a, b) => (k === 'date' ? a.date.localeCompare(b.date) : a.amount - b.amount) * (d === 'asc' ? 1 : -1));
}
function renderTransactions() {
  const l = visibleTx();
  $('#txList').replaceChildren(...(l.length ? l.map(t => txRow(t, true)) : [h('li', { class: 'empty' }, state.tx.length ? 'No transactions match these filters.' : 'No transactions yet. Add your first one.')]));
}

function renderBudgets() {
  const cur = months(1)[0], now = spendBy(cur), entries = Object.entries(state.budgets);
  const free = EXPENSE.filter(c => !(c in state.budgets) || c === ui.editBudget);
  $('#bCat').replaceChildren(...free.map(c => h('option', { value: c, selected: c === ui.editBudget }, c)));
  $('#bSubmit').textContent = ui.editBudget ? 'Update budget' : 'Set budget';
  $('#budgetList').replaceChildren(...(entries.length ? entries.map(([c, l]) => h('li', { class: 'bud-row' }, budgetBar(c, now[c] || 0, l),
    h('div', { class: 'row-actions' }, h('button', { class: 'btn sm', 'data-bedit': c }, 'Edit'), h('button', { class: 'btn sm danger', 'data-bdel': c }, 'Remove')))) : [h('li', { class: 'empty' }, 'No budgets yet. Set a monthly limit above.')]));
}

function renderInsights() {
  const ms = months(6), cur = ms[5], prev = ms[4], now = spendBy(cur), before = spendBy(prev);
  const cats = [...new Set([...Object.keys(now), ...Object.keys(before)])].sort((a, b) => (now[b] || 0) - (now[a] || 0));
  const delta = c => { const a = now[c] || 0, b = before[c] || 0; if (!b) return a ? 'new' : '—'; const d = Math.round((a - b) / b * 100); return (d > 0 ? '+' : '') + d + '%'; };
  const comp = h('table', {}, h('thead', {}, h('tr', {}, ...['Category', mLabel(prev), mLabel(cur), 'Change'].map((x, i) => h('th', { scope: 'col', class: i ? 'n' : '' }, x)))),
    h('tbody', {}, ...cats.map(c => h('tr', {}, h('th', { scope: 'row' }, c), h('td', { class: 'n' }, money(before[c] || 0)), h('td', { class: 'n' }, money(now[c] || 0)), h('td', { class: 'n ' + (delta(c).startsWith('+') ? 'up' : delta(c).startsWith('-') ? 'down' : '') }, delta(c))))));
  const trend = h('table', {}, h('thead', {}, h('tr', {}, ...['Month', 'Income', 'Expenses', 'Savings rate'].map((x, i) => h('th', { scope: 'col', class: i ? 'n' : '' }, x)))),
    h('tbody', {}, ...ms.map(k => { const l = inMonth(k), i = sum(l, 'income'), e = sum(l, 'expense'); return h('tr', {}, h('th', { scope: 'row' }, mLabel(k, true)), h('td', { class: 'n' }, money(i)), h('td', { class: 'n' }, money(e)), h('td', { class: 'n' }, rate(i, e))); })));
  $('#insights').replaceChildren(h('header', { class: 'head' }, h('h1', {}, 'Insights')), h('div', { class: 'panel insight' }, insightText()),
    h('div', { class: 'grid2' }, h('div', { class: 'panel' }, h('h2', {}, `Spending, ${mLabel(cur, true)}`), donut(now)), h('div', { class: 'panel' }, h('h2', {}, 'Income vs expenses, 6 months'), barChart(ms))),
    h('div', { class: 'panel' }, h('h2', {}, 'Category comparison'), cats.length ? comp : h('p', { class: 'muted' }, 'No expenses in the last two months.')),
    h('div', { class: 'panel' }, h('h2', {}, 'Savings rate by month'), trend));
}

function renderSettings() {
  const f = $('#settingsForm'), st = state.settings;
  if (document.activeElement && f.contains(document.activeElement)) return;
  f.name.value = st.name; f.currency.value = st.currency; f.monthlyBudget.value = st.monthlyBudget;
}

function render() {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === ui.view));
  document.querySelectorAll('.nav-btn').forEach(b => b.toggleAttribute('aria-current', b.dataset.view === ui.view) || b.removeAttribute('aria-current'));
  document.querySelectorAll('.nav-btn').forEach(b => { if (b.dataset.view === ui.view) b.setAttribute('aria-current', 'page'); });
  ({ overview: renderOverview, transactions: renderTransactions, budgets: renderBudgets, insights: renderInsights, settings: renderSettings })[ui.view]();
}

/* ---------- Feedback, dialogs ---------- */
function toast(msg, isError) {
  const t = h('div', { class: 'toast' + (isError ? ' error' : ''), role: 'status' }, msg);
  $('#toasts').append(t); setTimeout(() => t.remove(), 3000);
}
function ask(msg, okLabel, fn) {
  const d = $('#confirmDialog');
  $('#cMsg').textContent = msg; $('#cOk').textContent = okLabel;
  d.onclose = () => { if (d.returnValue === 'yes') fn(); d.returnValue = ''; };
  d.showModal();
}
function fillCategories(type, selected) {
  $('#txForm').category.replaceChildren(...(type === 'income' ? INCOME : EXPENSE).map(c => h('option', { value: c, selected: c === selected }, c)));
}
function openTx(id) {
  const f = $('#txForm'), t = state.tx.find(x => x.id === id);
  ui.editing = t ? id : null;
  $('#txTitle').textContent = t ? 'Edit transaction' : 'Add transaction';
  f.reset(); f.querySelectorAll('[data-err]').forEach(e => e.textContent = '');
  f.type.value = t ? t.type : 'expense'; fillCategories(f.type.value, t && t.category);
  f.description.value = t ? t.description : ''; f.amount.value = t ? t.amount : '';
  f.date.value = t ? t.date : ymd(new Date()); f.notes.value = t ? t.notes : '';
  $('#txDialog').showModal(); f.description.focus();
}
function submitTx(e) {
  e.preventDefault();
  const f = e.target, v = { description: f.description.value.trim(), amount: parseFloat(f.amount.value), type: f.type.value, category: f.category.value, date: f.date.value, notes: f.notes.value.trim() };
  const errs = {};
  if (!v.description) errs.description = 'Please enter a description.';
  if (!(v.amount > 0)) errs.amount = 'Enter an amount greater than zero.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) errs.date = 'Choose a valid date.';
  f.querySelectorAll('[data-err]').forEach(el => el.textContent = errs[el.dataset.err] || '');
  if (Object.keys(errs).length) { toast('Please fix the highlighted fields', true); return; }
  v.amount = Math.round(v.amount * 100) / 100;
  if (ui.editing) Object.assign(state.tx.find(t => t.id === ui.editing), v); else state.tx.push({ id: uid(), ...v });
  toast(ui.editing ? 'Transaction updated' : 'Transaction added');
  $('#txDialog').close(); commit();
}

/* ---------- Events ---------- */
function go(view) { ui.view = view; history.replaceState(null, '', '#' + view); render(); window.scrollTo(0, 0); }
function init() {
  $('#fCat').append(...[...EXPENSE, ...INCOME].map(c => h('option', { value: c }, c)));
  document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  const v = location.hash.slice(1); if (document.getElementById(v) && ['overview', 'transactions', 'budgets', 'insights', 'settings'].includes(v)) ui.view = v;
  document.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-add')) openTx();
    else if (t.dataset.edit) openTx(t.dataset.edit);
    else if (t.dataset.del) { const tx = state.tx.find(x => x.id === t.dataset.del); ask(`Delete “${tx.description}”? This cannot be undone.`, 'Delete', () => { state.tx = state.tx.filter(x => x.id !== tx.id); toast('Transaction deleted'); commit(); }); }
    else if (t.dataset.bedit) { ui.editBudget = t.dataset.bedit; renderBudgets(); $('#budgetForm').limit.value = state.budgets[ui.editBudget]; $('#budgetForm').limit.focus(); }
    else if (t.dataset.bdel) ask(`Remove the ${t.dataset.bdel} budget?`, 'Remove', () => { delete state.budgets[t.dataset.bdel]; ui.editBudget = null; toast('Budget removed'); commit(); });
    else if (t.id === 'hintOk') { state.hintDismissed = true; commit(); }
    else if (t.hasAttribute('data-close')) $('#txDialog').close();
  });
  $('#txForm').addEventListener('submit', submitTx);
  $('#txForm').type.forEach(r => r.addEventListener('change', () => fillCategories(r.value)));
  $('#txDialog').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  $('#filters').addEventListener('input', e => { ui.f[e.target.name] = e.target.value; renderTransactions(); });
  $('#filters').addEventListener('submit', e => e.preventDefault());
  $('#budgetForm').addEventListener('submit', e => {
    e.preventDefault(); const f = e.target, limit = parseFloat(f.limit.value);
    if (!f.cat.value) { $('#bErr').textContent = 'All categories already have a budget.'; return; }
    if (!(limit > 0)) { $('#bErr').textContent = 'Enter a limit greater than zero.'; return; }
    $('#bErr').textContent = ''; state.budgets[f.cat.value] = limit; ui.editBudget = null; f.reset(); toast('Budget saved'); commit();
  });
  $('#settingsForm').addEventListener('submit', e => {
    e.preventDefault(); const f = e.target, mb = parseFloat(f.monthlyBudget.value), name = f.name.value.trim();
    if (!name) { $('#sErr').textContent = 'Display name is required.'; return; }
    if (!(mb > 0)) { $('#sErr').textContent = 'Monthly budget must be greater than zero.'; return; }
    $('#sErr').textContent = ''; state.settings = { name, currency: f.currency.value, monthlyBudget: mb }; toast('Settings saved'); commit();
  });
  $('#resetBtn').addEventListener('click', () => ask('Replace everything with the original sample data?', 'Reset', () => { state = fresh(); ui.editBudget = null; toast('Demo data restored'); commit(); }));
  render();
}
init();
