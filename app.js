// ============================================================
// FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyDEuRV3yHbrjc3hRypvlKjNlmLcaOacoBM",
  authDomain: "heloisa-mazzi.firebaseapp.com",
  databaseURL: "https://heloisa-mazzi-default-rtdb.firebaseio.com",
  projectId: "heloisa-mazzi",
  storageBucket: "heloisa-mazzi.firebasestorage.app",
  messagingSenderId: "983837980270",
  appId: "1:983837980270:web:96d8fd0b509a3d5f22d87f"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ============================================================
// CONSTANTES
// ============================================================
const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const CATS = [
  { nome:'Barbearia', icon:'ti-tool',         cor:'#85B7EB', bg:'rgba(55,138,221,0.15)'  },
  { nome:'Marketing', icon:'ti-speakerphone', cor:'#e05555', bg:'rgba(224,85,85,0.15)'   },
  { nome:'Produtos',  icon:'ti-package',      cor:'#e8a642', bg:'rgba(232,166,66,0.15)'  },
  { nome:'Bebidas',   icon:'ti-beer',         cor:'#AFA9EC', bg:'rgba(127,119,221,0.15)' },
  { nome:'Contas',    icon:'ti-file-invoice', cor:'#4caf7d', bg:'rgba(76,175,125,0.15)'  },
  { nome:'Pessoal',   icon:'ti-heart',        cor:'#D4537E', bg:'rgba(212,83,126,0.15)'  },
];

// Dados de migração inicial (só usados na primeira execução)
const HIST_SEED = [
  { m:'2026-01', label:'Jan', fat:7224.90,  atend:154, ticket:46.91 },
  { m:'2026-02', label:'Fev', fat:8299.90,  atend:185, ticket:44.86 },
  { m:'2026-03', label:'Mar', fat:9050.00,  atend:194, ticket:46.65 },
  { m:'2026-04', label:'Abr', fat:9060.50,  atend:198, ticket:45.76 },
  { m:'2026-05', label:'Mai', fat:11309.50, atend:242, ticket:46.73 },
  { m:'2026-06', label:'Jun', fat:10638.00, atend:234, ticket:45.46 },
];

const VENC_SEED = [
  { id:'app-barber',    nome:'App Barber',       valor:109.90, dia:2,  tipo:'Fixo',           aviso:3 },
  { id:'ar-cond',       nome:'Ar condicionado',  valor:213.00, dia:3,  tipo:'Parcela 3/10',   aviso:3 },
  { id:'laura',         nome:'Laura',            valor:320.00, dia:10, tipo:'Fixo',            aviso:3 },
  { id:'mei',           nome:'MEI',              valor:390.00, dia:25, tipo:'Fixo',            aviso:3 },
  { id:'papo-barbeira', nome:'Papo de Barbeira', valor:99.00,  dia:30, tipo:'Parcela 3/3',    aviso:3, encerra:true },
];

// ============================================================
// STATE
// ============================================================
let HIST = [];
let VENCIMENTOS_FB = [];
let lancamentos = [];
let reserva = { valor:7199, meta:1000, metaTotal:11742, historico:[] };
let bebidas = [];
let metas = { fat:9000, desp:8500, atend:220, ticket:46, reserva:1000, prod:10 };

let currentTab = 'painel';
let histIdx = -1;       // -1 = mês atual; 0..n = índice no HIST
let catSel = 0;
let pagSel = 'Pix';
let editingVencId = null;

// ============================================================
// HELPERS
// ============================================================
function brl(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function hoje() { return new Date().toISOString().split('T')[0]; }
function dataFmt(d) { return d ? d.split('-').reverse().join('/') : ''; }

function getMesAtual() {
  // Retorna o mês EM ANDAMENTO (seguinte ao último fechado)
  if (!HIST.length) {
    const now = new Date();
    const m = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    return { m, label: MESES_LABEL[now.getMonth()], mesNum: now.getMonth() + 1, ano: now.getFullYear() };
  }
  const ultimo = HIST[HIST.length - 1];
  const d = new Date(ultimo.m + '-15');
  d.setMonth(d.getMonth() + 1);
  const m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  return { m, label: MESES_LABEL[d.getMonth()], mesNum: d.getMonth() + 1, ano: d.getFullYear() };
}

function atualizarHeaderMes() {
  const el = document.getElementById('mes-tag');
  if (!el) return;
  const ma = getMesAtual();
  el.textContent = ma.label.toLowerCase() + '/' + ma.ano;
}

// ============================================================
// FIREBASE — LISTENERS + MIGRAÇÃO
// ============================================================
function loadFirebase() {
  db.ref('historico').on('value', function(snap) {
    HIST = snap.val()
      ? Object.values(snap.val()).sort(function(a,b){ return a.m.localeCompare(b.m); })
      : [];
    if (histIdx >= HIST.length) histIdx = -1;
    atualizarHeaderMes();
    if (currentTab === 'painel') renderPainel();
    if (currentTab === 'metas')  renderMetas();
  });

  db.ref('vencimentos').on('value', function(snap) {
    VENCIMENTOS_FB = snap.val()
      ? Object.values(snap.val()).sort(function(a,b){ return a.dia - b.dia; })
      : [];
    if (currentTab === 'alertas') renderAlertas();
    agendarNotificacoes();
  });

  db.ref('lancamentos').on('value', function(snap) {
    lancamentos = snap.val() ? Object.values(snap.val()) : [];
    if (currentTab === 'junho')  renderMes();
    if (currentTab === 'painel') renderPainel();
  });

  db.ref('reserva').on('value', function(snap) {
    if (snap.val()) reserva = Object.assign({}, reserva, snap.val());
    if (currentTab === 'reserva') renderReserva();
    if (currentTab === 'painel')  renderPainel();
  });

  db.ref('bebidas').on('value', function(snap) {
    bebidas = snap.val() ? Object.values(snap.val()) : [];
    if (currentTab === 'bebidas') renderBebidas();
  });

  db.ref('metas').on('value', function(snap) {
    if (snap.val()) metas = Object.assign({}, metas, snap.val());
    if (currentTab === 'metas') renderMetas();
  });
}

function initHistorico() {
  db.ref('historico').once('value', function(snap) {
    if (!snap.val()) {
      var data = {};
      HIST_SEED.forEach(function(h){ data[h.m] = h; });
      db.ref('historico').set(data);
    }
  });
}

function initVencimentos() {
  db.ref('vencimentos').once('value', function(snap) {
    if (!snap.val()) {
      var data = {};
      VENC_SEED.forEach(function(v){ data[v.id] = v; });
      db.ref('vencimentos').set(data);
    }
  });
}

function initReserva() {
  db.ref('reserva').once('value', function(snap) {
    if (!snap.val()) {
      db.ref('reserva').set({
        valor:7199, meta:1000, metaTotal:11742,
        historico:[{ id:'mai-dep', data:'2026-05-31', valor:400, obs:'Guardado em maio/2026' }]
      });
    }
  });
}

// ============================================================
// FIREBASE — CRUD
// ============================================================
async function fbPush(path, data) {
  var ref = db.ref(path).push();
  await ref.set(Object.assign({}, data, { id: ref.key }));
  return ref.key;
}
async function fbSet(path, data)  { return db.ref(path).set(data); }
async function fbRemove(path)     { return db.ref(path).remove(); }

// ============================================================
// PWA — SERVICE WORKER
// ============================================================
async function registrarSW() {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register('/sw.js'); }
    catch(e) { console.warn('SW não registrado:', e); }
  }
}

// ============================================================
// NOTIFICAÇÕES
// ============================================================
async function solicitarPermissao() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  agendarNotificacoes();
  // Esconder banner se já foi concedida
  var banner = document.getElementById('notif-banner');
  if (banner && Notification.permission === 'granted') banner.style.display = 'none';
}

function agendarNotificacoes() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!VENCIMENTOS_FB.length) return;

  var mesAt = getMesAtual();
  var agora = new Date();

  VENCIMENTOS_FB.forEach(function(v) {
    var vencDate = new Date(mesAt.ano, mesAt.mesNum - 1, v.dia);
    var diff = Math.round((vencDate - agora) / 86400000);
    var aviso = v.aviso || 3;
    var chave = 'notif-' + (v.id || v.nome) + '-' + mesAt.m + '-' + v.dia;

    if (diff >= 0 && diff <= aviso && !localStorage.getItem(chave)) {
      var valorFmt = brl(v.valor);
      var corpo;
      if (diff === 0)      corpo = 'Heloísa, ' + v.nome + ' vence hoje! ' + valorFmt;
      else if (diff === 1) corpo = 'Heloísa, ' + v.nome + ' vence amanhã! ' + valorFmt;
      else                 corpo = 'Heloísa, ' + v.nome + ' vence em ' + diff + ' dias — ' + valorFmt;

      var notif = new Notification('✂️ Heloísa Mazzi Barbearia', {
        body: corpo,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: chave,
        requireInteraction: diff <= 1,
      });
      notif.onclick = function() { window.focus(); switchTab('alertas', null); };
      localStorage.setItem(chave, '1');
    }
  });
}

// ============================================================
// UI — HELPERS
// ============================================================
function showToast(msg, tipo) {
  tipo = tipo || 'ok';
  var t = document.getElementById('toast');
  t.innerHTML = msg;
  t.className = 'toast show toast-' + tipo;
  setTimeout(function(){ t.classList.remove('show'); }, 2800);
}

function openModal(id) {
  var m = document.getElementById(id);
  if (!m) return;
  m.style.display = 'flex';
  requestAnimationFrame(function(){ m.classList.add('open'); });
}

function closeModal(id) {
  var m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('open');
  setTimeout(function(){ m.style.display = 'none'; }, 280);
}

function closeIfBg(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

// ============================================================
// NAVEGAÇÃO DE ABAS
// ============================================================
function switchTab(id, btn) {
  currentTab = id;
  document.querySelectorAll('.sec').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(b){ b.classList.remove('active'); });
  document.getElementById('sec-' + id).classList.add('active');
  if (btn) {
    btn.classList.add('active');
  } else {
    var navBtn = document.querySelector('.nav-item[data-tab="' + id + '"]');
    if (navBtn) navBtn.classList.add('active');
  }
  var renders = {
    painel: renderPainel, junho: renderMes, alertas: renderAlertas,
    reserva: renderReserva, metas: renderMetas, bebidas: renderBebidas,
  };
  if (renders[id]) renders[id]();
}

// ============================================================
// NAVEGAÇÃO DO HISTÓRICO (painel)
// ============================================================
function navHist(dir) {
  if (dir < 0) {
    if (histIdx === -1 && HIST.length > 0) histIdx = HIST.length - 1;
    else if (histIdx > 0) histIdx--;
  } else {
    if (histIdx >= 0 && histIdx < HIST.length - 1) histIdx++;
    else if (histIdx === HIST.length - 1) histIdx = -1;
  }
  renderPainel();
}

// ============================================================
// RENDER: PAINEL
// ============================================================
function renderPainel() {
  var mesAt = getMesAtual();
  var isCurrent = histIdx === -1;
  var viewed = isCurrent ? null : HIST[histIdx];
  var last = HIST.length ? HIST[HIST.length - 1] : null;
  var showData = viewed || last;
  var prevData = viewed
    ? (histIdx > 0 ? HIST[histIdx - 1] : null)
    : (HIST.length >= 2 ? HIST[HIST.length - 2] : null);

  var filtroMes = isCurrent ? mesAt.m : (viewed ? viewed.m : mesAt.m);
  var lancsDoMes = lancamentos.filter(function(l){ return l.data && l.data.indexOf(filtroMes) === 0; });
  var totalSaidas = lancsDoMes.reduce(function(s,l){ return s + l.valor; }, 0);

  var canPrev = HIST.length > 0 && !(histIdx === 0);
  var canNext = histIdx !== -1;
  var navLabel = isCurrent
    ? (mesAt.label + '/' + mesAt.ano + ' <span style="font-size:10px;color:var(--text3)">(atual)</span>')
    : (viewed.label + '/' + viewed.m.slice(0, 4));

  // Gráfico de barras
  var maxFat = HIST.length ? Math.max.apply(null, HIST.map(function(h){ return h.fat; })) : 1;
  var barras = HIST.map(function(h, i) {
    var pct = Math.round((h.fat / maxFat) * 100);
    var selected = isCurrent ? i === HIST.length - 1 : i === histIdx;
    return '<div class="bar-col"><div class="bar-fill" style="height:' + pct + '%;background:' + (selected ? 'var(--gold)' : 'var(--bg3)') + ';border:0.5px solid ' + (selected ? 'var(--gold)' : 'var(--border2)') + '"></div><div class="bar-label">' + h.label + '</div></div>';
  }).join('');

  // Cards de métricas
  var metricsHtml = '';
  if (showData) {
    var diffFat = prevData ? showData.fat - prevData.fat : 0;
    var diffFatPct = prevData ? Math.round((diffFat / prevData.fat) * 100) : 0;
    var fatCor = diffFat >= 0 ? 'var(--green)' : 'var(--red)';
    var fatSeta = diffFat >= 0 ? '↑' : '↓';
    var diffAtend = prevData ? showData.atend - prevData.atend : 0;
    var diffAtendCor = diffAtend >= 0 ? 'var(--green)' : 'var(--red)';

    metricsHtml =
      '<div class="mcard"><div class="mcard-label">Faturamento ' + showData.label + '</div>' +
        '<div class="mcard-val val-green">' + brl(showData.fat) + '</div>' +
        (prevData ? '<div class="mcard-sub" style="color:' + fatCor + '">' + fatSeta + ' ' + Math.abs(diffFatPct) + '% vs. ' + prevData.label + '</div>' : '<div class="mcard-sub">—</div>') +
      '</div>' +
      '<div class="mcard"><div class="mcard-label">Atendimentos</div>' +
        '<div class="mcard-val">' + showData.atend + '</div>' +
        (prevData ? '<div class="mcard-sub" style="color:' + diffAtendCor + '">' + (diffAtend >= 0 ? '+' : '') + diffAtend + ' vs. ' + prevData.label + '</div>' : '<div class="mcard-sub">Ticket: ' + brl(showData.ticket) + '</div>') +
      '</div>' +
      '<div class="mcard"><div class="mcard-label">Ticket médio</div>' +
        '<div class="mcard-val">' + brl(showData.ticket) + '</div>' +
        '<div class="mcard-sub">' + showData.label + '/' + showData.m.slice(0,4) + '</div>' +
      '</div>' +
      '<div class="mcard"><div class="mcard-label">Saídas ' + (isCurrent ? mesAt.label : showData.label) + '</div>' +
        '<div class="mcard-val ' + (totalSaidas > 0 ? 'val-red' : '') + '">' + (totalSaidas > 0 ? brl(totalSaidas) : '—') + '</div>' +
        '<div class="mcard-sub">' + lancsDoMes.length + ' lançamentos</div>' +
      '</div>';
  } else {
    metricsHtml = '<div class="mcard" style="grid-column:1/-1;text-align:center;padding:20px 14px">' +
      '<i class="ti ti-chart-bar" style="font-size:32px;color:var(--text3);display:block;margin-bottom:8px"></i>' +
      '<div style="font-size:13px;color:var(--text2)">Nenhum fechamento ainda</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:4px">Clique em "Fechar mês" para começar</div>' +
    '</div>';
  }

  // Reserva
  var pctRes = Math.round((reserva.valor / reserva.metaTotal) * 100);

  // Insights dinâmicos
  var insightsHtml = '';
  if (HIST.length >= 2) {
    var primeiro = HIST[0];
    var ultimoH = HIST[HIST.length - 1];
    var crescTotal = Math.round(((ultimoH.fat - primeiro.fat) / primeiro.fat) * 100);
    var recorde = HIST.reduce(function(mx, h){ return h.fat > mx.fat ? h : mx; }, HIST[0]);
    insightsHtml =
      '<div class="insight-item"><i class="ti ti-trending-up" style="color:var(--green)"></i><span><strong>+' + crescTotal + '% ' + primeiro.label + '→' + ultimoH.label + '.</strong> ' + HIST.length + ' meses de histórico registrado.</span></div>' +
      '<div class="insight-item"><i class="ti ti-trophy" style="color:var(--gold)"></i><span><strong>Recorde: ' + brl(recorde.fat) + '</strong> em ' + recorde.label + '/' + recorde.m.slice(0,4) + ' com ' + recorde.atend + ' atend.</span></div>' +
      (VENCIMENTOS_FB.some(function(v){ return v.encerra; }) ? '<div class="insight-item"><i class="ti ti-confetti" style="color:var(--amber)"></i><span><strong>Papo de Barbeira encerra em julho!</strong> R$ 552,93/mês liberados a partir de agosto.</span></div>' : '');
  }

  document.getElementById('sec-painel').innerHTML =
    '<div class="nav-mes">' +
      '<button class="nav-mes-btn" onclick="navHist(-1)"' + (!canPrev ? ' disabled' : '') + '><i class="ti ti-chevron-left"></i></button>' +
      '<span class="nav-mes-label">' + navLabel + '</span>' +
      '<button class="nav-mes-btn" onclick="navHist(1)"' + (!canNext ? ' disabled' : '') + '><i class="ti ti-chevron-right"></i></button>' +
    '</div>' +
    '<div class="metrics">' + metricsHtml + '</div>' +
    (HIST.length ? '<div class="card"><div class="card-title">Faturamento histórico</div><div class="bar-chart">' + barras + '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-top:6px">' +
        '<span>' + brl(HIST[0].fat) + ' em ' + HIST[0].label + '</span>' +
        '<span style="color:var(--gold)">' + brl(HIST.reduce(function(mx,h){ return h.fat>mx.fat?h:mx; }, HIST[0]).fat) + ' recorde ★</span>' +
      '</div></div>' : '') +
    '<div class="card"><div class="card-title">Reserva financeira</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">' +
        '<div>' +
          '<div style="font-size:11px;color:var(--text2);margin-bottom:2px">Cofrinho Mercado Pago</div>' +
          '<div style="font-size:26px;font-weight:600;color:var(--green);font-family:var(--mono)">' + brl(reserva.valor) + '</div>' +
        '</div>' +
        '<div style="text-align:right"><div style="font-size:10px;color:var(--text2)">meta/mês</div><div style="font-size:15px;font-weight:500;color:var(--gold)">R$ 1.000</div></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px"><span>' + pctRes + '% da meta</span><span>meta: ' + brl(reserva.metaTotal) + '</span></div>' +
      '<div class="prog-wrap" style="height:7px"><div class="prog-bar" style="width:' + pctRes + '%;background:var(--green)"></div></div>' +
    '</div>' +
    (insightsHtml ? '<div class="card"><div class="card-title">Insights</div>' + insightsHtml + '</div>' : '') +
    (isCurrent ? '<button class="btn-primary" onclick="abrirFechamento()" style="margin-bottom:8px"><i class="ti ti-calendar-check"></i> Fechar mês — ' + mesAt.label + '/' + mesAt.ano + '</button>' : '');
}

// ============================================================
// RENDER: MÊS ATUAL (saídas/despesas)
// ============================================================
function renderMes() {
  var mesAt = getMesAtual();
  var lancsDoMes = lancamentos.filter(function(l){ return l.data && l.data.indexOf(mesAt.m) === 0; })
    .sort(function(a,b){ return b.data.localeCompare(a.data); });
  var total = lancsDoMes.reduce(function(s,l){ return s + l.valor; }, 0);
  var barb  = lancsDoMes.filter(function(l){ return l.conta === 'Barbearia'; }).reduce(function(s,l){ return s + l.valor; }, 0);
  var pes   = lancsDoMes.filter(function(l){ return l.conta === 'Pessoal'; }).reduce(function(s,l){ return s + l.valor; }, 0);

  // Por categoria
  var porCat = {};
  lancsDoMes.forEach(function(l){ var k = l.categoria || 'Outro'; porCat[k] = (porCat[k] || 0) + l.valor; });
  var catHtml = Object.entries(porCat).sort(function(a,b){ return b[1]-a[1]; }).map(function(e){
    var cat = CATS.find(function(c){ return c.nome === e[0]; }) || CATS[0];
    var pct = total > 0 ? Math.round((e[1] / total) * 100) : 0;
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px">' +
      '<i class="ti ' + cat.icon + '" style="color:' + cat.cor + ';font-size:14px;min-width:16px"></i>' +
      '<span style="flex:1;color:var(--text2)">' + e[0] + '</span>' +
      '<div class="prog-wrap" style="flex:2;margin:0"><div class="prog-bar" style="width:' + pct + '%;background:' + cat.cor + '"></div></div>' +
      '<span style="min-width:72px;text-align:right;font-family:var(--mono);font-size:11px">' + brl(e[1]) + '</span>' +
    '</div>';
  }).join('');

  var lista = lancsDoMes.length
    ? lancsDoMes.map(function(l){
        var cat = CATS.find(function(c){ return c.nome === l.categoria; }) || CATS[0];
        return '<div class="list-item">' +
          '<div class="list-icon" style="background:' + cat.bg + '"><i class="ti ' + cat.icon + '" style="color:' + cat.cor + '"></i></div>' +
          '<div class="list-info"><div class="list-name">' + l.desc + '</div>' +
          '<div class="list-meta">' + dataFmt(l.data) + ' · ' + l.categoria + (l.pagamento ? ' · ' + l.pagamento : '') + (l.obs ? ' · ' + l.obs : '') + '</div></div>' +
          '<div class="list-val" style="color:var(--red)">' + brl(l.valor) + '</div>' +
          '<button class="del-btn" onclick="delLanc(\'' + l.id + '\')"><i class="ti ti-trash"></i></button>' +
        '</div>';
      }).join('')
    : '<div class="empty"><i class="ti ti-inbox"></i><br>Nenhuma saída lançada ainda.</div>';

  // Atualizar título do modal de nova saída
  var modalTitle = document.querySelector('#modal-lanc .modal-title');
  if (modalTitle) modalTitle.textContent = 'Nova saída — ' + mesAt.label + '/' + mesAt.ano;

  document.getElementById('sec-junho').innerHTML =
    '<div class="sec-header">' +
      '<div class="sec-title">' + mesAt.label + ' / ' + mesAt.ano + '</div>' +
      '<button class="btn-add" onclick="openModal(\'modal-lanc\')"><i class="ti ti-plus"></i> Nova saída</button>' +
    '</div>' +
    '<div class="metrics">' +
      '<div class="mcard"><div class="mcard-label">Total saídas</div><div class="mcard-val ' + (total > 0 ? 'val-red' : '') + '">' + (total > 0 ? brl(total) : '—') + '</div><div class="mcard-sub">' + lancsDoMes.length + ' lançamentos</div></div>' +
      '<div class="mcard"><div class="mcard-label">Barbearia</div><div class="mcard-val val-amber">' + brl(barb) + '</div><div class="mcard-sub">Pessoal: ' + brl(pes) + '</div></div>' +
    '</div>' +
    (lancsDoMes.length > 0 && catHtml ? '<div class="card"><div class="card-title">Por categoria</div>' + catHtml + '</div>' : '') +
    '<div class="card"><div class="card-title">Lançamentos</div>' + lista + '</div>';
}

// ============================================================
// RENDER: ALERTAS (vencimentos dinâmicos)
// ============================================================
function renderAlertas() {
  var mesAt = getMesAtual();
  var agora = new Date();

  var vencComDiff = VENCIMENTOS_FB.map(function(v){
    var vd = new Date(mesAt.ano, mesAt.mesNum - 1, v.dia);
    var diff = Math.round((vd - agora) / 86400000);
    return Object.assign({}, v, { diff: diff });
  }).sort(function(a,b){ return a.diff - b.diff; });

  var urgentes = vencComDiff.filter(function(v){ return v.diff >= 0 && v.diff <= 2; });
  var proximos = vencComDiff.filter(function(v){ return v.diff > 2 && v.diff <= 10; });
  var html = '';

  // Banner de notificação
  if ('Notification' in window && Notification.permission !== 'granted') {
    html += '<div class="alert alert-amber" onclick="solicitarPermissao()" style="cursor:pointer;margin-bottom:12px">' +
      '<i class="ti ti-bell-ringing" style="color:var(--amber)"></i>' +
      '<div><div class="alert-title">Ativar notificações</div>' +
      '<div class="alert-sub">Toque para receber alertas de vencimento no celular.</div></div>' +
    '</div>';
  }

  if (urgentes.length) {
    html += '<div class="card"><div class="card-title" style="color:var(--red)">⚠ Atenção imediata</div>';
    urgentes.forEach(function(v){
      var label = v.diff === 0 ? 'Vence hoje!' : v.diff === 1 ? 'Amanhã' : 'Em ' + v.diff + ' dias';
      html += '<div class="alert alert-red">' +
        '<i class="ti ti-bell"></i>' +
        '<div style="flex:1"><div class="alert-title">' + v.nome + (v.encerra ? ' <span class="pill pill-green">último mês</span>' : '') + '</div>' +
        '<div class="alert-sub">' + label + ' · ' + v.tipo + ' · ' + brl(v.valor) + '</div></div>' +
        '<div class="venc-actions">' +
          '<button class="del-btn" onclick="editarVencimento(\'' + v.id + '\')"><i class="ti ti-edit"></i></button>' +
          '<button class="del-btn" onclick="delVencimento(\'' + v.id + '\')"><i class="ti ti-trash"></i></button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
  }

  if (proximos.length) {
    html += '<div class="card"><div class="card-title">Próximos 10 dias</div>';
    proximos.forEach(function(v){
      html += '<div class="alert alert-amber">' +
        '<i class="ti ti-clock"></i>' +
        '<div style="flex:1"><div class="alert-title">' + v.nome + (v.encerra ? ' <span class="pill pill-green">último mês</span>' : '') + '</div>' +
        '<div class="alert-sub">Em ' + v.diff + ' dias · dia ' + v.dia + ' · ' + brl(v.valor) + '</div></div>' +
        '<div class="venc-actions">' +
          '<button class="del-btn" onclick="editarVencimento(\'' + v.id + '\')"><i class="ti ti-edit"></i></button>' +
          '<button class="del-btn" onclick="delVencimento(\'' + v.id + '\')"><i class="ti ti-trash"></i></button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
  }

  // Calendário completo
  html += '<div class="card"><div class="card-title">Calendário — ' + mesAt.label + '/' + mesAt.ano + '</div>';
  if (vencComDiff.length) {
    vencComDiff.forEach(function(v){
      var passado = v.diff < 0;
      var corDot = passado ? 'var(--text3)' : v.diff <= 2 ? 'var(--red)' : v.diff <= 10 ? 'var(--amber)' : 'var(--green)';
      html += '<div class="row" style="' + (passado ? 'opacity:0.4' : '') + '">' +
        '<div class="dot" style="background:' + corDot + ';width:8px;height:8px;flex-shrink:0"></div>' +
        '<div class="row-label" style="flex:1"><div>' + v.nome + (v.encerra ? ' ★' : '') + '</div><div class="row-sub">dia ' + v.dia + ' · ' + v.tipo + '</div></div>' +
        '<div class="row-val">' + brl(v.valor) + '</div>' +
        '<div class="venc-actions">' +
          '<button class="del-btn" onclick="editarVencimento(\'' + v.id + '\')"><i class="ti ti-edit"></i></button>' +
          '<button class="del-btn" onclick="delVencimento(\'' + v.id + '\')"><i class="ti ti-trash"></i></button>' +
        '</div>' +
      '</div>';
    });
  } else {
    html += '<div class="empty"><i class="ti ti-calendar"></i><br>Nenhum vencimento cadastrado.</div>';
  }
  html += '</div>';

  var totalVenc = VENCIMENTOS_FB.reduce(function(s,v){ return s + v.valor; }, 0);
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;font-size:12px;color:var(--text2)">' +
    '<span>Total comprometido/mês: <strong style="color:var(--text)">' + brl(totalVenc) + '</strong></span>' +
  '</div>';

  html += '<button class="btn-primary" onclick="abrirNovoVencimento()" style="margin-bottom:8px">' +
    '<i class="ti ti-plus"></i> Adicionar vencimento' +
  '</button>';

  if (VENCIMENTOS_FB.some(function(v){ return v.encerra; })) {
    html += '<div class="alert alert-green"><i class="ti ti-confetti"></i><div>' +
      '<div class="alert-title">Papo de Barbeira encerra este mês!</div>' +
      '<div class="alert-sub">Última parcela R$ 99,00. A partir de agosto R$ 552,93/mês liberados no caixa.</div>' +
    '</div></div>';
  }

  document.getElementById('sec-alertas').innerHTML = html;
}

// ============================================================
// RENDER: RESERVA
// ============================================================
function renderReserva() {
  var pct    = Math.round((reserva.valor / reserva.metaTotal) * 100);
  var faltam = Math.max(0, reserva.metaTotal - reserva.valor);
  var hist   = (reserva.historico || []).slice().sort(function(a,b){ return b.data.localeCompare(a.data); });

  var histHtml = hist.length ? hist.map(function(d){
    return '<div class="list-item">' +
      '<div class="list-icon" style="background:rgba(76,175,125,0.15)"><i class="ti ti-piggy-bank" style="color:var(--green)"></i></div>' +
      '<div class="list-info"><div class="list-name">' + (d.obs || 'Depósito') + '</div><div class="list-meta">' + dataFmt(d.data) + '</div></div>' +
      '<div class="list-val" style="color:var(--green)">' + brl(d.valor) + '</div>' +
      (d.id !== 'mai-dep' ? '<button class="del-btn" onclick="delDeposito(\'' + d.id + '\')"><i class="ti ti-trash"></i></button>' : '') +
    '</div>';
  }).join('') : '<div class="empty"><i class="ti ti-piggy-bank"></i><br>Nenhum depósito ainda.</div>';

  var projHtml = ['Jul','Ago','Set','Out','Nov','Dez'].map(function(m, i){
    var v = Math.min(reserva.metaTotal, reserva.valor + (i + 1) * 1000);
    var p = Math.round((v / reserva.metaTotal) * 100);
    var done = p >= 100;
    return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px">' +
      '<span style="min-width:28px;color:var(--text2)">' + m + '</span>' +
      '<div class="prog-wrap" style="flex:1"><div class="prog-bar" style="width:' + p + '%;background:' + (done ? 'var(--gold)' : 'var(--green)') + '"></div></div>' +
      '<span style="min-width:60px;text-align:right;' + (done ? 'color:var(--gold);font-weight:500' : 'color:var(--text2)') + '">' + brl(v) + (done ? ' ✓' : '') + '</span>' +
    '</div>';
  }).join('');

  document.getElementById('sec-reserva').innerHTML =
    '<div class="reserva-big">' +
      '<div class="reserva-val">' + brl(reserva.valor) + '</div>' +
      '<div class="reserva-label">Cofrinho Mercado Pago</div>' +
      '<div style="margin-top:12px">' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:4px"><span>' + pct + '% da meta</span><span>meta: ' + brl(reserva.metaTotal) + '</span></div>' +
        '<div class="prog-wrap" style="height:7px"><div class="prog-bar" style="width:' + pct + '%;background:var(--green)"></div></div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:6px">Faltam ' + brl(faltam) + ' · meta em dezembro/2026</div>' +
      '</div>' +
    '</div>' +
    '<button class="btn-primary" onclick="openModal(\'modal-dep\')" style="margin-bottom:16px"><i class="ti ti-piggy-bank"></i> Registrar depósito</button>' +
    '<div class="card"><div class="card-title">Histórico de depósitos</div>' + histHtml + '</div>' +
    '<div class="card"><div class="card-title">Projeção mensal</div>' + projHtml + '</div>';
}

// ============================================================
// RENDER: METAS
// ============================================================
function renderMetas() {
  var ref = HIST.length ? HIST[HIST.length - 1] : null;
  var items = [
    { l:'Faturamento mínimo',    meta:metas.fat,     real:ref ? ref.fat : 0,     fmt:function(v){ return 'R$' + Math.round(v).toLocaleString('pt-BR'); } },
    { l:'Limite de despesas',    meta:metas.desp,    real:3858.28,               fmt:function(v){ return 'R$' + Math.round(v).toLocaleString('pt-BR'); }, inv:true },
    { l:'Atendimentos/mês',      meta:metas.atend,   real:ref ? ref.atend : 0,   fmt:function(v){ return v + ' atend.'; } },
    { l:'Ticket médio mínimo',   meta:metas.ticket,  real:ref ? ref.ticket : 0,  fmt:function(v){ return 'R$' + Number(v).toFixed(2); } },
    { l:'Depósito reserva/mês',  meta:metas.reserva, real:400,                   fmt:function(v){ return 'R$' + Math.round(v).toLocaleString('pt-BR'); } },
    { l:'Participação produtos',  meta:metas.prod,   real:5.5,                   fmt:function(v){ return v + '%'; } },
  ];

  var itensHtml = items.map(function(it){
    var pct = Math.min(100, Math.round((it.real / it.meta) * 100));
    var ok  = it.inv ? it.real <= it.meta : it.real >= it.meta;
    return '<div style="padding:10px 0;border-bottom:0.5px solid var(--border)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">' +
        '<span style="font-size:13px">' + it.l + '</span>' +
        '<span class="pill ' + (ok ? 'pill-green' : 'pill-amber') + '">' + (ok ? '✓ atingido' : 'em andamento') + '</span>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:3px">' +
        '<span>Realizado: <strong style="color:var(--text)">' + it.fmt(it.real) + '</strong></span>' +
        '<span>Meta: <strong style="color:var(--text)">' + it.fmt(it.meta) + '</strong></span>' +
      '</div>' +
      '<div class="prog-wrap"><div class="prog-bar" style="width:' + pct + '%;background:' + (ok ? 'var(--green)' : 'var(--amber)') + '"></div></div>' +
    '</div>';
  }).join('');

  var refLabel = ref ? ref.label + '/' + ref.m.slice(0, 4) : 'sem dados';
  document.getElementById('sec-metas').innerHTML =
    '<div class="sec-header"><div class="sec-title">Metas</div><button class="btn-add" onclick="abrirMetas()"><i class="ti ti-edit"></i> Editar</button></div>' +
    '<div class="card"><div class="card-title">Metas vs. ' + refLabel + '</div>' + itensHtml + '</div>';
}

// ============================================================
// RENDER: BEBIDAS
// ============================================================
function renderBebidas() {
  var total = bebidas.reduce(function(s,b){ return s + b.valor; }, 0);
  var qtd   = bebidas.reduce(function(s,b){ return s + b.qtd; }, 0);
  var rank  = {};
  bebidas.forEach(function(b){ rank[b.produto] = (rank[b.produto] || 0) + b.qtd; });
  var rankArr = Object.entries(rank).sort(function(a,b){ return b[1]-a[1]; }).slice(0, 5);
  var maxR = rankArr[0] ? rankArr[0][1] : 1;
  var sorted = bebidas.slice().sort(function(a,b){ return b.data.localeCompare(a.data); });

  var rankHtml = rankArr.length ? '<div class="card"><div class="card-title">Mais comprados</div>' +
    rankArr.map(function(e){
      return '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px"><span>' + e[0] + '</span><span style="color:var(--text2)">' + e[1] + ' un.</span></div>' +
        '<div class="prog-wrap"><div class="prog-bar" style="width:' + Math.round(e[1]/maxR*100) + '%;background:var(--gold)"></div></div></div>';
    }).join('') + '</div>' : '';

  var listaHtml = sorted.length ? sorted.map(function(b){
    return '<div class="list-item">' +
      '<div class="list-icon" style="background:rgba(127,119,221,0.15)"><i class="ti ti-beer" style="color:#AFA9EC"></i></div>' +
      '<div class="list-info"><div class="list-name">' + b.produto + '</div><div class="list-meta">' + b.fornecedor + ' · ' + dataFmt(b.data) + ' · ' + b.qtd + ' un. · ' + brl(b.valor) + '</div></div>' +
      '<button class="del-btn" onclick="delBebida(\'' + b.id + '\')"><i class="ti ti-trash"></i></button>' +
    '</div>';
  }).join('') : '<div class="empty"><i class="ti ti-beer"></i><br>Nenhuma compra registrada.</div>';

  document.getElementById('sec-bebidas').innerHTML =
    '<div class="sec-header"><div class="sec-title">Bebidas</div><button class="btn-add" onclick="openModal(\'modal-bev\')"><i class="ti ti-plus"></i> Registrar</button></div>' +
    '<div class="metrics">' +
      '<div class="mcard"><div class="mcard-label">Total investido</div><div class="mcard-val val-amber">' + brl(total) + '</div><div class="mcard-sub">' + bebidas.length + ' compras</div></div>' +
      '<div class="mcard"><div class="mcard-label">Unidades</div><div class="mcard-val">' + qtd + '</div><div class="mcard-sub">no período</div></div>' +
    '</div>' + rankHtml +
    '<div class="card"><div class="card-title">Histórico de compras</div>' + listaHtml + '</div>';
}

// ============================================================
// CRUD: LANÇAMENTOS
// ============================================================
async function salvarLanc() {
  var desc = document.getElementById('l-desc').value.trim();
  var val  = parseFloat(document.getElementById('l-val').value);
  var data = document.getElementById('l-data').value;
  if (!desc || !val || !data) { showToast('Preencha todos os campos obrigatórios', 'err'); return; }
  var cat = CATS[catSel];
  try {
    await fbPush('lancamentos', {
      desc: desc, valor: val, data: data,
      categoria: cat.nome,
      conta: cat.nome === 'Pessoal' ? 'Pessoal' : 'Barbearia',
      pagamento: pagSel,
      obs: document.getElementById('l-obs').value.trim(),
    });
    closeModal('modal-lanc');
    ['l-desc','l-val','l-obs'].forEach(function(id){ document.getElementById(id).value = ''; });
    document.getElementById('l-data').value = hoje();
    showToast('Saída registrada!');
  } catch(e) { showToast('Erro ao salvar.', 'err'); }
}

async function delLanc(id) {
  await fbRemove('lancamentos/' + id);
  showToast('Lançamento removido.');
}

// ============================================================
// CRUD: FECHAMENTO DE MÊS
// ============================================================
function abrirFechamento() {
  var mesAt = getMesAtual();
  document.getElementById('f-mes').value = mesAt.m;
  document.getElementById('f-mes-label').textContent = mesAt.label + ' / ' + mesAt.ano;
  document.getElementById('f-fat').value = '';
  document.getElementById('f-atend').value = '';
  document.getElementById('f-ticket-preview').textContent = '—';
  openModal('modal-fechamento');
}

function calcTicketPreview() {
  var fat   = parseFloat(document.getElementById('f-fat').value) || 0;
  var atend = parseInt(document.getElementById('f-atend').value) || 0;
  document.getElementById('f-ticket-preview').textContent = (fat > 0 && atend > 0) ? brl(fat / atend) : '—';
}

async function salvarFechamento() {
  var m     = document.getElementById('f-mes').value;
  var fat   = parseFloat(document.getElementById('f-fat').value);
  var atend = parseInt(document.getElementById('f-atend').value);
  if (!m || !fat || !atend) { showToast('Preencha faturamento e atendimentos', 'err'); return; }
  var ticket = parseFloat((fat / atend).toFixed(2));
  var d = new Date(m + '-15');
  var label = MESES_LABEL[d.getMonth()];
  try {
    await fbSet('historico/' + m, { m: m, label: label, fat: fat, atend: atend, ticket: ticket });
    closeModal('modal-fechamento');
    histIdx = -1;
    showToast('✓ ' + label + '/' + d.getFullYear() + ' fechado! Faturamento: ' + brl(fat));
  } catch(e) { showToast('Erro ao salvar.', 'err'); }
}

// ============================================================
// CRUD: VENCIMENTOS
// ============================================================
function abrirNovoVencimento() {
  editingVencId = null;
  document.getElementById('v-titulo').textContent = 'Novo vencimento';
  document.getElementById('v-nome').value   = '';
  document.getElementById('v-valor').value  = '';
  document.getElementById('v-dia').value    = '';
  document.getElementById('v-tipo').value   = 'Fixo';
  document.getElementById('v-aviso').value  = '3';
  document.getElementById('v-encerra').checked = false;
  openModal('modal-vencimento');
}

function editarVencimento(id) {
  var v = VENCIMENTOS_FB.find(function(x){ return x.id === id; });
  if (!v) return;
  editingVencId = id;
  document.getElementById('v-titulo').textContent = 'Editar vencimento';
  document.getElementById('v-nome').value   = v.nome;
  document.getElementById('v-valor').value  = v.valor;
  document.getElementById('v-dia').value    = v.dia;
  document.getElementById('v-tipo').value   = v.tipo || 'Fixo';
  document.getElementById('v-aviso').value  = v.aviso || '3';
  document.getElementById('v-encerra').checked = !!v.encerra;
  openModal('modal-vencimento');
}

async function salvarVencimento() {
  var nome    = document.getElementById('v-nome').value.trim();
  var valor   = parseFloat(document.getElementById('v-valor').value);
  var dia     = parseInt(document.getElementById('v-dia').value);
  var tipo    = document.getElementById('v-tipo').value.trim() || 'Fixo';
  var aviso   = parseInt(document.getElementById('v-aviso').value) || 3;
  var encerra = document.getElementById('v-encerra').checked;
  if (!nome || !valor || !dia || dia < 1 || dia > 31) { showToast('Preencha nome, valor e dia (1–31)', 'err'); return; }
  var id = editingVencId || nome.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
  try {
    await fbSet('vencimentos/' + id, { id: id, nome: nome, valor: valor, dia: dia, tipo: tipo, aviso: aviso, encerra: encerra });
    closeModal('modal-vencimento');
    showToast(editingVencId ? 'Vencimento atualizado!' : 'Vencimento adicionado!');
    editingVencId = null;
    setTimeout(agendarNotificacoes, 600);
  } catch(e) { showToast('Erro ao salvar.', 'err'); }
}

async function delVencimento(id) {
  await fbRemove('vencimentos/' + id);
  showToast('Vencimento removido.');
}

// ============================================================
// CRUD: RESERVA
// ============================================================
async function salvarDeposito() {
  var val  = parseFloat(document.getElementById('d-val').value);
  var data = document.getElementById('d-data').value;
  var obs  = document.getElementById('d-obs').value.trim();
  if (!val || val <= 0 || !data) { showToast('Preencha valor e data', 'err'); return; }
  try {
    var dep = { id: Date.now().toString(), data: data, valor: val, obs: obs };
    var novoHist  = (reserva.historico || []).concat([dep]);
    var novoValor = reserva.valor + val;
    await fbSet('reserva', Object.assign({}, reserva, { valor: novoValor, historico: novoHist }));
    closeModal('modal-dep');
    ['d-val','d-obs'].forEach(function(id){ document.getElementById(id).value = ''; });
    showToast('Depósito registrado!');
  } catch(e) { showToast('Erro ao salvar.', 'err'); }
}

async function delDeposito(id) {
  var dep = (reserva.historico || []).find(function(d){ return d.id === id; });
  if (!dep) return;
  var novoHist  = reserva.historico.filter(function(d){ return d.id !== id; });
  var novoValor = reserva.valor - dep.valor;
  await fbSet('reserva', Object.assign({}, reserva, { valor: novoValor, historico: novoHist }));
  showToast('Depósito removido.');
}

// ============================================================
// CRUD: METAS
// ============================================================
function abrirMetas() {
  document.getElementById('m-fat').value     = metas.fat;
  document.getElementById('m-desp').value    = metas.desp;
  document.getElementById('m-atend').value   = metas.atend;
  document.getElementById('m-ticket').value  = metas.ticket;
  document.getElementById('m-reserva').value = metas.reserva;
  document.getElementById('m-prod').value    = metas.prod;
  openModal('modal-meta');
}

async function salvarMetas() {
  var novo = {
    fat:     parseFloat(document.getElementById('m-fat').value)     || metas.fat,
    desp:    parseFloat(document.getElementById('m-desp').value)    || metas.desp,
    atend:   parseInt(document.getElementById('m-atend').value)     || metas.atend,
    ticket:  parseFloat(document.getElementById('m-ticket').value)  || metas.ticket,
    reserva: parseFloat(document.getElementById('m-reserva').value) || metas.reserva,
    prod:    parseFloat(document.getElementById('m-prod').value)    || metas.prod,
  };
  await fbSet('metas', novo);
  closeModal('modal-meta');
  showToast('Metas atualizadas!');
}

// ============================================================
// CRUD: BEBIDAS
// ============================================================
async function salvarBebida() {
  var forn = document.getElementById('b-forn').value.trim();
  var prod = document.getElementById('b-prod').value.trim();
  var qtd  = parseInt(document.getElementById('b-qtd').value);
  var val  = parseFloat(document.getElementById('b-val').value);
  var data = document.getElementById('b-data').value;
  if (!forn || !prod || !qtd || !val || !data) { showToast('Preencha todos os campos', 'err'); return; }
  try {
    await fbPush('bebidas', { fornecedor: forn, produto: prod, qtd: qtd, valor: val, data: data });
    closeModal('modal-bev');
    ['b-forn','b-prod','b-qtd','b-val'].forEach(function(id){ document.getElementById(id).value = ''; });
    showToast('Compra registrada!');
  } catch(e) { showToast('Erro ao salvar.', 'err'); }
}

async function delBebida(id) {
  await fbRemove('bebidas/' + id);
  showToast('Registro removido.');
}

// ============================================================
// UI: SELETORES
// ============================================================
function selCat(i) {
  catSel = i;
  document.querySelectorAll('#cat-grid-lanc .cat-btn').forEach(function(b, j){ b.classList.toggle('active', j === i); });
}

function selPag(v, btn) {
  pagSel = v;
  document.querySelectorAll('.pag-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}

function initCatGrid() {
  var grid = document.getElementById('cat-grid-lanc');
  if (!grid) return;
  grid.innerHTML = CATS.map(function(c, i){
    return '<button class="cat-btn ' + (i === 0 ? 'active' : '') + '" onclick="selCat(' + i + ')"><i class="ti ' + c.icon + '" style="color:' + c.cor + '"></i>' + c.nome + '</button>';
  }).join('');
}

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', async function() {
  await registrarSW();

  setTimeout(async function() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('main').style.display = 'block';

    initCatGrid();

    var h = hoje();
    ['l-data','d-data','b-data'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.value = h;
    });

    initHistorico();
    initVencimentos();
    initReserva();
    loadFirebase();
    renderPainel();

    // Solicitar permissão de notificação após 3 segundos
    setTimeout(solicitarPermissao, 3000);

    // Verificar notificações a cada hora enquanto o app está aberto
    setInterval(agendarNotificacoes, 3600000);

  }, 900);
});
