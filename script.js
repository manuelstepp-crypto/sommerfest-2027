/* Sommerfest am Sonnenhang 2027 · Save the Date
   Formular → Supabase (nur INSERT erlaubt, RLS aktiv). */

const SUPABASE_URL = 'https://stomqsjexvocbegwzkgy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_4UigCPskAjYZ-0CryLYUeQ_GfMR9IGQ'; // öffentlicher Publishable Key
const TABLE = 'save_the_date';

const EVENT_START = new Date('2027-07-23T15:00:00+02:00');

/* ---------- Countdown ---------- */
function updateCountdown() {
    const diff = EVENT_START - new Date();
    const el = (id) => document.getElementById(id);
    if (diff <= 0) {
        el('cdDays').textContent = '0';
        el('cdHours').textContent = '0';
        el('cdMinutes').textContent = '0';
        return;
    }
    el('cdDays').textContent = Math.floor(diff / 86400000);
    el('cdHours').textContent = Math.floor((diff % 86400000) / 3600000);
    el('cdMinutes').textContent = Math.floor((diff % 3600000) / 60000);
}
updateCountdown();
setInterval(updateCountdown, 30000);

/* ---------- Modal ---------- */
const modal = document.getElementById('modal');
const openBtn = document.getElementById('openBtn');
let lastFocus = null;

function openModal() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => {
        modal.classList.add('is-open');
        const first = modal.querySelector('#formView:not([hidden]) input, .success:not([hidden]) button');
        if (first) first.focus();
    });
}
function closeModal() {
    modal.classList.remove('is-open');
    document.body.classList.remove('modal-open');
    setTimeout(() => { modal.hidden = true; }, 220);
    if (lastFocus) lastFocus.focus();
}

openBtn.addEventListener('click', openModal);
document.getElementById('closeBtn').addEventListener('click', closeModal);
document.getElementById('modalBackdrop').addEventListener('click', closeModal);
modal.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal));
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
});

/* ---------- Begleitpersonen ein-/ausblenden ---------- */
const begleitField = document.getElementById('begleitpersonenField');
const begleitInput = document.getElementById('begleitpersonen');

document.querySelectorAll('input[name="begleitung"]').forEach((r) => r.addEventListener('change', () => {
    begleitField.hidden = document.querySelector('input[name="begleitung"]:checked').value !== 'ja';
}));

document.querySelectorAll('.stepper-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        const step = Number(btn.dataset.step);
        begleitInput.value = Math.min(20, Math.max(1, (Number(begleitInput.value) || 1) + step));
    });
});

/* ---------- Formular ---------- */
const form = document.getElementById('signupForm');
const submitBtn = document.getElementById('submitBtn');
const errorBox = document.getElementById('formError');

function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function clearError() {
    errorBox.hidden = true;
    errorBox.textContent = '';
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
}
function markInvalid(el) { el.classList.add('invalid'); }

function normalizePhone(raw) {
    let s = raw.trim().replace(/[\s\-\/().]/g, '');
    if (s.startsWith('00')) s = '+' + s.slice(2);
    if (/^0\d{6,}$/.test(s)) s = '+49' + s.slice(1); // deutsche Nummer ohne Vorwahl
    return s;
}

function validate() {
    clearError();
    const v = (id) => document.getElementById(id);
    const problems = [];

    if (!v('vorname').value.trim()) { markInvalid(v('vorname')); problems.push('Vorname'); }
    if (!v('nachname').value.trim()) { markInvalid(v('nachname')); problems.push('Nachname'); }

    const email = v('email').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { markInvalid(v('email')); problems.push('E-Mail-Adresse'); }

    const phone = normalizePhone(v('whatsapp').value);
    if (!/^\+\d{7,20}$/.test(phone)) { markInvalid(v('whatsapp')); problems.push('WhatsApp-Nummer (mit Ländervorwahl, z. B. +49 …)'); }

    const begleitung = document.querySelector('input[name="begleitung"]:checked').value === 'ja';
    let begleitpersonen = 0;
    if (begleitung) {
        begleitpersonen = Number(begleitInput.value);
        if (!Number.isInteger(begleitpersonen) || begleitpersonen < 1 || begleitpersonen > 20) {
            markInvalid(begleitInput); problems.push('Anzahl Begleitpersonen (1 bis 20)');
        }
    }

    if (problems.length) {
        showError('Bitte noch prüfen: ' + problems.join(', ') + '.');
        return null;
    }

    const params = new URLSearchParams(location.search);
    return {
        vorname: v('vorname').value.trim(),
        nachname: v('nachname').value.trim(),
        email: email,
        whatsapp: phone,
        begleitung: begleitung,
        begleitpersonen: begleitpersonen,
        nachricht: v('nachricht').value.trim() || null,
        einwilligung: true,
        quelle: params.get('via') || null,
        user_agent: navigator.userAgent.slice(0, 250),
    };
}

async function submit(payload) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Prefer': 'return=minimal',
        },
        body: JSON.stringify(payload),
    });
    if (res.status === 201 || res.status === 204) return 'ok';
    let body = {};
    try { body = await res.json(); } catch (e) { /* leer */ }
    if (res.status === 409 || body.code === '23505') return 'duplicate';
    throw new Error(body.message || `HTTP ${res.status}`);
}

form.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    // Honeypot: Bots füllen das versteckte Feld – dann still "Erfolg" zeigen, nichts speichern.
    if (document.getElementById('website').value) {
        showSuccess(document.getElementById('vorname').value.trim());
        return;
    }

    const payload = validate();
    if (!payload) return;

    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    try {
        const result = await submit(payload);
        if (result === 'duplicate') showView('duplicateView');
        else showSuccess(payload.vorname);
    } catch (err) {
        console.error(err);
        showError('Das hat leider nicht geklappt. Bitte versuch es gleich noch einmal oder schreib Manuel direkt per WhatsApp.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
    }
});

function showView(id) {
    ['formView', 'successView', 'duplicateView'].forEach((v) => {
        document.getElementById(v).hidden = v !== id;
    });
    modal.querySelector('.modal-card').scrollTop = 0;
}
function showSuccess(name) {
    document.getElementById('successName').textContent = name || 'du';
    showView('successView');
}
