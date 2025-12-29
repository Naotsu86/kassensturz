<template>
  <div class="wrap">
    <header>
      <div>
        <h1>Reise-Kasse</h1>
        <p class="sub">Personen &amp; Ausgaben erfassen → Saldo &amp; Überweisungen. Alles lokal, mit JSON Export/Import.</p>
      </div>

      <div class="row" style="justify-content:flex-end">
        <button class="btn" @click="exportJson">📤 Export</button>
        <label class="btn" style="cursor:pointer;">
          📥 Import
          <input type="file" accept="application/json" style="display:none" @change="importJson($event)" />
        </label>
        <button class="btn danger" @click="resetAll">🧹 Reset</button>
      </div>
    </header>

    <div class="grid">
      <!-- LEFT -->
      <section class="card">
        <div class="hd">
          <h2>👥 Personen</h2>
          <span class="muted" style="font-size:12px">{{ people.length }} Teilnehmer</span>
        </div>
        <div class="bd">
          <div class="row">
            <div class="field">
              <label>Neue Person</label>
              <input type="text" v-model.trim="newPerson" placeholder="z.B. Alex" @keyup.enter="addPerson" />
            </div>
            <div class="field small" style="align-self:flex-end">
              <button class="btn primary" style="width:100%" @click="addPerson">➕ Hinzufügen</button>
            </div>
          </div>

          <div class="row" style="margin-top:10px" v-if="people.length">
            <div class="kpi">
              <span class="pill" v-for="p in people" :key="p.id">
                <span>{{ p.name }}</span>
                <button class="btn danger" style="padding:6px 8px;border-radius:999px" title="Person entfernen"
                        @click="removePerson(p.id)">✕</button>
              </span>
            </div>
          </div>

          <div class="hr"></div>

          <div class="row" style="justify-content:space-between; align-items:flex-end;">
            <div>
              <h2 style="margin:0;font-size:14px">📊 Saldo</h2>
              <div class="smallnote">Positiv = bekommt Geld. Negativ = schuldet Geld.</div>
            </div>
            <div class="muted" style="font-size:12px">Gesamt: <b>{{ fmtMoney(totalSpentCents) }}</b></div>
          </div>

          <div style="margin-top:10px" v-if="people.length === 0" class="smallnote">
            Erst Personen hinzufügen. Dann kannst du Ausgaben erfassen.
          </div>

          <div class="list" style="margin-top:10px" v-else>
            <div class="item" v-for="b in balancesSorted" :key="b.id">
              <div class="top">
                <p class="title"><b>{{ b.name }}</b></p>
                <span class="money" :class="b.cents >= 0 ? 'pos' : 'neg'">
                  <b>{{ fmtMoney(b.cents) }}</b>
                </span>
              </div>
              <div class="meta">
                <span>bezahlt: {{ fmtMoney(paidByPersonCents(b.id)) }}</span>
                <span>Fairer Anteil: {{ fmtMoney(fairShareCents(b.id)) }}</span>
              </div>
            </div>
          </div>

          <div class="hr"></div>

          <div class="row" style="justify-content:space-between; align-items:center;">
            <div>
              <h2 style="margin:0;font-size:14px">💸 Überweisungen</h2>
              <div class="smallnote">
                <b>{{ transferMode === 'min' ? '✨ Minimiert' : '🧾 Direkt an Zahler' }}</b>
                – {{ transferMode === 'min'
                  ? 'wenige Transfers (kann sich stark ändern)'
                  : 'stabiler/verständlicher (oft mehr Transfers)' }}
              </div>
            </div>
            <div class="row" style="gap:8px">
              <button class="btn" :class="{ primary: transferMode === 'min' }" @click="transferMode = 'min'">✨ Minimiert</button>
              <button class="btn" :class="{ primary: transferMode === 'direct' }" @click="transferMode = 'direct'">🧾 Direkt</button>
            </div>
          </div>

          <div style="margin-top:10px" v-if="activeTransfers.length === 0" class="smallnote">
            Noch keine Transfers – entweder keine Ausgaben oder alles schon ausgeglichen.
          </div>

          <div class="list" style="margin-top:10px" v-else>
            <div class="item" v-for="(t, idx) in activeTransfers" :key="idx">
              <div class="top">
                <p class="title">{{ t.from }} → <b>{{ t.to }}</b></p>
                <span class="money neg"><b>{{ fmtMoney(t.cents) }}</b></span>
              </div>
              <div class="meta">
                <span class="muted">Tipp: Referenz „Reise-Ausgleich“</span>
              </div>
            </div>
          </div>

          <div class="hr"></div>

          <details>
            <summary class="muted" style="cursor:pointer; font-size:13px;">🔎 Debug-Ansicht (Rohdaten)</summary>
            <pre class="code">{{ debugState }}</pre>
          </details>
        </div>
      </section>

      <!-- RIGHT -->
      <section class="card">
        <div class="hd">
          <h2>🧾 Ausgaben</h2>
          <span class="muted" style="font-size:12px">{{ expenses.length }} Einträge</span>
        </div>
        <div class="bd">
          <div v-if="people.length === 0" class="smallnote">
            Du brauchst mindestens <b>1 Person</b>, bevor du Ausgaben anlegen kannst.
          </div>

          <div v-else>
            <div class="row">
              <div class="field">
                <label>Beschreibung (optional)</label>
                <input type="text" v-model.trim="draft.desc" placeholder="z.B. Abendessen, Taxi, Museum" />
              </div>

              <div class="field small">
                <label>Betrag (€)</label>
                <input type="number" inputmode="decimal" step="0.01" min="0" v-model="draft.amountEuro" />
              </div>

              <div class="field">
                <label>Bezahlt von</label>
                <select v-model="draft.payerId">
                  <option v-for="p in people" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
              </div>
            </div>

            <div class="row" style="align-items:flex-start">
              <div class="field" style="min-width:280px; flex:1 1 320px">
                <label>Teilnehmer (wer teilt diese Ausgabe?)</label>
                <div class="checks">
                  <label class="check" v-for="p in people" :key="p.id">
                    <input type="checkbox" :value="p.id" v-model="draft.participantIds" />
                    <span>{{ p.name }}</span>
                  </label>
                </div>
                <div class="smallnote" style="margin-top:8px">
                  Standard: alle angehakt. Du kannst z.B. bei „nur zwei waren mit“ abwählen.
                </div>
              </div>

              <div class="field small" style="align-self:flex-end; min-width:160px">
                <button class="btn primary" style="width:100%" @click="addExpense">
                  {{ editIndex === null ? '➕ Ausgabe hinzufügen' : '✅ Änderungen speichern' }}
                </button>
                <button v-if="editIndex !== null" class="btn" style="width:100%; margin-top:8px" @click="cancelEdit">
                  ↩︎ Abbrechen
                </button>
              </div>
            </div>

            <div class="hr"></div>

            <div class="footerbar">
              <div class="smallnote">
                Speicherung: <b>localStorage</b>. Backup: Export JSON.
              </div>
              <div class="row">
                <button class="btn" @click="selectAllParticipants">✔︎ Alle</button>
                <button class="btn" @click="selectOnlyPayer">👤 Nur Zahler</button>
              </div>
            </div>

            <div class="hr"></div>
          </div>

          <div class="list" v-if="expenses.length">
            <div class="item" v-for="(e, idx) in expenses" :key="e.id">
              <div class="top">
                <div>
                  <p class="title">
                    <b>{{ e.desc || 'Ausgabe' }}</b>
                    <span class="muted" style="font-size:12px">· bezahlt von {{ nameById(e.payerId) }}</span>
                  </p>
                  <div class="meta">
                    <span>Betrag: <b>{{ fmtMoney(e.amountCents) }}</b></span>
                    <span>geteilt durch: {{ e.participantIds.length }} ({{ participantNames(e.participantIds).join(', ') }})</span>
                  </div>
                </div>

                <div class="row" style="gap:8px; justify-content:flex-end">
                  <button class="btn" @click="startEdit(idx)">✏️</button>
                  <button class="btn danger" @click="deleteExpense(idx)">🗑️</button>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="smallnote">
            Noch keine Ausgaben. Leg oben die erste an (z.B. „Abendessen 100€“).
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'

const LS_KEY = 'reise_kasse_vite_pwa_v1'

function uid () {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

function toCentsFromEuroInput (val) {
  if (val === null || val === undefined) return 0
  const s = String(val).trim().replace(',', '.')
  if (!s) return 0
  const n = Number(s)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

function fmtMoney (cents) {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const euros = Math.floor(abs / 100)
  const rest = abs % 100
  const euroStr = euros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${euroStr},${String(rest).padStart(2, '0')} €`
}

const people = ref([])
const expenses = ref([])
const newPerson = ref('')

const draft = reactive({
  desc: '',
  amountEuro: '',
  payerId: '',
  participantIds: []
})

const editIndex = ref(null)
const transferMode = ref('direct') // 'min' | 'direct'

function nameById (id) {
  return (people.value.find(p => p.id === id) || {}).name || '—'
}

function participantNames (ids) {
  const set = new Set(ids || [])
  return people.value.filter(p => set.has(p.id)).map(p => p.name)
}

function selectAllParticipants () {
  draft.participantIds = people.value.map(p => p.id)
}
function selectOnlyPayer () {
  draft.participantIds = draft.payerId ? [draft.payerId] : []
}

const totalSpentCents = computed(() =>
  expenses.value.reduce((s, e) => s + (e.amountCents || 0), 0)
)

// -------- Balances (exact cents splitting) ----------
const balances = computed(() => {
  const bal = Object.fromEntries(people.value.map(p => [p.id, 0]))

  for (const e of expenses.value) {
    const payer = e.payerId
    const parts = (e.participantIds || []).filter(id => id in bal)
    const n = parts.length
    const amount = e.amountCents || 0
    if (!(payer in bal)) continue
    if (n <= 0) continue

    bal[payer] += amount

    const base = Math.floor(amount / n)
    let rem = amount - base * n

    const ordered = parts.slice().sort((a, b) => nameById(a).localeCompare(nameById(b)))
    for (const id of ordered) {
      const share = base + (rem > 0 ? 1 : 0)
      if (rem > 0) rem -= 1
      bal[id] -= share
    }
  }

  return bal
})

const balancesSorted = computed(() =>
  people.value
    .map(p => ({ id: p.id, name: p.name, cents: balances.value[p.id] || 0 }))
    .sort((a, b) => b.cents - a.cents)
)

// -------- Transfers mode 1: minimized -----------
const transfersMinimized = computed(() => {
  const creditors = []
  const debtors = []

  for (const p of people.value) {
    const c = balances.value[p.id] || 0
    if (c > 0) creditors.push({ id: p.id, name: p.name, cents: c })
    else if (c < 0) debtors.push({ id: p.id, name: p.name, cents: -c })
  }

  creditors.sort((a, b) => b.cents - a.cents)
  debtors.sort((a, b) => b.cents - a.cents)

  const out = []
  let i = 0; let j = 0
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]
    const c = creditors[j]
    const pay = Math.min(d.cents, c.cents)
    if (pay > 0) {
      out.push({ from: d.name, to: c.name, cents: pay })
      d.cents -= pay
      c.cents -= pay
    }
    if (d.cents === 0) i++
    if (c.cents === 0) j++
  }
  return out
})

// -------- Transfers mode 2: direct-to-payer (stable) -----------
const transfersDirect = computed(() => {
  // Build per-pair debts based on each expense:
  // For each participant (except payer), participant owes payer their share.
  const pairDebt = new Map() // key: fromId->toId, value cents

  const addDebt = (fromId, toId, cents) => {
    if (cents <= 0 || fromId === toId) return
    const key = `${fromId}__${toId}`
    pairDebt.set(key, (pairDebt.get(key) || 0) + cents)
  }

  for (const e of expenses.value) {
    const payer = e.payerId
    const parts = (e.participantIds || []).filter(id => people.value.some(p => p.id === id))
    const n = parts.length
    const amount = e.amountCents || 0
    if (!payer || n <= 0 || amount <= 0) continue

    const base = Math.floor(amount / n)
    let rem = amount - base * n
    const ordered = parts.slice().sort((a, b) => nameById(a).localeCompare(nameById(b)))

    // Determine share per participant exactly like balances
    for (const id of ordered) {
      const share = base + (rem > 0 ? 1 : 0)
      if (rem > 0) rem -= 1
      if (id !== payer) addDebt(id, payer, share)
    }
  }

  // Net mutual debts: if A owes B and B owes A, keep the difference
  const net = new Map() // key: from__to, cents
  const keys = Array.from(pairDebt.keys())
  const seen = new Set()

  for (const key of keys) {
    if (seen.has(key)) continue
    seen.add(key)

    const [from, to] = key.split('__')
    const rev = `${to}__${from}`
    const a = pairDebt.get(key) || 0
    const b = pairDebt.get(rev) || 0
    seen.add(rev)

    if (a > b) net.set(key, a - b)
    else if (b > a) net.set(rev, b - a)
  }

  const out = []
  for (const [key, cents] of net.entries()) {
    const [fromId, toId] = key.split('__')
    out.push({ from: nameById(fromId), to: nameById(toId), cents })
  }

  // sort bigger first for readability
  out.sort((x, y) => y.cents - x.cents)
  return out
})

const activeTransfers = computed(() =>
  transferMode.value === 'min' ? transfersMinimized.value : transfersDirect.value
)

const debugState = computed(() => JSON.stringify({ people: people.value, expenses: expenses.value }, null, 2))

function paidByPersonCents (personId) {
  return expenses.value
    .filter(e => e.payerId === personId)
    .reduce((s, e) => s + (e.amountCents || 0), 0)
}

function fairShareCents (personId) {
  let share = 0
  for (const e of expenses.value) {
    const parts = e.participantIds || []
    const n = parts.length
    if (n <= 0) continue

    const amount = e.amountCents || 0
    const base = Math.floor(amount / n)
    let rem = amount - base * n
    const ordered = parts.slice().sort((a, b) => nameById(a).localeCompare(nameById(b)))

    for (const id of ordered) {
      const s = base + (rem > 0 ? 1 : 0)
      if (rem > 0) rem -= 1
      if (id === personId) share += s
    }
  }
  return share
}

function addPerson () {
  const name = (newPerson.value || '').trim()
  if (!name) return
  const exists = people.value.some(p => p.name.toLowerCase() === name.toLowerCase())
  if (exists) { newPerson.value = ''; return }

  const id = uid()
  people.value.push({ id, name })

  if (!draft.payerId) draft.payerId = id
  selectAllParticipants()
  newPerson.value = ''
}

function removePerson (personId) {
  people.value = people.value.filter(p => p.id !== personId)

  const remainingIds = new Set(people.value.map(p => p.id))
  const newExpenses = []
  for (const e of expenses.value) {
    if (!remainingIds.has(e.payerId)) continue
    const parts = (e.participantIds || []).filter(id => remainingIds.has(id))
    if (parts.length === 0) continue
    newExpenses.push({ ...e, participantIds: parts })
  }
  expenses.value = newExpenses

  if (draft.payerId === personId) draft.payerId = people.value[0]?.id || ''
  draft.participantIds = (draft.participantIds || []).filter(id => remainingIds.has(id))
  if (draft.participantIds.length === 0) selectAllParticipants()

  editIndex.value = null
}

function addExpense () {
  if (people.value.length === 0) return
  const payerId = draft.payerId || people.value[0].id
  const participantIds = (draft.participantIds || []).slice()
  const amountCents = toCentsFromEuroInput(draft.amountEuro)

  if (!payerId) return
  if (amountCents <= 0) return
  if (participantIds.length === 0) return

  const e = {
    id: uid(),
    desc: (draft.desc || '').trim(),
    payerId,
    amountCents,
    participantIds
  }

  if (editIndex.value === null) {
    expenses.value.unshift(e)
  } else {
    const old = expenses.value[editIndex.value]
    expenses.value.splice(editIndex.value, 1, { ...e, id: old.id })
    editIndex.value = null
  }

  draft.desc = ''
  draft.amountEuro = ''
  selectAllParticipants()
}

function startEdit (idx) {
  const e = expenses.value[idx]
  if (!e) return
  editIndex.value = idx
  draft.desc = e.desc || ''
  draft.amountEuro = (e.amountCents / 100).toFixed(2)
  draft.payerId = e.payerId
  draft.participantIds = (e.participantIds || []).slice()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function cancelEdit () {
  editIndex.value = null
  draft.desc = ''
  draft.amountEuro = ''
  if (!draft.payerId) draft.payerId = people.value[0]?.id || ''
  selectAllParticipants()
}

function deleteExpense (idx) {
  expenses.value.splice(idx, 1)
  if (editIndex.value === idx) cancelEdit()
}

function exportJson () {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    people: people.value,
    expenses: expenses.value
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'reise-kasse.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function importJson (evt) {
  const file = evt.target.files?.[0]
  evt.target.value = ''
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)

    if (!data || !Array.isArray(data.people) || !Array.isArray(data.expenses)) {
      alert('JSON hat nicht das erwartete Format (people/expenses).')
      return
    }

    const p1 = data.people
      .filter(p => p && typeof p.id === 'string' && typeof p.name === 'string')
      .map(p => ({ id: p.id, name: p.name.trim().slice(0, 40) }))
      .filter(p => p.name.length > 0)

    const seen = new Set()
    const cleanPeople = []
    for (const p of p1) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      cleanPeople.push(p)
    }

    const validIds = new Set(cleanPeople.map(p => p.id))

    const e1 = data.expenses
      .filter(e => e && typeof e.id === 'string' && typeof e.payerId === 'string')
      .map(e => ({
        id: e.id,
        desc: typeof e.desc === 'string' ? e.desc.slice(0, 120) : '',
        payerId: e.payerId,
        amountCents: Number.isFinite(e.amountCents) ? Math.max(0, Math.round(e.amountCents)) : 0,
        participantIds: Array.isArray(e.participantIds) ? e.participantIds.filter(id => validIds.has(id)) : []
      }))
      .filter(e => validIds.has(e.payerId) && e.amountCents > 0 && e.participantIds.length > 0)

    people.value = cleanPeople
    expenses.value = e1

    draft.payerId = people.value[0]?.id || ''
    selectAllParticipants()
    editIndex.value = null
  } catch (err) {
    console.error(err)
    alert('Konnte JSON nicht importieren (ungültig oder beschädigt).')
  }
}

function resetAll () {
  if (!confirm('Wirklich alles löschen? (Personen + Ausgaben)')) return
  people.value = []
  expenses.value = []
  newPerson.value = ''
  draft.desc = ''
  draft.amountEuro = ''
  draft.payerId = ''
  draft.participantIds = []
  editIndex.value = null
  localStorage.removeItem(LS_KEY)
}

function load () {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (!data || !Array.isArray(data.people) || !Array.isArray(data.expenses)) return
    people.value = data.people
    expenses.value = data.expenses
    draft.payerId = people.value[0]?.id || ''
    selectAllParticipants()
  } catch {}
}

function save () {
  const data = { people: people.value, expenses: expenses.value, transferMode: transferMode.value }
  localStorage.setItem(LS_KEY, JSON.stringify(data))
}

onMounted(() => {
  // migrate/load
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const data = JSON.parse(raw)
      if (data && Array.isArray(data.people) && Array.isArray(data.expenses)) {
        people.value = data.people
        expenses.value = data.expenses
        transferMode.value = data.transferMode || 'direct'
      }
    }
  } catch {}
  if (people.value.length === 0 && expenses.value.length === 0) {
    // seed demo
    const A = { id: uid(), name: 'A' }
    const B = { id: uid(), name: 'B' }
    const C = { id: uid(), name: 'C' }
    const D = { id: uid(), name: 'D' }
    people.value = [A, B, C, D]
    expenses.value = [
      { id: uid(), desc: 'Rechnung 1', payerId: A.id, amountCents: 10000, participantIds: [A.id, B.id, C.id, D.id] },
      { id: uid(), desc: 'Rechnung 2', payerId: B.id, amountCents: 12540, participantIds: [A.id, B.id, C.id, D.id] }
    ]
    draft.payerId = A.id
    selectAllParticipants()
    save()
  } else {
    draft.payerId = people.value[0]?.id || ''
    selectAllParticipants()
  }
})

watch(people, save, { deep: true })
watch(expenses, save, { deep: true })
watch(transferMode, save)
</script>

<style>
:root{
  --bg:#f6f7f9;
  --panel:#ffffff;
  --ink:#18202b;
  --muted:#5b6776;
  --line:#e7ebf0;
  --accent:#3b82f6;
  --danger:#ef4444;
  --ok:#16a34a;
  --shadow: 0 10px 30px rgba(0,0,0,.08);
  --radius:16px;
  --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --sans: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
}
*{ box-sizing:border-box; }
html,body{ height:100%; }
body{
  margin:0;
  font-family:var(--sans);
  background:var(--bg);
  color:var(--ink);
}
.wrap{
  max-width:1100px;
  margin:0 auto;
  padding:18px;
}
header{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:12px;
  margin: 4px 0 14px;
}
h1{
  margin:0;
  font-size:20px;
  letter-spacing:-.2px;
}
.sub{
  margin:6px 0 0;
  color:var(--muted);
  font-size:13px;
}
.grid{
  display:grid;
  grid-template-columns: 1.1fr 1.9fr;
  gap:14px;
}
@media (max-width: 900px){
  .grid{ grid-template-columns: 1fr; }
  header{ align-items:flex-start; flex-direction:column; }
}
.card{
  background:var(--panel);
  border:1px solid var(--line);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  overflow:hidden;
}
.card .hd{
  padding:12px 14px;
  border-bottom:1px solid var(--line);
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.card .hd h2{
  margin:0;
  font-size:14px;
  letter-spacing:.2px;
}
.card .bd{ padding:14px; }
.row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.row + .row{ margin-top:10px; }
label{
  font-size:12px;
  color:var(--muted);
  display:block;
  margin-bottom:6px;
}
input, select, button, textarea{ font:inherit; }
input[type="text"], input[type="number"], select, textarea{
  width:100%;
  padding:10px 10px;
  border:1px solid var(--line);
  border-radius:12px;
  background:#fff;
  outline:none;
}
textarea{ min-height:60px; resize:vertical; }
.field{ flex:1 1 180px; min-width: 180px; }
.field.small{ flex:0 1 120px; min-width:120px; }
.btn{
  border:1px solid var(--line);
  background:#fff;
  padding:9px 10px;
  border-radius:12px;
  cursor:pointer;
  transition: transform .03s ease, border-color .1s ease;
  display:inline-flex;
  align-items:center;
  gap:8px;
  user-select:none;
}
.btn:hover{ border-color:#cfd7e2; }
.btn:active{ transform: translateY(1px); }
.btn.primary{
  background:var(--accent);
  border-color:var(--accent);
  color:#fff;
}
.btn.danger{
  background:#fff;
  border-color:#ffd3d3;
  color:var(--danger);
}
.pill{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:6px 10px;
  border:1px solid var(--line);
  border-radius:999px;
  font-size:13px;
  background:#fff;
}
.pill b{ font-family:var(--mono); font-size:12px; }
.list{
  display:flex;
  flex-direction:column;
  gap:10px;
}
.item{
  border:1px solid var(--line);
  border-radius:14px;
  padding:10px 12px;
  background:#fff;
}
.item .top{
  display:flex;
  justify-content:space-between;
  gap:10px;
  align-items:flex-start;
}
.item .title{
  font-size:13px;
  margin:0;
  line-height:1.25;
}
.item .meta{
  margin-top:6px;
  font-size:12px;
  color:var(--muted);
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}
.muted{ color:var(--muted); }
.checks{
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap:8px 10px;
  padding:10px;
  border:1px solid var(--line);
  border-radius:14px;
  background:#fbfcfe;
}
@media (max-width: 520px){
  .checks{ grid-template-columns: 1fr; }
}
.check{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:13px;
  color:var(--ink);
}
.check input{ width:18px; height:18px; }
.hr{
  height:1px;
  background:var(--line);
  margin:14px 0;
}
.kpi{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  align-items:center;
}
.kpi .pill{ background:#fbfcfe; }
.money.pos{ color:var(--ok); }
.money.neg{ color:var(--danger); }
.footerbar{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  align-items:center;
  justify-content:space-between;
}
.smallnote{
  font-size:12px;
  color:var(--muted);
  line-height:1.35;
}
.code{
  font-family:var(--mono);
  font-size:12px;
  padding:8px 10px;
  border-radius:12px;
  background:#0b1220;
  color:#e5e7eb;
  overflow:auto;
  border:1px solid rgba(255,255,255,.08);
}
</style>
