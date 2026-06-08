// ============================================================
// CONFIGURAÇÃO FIREBASE
// Substitua pelos seus dados do Firebase Console
// ============================================================
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================================
// DADOS HISTÓRICOS (jan–mai/2026)
// ============================================================
const HIST = [
  { m:'2026-01', label:'Jan', fat:7224.90, atend:154, ticket:46.91 },
  { m:'2026-02', label:'Fev', fat:8299.90, atend:185, ticket:44.86 },
  { m:'2026-03', label:'Mar', fat:9050.00, atend:194, ticket:46.65 },
  { m:'2026-04', label:'Abr', fat:9060.50, atend:198, ticket:45.76 },
  { m:'2026-05', label:'Mai', fat:11309.50, atend:242, ticket:46.73 },
];

const DESPESAS_FIXAS = {
  barbearia: [
    { nome:'Internet e Spotify', valor:276.45, tipo:'Fixo', cat:'Operacional' },
    { nome:'App Barber',         valor:109.90, tipo:'Fixo', cat:'Operacional' },
    { nome:'Luz',                valor:200.00, tipo:'Fixo', cat:'Operacional' },
    { nome:'Marketing',          valor:1750.00, tipo:'Fixo', cat:'Marketing'  },
    { nome:'Laura',              valor:320.00, tipo:'Fixo', cat:'RH'          },
    { nome:'Máquina de Café',    valor:256.00, tipo:'Fixo', cat:'Equipamentos'},
    { nome:'Maca',               valor:180.00, tipo:'Parcela', cat:'Equipamentos', pagas:2, total:5, fim:'ago/2026' },
    { nome:'Ar condicionado',    valor:213.00, tipo:'Parcela', cat:'Equipamentos', pagas:1, total:10, fim:'fev/2027' },
    { nome:'Mesinha',            valor:63.93,  tipo:'Parcela', cat:'Equipamentos', pagas:3, total:4, fim:'jun/2026', encerra:true },
    { nome:'Papo de Barbeira',   valor:99.00,  tipo:'Parcela', cat:'Capacitação',  pagas:1, total:3, fim:'jul/2026' },
    { nome:'MEI',                valor:390.00, tipo:'Parcela', cat:'Financeiro',   pagas:8, total:9, fim:'jun/2026', encerra:true },
  ],
  pessoal: [
    { nome:'Vó',               valor:480.00, tipo:'Fixo', cat:'Pessoal' },
    { nome:'Unimed Pedro',     valor:300.00, tipo:'Fixo', cat:'Pessoal' },
    { nome:'Psicólogo',        valor:180.00, tipo:'Fixo', cat:'Pessoal' },
    { nome:'Cartão de todos',  valor:40.00,  tipo:'Fixo', cat:'Pessoal' },
    { nome:'IPTU',             valor:80.00,  tipo:'Parcela', cat:'Pessoal', pagas:4, total:11, fim:'dez/2026' },
    { nome:'Roupas pessoais',  valor:84.00,  tipo:'Parcela', cat:'Pessoal', pagas:1, total:3, fim:'jul/2026' },
  ]
};

const VENCIMENTOS = [
  { nome:'App Barber',      valor:109.90, dia:2,  conta:'Barbearia', tipo:'Fixo' },
  { nome:'Ar condicionado', valor:213.00, dia:3,  conta:'Barbearia', tipo:'Parcela 2/10' },
  { nome:'Laura',           valor:320.00, dia:10, conta:'Barbearia', tipo:'Fixo' },
  { nome:'Mesinha',         valor:63.93,  dia:16, conta:'Barbearia', tipo:'Parcela 4/4 ★', encerra:true },
  { nome:'MEI',             valor:390.00, dia:25, conta:'Barbearia', tipo:'Parcela 9/9 ★', encerra:true },
  { nome:'Papo de Barbeira',valor:99.00,  dia:30, conta:'Barbearia', tipo:'Parcela 2/3' },
];

const CATS_SAIDA = [
  { nome:'Barbearia', icon:'ti-tool',         bg:'rgba(55,138,221,0.15)', color:'#85B7EB' },
  { nome:'Marketing', icon:'ti-speakerphone', bg:'rgba(224,85,85,0.15)',  color:'#e05555' },
  { nome:'Produtos',  icon:'ti-package',      bg:'rgba(232,166,66,0.15)', color:'#e8a642' },
  { nome:'Bebidas',   icon:'ti-beer',         bg:'rgba(127,119,221,0.15)',color:'#AFA9EC' },
  { nome:'Contas',    icon:'ti-file-invoice', bg:'rgba(76,175,125,0.15)', color:'#4caf7d' },
  { nome:'Pessoal',   icon:'ti-heart',        bg:'rgba(212,83,126,0.15)', color:'#D4537E' },
];

// ============================================================
// ESTADO
// ============================================================
let currentTab = 'painel';
let catSel = 0;
let pagSel = 'Pix';
let lancamentos = [];
let reserva = { valor: 7199, meta: 1000, metaTotal: 11742, historico: [] };
let bebidas = [];
let metas = { fat:9000, desp:8500, atend:220, ticket:46, reserva:1000, prod:10 };

// ============================================================
// FIREBASE HELPERS
// ============================================================
function fbRef(path) { return db.ref(path); }

function loadFirebase() {
  fbRef('lancamentos').on('value', snap => {
    lancamentos = snap.val() ? Object.values(snap.val()) : [];
    if (currentTab === 'junho') renderJunho();
    if (currentTab === 'painel') renderPainel();
  });
  fbRef('reserva').on('value', snap => {
    if (snap.val()) reserva = { ...reserva, ...snap.val() };
    if (currentTab === 'reserva' || currentTab === 'junho') renderReserva();
  });
  fbRef('bebidas').on('value', snap => {
    bebidas = snap.val() ? Object.values(snap.val()) : [];
    if (currentTab === 'bebidas') renderBebidas();
  });
  fbRef('metas').on('value', snap => {
    if (snap.val()) metas = { ...metas, ...snap.val() };
    if (currentTab === 'metas') renderMetas();
  });
}

async function fbSet(path, data) {
  return fbRef(path).set(data);
}
async function fbPush(path, data) {
  const key = fbRef(path).push().key;
  await fbRef(`${path}/${key}`).set({ ...data, id: key });
  return key;
}
async function fbRemove(path) {
  return fbRef(path).remove();
}

// ============================================================
// UTILS
// ============================================================
function brl(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function hoje() { return new Date().toISOString().split('T')[0]; }
function dataFmt(d) { return d ? d.split('-').reverse().join('/') : ''; }
function showToast(msg, tipo = 'ok') {
  const t = document.getElementById('toast');
  t.innerHTML = `<i class="ti ti-${tipo === 'ok' ? 'circle-check' : 'alert-circle'}"></i>${msg}`;
  t.className = `toast show toast-${tipo}`;
  setTimeout(() => t.classList.remove('show'), 2500);
}
function openModal(id) {
  const m = document.getElementById(id);
  m.style.display = 'flex';
  setTimeout(() => m.classList.add('open'), 10);
}
function closeModal(id) {
  const m = document.getElementById(id);
  m.classList.remove('open');
  setTimeout(() => m.style.display = 'none', 300);
}

// ============================================================
// NAVEGAÇÃO
// ============================================================
function switchTab(id) {
  currentTab = id;
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');
  document.querySelector(`.nav-item[data-tab="${id}"]`).classList.add('active');

  const renders = { painel: renderPainel, junho: renderJunho, alertas: renderAlertas, reserva: renderReserva, metas: renderMetas, bebidas: renderBebidas };
  if (renders[id]) renders[id]();
}

// ============================================================
// PAINEL
// ============================================================
function renderPainel() {
  const fatMai = HIST[4].fat;
  const desp = 8248.77;
  const resultado = 1060.73;
  const pctReserva = Math.round((reserva.valor / reserva.metaTotal) * 100);
  const lancJun = lancamentos.filter(l => l.data && l.data.startsWith('2026-06'));
  const totalJun = lancJun.reduce((s, l) => s + l.valor, 0);

  document.getElementById('sec-painel').innerHTML = `
    <div class="metrics">
      <div class="mcard">
        <div class="mcard-label">Faturamento mai</div>
        <div class="mcard-val val-green">${brl(fatMai)}</div>
        <div class="mcard-sub">↑ recorde histórico</div>
      </div>
      <div class="mcard">
        <div class="mcard-label">Atendimentos mai</div>
        <div class="mcard-val">242</div>
        <div class="mcard-sub" style="color:var(--green)">+27 vs. abril</div>
      </div>
      <div class="mcard">
        <div class="mcard-label">Resultado líquido</div>
        <div class="mcard-val val-green">${brl(resultado)}</div>
        <div class="mcard-sub">mai/2026</div>
      </div>
      <div class="mcard">
        <div class="mcard-label">Saídas jun. até agora</div>
        <div class="mcard-val ${totalJun > 0 ? 'val-red' : ''}">${totalJun > 0 ? brl(totalJun) : '—'}</div>
        <div class="mcard-sub">${lancJun.length} lançamentos</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Faturamento jan–mai/2026</div>
      <div class="bar-chart">
        ${HIST.map((h, i) => {
          const pct = Math.round((h.fat / 11309.50) * 100);
          const ativo = i === 4;
          return `<div class="bar-col">
            <div class="bar-fill" style="height:${pct}%;background:${ativo ? 'var(--gold)' : 'var(--bg3)'};border:0.5px solid ${ativo ? 'var(--gold)' : 'var(--border2)'}"></div>
            <div class="bar-label">${h.label}</div>
          </div>`;
        }).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-top:4px">
        <span>R$ 7.224 em jan</span>
        <span style="color:var(--gold)">R$ 11.309 em mai ★</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Reserva financeira</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">
        <div>
          <div style="font-size:11px;color:var(--text2);margin-bottom:2px">Cofrinho Mercado Pago</div>
          <div style="font-size:26px;font-weight:600;color:var(--green);font-family:var(--mono)">${brl(reserva.valor)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:var(--text2)">meta/mês</div>
          <div style="font-size:15px;font-weight:500;color:var(--gold)">R$ 1.000</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px">
        <span>${pctReserva}% da meta</span><span>meta: ${brl(reserva.metaTotal)}</span>
      </div>
      <div class="prog-wrap" style="height:7px"><div class="prog-bar" style="width:${pctReserva}%;background:var(--green)"></div></div>
    </div>

    <div class="card">
      <div class="card-title">Insights</div>
      <div class="insight-item"><i class="ti ti-trending-up" style="color:var(--green)"></i><span><strong>+57% jan→mai.</strong> Crescimento consistente por 5 meses. Maio foi recorde.</span></div>
      <div class="insight-item"><i class="ti ti-confetti" style="color:var(--gold)"></i><span><strong>MEI e Mesinha encerram em junho!</strong> R$ 453/mês liberados a partir de julho.</span></div>
      <div class="insight-item"><i class="ti ti-scissors" style="color:var(--amber)"></i><span><strong>Barboterapia em alta:</strong> 14→21 atendimentos. Serviço premium com potencial.</span></div>
      <div class="insight-item"><i class="ti ti-package" style="color:var(--amber)"></i><span><strong>Produtos = 5,5%</strong> do faturamento. Meta: 10%. +R$ 500/mês possíveis.</span></div>
    </div>`;
}

// ============================================================
// JUNHO
// ============================================================
function renderJunho() {
  const junLancs = lancamentos.filter(l => l.data && l.data.startsWith('2026-06')).sort((a,b) => b.data.localeCompare(a.data));
  const total = junLancs.reduce((s, l) => s + l.valor, 0);
  const barb = junLancs.filter(l => l.conta === 'Barbearia').reduce((s,l) => s+l.valor, 0);
  const pes = junLancs.filter(l => l.conta === 'Pessoal').reduce((s,l) => s+l.valor, 0);

  const lista = junLancs.length
    ? junLancs.map(l => {
        const cat = CATS_SAIDA.find(c => c.nome === l.categoria) || CATS_SAIDA[0];
        return `<div class="list-item">
          <div class="list-icon" style="background:${cat.bg}"><i class="ti ${cat.icon}" style="color:${cat.color}"></i></div>
          <div class="list-info">
            <div class="list-name">${l.desc}</div>
            <div class="list-meta">${dataFmt(l.data)} · ${l.categoria} · ${l.pagamento || ''}${l.obs ? ' · ' + l.obs : ''}</div>
          </div>
          <div class="list-val" style="color:var(--red)">${brl(l.valor)}</div>
          <button class="del-btn" onclick="delLanc('${l.id}')"><i class="ti ti-trash"></i></button>
        </div>`;
      }).join('')
    : '<div class="empty"><i class="ti ti-inbox"></i>Nenhuma saída lançada ainda.</div>';

  document.getElementById('sec-junho').innerHTML = `
    <div class="sec-header">
      <div class="sec-title">Junho / 2026</div>
      <button class="btn-add" onclick="openModal('modal-lanc')"><i class="ti ti-plus"></i>Nova saída</button>
    </div>
    <div class="metrics">
      <div class="mcard"><div class="mcard-label">Total saídas</div><div class="mcard-val val-red">${brl(total)}</div><div class="mcard-sub">${junLancs.length} lançamentos</div></div>
      <div class="mcard"><div class="mcard-label">Barbearia</div><div class="mcard-val val-amber">${brl(barb)}</div><div class="mcard-sub">Pessoal: ${brl(pes)}</div></div>
    </div>
    <div class="card"><div class="card-title">Lançamentos</div>${lista}</div>`;
}

async function salvarLanc() {
  const desc = document.getElementById('l-desc').value.trim();
  const val = parseFloat(document.getElementById('l-val').value);
  const data = document.getElementById('l-data').value;
  if (!desc) { document.getElementById('l-desc').style.borderColor = 'var(--red)'; return; }
  if (!val || val <= 0) { document.getElementById('l-val').style.borderColor = 'var(--red)'; return; }
  if (!data) { document.getElementById('l-data').style.borderColor = 'var(--red)'; return; }

  const cat = CATS_SAIDA[catSel];
  await fbPush('lancamentos', {
    desc, valor: val, data,
    categoria: cat.nome,
    conta: cat.nome === 'Pessoal' ? 'Pessoal' : 'Barbearia',
    pagamento: pagSel,
    obs: document.getElementById('l-obs').value.trim(),
  });
  closeModal('modal-lanc');
  ['l-desc','l-val','l-obs'].forEach(id => document.getElementById(id).value = '');
  showToast('Saída registrada!');
}

async function delLanc(id) {
  await fbRemove(`lancamentos/${id}`);
  showToast('Lançamento removido.');
}

// ============================================================
// ALERTAS
// ============================================================
function renderAlertas() {
  const hoje_ = new Date();
  const vencComDiff = VENCIMENTOS.map(v => {
    const vd = new Date(2026, 5, v.dia);
    const diff = Math.round((vd - hoje_) / 86400000);
    return { ...v, diff };
  }).sort((a,b) => a.diff - b.diff);

  const urgentes = vencComDiff.filter(v => v.diff >= 0 && v.diff <= 3);
  const proximos = vencComDiff.filter(v => v.diff > 3 && v.diff <= 10);
  const tranquilos = vencComDiff.filter(v => v.diff > 10);

  let html = '';

  if (urgentes.length) {
    html += `<div class="card"><div class="card-title" style="color:var(--red)">⚠ Atenção imediata</div>`;
    urgentes.forEach(v => {
      const label = v.diff === 0 ? 'Vence hoje!' : v.diff === 1 ? 'Amanhã' : `Em ${v.diff} dias`;
      html += `<div class="alert alert-red">
        <i class="ti ti-bell"></i>
        <div><div class="alert-title">${v.nome}${v.encerra ? ' <span class="pill pill-green" style="margin-left:4px">último mês</span>' : ''}</div>
        <div class="alert-sub">${label} · ${v.tipo} · ${brl(v.valor)}</div></div>
      </div>`;
    });
    html += '</div>';
  }

  if (proximos.length) {
    html += `<div class="card"><div class="card-title">Próximos 10 dias</div>`;
    proximos.forEach(v => {
      html += `<div class="alert alert-amber">
        <i class="ti ti-clock"></i>
        <div><div class="alert-title">${v.nome}${v.encerra ? ' <span class="pill pill-green" style="margin-left:4px">último mês</span>' : ''}</div>
        <div class="alert-sub">Em ${v.diff} dias · dia ${v.dia} · ${brl(v.valor)}</div></div>
      </div>`;
    });
    html += '</div>';
  }

  html += `<div class="card"><div class="card-title">Calendário de junho</div>`;
  vencComDiff.forEach(v => {
    const passado = v.diff < 0;
    const dotCls = passado ? 'dot' : v.diff <= 3 ? 'dot dot-red' : v.diff <= 10 ? 'dot dot-amber' : 'dot dot-green';
    html += `<div class="row" style="${passado ? 'opacity:0.4' : ''}">
      <div class="${dotCls}" style="width:8px;height:8px"></div>
      <div class="row-label">
        <div>${v.nome}${v.encerra ? ' ★' : ''}</div>
        <div class="row-sub">dia ${v.dia} · ${v.tipo}</div>
      </div>
      <div class="row-val">${brl(v.valor)}</div>
    </div>`;
  });
  html += '</div>';

  html += `<div class="alert alert-green" style="margin-top:4px">
    <i class="ti ti-confetti"></i>
    <div><div class="alert-title">MEI e Mesinha encerram em junho!</div>
    <div class="alert-sub">R$ 453,93/mês liberados a partir de julho.</div></div>
  </div>`;

  document.getElementById('sec-alertas').innerHTML = html;
}

// ============================================================
// RESERVA
// ============================================================
function renderReserva() {
  const pct = Math.round((reserva.valor / reserva.metaTotal) * 100);
  const faltam = Math.max(0, reserva.metaTotal - reserva.valor);
  const hist = (reserva.historico || []).slice().sort((a,b) => b.data.localeCompare(a.data));

  document.getElementById('sec-reserva').innerHTML = `
    <div class="reserva-big">
      <div class="reserva-val">${brl(reserva.valor)}</div>
      <div class="reserva-label">Cofrinho Mercado Pago</div>
      <div style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:4px">
          <span>${pct}% da meta</span><span>meta: ${brl(reserva.metaTotal)}</span>
        </div>
        <div class="prog-wrap" style="height:7px"><div class="prog-bar" style="width:${pct}%;background:var(--green)"></div></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:6px">Faltam ${brl(faltam)} · meta em dezembro/2026</div>
      </div>
    </div>
    <button class="btn-primary" onclick="openModal('modal-dep')" style="margin-bottom:16px">
      <i class="ti ti-piggy-bank"></i>Registrar depósito
    </button>
    <div class="card">
      <div class="card-title">Histórico de depósitos</div>
      ${hist.length ? hist.map(d => `
        <div class="list-item">
          <div class="list-icon" style="background:rgba(76,175,125,0.15)"><i class="ti ti-piggy-bank" style="color:var(--green)"></i></div>
          <div class="list-info">
            <div class="list-name">${d.obs || 'Depósito'}</div>
            <div class="list-meta">${dataFmt(d.data)}</div>
          </div>
          <div class="list-val" style="color:var(--green)">${brl(d.valor)}</div>
          ${d.id !== 'mai-dep' ? `<button class="del-btn" onclick="delDeposito('${d.id}')"><i class="ti ti-trash"></i></button>` : ''}
        </div>`).join('') : '<div class="empty"><i class="ti ti-piggy-bank"></i>Nenhum depósito ainda.</div>'}
    </div>
    <div class="card">
      <div class="card-title">Projeção mensal</div>
      ${['Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m,i) => {
        const v = Math.min(reserva.metaTotal, reserva.valor + (i+1)*1000);
        const p = Math.round((v/reserva.metaTotal)*100);
        const done = p >= 100;
        return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px">
          <span style="min-width:28px;color:var(--text2)">${m}</span>
          <div class="prog-wrap" style="flex:1"><div class="prog-bar" style="width:${p}%;background:${done?'var(--gold)':'var(--green)'}"></div></div>
          <span style="min-width:60px;text-align:right;${done?'color:var(--gold);font-weight:500':'color:var(--text2)'}">${brl(v)}${done?' ✓':''}</span>
        </div>`;
      }).join('')}
    </div>`;
}

async function salvarDeposito() {
  const val = parseFloat(document.getElementById('d-val').value);
  const data = document.getElementById('d-data').value;
  const obs = document.getElementById('d-obs').value.trim();
  if (!val || val <= 0) { document.getElementById('d-val').style.borderColor='var(--red)'; return; }
  if (!data) { document.getElementById('d-data').style.borderColor='var(--red)'; return; }

  const dep = { id: Date.now().toString(), data, valor: val, obs };
  const novoHist = [...(reserva.historico || []), dep];
  const novoValor = reserva.valor + val;
  await fbSet('reserva', { ...reserva, valor: novoValor, historico: novoHist });
  closeModal('modal-dep');
  ['d-val','d-obs'].forEach(id => document.getElementById(id).value = '');
  showToast('Depósito registrado!');
}

async function delDeposito(id) {
  const dep = (reserva.historico || []).find(d => d.id === id);
  if (!dep) return;
  const novoHist = reserva.historico.filter(d => d.id !== id);
  const novoValor = reserva.valor - dep.valor;
  await fbSet('reserva', { ...reserva, valor: novoValor, historico: novoHist });
  showToast('Depósito removido.');
}

// ============================================================
// METAS
// ============================================================
function renderMetas() {
  const mai = HIST[4];
  const items = [
    { l:'Faturamento mínimo',    meta:metas.fat,     real:mai.fat,     fmt:v=>'R$'+Math.round(v).toLocaleString('pt-BR') },
    { l:'Limite de despesas',    meta:metas.desp,    real:8248.77,     fmt:v=>'R$'+Math.round(v).toLocaleString('pt-BR'), inv:true },
    { l:'Atendimentos/mês',      meta:metas.atend,   real:mai.atend,   fmt:v=>v+' atend.' },
    { l:'Ticket médio mínimo',   meta:metas.ticket,  real:mai.ticket,  fmt:v=>'R$'+Number(v).toFixed(2) },
    { l:'Depósito reserva/mês',  meta:metas.reserva, real:400,         fmt:v=>'R$'+Math.round(v).toLocaleString('pt-BR') },
    { l:'Participação produtos',  meta:metas.prod,    real:5.5,         fmt:v=>v+'%' },
  ];

  document.getElementById('sec-metas').innerHTML = `
    <div class="sec-header">
      <div class="sec-title">Metas</div>
      <button class="btn-add" onclick="openModal('modal-meta')"><i class="ti ti-edit"></i>Editar</button>
    </div>
    <div class="card">
      <div class="card-title">Metas vs. maio/2026</div>
      ${items.map(it => {
        const pct = Math.min(100, Math.round((it.real/it.meta)*100));
        const ok = it.inv ? it.real <= it.meta : it.real >= it.meta;
        return `<div style="padding:10px 0;border-bottom:0.5px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
            <span style="font-size:13px">${it.l}</span>
            <span class="pill ${ok?'pill-green':'pill-amber'}">${ok?'✓ atingido':'em andamento'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:3px">
            <span>Realizado: <strong style="color:var(--text)">${it.fmt(it.real)}</strong></span>
            <span>Meta: <strong style="color:var(--text)">${it.fmt(it.meta)}</strong></span>
          </div>
          <div class="prog-wrap"><div class="prog-bar" style="width:${pct}%;background:${ok?'var(--green)':'var(--amber)'}"></div></div>
        </div>`;
      }).join('')}
    </div>`;
}

async function salvarMetas() {
  const novo = {
    fat:    parseFloat(document.getElementById('m-fat').value)     || metas.fat,
    desp:   parseFloat(document.getElementById('m-desp').value)    || metas.desp,
    atend:  parseInt(document.getElementById('m-atend').value)     || metas.atend,
    ticket: parseFloat(document.getElementById('m-ticket').value)  || metas.ticket,
    reserva:parseFloat(document.getElementById('m-reserva').value) || metas.reserva,
    prod:   parseFloat(document.getElementById('m-prod').value)    || metas.prod,
  };
  await fbSet('metas', novo);
  closeModal('modal-meta');
  showToast('Metas atualizadas!');
}

// ============================================================
// BEBIDAS
// ============================================================
function renderBebidas() {
  const total = bebidas.reduce((s,b) => s+b.valor, 0);
  const qtd = bebidas.reduce((s,b) => s+b.qtd, 0);
  const rank = {};
  bebidas.forEach(b => { rank[b.produto] = (rank[b.produto]||0)+b.qtd; });
  const rankArr = Object.entries(rank).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxR = rankArr[0]?.[1] || 1;
  const sorted = bebidas.slice().sort((a,b)=>b.data.localeCompare(a.data));

  document.getElementById('sec-bebidas').innerHTML = `
    <div class="sec-header">
      <div class="sec-title">Bebidas</div>
      <button class="btn-add" onclick="openModal('modal-bev')"><i class="ti ti-plus"></i>Registrar</button>
    </div>
    <div class="metrics">
      <div class="mcard"><div class="mcard-label">Total investido</div><div class="mcard-val val-amber">${brl(total)}</div><div class="mcard-sub">${bebidas.length} compras</div></div>
      <div class="mcard"><div class="mcard-label">Unidades</div><div class="mcard-val">${qtd}</div><div class="mcard-sub">no período</div></div>
    </div>
    ${rankArr.length ? `<div class="card">
      <div class="card-title">Mais comprados</div>
      ${rankArr.map(([p,n]) => `
        <div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
            <span>${p}</span><span style="color:var(--text2)">${n} un.</span>
          </div>
          <div class="prog-wrap"><div class="prog-bar" style="width:${Math.round(n/maxR*100)}%;background:var(--gold)"></div></div>
        </div>`).join('')}
    </div>` : ''}
    <div class="card">
      <div class="card-title">Histórico de compras</div>
      ${sorted.length ? sorted.map(b=>`
        <div class="list-item">
          <div class="list-icon" style="background:rgba(127,119,221,0.15)"><i class="ti ti-beer" style="color:#AFA9EC"></i></div>
          <div class="list-info">
            <div class="list-name">${b.produto}</div>
            <div class="list-meta">${b.fornecedor} · ${dataFmt(b.data)} · ${b.qtd} un. · ${brl(b.valor)}</div>
          </div>
          <button class="del-btn" onclick="delBebida('${b.id}')"><i class="ti ti-trash"></i></button>
        </div>`).join('') : '<div class="empty"><i class="ti ti-beer"></i>Nenhuma compra registrada.</div>'}
    </div>`;
}

async function salvarBebida() {
  const forn = document.getElementById('b-forn').value.trim();
  const prod = document.getElementById('b-prod').value.trim();
  const qtd  = parseInt(document.getElementById('b-qtd').value);
  const val  = parseFloat(document.getElementById('b-val').value);
  const data = document.getElementById('b-data').value;
  if (!forn||!prod||!qtd||!val||!data) { showToast('Preencha todos os campos','err'); return; }
  await fbPush('bebidas', { fornecedor:forn, produto:prod, qtd, valor:val, data });
  closeModal('modal-bev');
  ['b-forn','b-prod','b-qtd','b-val'].forEach(id => document.getElementById(id).value='');
  showToast('Compra registrada!');
}

async function delBebida(id) {
  await fbRemove(`bebidas/${id}`);
  showToast('Registro removido.');
}

// ============================================================
// SELEÇÃO CAT / PAG
// ============================================================
function selCat(i, btn) {
  catSel = i;
  document.querySelectorAll('.cat-btn').forEach((b,j) => {
    b.classList.toggle('active', j === i);
  });
}
function selPag(v, btn) {
  pagSel = v;
  document.querySelectorAll('.pag-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ============================================================
// RENDER MODAIS
// ============================================================
function buildModals() {
  const catBtns = CATS_SAIDA.map((c,i) =>
    `<button class="cat-btn ${i===0?'active':''}" onclick="selCat(${i},this)"><i class="ti ${c.icon}" style="color:${c.color}"></i>${c.nome}</button>`
  ).join('');

  document.body.insertAdjacentHTML('beforeend', `
    <div class="toast" id="toast"></div>

    <!-- MODAL LANÇAMENTO -->
    <div class="modal-overlay" id="modal-lanc">
      <div class="modal-box">
        <div class="modal-header">
          <div class="modal-title">Nova saída — Junho</div>
          <button class="modal-close" onclick="closeModal('modal-lanc')"><i class="ti ti-x"></i></button>
        </div>
        <div class="form-group"><label class="form-label">O que foi pago?</label><input class="form-input" type="text" id="l-desc" placeholder="Ex: Marketing, produtos..."></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Valor (R$)</label><input class="form-input" type="number" id="l-val" step="0.01" inputmode="decimal" placeholder="0,00"></div>
          <div class="form-group"><label class="form-label">Data</label><input class="form-input" type="date" id="l-data"></div>
        </div>
        <div class="form-group"><label class="form-label">Categoria</label><div class="cat-grid">${catBtns}</div></div>
        <div class="form-group"><label class="form-label">Pagamento</label>
          <div class="toggle-row">
            <button class="toggle-btn pag-btn active" onclick="selPag('Pix',this)">Pix</button>
            <button class="toggle-btn pag-btn" onclick="selPag('Dinheiro',this)">Dinheiro</button>
            <button class="toggle-btn pag-btn" onclick="selPag('Cartão',this)">Cartão</button>
          </div>
        </div>
        <div class="form-group"><label class="form-label">Obs. (opcional)</label><input class="form-input" type="text" id="l-obs" placeholder="Fornecedor, nota..."></div>
        <button class="btn-primary" onclick="salvarLanc()"><i class="ti ti-check"></i>Registrar saída</button>
      </div>
    </div>

    <!-- MODAL DEPÓSITO -->
    <div class="modal-overlay" id="modal-dep">
      <div class="modal-box">
        <div class="modal-header">
          <div class="modal-title">Registrar depósito</div>
          <button class="modal-close" onclick="closeModal('modal-dep')"><i class="ti ti-x"></i></button>
        </div>
        <div class="form-group"><label class="form-label">Valor depositado (R$)</label><input class="form-input" type="number" id="d-val" step="0.01" inputmode="decimal" placeholder="0,00"></div>
        <div class="form-group"><label class="form-label">Data</label><input class="form-input" type="date" id="d-data"></div>
        <div class="form-group"><label class="form-label">Observação (opcional)</label><input class="form-input" type="text" id="d-obs" placeholder="Ex: guardado da semana"></div>
        <button class="btn-primary" onclick="salvarDeposito()"><i class="ti ti-piggy-bank"></i>Confirmar depósito</button>
      </div>
    </div>

    <!-- MODAL BEBIDA -->
    <div class="modal-overlay" id="modal-bev">
      <div class="modal-box">
        <div class="modal-header">
          <div class="modal-title">Registrar compra</div>
          <button class="modal-close" onclick="closeModal('modal-bev')"><i class="ti ti-x"></i></button>
        </div>
        <div class="form-group"><label class="form-label">Fornecedor</label><input class="form-input" type="text" id="b-forn" placeholder="Ex: Helder"></div>
        <div class="form-group"><label class="form-label">Produto</label><input class="form-input" type="text" id="b-prod" placeholder="Ex: Cerveja Heineken 250ml"></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Quantidade</label><input class="form-input" type="number" id="b-qtd" placeholder="0"></div>
          <div class="form-group"><label class="form-label">Valor total (R$)</label><input class="form-input" type="number" id="b-val" step="0.01" placeholder="0,00"></div>
        </div>
        <div class="form-group"><label class="form-label">Data</label><input class="form-input" type="date" id="b-data"></div>
        <button class="btn-primary" onclick="salvarBebida()"><i class="ti ti-check"></i>Registrar compra</button>
      </div>
    </div>

    <!-- MODAL METAS -->
    <div class="modal-overlay" id="modal-meta">
      <div class="modal-box">
        <div class="modal-header">
          <div class="modal-title">Editar metas</div>
          <button class="modal-close" onclick="closeModal('modal-meta')"><i class="ti ti-x"></i></button>
        </div>
        <div class="form-group"><label class="form-label">Faturamento mínimo (R$)</label><input class="form-input" type="number" id="m-fat" step="100"></div>
        <div class="form-group"><label class="form-label">Limite despesas barbearia (R$)</label><input class="form-input" type="number" id="m-desp" step="100"></div>
        <div class="form-group"><label class="form-label">Meta atendimentos/mês</label><input class="form-input" type="number" id="m-atend"></div>
        <div class="form-group"><label class="form-label">Ticket médio mínimo (R$)</label><input class="form-input" type="number" id="m-ticket" step="0.5"></div>
        <div class="form-group"><label class="form-label">Depósito reserva/mês (R$)</label><input class="form-input" type="number" id="m-reserva" step="100"></div>
        <div class="form-group"><label class="form-label">Meta produtos (% faturamento)</label><input class="form-input" type="number" id="m-prod" step="0.5"></div>
        <button class="btn-primary" onclick="salvarMetas()"><i class="ti ti-check"></i>Salvar metas</button>
      </div>
    </div>
  `);

  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
  });
}

// ============================================================
// INIT
// ============================================================
function buildApp() {
  document.getElementById('app').innerHTML = `
    <div class="app-wrap">
      <div class="app-header">
        <div class="brand">
          <div class="brand-av"><i class="ti ti-scissors"></i></div>
          <div><div class="brand-name">Heloisa Mazzi</div><div class="brand-sub">Gestão financeira</div></div>
        </div>
        <span class="mes-tag">jun/2026</span>
      </div>

      <div id="sec-painel" class="sec active"></div>
      <div id="sec-junho"  class="sec"></div>
      <div id="sec-alertas" class="sec"></div>
      <div id="sec-reserva" class="sec"></div>
      <div id="sec-metas"  class="sec"></div>
      <div id="sec-bebidas" class="sec"></div>

      <nav class="bottom-nav">
        <button class="nav-item active" data-tab="painel"  onclick="switchTab('painel')"><i class="ti ti-home"></i><span>Painel</span></button>
        <button class="nav-item" data-tab="junho"   onclick="switchTab('junho')"><i class="ti ti-plus"></i><span>Junho</span></button>
        <button class="nav-item" data-tab="alertas" onclick="switchTab('alertas')"><i class="ti ti-bell"></i><span>Alertas</span></button>
        <button class="nav-item" data-tab="reserva" onclick="switchTab('reserva')"><i class="ti ti-piggy-bank"></i><span>Reserva</span></button>
        <button class="nav-item" data-tab="metas"   onclick="switchTab('metas')"><i class="ti ti-target"></i><span>Metas</span></button>
        <button class="nav-item" data-tab="bebidas" onclick="switchTab('bebidas')"><i class="ti ti-beer"></i><span>Bebidas</span></button>
      </nav>
    </div>`;

  buildModals();
  document.getElementById('l-data').value = hoje();
  document.getElementById('d-data').value = hoje();
  document.getElementById('b-data').value = hoje();

  loadFirebase();
  renderPainel();
}

window.addEventListener('load', () => {
  setTimeout(buildApp, 800);
});
