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

// Seeds de migração
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

// Metas: estrutura rica (autoKey = pega do último HIST; realVal = valor fixo manual)
const METAS_SEED = {
  fat:     { id:'fat',     label:'Faturamento mínimo',    target:9000,  tipo:'min', fmt:'brl', autoKey:'fat'    },
  desp:    { id:'desp',    label:'Limite de despesas',    target:8500,  tipo:'max', fmt:'brl', realVal:3858.28  },
  atend:   { id:'atend',   label:'Atendimentos/mês',      target:220,   tipo:'min', fmt:'num', autoKey:'atend'  },
  ticket:  { id:'ticket',  label:'Ticket médio mínimo',   target:46,    tipo:'min', fmt:'brl', autoKey:'ticket' },
  reserva: { id:'reserva', label:'Depósito reserva/mês',  target:1000,  tipo:'min', fmt:'brl', realVal:400      },
  prod:    { id:'prod',    label:'Participação produtos',  target:10,    tipo:'min', fmt:'pct', realVal:5.5      },
};

// ============================================================
// STATE
// ============================================================
let HIST = [];
let VENCIMENTOS_FB = [];
let metasObj = {};       // { id: { id, label, target, tipo, fmt, autoKey?, realVal? } }
let lancamentos = [];
let reserva = { valor:7199, meta:1000, metaTotal:11742, historico:[] };
let bebidas = [];
let bebidasVendas = [];
let faturamentoDiario = [];

let currentTab = 'painel';
let histIdx = -1;
let catSel = 0;
let pagSel = 'Pix';
let editingVencId = null;
let editingMetaId = null;
let editingDepId = null;
let chartHistoricoInstance = null;
let chartCategoriasInstance = null;

// ============================================================
// HELPERS
// ============================================================
function brl(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function hoje() { return new Date().toISOString().split('T')[0]; }
function dataFmt(d) { return d ? d.split('-').reverse().join('/') : ''; }

// Label de tipo: se tiver parcela, mostra "Parcela X/Y" automaticamente
function tipoLabel(v) {
  if (v.parcelaTotal) return 'Parcela ' + (v.parcelaAtual || 1) + '/' + v.parcelaTotal;
  return v.tipo || 'Fixo';
}
// Verifica se um vencimento já foi pago no mês informado
function vencPago(v, mes) {
  return !!(v.pagamentos && v.pagamentos[mes]);
}

function fmtMeta(fmt, v) {
  if (fmt === 'brl') return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  if (fmt === 'pct') return Number(v).toFixed(1) + '%';
  return String(v);
}

function getMesAtual() {
  if (!HIST.length) {
    var now = new Date();
    var m = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    return { m:m, label:MESES_LABEL[now.getMonth()], mesNum:now.getMonth()+1, ano:now.getFullYear() };
  }
  var ultimo = HIST[HIST.length - 1];
  var d = new Date(ultimo.m + '-15');
  d.setMonth(d.getMonth() + 1);
  var m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  return { m:m, label:MESES_LABEL[d.getMonth()], mesNum:d.getMonth()+1, ano:d.getFullYear() };
}

function atualizarHeaderMes() {
  var el = document.getElementById('mes-tag');
  if (!el) return;
  var ma = getMesAtual();
  el.textContent = ma.label.toLowerCase() + '/' + ma.ano;
}

// ============================================================
// FIREBASE — LISTENERS
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

  db.ref('metas').on('value', function(snap) {
    var val = snap.val();
    if (val) {
      // Migração: se os valores forem números (formato antigo), migra para objeto rico
      var primeiroValor = Object.values(val)[0];
      if (typeof primeiroValor === 'number') {
        db.ref('metas').set(METAS_SEED);
      } else {
        metasObj = val;
      }
    } else {
      metasObj = {};
    }
    if (currentTab === 'metas') renderMetas();
  });

  db.ref('bebidas').on('value', function(snap) {
    bebidas = snap.val() ? Object.values(snap.val()) : [];
    if (currentTab === 'bebidas') renderBebidas();
  });

  db.ref('bebidas_vendas').on('value', function(snap) {
    bebidasVendas = snap.val() ? Object.values(snap.val()) : [];
    if (currentTab === 'bebidas') renderBebidas();
  });

  db.ref('faturamento_diario').on('value', function(snap) {
    faturamentoDiario = snap.val() ? Object.values(snap.val()) : [];
    if (currentTab === 'painel') renderPainel();
  });
}

// ============================================================
// FIREBASE — INICIALIZAÇÃO
// ============================================================
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

function initMetas() {
  db.ref('metas').once('value', function(snap) {
    var val = snap.val();
    if (!val) {
      db.ref('metas').set(METAS_SEED);
      return;
    }
    // Migração de formato antigo (valores numéricos planos)
    var primeiroValor = Object.values(val)[0];
    if (typeof primeiroValor === 'number') {
      db.ref('metas').set(METAS_SEED);
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
        body: corpo, icon:'/icon-192.png', badge:'/icon-192.png', tag:chave, requireInteraction: diff <= 1,
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
function closeIfBg(e, id) { if (e.target === e.currentTarget) closeModal(id); }

// ============================================================
// NAVEGAÇÃO
// ============================================================
function switchTab(id, btn) {
  currentTab = id;
  document.querySelectorAll('.sec').forEach(function(s){ s.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(b){ b.classList.remove('active'); });
  document.getElementById('sec-' + id).classList.add('active');
  if (btn) { btn.classList.add('active'); }
  else {
    var navBtn = document.querySelector('.nav-item[data-tab="' + id + '"]');
    if (navBtn) navBtn.classList.add('active');
  }
  var renders = {
    painel:renderPainel, junho:renderMes, alertas:renderAlertas,
    reserva:renderReserva, metas:renderMetas, bebidas:renderBebidas,
  };
  if (renders[id]) renders[id]();
}

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

  var filtroMes = isCurrent ? mesAt.m : (viewed ? viewed.m : mesAt.m);
  var lancsDoMes = lancamentos.filter(function(l){ return l.data && l.data.indexOf(filtroMes) === 0; });
  var totalSaidas = lancsDoMes.reduce(function(s,l){ return s + l.valor; }, 0);

  // Calcular faturamento diário para o mês filtrado
  var fatsDoMes = faturamentoDiario.filter(function(fd){ return fd.data && fd.data.indexOf(filtroMes) === 0; });
  var totalFatMes = fatsDoMes.reduce(function(s,fd){ return s + fd.valor; }, 0);
  var totalAtendMes = fatsDoMes.reduce(function(s,fd){ return s + fd.atendimentos; }, 0);
  var ticketMedioMes = totalAtendMes > 0 ? totalFatMes / totalAtendMes : 0;

  var dadosMes = {
    fat: totalFatMes,
    atend: totalAtendMes,
    ticket: ticketMedioMes,
    label: mesAt.label,
    m: mesAt.m
  };

  var showData = isCurrent ? dadosMes : viewed;
  var prevData = isCurrent
    ? last
    : (histIdx > 0 ? HIST[histIdx - 1] : null);

  var canPrev = HIST.length > 0 && !(histIdx === 0);
  var canNext = histIdx !== -1;
  var navLabel = isCurrent
    ? (mesAt.label + '/' + mesAt.ano + ' <span style="font-size:10px;color:var(--text3)">(atual)</span>')
    : (viewed.label + '/' + viewed.m.slice(0, 4));

  var metricsHtml = '';
  if (showData) {
    var diffFat = prevData ? showData.fat - prevData.fat : 0;
    var diffFatPct = prevData ? Math.round((diffFat / prevData.fat) * 100) : 0;
    var fatCor = diffFat >= 0 ? 'var(--green)' : 'var(--red)';
    var fatSeta = diffFat >= 0 ? '↑' : '↓';
    var diffAtend = prevData ? showData.atend - prevData.atend : 0;
    var diffAtendCor = diffAtend >= 0 ? 'var(--green)' : 'var(--red)';
    
    var fatLabel = 'Faturamento ' + showData.label;
    var addBtn = isCurrent ? '<button onclick="abrirFatDiarioModal()" style="background:transparent; border:none; color:var(--gold); cursor:pointer; font-size:13px; display:inline-flex; align-items:center; gap:2px" title="Lançar faturamento diário"><i class="ti ti-plus"></i></button>' : '';

    metricsHtml =
      '<div class="mcard">' +
        '<div class="mcard-label" style="display:flex; justify-content:space-between; align-items:center"><span>' + fatLabel + '</span>' + addBtn + '</div>' +
        '<div class="mcard-val val-green">' + brl(showData.fat) + '</div>' +
        (prevData ? '<div class="mcard-sub" style="color:' + fatCor + '">' + fatSeta + ' ' + Math.abs(diffFatPct) + '% vs. ' + prevData.label + ' (' + brl(prevData.fat) + ')</div>' : '<div class="mcard-sub">—</div>') +
      '</div>' +
      '<div class="mcard"><div class="mcard-label">Atendimentos</div>' +
        '<div class="mcard-val">' + showData.atend + '</div>' +
        (prevData ? '<div class="mcard-sub" style="color:' + diffAtendCor + '">' + (diffAtend >= 0?'+':'') + diffAtend + ' vs. ' + prevData.label + '</div>' : '<div class="mcard-sub">—</div>') +
      '</div>' +
      '<div class="mcard"><div class="mcard-label">Ticket médio</div>' +
        '<div class="mcard-val">' + brl(showData.ticket) + '</div>' +
        '<div class="mcard-sub">' + showData.label + '/' + showData.m.slice(0,4) + '</div>' +
      '</div>' +
      '<div class="mcard"><div class="mcard-label">Saídas ' + (isCurrent?mesAt.label:showData.label) + '</div>' +
        '<div class="mcard-val ' + (totalSaidas>0?'val-red':'') + '">' + (totalSaidas>0?brl(totalSaidas):'—') + '</div>' +
        '<div class="mcard-sub">' + lancsDoMes.length + ' lançamentos</div>' +
      '</div>';
  } else {
    metricsHtml = '<div class="mcard" style="grid-column:1/-1;text-align:center;padding:20px 14px">' +
      '<i class="ti ti-chart-bar" style="font-size:32px;color:var(--text3);display:block;margin-bottom:8px"></i>' +
      '<div style="font-size:13px;color:var(--text2)">Nenhum fechamento ainda</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:4px">Clique em "Fechar mês" para começar</div>' +
    '</div>';
  }

  var pctRes = Math.round((reserva.valor / reserva.metaTotal) * 100);

  var insightsHtml = '';
  if (HIST.length >= 2) {
    var primeiro = HIST[0];
    var ultimoH = HIST[HIST.length - 1];
    var crescTotal = Math.round(((ultimoH.fat - primeiro.fat) / primeiro.fat) * 100);
    var recorde = HIST.reduce(function(mx, h){ return h.fat > mx.fat ? h : mx; }, HIST[0]);
    insightsHtml =
      '<div class="insight-item"><i class="ti ti-trending-up" style="color:var(--green)"></i><span><strong>+' + crescTotal + '% ' + primeiro.label + '→' + ultimoH.label + '.</strong> ' + HIST.length + ' meses de histórico registrado.</span></div>' +
      '<div class="insight-item"><i class="ti ti-trophy" style="color:var(--gold)"></i><span><strong>Recorde: ' + brl(recorde.fat) + '</strong> em ' + recorde.label + '/' + recorde.m.slice(0,4) + ' com ' + recorde.atend + ' atend.</span></div>';
    if (VENCIMENTOS_FB.some(function(v){ return v.encerra; })) {
      insightsHtml += '<div class="insight-item"><i class="ti ti-confetti" style="color:var(--amber)"></i><span><strong>Papo de Barbeira encerra em julho!</strong> R$ 552,93/mês liberados a partir de agosto.</span></div>';
    }
  }

  // Lista de faturamento diário
  var listFatHtml = '';
  if (fatsDoMes.length > 0) {
    var sortedFats = fatsDoMes.slice().sort(function(a,b){ return b.data.localeCompare(a.data); });
    listFatHtml = '<div class="card"><div class="card-title">Faturamento Diário</div>' +
      sortedFats.map(function(fd) {
        return '<div class="list-item">' +
          '<div class="list-icon" style="background:rgba(76,175,125,0.12)"><i class="ti ti-cash" style="color:var(--green)"></i></div>' +
          '<div class="list-info"><div class="list-name">' + dataFmt(fd.data) + '</div>' +
            '<div class="list-meta">' + fd.atendimentos + ' atendimentos · Ticket médio: ' + brl(fd.valor/fd.atendimentos) + '</div></div>' +
          '<div class="list-val" style="color:var(--green)">+' + brl(fd.valor) + '</div>' +
          '<button class="del-btn" onclick="delFatDiario(\'' + fd.id + '\')"><i class="ti ti-trash"></i></button>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  document.getElementById('sec-painel').innerHTML =
    '<div class="nav-mes">' +
      '<button class="nav-mes-btn" onclick="navHist(-1)"' + (!canPrev?' disabled':'') + '><i class="ti ti-chevron-left"></i></button>' +
      '<span class="nav-mes-label">' + navLabel + '</span>' +
      '<button class="nav-mes-btn" onclick="navHist(1)"' + (!canNext?' disabled':'') + '><i class="ti ti-chevron-right"></i></button>' +
    '</div>' +
    '<div class="metrics">' + metricsHtml + '</div>' +
    (HIST.length ? '<div class="card"><div class="card-title">Faturamento vs. Saídas Histórico</div>' +
      '<div style="position:relative;height:180px;width:100%"><canvas id="chart-historico"></canvas></div></div>' : '') +
    (totalSaidas > 0 ? '<div class="card"><div class="card-title">Saídas por Categoria</div>' +
      '<div style="position:relative;height:180px;width:100%"><canvas id="chart-categorias"></canvas></div></div>' : '') +
    listFatHtml +
    '<div class="card"><div class="card-title">Reserva financeira</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">' +
        '<div><div style="font-size:11px;color:var(--text2);margin-bottom:2px">Cofrinho Mercado Pago</div><div style="font-size:26px;font-weight:600;color:var(--green);font-family:var(--mono)">' + brl(reserva.valor) + '</div></div>' +
        '<div style="text-align:right"><div style="font-size:10px;color:var(--text2)">meta/mês</div><div style="font-size:15px;font-weight:500;color:var(--gold)">R$ 1.000</div></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px"><span>' + pctRes + '% da meta</span><span>meta: ' + brl(reserva.metaTotal) + '</span></div>' +
      '<div class="prog-wrap" style="height:7px"><div class="prog-bar" style="width:' + pctRes + '%;background:var(--green)"></div></div>' +
    '</div>' +
    (insightsHtml ? '<div class="card"><div class="card-title">Insights</div>' + insightsHtml + '</div>' : '') +
    (isCurrent ? '<button class="btn-primary" onclick="abrirFechamento()" style="margin-bottom:8px"><i class="ti ti-calendar-check"></i> Fechar mês — ' + mesAt.label + '/' + mesAt.ano + '</button>' : '') +
    (showData ? '<button class="btn-secondary" onclick="exportarFechamento()" style="margin-bottom:8px"><i class="ti ti-file-export"></i> Exportar relatório — ' + (isCurrent?mesAt.label:showData.label) + '</button>' : '');

  // Renderizar gráficos após carregar o HTML
  setTimeout(function() {
    renderCharts(filtroMes, totalSaidas, lancsDoMes, dadosMes);
  }, 50);
}

function renderCharts(filtroMes, totalSaidas, lancsDoMes, dadosMes) {
  if (chartHistoricoInstance) {
    chartHistoricoInstance.destroy();
    chartHistoricoInstance = null;
  }
  if (chartCategoriasInstance) {
    chartCategoriasInstance.destroy();
    chartCategoriasInstance = null;
  }

  // 1) Gráfico Histórico
  var canvasHist = document.getElementById('chart-historico');
  if (canvasHist && HIST.length > 0) {
    var ctxHist = canvasHist.getContext('2d');
    
    // Adicionar o ponto do mês corrente atual nos dados do gráfico para faturamento dinâmico
    var histComAtual = HIST.concat([dadosMes]);
    var labelsHist = histComAtual.map(function(h) { return h.label; });
    var dadosFat = histComAtual.map(function(h) { return h.fat; });
    var dadosSaidas = histComAtual.map(function(h) {
      var mKey = h.m;
      var lancsM = lancamentos.filter(function(l) { return l.data && l.data.indexOf(mKey) === 0; });
      return lancsM.reduce(function(s, l) { return s + l.valor; }, 0);
    });

    chartHistoricoInstance = new Chart(ctxHist, {
      type: 'line',
      data: {
        labels: labelsHist,
        datasets: [
          {
            label: 'Faturamento',
            data: dadosFat,
            borderColor: '#FAC775',
            backgroundColor: 'rgba(250, 199, 117, 0.05)',
            borderWidth: 2,
            tension: 0.3,
            fill: true
          },
          {
            label: 'Saídas',
            data: dadosSaidas,
            borderColor: '#e05555',
            backgroundColor: 'rgba(224, 85, 85, 0.05)',
            borderWidth: 1.5,
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#8c8980',
              font: { family: 'DM Sans', size: 10 }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#8c8980', font: { family: 'DM Sans', size: 9 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#8c8980',
              font: { family: 'DM Sans', size: 9 },
              callback: function(val) { return 'R$ ' + val; }
            }
          }
        }
      }
    });
  }

  // 2) Gráfico de Categorias (Rosca)
  var canvasCat = document.getElementById('chart-categorias');
  if (canvasCat && totalSaidas > 0) {
    var ctxCat = canvasCat.getContext('2d');
    var porCat = {};
    lancsDoMes.forEach(function(l) {
      var k = l.categoria || 'Outro';
      porCat[k] = (porCat[k] || 0) + l.valor;
    });

    var sortedCats = Object.entries(porCat).sort(function(a, b) { return b[1] - a[1]; });
    var labelsCat = sortedCats.map(function(e) { return e[0]; });
    var valuesCat = sortedCats.map(function(e) { return e[1]; });
    var colorsCat = labelsCat.map(function(name) {
      var cat = CATS.find(function(c) { return c.nome === name; });
      return cat ? cat.cor : '#8c8980';
    });

    chartCategoriasInstance = new Chart(ctxCat, {
      type: 'doughnut',
      data: {
        labels: labelsCat,
        datasets: [{
          data: valuesCat,
          backgroundColor: colorsCat,
          borderWidth: 1.5,
          borderColor: '#1a1a18'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#8c8980',
              font: { family: 'DM Sans', size: 10 },
              boxWidth: 10
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                var val = context.raw;
                var pct = Math.round((val / totalSaidas) * 100);
                return ' ' + context.label + ': R$ ' + val.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' (' + pct + '%)';
              }
            }
          }
        },
        cutout: '65%'
      }
    });
  }
}


// ============================================================
// RENDER: MÊS ATUAL (saídas)
// ============================================================
function renderMes() {
  var mesAt = getMesAtual();
  var lancsDoMes = lancamentos.filter(function(l){ return l.data && l.data.indexOf(mesAt.m) === 0; })
    .sort(function(a,b){ return b.data.localeCompare(a.data); });
  var total = lancsDoMes.reduce(function(s,l){ return s + l.valor; }, 0);
  var barb  = lancsDoMes.filter(function(l){ return l.conta === 'Barbearia'; }).reduce(function(s,l){ return s + l.valor; }, 0);
  var pes   = lancsDoMes.filter(function(l){ return l.conta === 'Pessoal'; }).reduce(function(s,l){ return s + l.valor; }, 0);

  var porCat = {};
  lancsDoMes.forEach(function(l){ var k = l.categoria||'Outro'; porCat[k]=(porCat[k]||0)+l.valor; });
  var catHtml = Object.entries(porCat).sort(function(a,b){ return b[1]-a[1]; }).map(function(e){
    var cat = CATS.find(function(c){ return c.nome===e[0]; })||CATS[0];
    var pct = total>0?Math.round((e[1]/total)*100):0;
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12px">' +
      '<i class="ti ' + cat.icon + '" style="color:' + cat.cor + ';font-size:14px;min-width:16px"></i>' +
      '<span style="flex:1;color:var(--text2)">' + e[0] + '</span>' +
      '<div class="prog-wrap" style="flex:2;margin:0"><div class="prog-bar" style="width:' + pct + '%;background:' + cat.cor + '"></div></div>' +
      '<span style="min-width:72px;text-align:right;font-family:var(--mono);font-size:11px">' + brl(e[1]) + '</span>' +
    '</div>';
  }).join('');

  // Salvar valores antigos do filtro antes de reconstruir o DOM
  var buscaVal = '';
  var catVal = '';
  var buscaInput = document.getElementById('s-busca');
  var catSelect = document.getElementById('s-filtro-cat');
  if (buscaInput) buscaVal = buscaInput.value;
  if (catSelect) catVal = catSelect.value;

  var modalTitle = document.querySelector('#modal-lanc .modal-title');
  if (modalTitle) modalTitle.textContent = 'Nova saída — ' + mesAt.label + '/' + mesAt.ano;

  var catOptions = CATS.map(function(c){
    return '<option value="' + c.nome + '">' + c.nome + '</option>';
  }).join('');

  document.getElementById('sec-junho').innerHTML =
    '<div class="sec-header">' +
      '<div class="sec-title">' + mesAt.label + ' / ' + mesAt.ano + '</div>' +
      '<button class="btn-add" onclick="openModal(\'modal-lanc\')"><i class="ti ti-plus"></i> Nova saída</button>' +
    '</div>' +
    '<div class="metrics">' +
      '<div class="mcard"><div class="mcard-label">Total saídas</div><div class="mcard-val ' + (total>0?'val-red':'') + '">' + (total>0?brl(total):'—') + '</div><div class="mcard-sub">' + lancsDoMes.length + ' lançamentos</div></div>' +
      '<div class="mcard"><div class="mcard-label">Barbearia</div><div class="mcard-val val-amber">' + brl(barb) + '</div><div class="mcard-sub">Pessoal: ' + brl(pes) + '</div></div>' +
    '</div>' +
    (lancsDoMes.length > 0 && catHtml ? '<div class="card"><div class="card-title">Por categoria</div>' + catHtml + '</div>' : '') +
    '<div class="card">' +
      '<div class="card-title">Lançamentos</div>' +
      '<div class="filter-bar" style="margin-bottom:14px; display:flex; gap:6px; flex-wrap:wrap">' +
        '<input type="text" id="s-busca" placeholder="Buscar despesa..." class="form-input" style="flex:2; padding:8px 12px; font-size:13px; height:36px" oninput="atualizarListaFiltrada()">' +
        '<select id="s-filtro-cat" class="form-select" style="flex:1.2; padding:8px 12px; font-size:13px; height:36px; background-position: calc(100% - 10px) 50%" onchange="atualizarListaFiltrada()">' +
          '<option value="">Categorias</option>' + catOptions +
        '</select>' +
        '<button class="btn-add" style="height:36px; padding:0 12px" onclick="exportarSaidasCSV()" title="Exportar CSV"><i class="ti ti-download"></i> CSV</button>' +
      '</div>' +
      '<div id="lancs-list-container"></div>' +
    '</div>';

  // Restaurar valores antigos dos filtros
  var newBuscaInput = document.getElementById('s-busca');
  var newCatSelect = document.getElementById('s-filtro-cat');
  if (newBuscaInput) newBuscaInput.value = buscaVal;
  if (newCatSelect) newCatSelect.value = catVal;

  atualizarListaFiltrada();
}

function atualizarListaFiltrada() {
  var mesAt = getMesAtual();
  var query = (document.getElementById('s-busca')?.value || '').toLowerCase().trim();
  var catFilter = document.getElementById('s-filtro-cat')?.value || '';

  var lancsDoMes = lancamentos.filter(function(l){ return l.data && l.data.indexOf(mesAt.m) === 0; })
    .sort(function(a,b){ return b.data.localeCompare(a.data); });

  var filtrados = lancsDoMes.filter(function(l) {
    var matchQuery = !query || l.desc.toLowerCase().indexOf(query) !== -1 || (l.obs && l.obs.toLowerCase().indexOf(query) !== -1);
    var matchCat = !catFilter || l.categoria === catFilter;
    return matchQuery && matchCat;
  });

  var container = document.getElementById('lancs-list-container');
  if (!container) return;

  container.innerHTML = filtrados.length
    ? filtrados.map(function(l){
        var cat = CATS.find(function(c){ return c.nome===l.categoria; })||CATS[0];
        return '<div class="list-item">' +
          '<div class="list-icon" style="background:' + cat.bg + '"><i class="ti ' + cat.icon + '" style="color:' + cat.cor + '"></i></div>' +
          '<div class="list-info"><div class="list-name">' + l.desc + '</div>' +
          '<div class="list-meta">' + dataFmt(l.data) + ' · ' + l.categoria + (l.pagamento?' · '+l.pagamento:'') + (l.obs?' · '+l.obs:'') + '</div></div>' +
          '<div class="list-val" style="color:var(--red)">' + brl(l.valor) + '</div>' +
          '<button class="del-btn" onclick="delLanc(\'' + l.id + '\')"><i class="ti ti-trash"></i></button>' +
        '</div>';
      }).join('')
    : '<div class="empty"><i class="ti ti-filter"></i><br>Nenhum lançamento correspondente.</div>';
}

function exportarSaidasCSV() {
  var mesAt = getMesAtual();
  var lancsDoMes = lancamentos.filter(function(l){ return l.data && l.data.indexOf(mesAt.m) === 0; })
    .sort(function(a,b){ return a.data.localeCompare(b.data); });

  if (!lancsDoMes.length) {
    showToast('Nenhum lançamento para exportar neste mês.', 'err');
    return;
  }

  var csvContent = 'Data,Descrição,Categoria,Valor,Pagamento,Observações\n';
  lancsDoMes.forEach(function(l) {
    var data = dataFmt(l.data);
    var desc = '"' + l.desc.replace(/"/g, '""') + '"';
    var cat = l.categoria || '';
    var val = l.valor.toFixed(2);
    var pag = l.pagamento || '';
    var obs = '"' + (l.obs || '').replace(/"/g, '""') + '"';
    csvContent += [data, desc, cat, val, pag, obs].join(',') + '\n';
  });

  var blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'despesas-' + mesAt.label.toLowerCase() + '-' + mesAt.ano + '.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Planilha CSV exportada!');
}

// ============================================================
// RENDER: ALERTAS (vencimentos dinâmicos)
// ============================================================
function renderAlertas() {
  var mesAt = getMesAtual();
  var agora = new Date();
  var mesKey = mesAt.m;

  var vencComDiff = VENCIMENTOS_FB.map(function(v){
    var vd = new Date(mesAt.ano, mesAt.mesNum-1, v.dia);
    var diff = Math.round((vd-agora)/86400000);
    return Object.assign({},v,{diff:diff, pago:vencPago(v, mesKey)});
  }).sort(function(a,b){ return a.diff-b.diff; });

  // Botão de pagar/desfazer reutilizável
  function btnPagar(v) {
    if (v.pago) {
      return '<button class="pay-btn pay-btn-done" onclick="desfazerPagamento(\'' + v.id + '\')" title="Desfazer pagamento"><i class="ti ti-circle-check"></i> Pago</button>';
    }
    return '<button class="pay-btn" onclick="marcarPago(\'' + v.id + '\')" title="Marcar como pago"><i class="ti ti-cash"></i> Pagar</button>';
  }

  // Só entram em "urgentes/próximos" os que ainda NÃO foram pagos
  var urgentes = vencComDiff.filter(function(v){ return !v.pago && v.diff>=0&&v.diff<=2; });
  var proximos = vencComDiff.filter(function(v){ return !v.pago && v.diff>2&&v.diff<=10; });
  var html = '';

  if ('Notification' in window && Notification.permission !== 'granted') {
    html += '<div class="alert alert-amber" onclick="solicitarPermissao()" style="cursor:pointer;margin-bottom:12px">' +
      '<i class="ti ti-bell-ringing" style="color:var(--amber)"></i>' +
      '<div><div class="alert-title">Ativar notificações</div>' +
      '<div class="alert-sub">Toque para receber alertas de vencimento no celular.</div></div></div>';
  }

  if (urgentes.length) {
    html += '<div class="card"><div class="card-title" style="color:var(--red)">⚠ Atenção imediata</div>';
    urgentes.forEach(function(v){
      var label = v.diff===0?'Vence hoje!':v.diff===1?'Amanhã':'Em '+v.diff+' dias';
      html += '<div class="alert alert-red">' +
        '<i class="ti ti-bell"></i>' +
        '<div style="flex:1"><div class="alert-title">' + v.nome + (v.encerra?' <span class="pill pill-green">último mês</span>':'') + '</div>' +
        '<div class="alert-sub">' + label + ' · ' + tipoLabel(v) + ' · ' + brl(v.valor) + '</div></div>' +
        '<div class="venc-actions">' + btnPagar(v) +
          '<button class="del-btn" onclick="editarVencimento(\'' + v.id + '\')"><i class="ti ti-edit"></i></button>' +
          '<button class="del-btn" onclick="delVencimento(\'' + v.id + '\')"><i class="ti ti-trash"></i></button>' +
        '</div></div>';
    });
    html += '</div>';
  }

  if (proximos.length) {
    html += '<div class="card"><div class="card-title">Próximos 10 dias</div>';
    proximos.forEach(function(v){
      html += '<div class="alert alert-amber">' +
        '<i class="ti ti-clock"></i>' +
        '<div style="flex:1"><div class="alert-title">' + v.nome + (v.encerra?' <span class="pill pill-green">último mês</span>':'') + '</div>' +
        '<div class="alert-sub">Em ' + v.diff + ' dias · dia ' + v.dia + ' · ' + brl(v.valor) + '</div></div>' +
        '<div class="venc-actions">' + btnPagar(v) +
          '<button class="del-btn" onclick="editarVencimento(\'' + v.id + '\')"><i class="ti ti-edit"></i></button>' +
          '<button class="del-btn" onclick="delVencimento(\'' + v.id + '\')"><i class="ti ti-trash"></i></button>' +
        '</div></div>';
    });
    html += '</div>';
  }

  html += '<div class="card"><div class="card-title">Calendário — ' + mesAt.label + '/' + mesAt.ano + '</div>';
  if (vencComDiff.length) {
    vencComDiff.forEach(function(v){
      var passado = v.diff < 0;
      var corDot = v.pago?'var(--green)':passado?'var(--text3)':v.diff<=2?'var(--red)':v.diff<=10?'var(--amber)':'var(--green)';
      html += '<div class="row" style="' + (passado&&!v.pago?'opacity:0.4':'') + '">' +
        '<div class="dot" style="background:' + corDot + ';width:8px;height:8px;flex-shrink:0"></div>' +
        '<div class="row-label" style="flex:1"><div>' + v.nome + (v.pago?' <span class="pill pill-green">pago</span>':'') + (v.encerra?' ★':'') + '</div><div class="row-sub">dia ' + v.dia + ' · ' + tipoLabel(v) + '</div></div>' +
        '<div class="row-val">' + brl(v.valor) + '</div>' +
        '<div class="venc-actions">' + btnPagar(v) +
          '<button class="del-btn" onclick="editarVencimento(\'' + v.id + '\')"><i class="ti ti-edit"></i></button>' +
          '<button class="del-btn" onclick="delVencimento(\'' + v.id + '\')"><i class="ti ti-trash"></i></button>' +
        '</div></div>';
    });
  } else {
    html += '<div class="empty"><i class="ti ti-calendar"></i><br>Nenhum vencimento cadastrado.</div>';
  }
  html += '</div>';

  var totalVenc = VENCIMENTOS_FB.reduce(function(s,v){ return s+v.valor; }, 0);
  var totalPago = vencComDiff.filter(function(v){ return v.pago; }).reduce(function(s,v){ return s+v.valor; }, 0);
  var totalFalta = totalVenc - totalPago;
  html += '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;font-size:12px;color:var(--text2)">' +
    '<span>Comprometido/mês: <strong style="color:var(--text)">' + brl(totalVenc) + '</strong></span>' +
    '<span>Pago: <strong style="color:var(--green)">' + brl(totalPago) + '</strong> · Falta: <strong style="color:var(--amber)">' + brl(totalFalta) + '</strong></span></div>';
  html += '<button class="btn-primary" onclick="abrirNovoVencimento()" style="margin-bottom:8px"><i class="ti ti-plus"></i> Adicionar vencimento</button>';

  if (VENCIMENTOS_FB.some(function(v){ return v.encerra; })) {
    html += '<div class="alert alert-green"><i class="ti ti-confetti"></i><div>' +
      '<div class="alert-title">Papo de Barbeira encerra este mês!</div>' +
      '<div class="alert-sub">Última parcela R$ 99,00. A partir de agosto R$ 552,93/mês liberados.</div>' +
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
  var hist   = (reserva.historico||[]).slice().sort(function(a,b){ return b.data.localeCompare(a.data); });

  var histHtml = hist.length ? hist.map(function(d){
    var ehSaida = d.tipo === 'saida';
    var cor     = ehSaida ? 'var(--red)' : 'var(--green)';
    var icone   = ehSaida ? 'ti-arrow-up-circle' : 'ti-arrow-down-circle';
    var bgIco   = ehSaida ? 'rgba(224,85,85,0.15)' : 'rgba(76,175,125,0.15)';
    var sinal   = ehSaida ? '−' : '+';
    var label   = d.obs || (ehSaida ? 'Retirada' : 'Depósito');
    return '<div class="list-item">' +
      '<div class="list-icon" style="background:' + bgIco + '"><i class="ti ' + icone + '" style="color:' + cor + '"></i></div>' +
      '<div class="list-info">' +
        '<div class="list-name">' + label + '</div>' +
        '<div class="list-meta">' + dataFmt(d.data) + ' · ' + (ehSaida ? 'Saída' : 'Entrada') + '</div>' +
      '</div>' +
      '<div class="list-val" style="color:' + cor + '">' + sinal + ' ' + brl(d.valor) + '</div>' +
      '<div class="venc-actions">' +
        '<button class="del-btn" onclick="editarDeposito(\'' + d.id + '\')"><i class="ti ti-edit"></i></button>' +
        (d.id !== 'mai-dep' ? '<button class="del-btn" onclick="delDeposito(\'' + d.id + '\')"><i class="ti ti-trash"></i></button>' : '') +
      '</div>' +
    '</div>';
  }).join('') : '<div class="empty"><i class="ti ti-piggy-bank"></i><br>Nenhuma transação ainda.</div>';

  var projHtml = ['Jul','Ago','Set','Out','Nov','Dez'].map(function(m, i){
    var v = Math.min(reserva.metaTotal, reserva.valor + (i+1)*1000);
    var p = Math.round((v/reserva.metaTotal)*100);
    var done = p >= 100;
    return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px">' +
      '<span style="min-width:28px;color:var(--text2)">' + m + '</span>' +
      '<div class="prog-wrap" style="flex:1"><div class="prog-bar" style="width:' + p + '%;background:' + (done?'var(--gold)':'var(--green)') + '"></div></div>' +
      '<span style="min-width:60px;text-align:right;' + (done?'color:var(--gold);font-weight:500':'color:var(--text2)') + '">' + brl(v) + (done?' ✓':'') + '</span>' +
    '</div>';
  }).join('');

  var totalEnt = (reserva.historico||[]).filter(function(d){ return d.tipo !== 'saida'; }).reduce(function(s,d){ return s+d.valor; },0);
  var totalSai = (reserva.historico||[]).filter(function(d){ return d.tipo === 'saida'; }).reduce(function(s,d){ return s+d.valor; },0);

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
    '<div class="metrics">' +
      '<div class="mcard"><div class="mcard-label">Entradas</div><div class="mcard-val val-green">' + brl(totalEnt) + '</div><div class="mcard-sub">depositado</div></div>' +
      '<div class="mcard"><div class="mcard-label">Saídas</div><div class="mcard-val ' + (totalSai>0?'val-red':'') + '">' + brl(totalSai) + '</div><div class="mcard-sub">retirado</div></div>' +
    '</div>' +
    '<button class="btn-primary" onclick="abrirDepModal()" style="margin-bottom:16px"><i class="ti ti-plus"></i> Nova transação</button>' +
    '<div class="card"><div class="card-title">Histórico de transações</div>' + histHtml + '</div>' +
    '<div class="card"><div class="card-title">Projeção mensal</div>' + projHtml + '</div>';
}


// ============================================================
// RENDER: METAS (dinâmico — add/edit/remove)
// ============================================================
function renderMetas() {
  var ref = HIST.length ? HIST[HIST.length - 1] : null;
  var ORDER = ['fat','desp','atend','ticket','reserva','prod'];
  var items = Object.values(metasObj).sort(function(a,b){
    var ai = ORDER.indexOf(a.id); var bi = ORDER.indexOf(b.id);
    if (ai>=0&&bi>=0) return ai-bi;
    if (ai>=0) return -1; if (bi>=0) return 1; return 0;
  });

  function getReal(it) {
    if (it.autoKey && ref && ref[it.autoKey] !== undefined) return ref[it.autoKey];
    return it.realVal !== undefined ? it.realVal : 0;
  }

  var refLabel = ref ? ref.label+'/'+ref.m.slice(0,4) : 'sem dados';

  var itensHtml = items.length ? items.map(function(it){
    var real = getReal(it);
    var pct  = Math.min(100, Math.round((real / it.target) * 100));
    var ok   = it.tipo === 'max' ? real <= it.target : real >= it.target;
    var autoTag = it.autoKey ? '<span style="font-size:10px;color:var(--text3);margin-left:4px">auto</span>' : '';
    return '<div style="padding:10px 0;border-bottom:0.5px solid var(--border)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">' +
        '<span style="font-size:13px">' + it.label + autoTag + '</span>' +
        '<div style="display:flex;align-items:center;gap:6px">' +
          '<span class="pill ' + (ok?'pill-green':'pill-amber') + '">' + (ok?'✓ atingido':'em andamento') + '</span>' +
          '<button class="del-btn" onclick="editarMeta(\'' + it.id + '\')"><i class="ti ti-edit"></i></button>' +
          '<button class="del-btn" onclick="delMeta(\'' + it.id + '\')"><i class="ti ti-trash"></i></button>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:3px">' +
        '<span>Realizado: <strong style="color:var(--text)">' + fmtMeta(it.fmt, real) + (it.autoKey?'':'') + '</strong></span>' +
        '<span>Meta: <strong style="color:var(--text)">' + fmtMeta(it.fmt, it.target) + '</strong></span>' +
      '</div>' +
      '<div class="prog-wrap"><div class="prog-bar" style="width:' + pct + '%;background:' + (ok?'var(--green)':'var(--amber)') + '"></div></div>' +
    '</div>';
  }).join('') : '<div class="empty"><i class="ti ti-target"></i><br>Nenhuma meta cadastrada ainda.</div>';

  document.getElementById('sec-metas').innerHTML =
    '<div class="sec-header">' +
      '<div class="sec-title">Metas</div>' +
      '<button class="btn-add" onclick="abrirNovaMeta()"><i class="ti ti-plus"></i> Nova meta</button>' +
    '</div>' +
    '<div class="card"><div class="card-title">Metas vs. ' + refLabel + '</div>' + itensHtml + '</div>';
}

// ============================================================
// RENDER: BEBIDAS
// ============================================================
function renderBebidas() {
  // 1) Agrupar compras por produto para custo médio e estoque total comprado
  var comprasPorProd = {};
  bebidas.forEach(function(b) {
    var p = b.produto;
    if (!comprasPorProd[p]) comprasPorProd[p] = { totalVal: 0, totalQtd: 0 };
    comprasPorProd[p].totalVal += b.valor;
    comprasPorProd[p].totalQtd += b.qtd;
  });

  // 2) Agrupar vendas por produto
  var vendasPorProd = {};
  bebidasVendas.forEach(function(v) {
    var p = v.produto;
    vendasPorProd[p] = (vendasPorProd[p] || 0) + v.qtd;
  });

  // 3) Calcular estoque atual e custo médio de cada produto
  var estoque = {};
  var custoMedio = {};
  Object.keys(comprasPorProd).forEach(function(p) {
    var totalQ = comprasPorProd[p].totalQtd;
    var totalV = comprasPorProd[p].totalVal;
    custoMedio[p] = totalQ > 0 ? (totalV / totalQ) : 0;
    var vendidas = vendasPorProd[p] || 0;
    estoque[p] = Math.max(0, totalQ - vendidas);
  });

  // 4) Métricas financeiras
  var totalCompras = bebidas.reduce(function(s,b){ return s+b.valor; }, 0);
  var totalVendas = bebidasVendas.reduce(function(s,v){ return s+v.valor; }, 0);
  var lucroEstimado = bebidasVendas.reduce(function(s, v) {
    var cMed = custoMedio[v.produto] || 0;
    return s + (v.valor - (v.qtd * cMed));
  }, 0);

  // 5) Renderizar estoque
  var estoqueRows = Object.keys(comprasPorProd).map(function(p) {
    var est = estoque[p];
    var cMed = custoMedio[p];
    var estCor = est === 0 ? 'var(--red)' : est <= 5 ? 'var(--amber)' : 'var(--green)';
    return '<div class="row">' +
      '<div class="row-label"><div>' + p + '</div><div class="row-sub">custo médio: ' + brl(cMed) + '</div></div>' +
      '<div class="row-val" style="color:' + estCor + '">' + est + ' un</div>' +
    '</div>';
  }).join('');
  
  var estoqueHtml = estoqueRows ? '<div class="card"><div class="card-title">Estoque Atual</div>' + estoqueRows + '</div>' : '';

  // 6) Histórico combinado de compras e vendas
  var histCompras = bebidas.map(function(b) {
    return {
      id: b.id,
      data: b.data,
      desc: b.produto,
      sub: 'Compra · ' + b.fornecedor + ' · ' + b.qtd + ' un · custo ' + brl(b.valor / b.qtd) + '/un',
      valor: b.valor,
      tipo: 'compra'
    };
  });

  var histVendas = bebidasVendas.map(function(v) {
    return {
      id: v.id,
      data: v.data,
      desc: v.produto,
      sub: 'Venda · ' + v.qtd + ' un · preço ' + brl(v.valor / v.qtd) + '/un',
      valor: v.valor,
      tipo: 'venda'
    };
  });

  var histCombinado = histCompras.concat(histVendas).sort(function(a, b) {
    return b.data.localeCompare(a.data);
  });

  var listHtml = histCombinado.length ? histCombinado.map(function(h) {
    var ehVenda = h.tipo === 'venda';
    var cor = ehVenda ? 'var(--green)' : 'var(--red)';
    var bgIco = ehVenda ? 'rgba(76,175,125,0.12)' : 'rgba(224,85,85,0.12)';
    var icone = ehVenda ? 'ti-arrow-down-circle' : 'ti-arrow-up-circle';
    var sinal = ehVenda ? '+' : '−';
    var fnDel = ehVenda ? 'delVendaBebida' : 'delBebida';
    return '<div class="list-item">' +
      '<div class="list-icon" style="background:' + bgIco + '"><i class="ti ' + icone + '" style="color:' + cor + '"></i></div>' +
      '<div class="list-info"><div class="list-name">' + h.desc + '</div><div class="list-meta">' + dataFmt(h.data) + ' · ' + h.sub + '</div></div>' +
      '<div class="list-val" style="color:' + cor + '">' + sinal + ' ' + brl(h.valor) + '</div>' +
      '<button class="del-btn" onclick="' + fnDel + '(\'' + h.id + '\')"><i class="ti ti-trash"></i></button>' +
    '</div>';
  }).join('') : '<div class="empty"><i class="ti ti-beer"></i><br>Nenhuma movimentação registrada.</div>';

  document.getElementById('sec-bebidas').innerHTML =
    '<div class="sec-header">' +
      '<div class="sec-title">Bebidas</div>' +
      '<div style="display:flex;gap:6px">' +
        '<button class="btn-add" onclick="openModal(\'modal-bev\')"><i class="ti ti-plus"></i> Compra</button>' +
        '<button class="btn-add" onclick="abrirBevVendaModal()"><i class="ti ti-cash"></i> Venda</button>' +
      '</div>' +
    '</div>' +
    '<div class="metrics">' +
      '<div class="mcard"><div class="mcard-label">Investido (Compras)</div><div class="mcard-val val-red">' + brl(totalCompras) + '</div><div class="mcard-sub">' + bebidas.length + ' compras</div></div>' +
      '<div class="mcard"><div class="mcard-label">Faturado (Vendas)</div><div class="mcard-val val-green">' + brl(totalVendas) + '</div><div class="mcard-sub">' + bebidasVendas.length + ' vendas</div></div>' +
      '<div class="mcard" style="grid-column: 1 / -1"><div class="mcard-label">Lucro Líquido Estimado</div><div class="mcard-val val-gold">' + brl(lucroEstimado) + '</div><div class="mcard-sub">considerando o custo médio unitário</div></div>' +
    '</div>' +
    estoqueHtml +
    '<div class="card"><div class="card-title">Movimentações de Bebidas</div>' + listHtml + '</div>';
}

// ============================================================
// CRUD: LANÇAMENTOS
// ============================================================
async function salvarLanc() {
  var desc = document.getElementById('l-desc').value.trim();
  var val  = parseFloat(document.getElementById('l-val').value);
  var data = document.getElementById('l-data').value;
  if (!desc||!val||!data) { showToast('Preencha todos os campos obrigatórios','err'); return; }
  var cat = CATS[catSel];
  try {
    await fbPush('lancamentos', { desc:desc, valor:val, data:data, categoria:cat.nome, conta:cat.nome==='Pessoal'?'Pessoal':'Barbearia', pagamento:pagSel, obs:document.getElementById('l-obs').value.trim() });
    closeModal('modal-lanc');
    ['l-desc','l-val','l-obs'].forEach(function(id){ document.getElementById(id).value=''; });
    document.getElementById('l-data').value = hoje();
    showToast('Saída registrada!');
  } catch(e) { showToast('Erro ao salvar.','err'); }
}
async function delLanc(id) { await fbRemove('lancamentos/'+id); showToast('Lançamento removido.'); }

// ============================================================
// CRUD: FECHAMENTO DE MÊS
// ============================================================
function abrirFechamento() {
  var mesAt = getMesAtual();
  document.getElementById('f-mes').value = mesAt.m;
  document.getElementById('f-mes-label').textContent = mesAt.label + ' / ' + mesAt.ano;
  
  // Calcular soma de faturamento diário para o mês corrente
  var fatsDoMes = faturamentoDiario.filter(function(fd){ return fd.data && fd.data.indexOf(mesAt.m) === 0; });
  var totalFat = fatsDoMes.reduce(function(s,fd){ return s + fd.valor; }, 0);
  var totalAtend = fatsDoMes.reduce(function(s,fd){ return s + fd.atendimentos; }, 0);

  document.getElementById('f-fat').value = totalFat > 0 ? totalFat.toFixed(2) : '';
  document.getElementById('f-atend').value = totalAtend > 0 ? totalAtend : '';
  document.getElementById('f-ticket-preview').textContent = (totalFat > 0 && totalAtend > 0) ? brl(totalFat / totalAtend) : '—';
  
  openModal('modal-fechamento');
}
function calcTicketPreview() {
  var fat   = parseFloat(document.getElementById('f-fat').value)||0;
  var atend = parseInt(document.getElementById('f-atend').value)||0;
  document.getElementById('f-ticket-preview').textContent = (fat>0&&atend>0)?brl(fat/atend):'—';
}
async function salvarFechamento() {
  var m     = document.getElementById('f-mes').value;
  var fat   = parseFloat(document.getElementById('f-fat').value);
  var atend = parseInt(document.getElementById('f-atend').value);
  if (!m||!fat||!atend) { showToast('Preencha faturamento e atendimentos','err'); return; }
  var ticket = parseFloat((fat/atend).toFixed(2));
  var d = new Date(m+'-15');
  var label = MESES_LABEL[d.getMonth()];
  try {
    await fbSet('historico/'+m, { m:m, label:label, fat:fat, atend:atend, ticket:ticket });
    closeModal('modal-fechamento');
    histIdx = -1;
    showToast('✓ ' + label + '/' + d.getFullYear() + ' fechado! Faturamento: ' + brl(fat));
  } catch(e) { showToast('Erro ao salvar.','err'); }
}

// ============================================================
// CRUD: VENCIMENTOS
// ============================================================
function abrirNovoVencimento() {
  editingVencId = null;
  document.getElementById('v-titulo').textContent = 'Novo vencimento';
  ['v-nome','v-valor','v-dia','v-tipo'].forEach(function(id){ document.getElementById(id).value=''; });
  document.getElementById('v-tipo').value = 'Fixo';
  document.getElementById('v-aviso').value = '3';
  document.getElementById('v-encerra').checked = false;
  document.getElementById('v-parc-atual').value = '';
  document.getElementById('v-parc-total').value = '';
  document.querySelectorAll('.aviso-btn').forEach(function(b){ b.classList.remove('active'); });
  var btn3 = document.querySelector('.aviso-btn[data-aviso="3"]');
  if (btn3) btn3.classList.add('active');
  openModal('modal-vencimento');
}
function editarVencimento(id) {
  var v = VENCIMENTOS_FB.find(function(x){ return x.id===id; });
  if (!v) return;
  editingVencId = id;
  document.getElementById('v-titulo').textContent = 'Editar vencimento';
  document.getElementById('v-nome').value  = v.nome;
  document.getElementById('v-valor').value = v.valor;
  document.getElementById('v-dia').value   = v.dia;
  document.getElementById('v-tipo').value  = v.tipo||'Fixo';
  document.getElementById('v-aviso').value = v.aviso||'3';
  document.getElementById('v-encerra').checked = !!v.encerra;
  document.getElementById('v-parc-atual').value = v.parcelaAtual || '';
  document.getElementById('v-parc-total').value = v.parcelaTotal || '';
  document.querySelectorAll('.aviso-btn').forEach(function(b){ b.classList.remove('active'); });
  var btnA = document.querySelector('.aviso-btn[data-aviso="' + (v.aviso||3) + '"]');
  if (btnA) btnA.classList.add('active');
  openModal('modal-vencimento');
}
async function salvarVencimento() {
  var nome    = document.getElementById('v-nome').value.trim();
  var valor   = parseFloat(document.getElementById('v-valor').value);
  var dia     = parseInt(document.getElementById('v-dia').value);
  var tipo    = document.getElementById('v-tipo').value.trim()||'Fixo';
  var aviso   = parseInt(document.getElementById('v-aviso').value)||3;
  var encerra = document.getElementById('v-encerra').checked;
  var pAtual  = parseInt(document.getElementById('v-parc-atual').value);
  var pTotal  = parseInt(document.getElementById('v-parc-total').value);
  if (!nome||!valor||!dia||dia<1||dia>31) { showToast('Preencha nome, valor e dia (1–31)','err'); return; }
  if (pTotal && (!pAtual || pAtual < 1 || pAtual > pTotal)) { showToast('Parcela atual deve estar entre 1 e o total','err'); return; }
  var id = editingVencId || nome.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')+'-'+Date.now();
  var obj = { id:id, nome:nome, valor:valor, dia:dia, tipo:tipo, aviso:aviso, encerra:encerra };
  // Preserva histórico de pagamentos ao editar
  var existente = VENCIMENTOS_FB.find(function(x){ return x.id===id; });
  if (existente && existente.pagamentos) obj.pagamentos = existente.pagamentos;
  // Campos de parcela (opcionais)
  if (pTotal) { obj.parcelaAtual = pAtual; obj.parcelaTotal = pTotal; }
  try {
    await fbSet('vencimentos/'+id, obj);
    closeModal('modal-vencimento');
    showToast(editingVencId?'Vencimento atualizado!':'Vencimento adicionado!');
    editingVencId = null;
    setTimeout(agendarNotificacoes, 600);
  } catch(e) { showToast('Erro ao salvar.','err'); }
}
async function delVencimento(id) {
  await fbRemove('vencimentos/'+id);
  showToast('Vencimento removido.');
}

// ------------------------------------------------------------
// PAGAR VENCIMENTO → gera saída automática + avança parcela
// ------------------------------------------------------------
async function marcarPago(id) {
  var v = VENCIMENTOS_FB.find(function(x){ return x.id===id; });
  if (!v) return;
  var mesAt = getMesAtual();
  var mesKey = mesAt.m;
  if (vencPago(v, mesKey)) { showToast('Este vencimento já está pago neste mês.','err'); return; }
  try {
    // Data do lançamento = dia do vencimento dentro do mês corrente do app
    var diaPad = String(v.dia).padStart(2, '0');
    var dataLanc = mesKey + '-' + diaPad;
    // 1) Cria a saída automática (categoria Contas)
    var lancId = await fbPush('lancamentos', {
      desc: v.nome,
      valor: v.valor,
      data: dataLanc,
      categoria: 'Contas',
      conta: 'Barbearia',
      pagamento: 'Pix',
      obs: 'Pagamento de vencimento',
      vencId: id
    });
    // 2) Monta atualização do vencimento (registro de pagamento + parcela)
    var upd = Object.assign({}, v);
    upd.pagamentos = Object.assign({}, v.pagamentos || {});
    var reg = { lancId: lancId, data: dataLanc };
    // 3) Avança parcela, se houver
    if (v.parcelaTotal) {
      var atual = v.parcelaAtual || 1;
      if (atual >= v.parcelaTotal) {
        upd.encerra = true;      // pagou a última parcela
        reg.encerrou = true;
      } else {
        upd.parcelaAtual = atual + 1;
        reg.avancou = true;
      }
    }
    upd.pagamentos[mesKey] = reg;
    await fbSet('vencimentos/'+id, upd);
    showToast('✓ ' + v.nome + ' pago — lançado nas saídas de ' + mesAt.label);
  } catch(e) { showToast('Erro ao registrar pagamento.','err'); }
}

async function desfazerPagamento(id) {
  var v = VENCIMENTOS_FB.find(function(x){ return x.id===id; });
  if (!v) return;
  var mesKey = getMesAtual().m;
  var reg = v.pagamentos && v.pagamentos[mesKey];
  if (!reg) { showToast('Nenhum pagamento neste mês para desfazer.','err'); return; }
  try {
    // 1) Remove a saída automática vinculada
    if (reg.lancId) await fbRemove('lancamentos/'+reg.lancId);
    // 2) Reverte parcela/encerramento se este pagamento os causou
    var upd = Object.assign({}, v);
    upd.pagamentos = Object.assign({}, v.pagamentos || {});
    if (reg.avancou && upd.parcelaAtual) upd.parcelaAtual = Math.max(1, upd.parcelaAtual - 1);
    if (reg.encerrou) upd.encerra = false;
    delete upd.pagamentos[mesKey];
    await fbSet('vencimentos/'+id, upd);
    showToast('Pagamento desfeito — saída removida.');
  } catch(e) { showToast('Erro ao desfazer.','err'); }
}

// ============================================================
// CRUD: DEPÓSITOS (add entrada/saída, edit, delete)
// ============================================================
async function salvarDeposito() {
  var tipo = document.getElementById('d-tipo').value || 'entrada';
  var val  = parseFloat(document.getElementById('d-val').value);
  var data = document.getElementById('d-data').value;
  var obs  = document.getElementById('d-obs').value.trim();
  if (!val||val<=0||!data) { showToast('Preencha valor e data','err'); return; }
  try {
    var dep = { id:Date.now().toString(), data:data, valor:val, obs:obs, tipo:tipo };
    var novoHist  = (reserva.historico||[]).concat([dep]);
    var delta     = tipo === 'saida' ? -val : val;
    var novoValor = reserva.valor + delta;
    await fbSet('reserva', Object.assign({},reserva,{ valor:novoValor, historico:novoHist }));
    closeModal('modal-dep');
    ['d-val','d-obs'].forEach(function(id){ document.getElementById(id).value=''; });
    document.getElementById('d-data').value = hoje();
    selDepTipo('entrada', document.querySelector('.dep-tipo-btn[data-tipo="entrada"]'));
    showToast(tipo === 'saida' ? 'Saída registrada na reserva!' : 'Entrada registrada na reserva!');
  } catch(e) { showToast('Erro ao salvar.','err'); }
}

function editarDeposito(id) {
  var dep = (reserva.historico||[]).find(function(d){ return d.id===id; });
  if (!dep) return;
  editingDepId = id;
  var tipo = dep.tipo || 'entrada';
  document.getElementById('de-val').value  = dep.valor;
  document.getElementById('de-data').value = dep.data;
  document.getElementById('de-obs').value  = dep.obs||'';
  document.getElementById('de-tipo').value = tipo;
  document.querySelectorAll('.dep-edit-tipo-btn').forEach(function(b){ b.classList.remove('active'); });
  var btn = document.querySelector('.dep-edit-tipo-btn[data-tipo="' + tipo + '"]');
  if (btn) btn.classList.add('active');
  openModal('modal-dep-edit');
}

async function salvarEdicaoDeposito() {
  if (!editingDepId) return;
  var depAntigo = (reserva.historico||[]).find(function(d){ return d.id===editingDepId; });
  if (!depAntigo) return;
  var novoVal  = parseFloat(document.getElementById('de-val').value);
  var novaData = document.getElementById('de-data').value;
  var novaObs  = document.getElementById('de-obs').value.trim();
  var novoTipo = document.getElementById('de-tipo').value || 'entrada';
  if (!novoVal||novoVal<=0||!novaData) { showToast('Preencha valor e data','err'); return; }
  try {
    // Reverter efeito antigo, aplicar novo
    var tipoAntigo = depAntigo.tipo || 'entrada';
    var reverter   = tipoAntigo === 'saida' ? depAntigo.valor : -depAntigo.valor;
    var aplicar    = novoTipo  === 'saida' ? -novoVal : novoVal;
    var novoHist = (reserva.historico||[]).map(function(d){
      return d.id === editingDepId
        ? Object.assign({},d,{valor:novoVal, data:novaData, obs:novaObs, tipo:novoTipo})
        : d;
    });
    await fbSet('reserva', Object.assign({},reserva,{ valor:reserva.valor+reverter+aplicar, historico:novoHist }));
    closeModal('modal-dep-edit');
    editingDepId = null;
    showToast('Transação atualizada!');
  } catch(e) { showToast('Erro ao salvar.','err'); }
}

async function delDeposito(id) {
  var dep = (reserva.historico||[]).find(function(d){ return d.id===id; });
  if (!dep) return;
  var tipo      = dep.tipo || 'entrada';
  var reverter  = tipo === 'saida' ? dep.valor : -dep.valor;
  var novoHist  = reserva.historico.filter(function(d){ return d.id!==id; });
  await fbSet('reserva', Object.assign({},reserva,{ valor:reserva.valor+reverter, historico:novoHist }));
  showToast('Transação removida.');
}

// ============================================================
// CRUD: METAS (add, edit, delete)
// ============================================================
function abrirNovaMeta() {
  editingMetaId = null;
  document.getElementById('mi-titulo').textContent = 'Nova meta';
  document.getElementById('mi-label').value  = '';
  document.getElementById('mi-target').value = '';
  document.getElementById('mi-real').value   = '';
  document.getElementById('mi-tipo').value   = 'min';
  document.getElementById('mi-fmt').value    = 'brl';
  document.querySelectorAll('.tipo-btn').forEach(function(b){ b.classList.remove('active'); });
  var t = document.querySelector('.tipo-btn[data-tipo="min"]');
  if (t) t.classList.add('active');
  document.querySelectorAll('.fmt-btn').forEach(function(b){ b.classList.remove('active'); });
  var f = document.querySelector('.fmt-btn[data-fmt="brl"]');
  if (f) f.classList.add('active');
  document.getElementById('mi-real-info').style.display = 'block';
  openModal('modal-meta-item');
}

function editarMeta(id) {
  var it = metasObj[id];
  if (!it) return;
  editingMetaId = id;
  document.getElementById('mi-titulo').textContent = 'Editar meta';
  document.getElementById('mi-label').value  = it.label;
  document.getElementById('mi-target').value = it.target;
  document.getElementById('mi-real').value   = it.realVal !== undefined ? it.realVal : '';
  document.getElementById('mi-tipo').value   = it.tipo||'min';
  document.getElementById('mi-fmt').value    = it.fmt||'brl';
  document.querySelectorAll('.tipo-btn').forEach(function(b){ b.classList.remove('active'); });
  var t = document.querySelector('.tipo-btn[data-tipo="' + (it.tipo||'min') + '"]');
  if (t) t.classList.add('active');
  document.querySelectorAll('.fmt-btn').forEach(function(b){ b.classList.remove('active'); });
  var f = document.querySelector('.fmt-btn[data-fmt="' + (it.fmt||'brl') + '"]');
  if (f) f.classList.add('active');
  // Mostrar info de autoKey se existir
  var infoEl = document.getElementById('mi-real-info');
  if (it.autoKey) {
    infoEl.style.display = 'block';
    infoEl.textContent = 'Valor realizado: calculado automaticamente do último fechamento (' + it.autoKey + ')';
  } else {
    infoEl.style.display = 'none';
  }
  openModal('modal-meta-item');
}

async function salvarMetaItem() {
  var label  = document.getElementById('mi-label').value.trim();
  var target = parseFloat(document.getElementById('mi-target').value);
  var realRaw= document.getElementById('mi-real').value;
  var tipo   = document.getElementById('mi-tipo').value;
  var fmt    = document.getElementById('mi-fmt').value;
  if (!label||!target) { showToast('Preencha nome e valor alvo','err'); return; }
  var id = editingMetaId || label.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')+'-'+Date.now();
  var obj = { id:id, label:label, target:target, tipo:tipo, fmt:fmt };
  // Manter autoKey se estiver editando uma meta padrão que tinha autoKey
  if (editingMetaId && metasObj[editingMetaId] && metasObj[editingMetaId].autoKey && !realRaw) {
    obj.autoKey = metasObj[editingMetaId].autoKey;
  } else if (realRaw !== '') {
    obj.realVal = parseFloat(realRaw);
  }
  try {
    await fbSet('metas/'+id, obj);
    closeModal('modal-meta-item');
    showToast(editingMetaId?'Meta atualizada!':'Meta adicionada!');
    editingMetaId = null;
  } catch(e) { showToast('Erro ao salvar.','err'); }
}

async function delMeta(id) {
  await fbRemove('metas/'+id);
  showToast('Meta removida.');
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
  if (!forn||!prod||!qtd||!val||!data) { showToast('Preencha todos os campos','err'); return; }
  try {
    await fbPush('bebidas', { fornecedor:forn, produto:prod, qtd:qtd, valor:val, data:data });
    closeModal('modal-bev');
    ['b-forn','b-prod','b-qtd','b-val'].forEach(function(id){ document.getElementById(id).value=''; });
    showToast('Compra registrada!');
  } catch(e) { showToast('Erro ao salvar.','err'); }
}
async function delBebida(id) { await fbRemove('bebidas/'+id); showToast('Registro removido.'); }

function abrirBevVendaModal() {
  var select = document.getElementById('bv-prod');
  if (!select) return;
  var prods = Array.from(new Set(bebidas.map(function(b){ return b.produto; })));
  if (!prods.length) {
    showToast('Registre alguma compra de bebida primeiro!', 'err');
    return;
  }
  select.innerHTML = prods.map(function(p){ return '<option value="' + p + '">' + p + '</option>'; }).join('');
  document.getElementById('bv-qtd').value = '1';
  document.getElementById('bv-val').value = '';
  document.getElementById('bv-data').value = hoje();
  sugerirPrecoVenda();
  openModal('modal-bev-venda');
}

function sugerirPrecoVenda() {
  var prod = document.getElementById('bv-prod').value;
  if (!prod) return;
  var comprasProd = bebidas.filter(function(b){ return b.produto === prod; });
  var totalVal = comprasProd.reduce(function(s,b){ return s+b.valor; }, 0);
  var totalQtd = comprasProd.reduce(function(s,b){ return s+b.qtd; }, 0);
  var custoUni = totalQtd > 0 ? (totalVal / totalQtd) : 0;
  var precoSug = Math.ceil(custoUni * 2);
  var qtd = parseInt(document.getElementById('bv-qtd').value)||1;
  document.getElementById('bv-val').value = (precoSug * qtd).toFixed(2);
}

function calcVendaTotalPreview() {
  var prod = document.getElementById('bv-prod').value;
  var qtd = parseInt(document.getElementById('bv-qtd').value)||1;
  var comprasProd = bebidas.filter(function(b){ return b.produto === prod; });
  var totalVal = comprasProd.reduce(function(s,b){ return s+b.valor; }, 0);
  var totalQtd = comprasProd.reduce(function(s,b){ return s+b.qtd; }, 0);
  var custoUni = totalQtd > 0 ? (totalVal / totalQtd) : 0;
  var precoSug = Math.ceil(custoUni * 2);
  document.getElementById('bv-val').value = (precoSug * qtd).toFixed(2);
}

async function salvarVendaBebida() {
  var prod = document.getElementById('bv-prod').value;
  var qtd  = parseInt(document.getElementById('bv-qtd').value);
  var val  = parseFloat(document.getElementById('bv-val').value);
  var data = document.getElementById('bv-data').value;
  if (!prod||!qtd||!val||!data) { showToast('Preencha todos os campos','err'); return; }
  
  var comprasProd = bebidas.filter(function(b){ return b.produto === prod; });
  var totalComprado = comprasProd.reduce(function(s,b){ return s+b.qtd; }, 0);
  var vendasProd = bebidasVendas.filter(function(v){ return v.produto === prod; });
  var totalVendido = vendasProd.reduce(function(s,v){ return s+v.qtd; }, 0);
  var estoqueAtual = totalComprado - totalVendido;
  
  if (qtd > estoqueAtual) {
    showToast('Estoque insuficiente! Saldo atual: ' + estoqueAtual + ' un.', 'err');
    return;
  }
  
  try {
    await fbPush('bebidas_vendas', { produto:prod, qtd:qtd, valor:val, data:data });
    closeModal('modal-bev-venda');
    showToast('Venda de bebida registrada!');
  } catch(e) { showToast('Erro ao salvar venda.','err'); }
}

async function delVendaBebida(id) {
  await fbRemove('bebidas_vendas/'+id);
  showToast('Venda de bebida removida.');
}

// ============================================================
// CRUD: FATURAMENTO DIÁRIO
// ============================================================
function abrirFatDiarioModal() {
  document.getElementById('fd-val').value = '';
  document.getElementById('fd-atend').value = '';
  document.getElementById('fd-data').value = hoje();
  openModal('modal-fat-diario');
}

async function salvarFatDiario() {
  var val = parseFloat(document.getElementById('fd-val').value);
  var atend = parseInt(document.getElementById('fd-atend').value);
  var data = document.getElementById('fd-data').value;
  if (!val || val <= 0 || !atend || atend <= 0 || !data) {
    showToast('Preencha data, valor e atendimentos válidos', 'err');
    return;
  }
  try {
    await fbPush('faturamento_diario', { valor: val, atendimentos: atend, data: data });
    closeModal('modal-fat-diario');
    showToast('Faturamento diário registrado!');
  } catch(e) {
    showToast('Erro ao salvar faturamento.', 'err');
  }
}

async function delFatDiario(id) {
  try {
    await fbRemove('faturamento_diario/' + id);
    showToast('Lançamento removido.');
  } catch(e) {
    showToast('Erro ao remover.', 'err');
  }
}

// ============================================================
// UI: SELETORES
// ============================================================
function selCat(i) {
  catSel = i;
  document.querySelectorAll('#cat-grid-lanc .cat-btn').forEach(function(b,j){ b.classList.toggle('active',j===i); });
}
function selPag(v, btn) {
  pagSel = v;
  document.querySelectorAll('.pag-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}
function selAviso(v, btn) {
  document.getElementById('v-aviso').value = v;
  document.querySelectorAll('.aviso-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}
function selMetaTipo(v, btn) {
  document.getElementById('mi-tipo').value = v;
  document.querySelectorAll('.tipo-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}
function selMetaFmt(v, btn) {
  document.getElementById('mi-fmt').value = v;
  document.querySelectorAll('.fmt-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}
function selDepTipo(v, btn) {
  document.getElementById('d-tipo').value = v;
  document.querySelectorAll('.dep-tipo-btn').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  var titulo   = document.getElementById('dep-titulo');
  var btnSalv  = document.getElementById('dep-btn-salvar');
  if (titulo)  titulo.textContent = v === 'saida' ? 'Registrar saída' : 'Registrar entrada';
  if (btnSalv) btnSalv.innerHTML  = v === 'saida'
    ? '<i class="ti ti-arrow-up-circle"></i> Confirmar saída'
    : '<i class="ti ti-piggy-bank"></i> Confirmar entrada';
}
function selDepEditTipo(v, btn) {
  document.getElementById('de-tipo').value = v;
  document.querySelectorAll('.dep-edit-tipo-btn').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
}
function abrirDepModal() {
  selDepTipo('entrada', document.querySelector('.dep-tipo-btn[data-tipo="entrada"]'));
  document.getElementById('d-val').value  = '';
  document.getElementById('d-obs').value  = '';
  document.getElementById('d-data').value = hoje();
  openModal('modal-dep');
}

function initCatGrid() {
  var grid = document.getElementById('cat-grid-lanc');
  if (!grid) return;
  grid.innerHTML = CATS.map(function(c,i){
    return '<button class="cat-btn '+(i===0?'active':'')+'" onclick="selCat('+i+')"><i class="ti '+c.icon+'" style="color:'+c.cor+'"></i>'+c.nome+'</button>';
  }).join('');
}

// ============================================================
// EXPORTAR RELATÓRIO DO MÊS (PDF via impressão)
// ============================================================
function exportarFechamento() {
  var isCurrent = histIdx === -1;
  var mesAt = getMesAtual();
  var dados = isCurrent ? (HIST.length ? HIST[HIST.length-1] : null) : HIST[histIdx];

  // Mês de referência para filtrar saídas/vencimentos
  var mesKey = isCurrent ? mesAt.m : (dados ? dados.m : mesAt.m);
  var mesLabel, ano;
  if (dados) { mesLabel = dados.label; ano = dados.m.slice(0,4); }
  else { mesLabel = mesAt.label; ano = String(mesAt.ano); }

  // Comparativo com mês anterior
  var idxRef = dados ? HIST.findIndex(function(h){ return h.m===dados.m; }) : -1;
  var prev = (idxRef > 0) ? HIST[idxRef-1] : null;

  // Saídas do mês
  var lancs = lancamentos.filter(function(l){ return l.data && l.data.indexOf(mesKey)===0; });
  var totalSaidas = lancs.reduce(function(s,l){ return s+l.valor; }, 0);
  var porCat = {};
  lancs.forEach(function(l){ var k=l.categoria||'Outro'; porCat[k]=(porCat[k]||0)+l.valor; });
  var catRows = Object.entries(porCat).sort(function(a,b){ return b[1]-a[1]; }).map(function(e){
    var pct = totalSaidas>0?Math.round((e[1]/totalSaidas)*100):0;
    return '<tr><td>'+e[0]+'</td><td class="r">'+brl(e[1])+'</td><td class="r">'+pct+'%</td></tr>';
  }).join('');

  // Vencimentos
  var totalVenc = VENCIMENTOS_FB.reduce(function(s,v){ return s+v.valor; }, 0);
  var vencRows = VENCIMENTOS_FB.slice().sort(function(a,b){ return a.dia-b.dia; }).map(function(v){
    var pago = vencPago(v, mesKey);
    return '<tr><td>'+v.nome+'</td><td>'+tipoLabel(v)+'</td><td class="r">'+brl(v.valor)+'</td><td class="r">'+(pago?'✓ pago':'—')+'</td></tr>';
  }).join('');

  var fat = dados ? dados.fat : 0;
  var atend = dados ? dados.atend : 0;
  var ticket = dados ? dados.ticket : 0;
  var resultado = fat - totalSaidas;

  var comparFat = '';
  if (prev) {
    var dif = fat - prev.fat;
    var difPct = Math.round((dif/prev.fat)*100);
    comparFat = '<span style="color:'+(dif>=0?'#2e7d4f':'#c0392b')+'">'+(dif>=0?'▲':'▼')+' '+Math.abs(difPct)+'% vs. '+prev.label+' ('+brl(prev.fat)+')</span>';
  }

  var pctRes = reserva.metaTotal ? Math.round((reserva.valor/reserva.metaTotal)*100) : 0;
  var hojeStr = new Date().toLocaleDateString('pt-BR');

  var doc = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">' +
    '<title>Fechamento '+mesLabel+'/'+ano+' — Heloísa Mazzi</title>' +
    '<style>' +
    '*{margin:0;padding:0;box-sizing:border-box}' +
    'body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1a1a;padding:32px;max-width:800px;margin:0 auto;font-size:13px}' +
    'h1{font-size:22px;color:#1e3a5f;margin-bottom:2px}' +
    '.sub{color:#666;font-size:12px;margin-bottom:20px}' +
    '.mes{display:inline-block;background:#1e3a5f;color:#fff;padding:4px 14px;border-radius:6px;font-weight:600;font-size:14px;margin-bottom:20px}' +
    '.kpis{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}' +
    '.kpi{flex:1;min-width:130px;border:1px solid #e0e0e0;border-radius:8px;padding:12px 14px}' +
    '.kpi .lbl{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px}' +
    '.kpi .val{font-size:20px;font-weight:700;color:#1e3a5f;margin-top:4px}' +
    '.kpi .cmp{font-size:11px;margin-top:3px}' +
    'h2{font-size:14px;color:#1e3a5f;margin:22px 0 8px;padding-bottom:5px;border-bottom:2px solid #1e3a5f}' +
    'table{width:100%;border-collapse:collapse;font-size:12px}' +
    'th{text-align:left;color:#888;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:6px 8px;border-bottom:1px solid #ddd}' +
    'td{padding:6px 8px;border-bottom:1px solid #f0f0f0}' +
    'td.r,th.r{text-align:right}' +
    '.tot{font-weight:700;color:#1e3a5f}' +
    '.result{background:#f5f8fc;border:1px solid #d5e2f0;border-radius:8px;padding:14px 16px;margin-top:10px;display:flex;justify-content:space-between;align-items:center}' +
    '.result .big{font-size:22px;font-weight:700}' +
    '.foot{margin-top:32px;padding-top:14px;border-top:1px solid #eee;color:#aaa;font-size:10px;text-align:center}' +
    '@media print{body{padding:0}.noprint{display:none}}' +
    '.noprint{margin-bottom:20px;text-align:center}' +
    '.noprint button{background:#1e3a5f;color:#fff;border:0;padding:10px 24px;border-radius:8px;font-size:14px;cursor:pointer}' +
    '</style></head><body>' +
    '<div class="noprint"><button onclick="window.print()">🖨️ Salvar como PDF / Imprimir</button></div>' +
    '<h1>✂️ Heloísa Mazzi Barbearia</h1>' +
    '<div class="sub">Relatório de fechamento mensal · gerado em '+hojeStr+'</div>' +
    '<div class="mes">'+mesLabel+' / '+ano+'</div>' +
    '<div class="kpis">' +
      '<div class="kpi"><div class="lbl">Faturamento</div><div class="val">'+brl(fat)+'</div><div class="cmp">'+comparFat+'</div></div>' +
      '<div class="kpi"><div class="lbl">Atendimentos</div><div class="val">'+atend+'</div></div>' +
      '<div class="kpi"><div class="lbl">Ticket médio</div><div class="val">'+brl(ticket)+'</div></div>' +
    '</div>' +
    '<h2>Saídas por categoria</h2>' +
    (catRows ? '<table><thead><tr><th>Categoria</th><th class="r">Valor</th><th class="r">%</th></tr></thead><tbody>'+catRows+
      '<tr class="tot"><td>Total de saídas</td><td class="r">'+brl(totalSaidas)+'</td><td class="r">100%</td></tr></tbody></table>'
      : '<p style="color:#999">Nenhuma saída lançada neste mês.</p>') +
    '<h2>Vencimentos / Contas do mês</h2>' +
    (vencRows ? '<table><thead><tr><th>Conta</th><th>Tipo</th><th class="r">Valor</th><th class="r">Status</th></tr></thead><tbody>'+vencRows+
      '<tr class="tot"><td colspan="2">Total comprometido</td><td class="r">'+brl(totalVenc)+'</td><td></td></tr></tbody></table>'
      : '<p style="color:#999">Nenhum vencimento cadastrado.</p>') +
    '<h2>Reserva de emergência</h2>' +
    '<table><tbody>' +
      '<tr><td>Saldo atual</td><td class="r tot">'+brl(reserva.valor)+'</td></tr>' +
      '<tr><td>Meta total</td><td class="r">'+brl(reserva.metaTotal)+'</td></tr>' +
      '<tr><td>Progresso</td><td class="r">'+pctRes+'%</td></tr>' +
    '</tbody></table>' +
    '<h2>Resultado do mês</h2>' +
    '<div class="result"><div><div style="font-size:11px;color:#888;text-transform:uppercase">Faturamento − Saídas</div>' +
      '<div style="font-size:11px;color:#aaa;margin-top:2px">'+brl(fat)+' − '+brl(totalSaidas)+'</div></div>' +
      '<div class="big" style="color:'+(resultado>=0?'#2e7d4f':'#c0392b')+'">'+brl(resultado)+'</div></div>' +
    '<div class="foot">Heloísa Mazzi Barbearia · Rua Ambrósio dos Santos, 749 · Gerado pelo app de gestão financeira</div>' +
    '</body></html>';

  var w = window.open('', '_blank');
  if (!w) { showToast('Libere pop-ups para exportar o relatório.','err'); return; }
  w.document.open();
  w.document.write(doc);
  w.document.close();
  showToast('Relatório de ' + mesLabel + ' gerado!');
}

// ============================================================
// PIN LOCK SCREEN SECURITY SYSTEM
// ============================================================
let typedPin = '';
let isLocked = false;

function iniciarPinCheck() {
  var pin = localStorage.getItem('heloisa_mazzi_pin');
  if (pin) {
    bloquearApp();
  } else {
    var btn = document.getElementById('btn-pin-lock');
    if (btn) btn.querySelector('i').className = 'ti ti-lock-open';
  }
}

function bloquearApp() {
  var pin = localStorage.getItem('heloisa_mazzi_pin');
  if (!pin) return; // Só bloqueia se houver PIN configurado
  isLocked = true;
  typedPin = '';
  atualizarPinDots();
  var msg = document.getElementById('pin-screen-msg');
  if (msg) {
    msg.textContent = 'Insira seu PIN de segurança';
    msg.style.color = 'var(--text2)';
  }
  var screen = document.getElementById('pin-lock-screen');
  if (screen) screen.style.display = 'flex';
  
  var appEl = document.getElementById('app');
  if (appEl) appEl.style.filter = 'blur(10px)';
  
  var btn = document.getElementById('btn-pin-lock');
  if (btn) btn.querySelector('i').className = 'ti ti-lock';
}

function desbloquearApp() {
  isLocked = false;
  typedPin = '';
  var screen = document.getElementById('pin-lock-screen');
  if (screen) screen.style.display = 'none';
  
  var appEl = document.getElementById('app');
  if (appEl) appEl.style.filter = 'none';
  
  var btn = document.getElementById('btn-pin-lock');
  if (btn) btn.querySelector('i').className = 'ti ti-lock-open';
}

function pressPinKey(k) {
  if (!isLocked) return;
  if (k === 'back') {
    if (typedPin.length > 0) typedPin = typedPin.slice(0, -1);
  } else {
    if (typedPin.length < 4) typedPin += k;
  }
  atualizarPinDots();

  if (typedPin.length === 4) {
    var pinSalvo = localStorage.getItem('heloisa_mazzi_pin');
    if (typedPin === pinSalvo) {
      desbloquearApp();
    } else {
      typedPin = '';
      setTimeout(function() {
        atualizarPinDots();
        var msg = document.getElementById('pin-screen-msg');
        if (msg) {
          msg.textContent = 'PIN incorreto! Tente novamente.';
          msg.style.color = 'var(--red)';
        }
      }, 150);
    }
  }
}

function atualizarPinDots() {
  var dots = document.querySelectorAll('.pin-dot');
  dots.forEach(function(dot, i) {
    dot.classList.toggle('active', i < typedPin.length);
  });
}

function abrirConfiguracaoPin() {
  var pin = localStorage.getItem('heloisa_mazzi_pin');
  if (pin) {
    document.getElementById('pin-setup-create').style.display = 'none';
    document.getElementById('pin-setup-remove').style.display = 'block';
    document.getElementById('p-curr-pin').value = '';
  } else {
    document.getElementById('pin-setup-create').style.display = 'block';
    document.getElementById('pin-setup-remove').style.display = 'none';
    document.getElementById('p-new-pin').value = '';
    document.getElementById('p-new-pin-conf').value = '';
  }
  openModal('modal-pin-setup');
}

async function salvarNovoPin() {
  var pin1 = document.getElementById('p-new-pin').value.trim();
  var pin2 = document.getElementById('p-new-pin-conf').value.trim();

  if (pin1.length !== 4 || isNaN(pin1)) {
    showToast('O PIN deve conter exatamente 4 números.', 'err');
    return;
  }
  if (pin1 !== pin2) {
    showToast('Os PINs digitados não são iguais.', 'err');
    return;
  }

  localStorage.setItem('heloisa_mazzi_pin', pin1);
  closeModal('modal-pin-setup');
  showToast('PIN de segurança ativado!');
  var btn = document.getElementById('btn-pin-lock');
  if (btn) btn.querySelector('i').className = 'ti ti-lock-open';
}

async function removerPin() {
  var pinDigitado = document.getElementById('p-curr-pin').value.trim();
  var pinSalvo = localStorage.getItem('heloisa_mazzi_pin');

  if (pinDigitado !== pinSalvo) {
    showToast('PIN incorreto.', 'err');
    return;
  }

  localStorage.removeItem('heloisa_mazzi_pin');
  closeModal('modal-pin-setup');
  showToast('PIN desativado!');
  var btn = document.getElementById('btn-pin-lock');
  if (btn) btn.querySelector('i').className = 'ti ti-lock-open';
}

document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    var pin = localStorage.getItem('heloisa_mazzi_pin');
    if (pin) bloquearApp();
  }
});

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', async function() {
  await registrarSW();
  setTimeout(async function() {
    document.getElementById('loading-screen').style.display = 'none';
    iniciarPinCheck();
    document.getElementById('main').style.display = 'block';
    initCatGrid();
    var h = hoje();
    ['l-data','d-data','b-data','bv-data','fd-data'].forEach(function(id){
      var el = document.getElementById(id); if (el) el.value = h;
    });
    initHistorico();
    initVencimentos();
    initReserva();
    initMetas();
    loadFirebase();
    renderPainel();
    setTimeout(solicitarPermissao, 3000);
    setInterval(agendarNotificacoes, 3600000);
  }, 900);
});
