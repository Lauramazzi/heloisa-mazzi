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

const HIST = [
  { m:'2026-01', label:'Jan', fat:7224.90,  atend:154, ticket:46.91 },
  { m:'2026-02', label:'Fev', fat:8299.90,  atend:185, ticket:44.86 },
  { m:'2026-03', label:'Mar', fat:9050.00,  atend:194, ticket:46.65 },
  { m:'2026-04', label:'Abr', fat:9060.50,  atend:198, ticket:45.76 },
  { m:'2026-05', label:'Mai', fat:11309.50, atend:242, ticket:46.73 },
  { m:'2026-06', label:'Jun', fat:10638.00, atend:234, ticket:45.46 },
];

const VENCIMENTOS = [
  { nome:'App Barber',       valor:109.90, dia:2,  tipo:'Fixo' },
  { nome:'Ar condicionado',  valor:213.00, dia:3,  tipo:'Parcela 3/10' },
  { nome:'Laura',            valor:320.00, dia:10, tipo:'Fixo' },
  { nome:'MEI',              valor:390.00, dia:25, tipo:'Fixo (recorrente)' },
  { nome:'Papo de Barbeira', valor:99.00,  dia:30, tipo:'Parcela 3/3', encerra:true },
];

const CATS = [
  { nome:'Barbearia', icon:'ti-tool',         cor:'#85B7EB', bg:'rgba(55,138,221,0.15)'  },
  { nome:'Marketing', icon:'ti-speakerphone', cor:'#e05555', bg:'rgba(224,85,85,0.15)'   },
  { nome:'Produtos',  icon:'ti-package',      cor:'#e8a642', bg:'rgba(232,166,66,0.15)'  },
  { nome:'Bebidas',   icon:'ti-beer',         cor:'#AFA9EC', bg:'rgba(127,119,221,0.15)' },
  { nome:'Contas',    icon:'ti-file-invoice', cor:'#4caf7d', bg:'rgba(76,175,125,0.15)'  },
  { nome:'Pessoal',   icon:'ti-heart',        cor:'#D4537E', bg:'rgba(212,83,126,0.15)'  },
];

let currentTab = 'painel';
let catSel = 0;
let pagSel = 'Pix';
let lancamentos = [];
let reserva = { valor:7199, meta:1000, metaTotal:11742, historico:[] };
let bebidas = [];
let metas = { fat:9000, desp:8500, atend:220, ticket:46, reserva:1000, prod:10 };

function brl(v) {
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function hoje() { return new Date().toISOString().split('T')[0]; }
function dataFmt(d) { return d ? d.split('-').reverse().join('/') : ''; }

function showToast(msg, tipo='ok') {
  const t = document.getElementById('toast');
  t.innerHTML = msg;
  t.className = 'toast show toast-' + tipo;
  setTimeout(() => t.classList.remove('show'), 2500);
}

function openModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.style.display = 'flex';
  requestAnimationFrame(() => m.classList.add('open'));
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.remove('open');
  setTimeout(() => { m.style.display = 'none'; }, 280);
}

function closeIfBg(e, id) {
  if (e.target === e.currentTarget) closeModal(id);
}

function loadFirebase() {
  db.ref('lancamentos').on('value', snap => {
    lancamentos = snap.val() ? Object.values(snap.val()) : [];
    if (currentTab === 'junho')  renderJunho();
    if (currentTab === 'painel') renderPainel();
  });
  db.ref('reserva').on('value', snap => {
    if (snap.val()) reserva = Object.assign({}, reserva, snap.val());
    if (currentTab === 'reserva') renderReserva();
    if (currentTab === 'painel')  renderPainel();
  });
  db.ref('bebidas').on('value', snap => {
    bebidas = snap.val() ? Object.values(snap.val()) : [];
    if (currentTab === 'bebidas') renderBebidas();
  });
  db.ref('metas').on('value', snap => {
    if (snap.val()) metas = Object.assign({}, metas, snap.val());
    if (currentTab === 'metas') renderMetas();
  });
}

async function fbPush(path, data) {
  const ref = db.ref(path).push();
  await ref.set(Object.assign({}, data, { id: ref.key }));
  return ref.key;
}
async function fbSet(path, data)   { return db.ref(path).set(data); }
async function fbRemove(path)      { return db.ref(path).remove(); }

function switchTab(id, btn) {
  currentTab = id;
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
  var renders = { painel:renderPainel, junho:renderJunho, alertas:renderAlertas, reserva:renderReserva, metas:renderMetas, bebidas:renderBebidas };
  if (renders[id]) renders[id]();
}

function renderPainel() {
  var lancJul = lancamentos.filter(function(l){ return l.data && l.data.indexOf('2026-07')===0; });
  var totalJul = lancJul.reduce(function(s,l){ return s+l.valor; }, 0);
  var pctRes = Math.round((reserva.valor / reserva.metaTotal) * 100);
  var junHist = HIST[5]; // junho
  var maiHist = HIST[4]; // maio (recorde)

  var maxFat = Math.max.apply(null, HIST.map(function(h){ return h.fat; }));
  var barras = HIST.map(function(h,i){
    var pct = Math.round((h.fat/maxFat)*100);
    var ativo = i === HIST.length - 1; // último mês (junho)
    return '<div class="bar-col"><div class="bar-fill" style="height:'+pct+'%;background:'+(ativo?'var(--gold)':'var(--bg3)')+';border:0.5px solid '+(ativo?'var(--gold)':'var(--border2)')+'"></div><div class="bar-label">'+h.label+'</div></div>';
  }).join('');

  var diffAtend = junHist.atend - maiHist.atend; // -8
  var diffAtendTxt = (diffAtend >= 0 ? '+' : '') + diffAtend + ' vs. maio';
  var diffAtendCor = diffAtend >= 0 ? 'var(--green)' : 'var(--red)';

  document.getElementById('sec-painel').innerHTML =
    '<div class="metrics">' +
      '<div class="mcard"><div class="mcard-label">Faturamento jun</div><div class="mcard-val val-green">'+brl(junHist.fat)+'</div><div class="mcard-sub">2º melhor do ano</div></div>' +
      '<div class="mcard"><div class="mcard-label">Atendimentos jun</div><div class="mcard-val">'+junHist.atend+'</div><div class="mcard-sub" style="color:'+diffAtendCor+'">'+diffAtendTxt+'</div></div>' +
      '<div class="mcard"><div class="mcard-label">Ticket médio jun</div><div class="mcard-val">'+brl(junHist.ticket)+'</div><div class="mcard-sub">jun/2026</div></div>' +
      '<div class="mcard"><div class="mcard-label">Saídas julho</div><div class="mcard-val '+(totalJul>0?'val-red':'')+'">'+( totalJul>0?brl(totalJul):'—')+'</div><div class="mcard-sub">'+lancJul.length+' lançamentos</div></div>' +
    '</div>' +
    '<div class="card"><div class="card-title">Faturamento jan–jun/2026</div><div class="bar-chart">'+barras+'</div>' +
    '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-top:6px"><span>R$ 7.224 em jan</span><span style="color:var(--gold)">R$ 11.309 em mai ★ recorde</span></div></div>' +
    '<div class="card"><div class="card-title">Reserva financeira</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">' +
        '<div><div style="font-size:11px;color:var(--text2);margin-bottom:2px">Cofrinho Mercado Pago</div><div style="font-size:26px;font-weight:600;color:var(--green);font-family:var(--mono)">'+brl(reserva.valor)+'</div></div>' +
        '<div style="text-align:right"><div style="font-size:10px;color:var(--text2)">meta/mês</div><div style="font-size:15px;font-weight:500;color:var(--gold)">R$ 1.000</div></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:4px"><span>'+pctRes+'% da meta</span><span>meta: '+brl(reserva.metaTotal)+'</span></div>' +
      '<div class="prog-wrap" style="height:7px"><div class="prog-bar" style="width:'+pctRes+'%;background:var(--green)"></div></div>' +
    '</div>' +
    '<div class="card"><div class="card-title">Insights</div>' +
      '<div class="insight-item"><i class="ti ti-trending-up" style="color:var(--green)"></i><span><strong>+47% jan→jun.</strong> 6 meses de histórico. Faturamento 2º melhor do ano.</span></div>' +
      '<div class="insight-item"><i class="ti ti-confetti" style="color:var(--gold)"></i><span><strong>MEI e Mesinha encerraram!</strong> R$ 453,93/mês livres a partir de julho.</span></div>' +
      '<div class="insight-item"><i class="ti ti-scissors" style="color:var(--amber)"></i><span><strong>Corte de Cabelo:</strong> 121 em junho (52% dos atend.). Principal motor de receita.</span></div>' +
      '<div class="insight-item"><i class="ti ti-package" style="color:var(--amber)"></i><span><strong>Papo de Barbeira encerra em julho!</strong> Última parcela (R$99) — R$ 552/mês liberados.</span></div>' +
    '</div>';
}

function renderJunho() {
  var julLancs = lancamentos.filter(function(l){ return l.data && l.data.indexOf('2026-07')===0; }).sort(function(a,b){ return b.data.localeCompare(a.data); });
  var total = julLancs.reduce(function(s,l){ return s+l.valor; },0);
  var barb  = julLancs.filter(function(l){ return l.conta==='Barbearia'; }).reduce(function(s,l){ return s+l.valor; },0);
  var pes   = julLancs.filter(function(l){ return l.conta==='Pessoal'; }).reduce(function(s,l){ return s+l.valor; },0);

  var lista = julLancs.length
    ? julLancs.map(function(l){
        var cat = CATS.filter(function(c){ return c.nome===l.categoria; })[0] || CATS[0];
        return '<div class="list-item">' +
          '<div class="list-icon" style="background:'+cat.bg+'"><i class="ti '+cat.icon+'" style="color:'+cat.cor+'"></i></div>' +
          '<div class="list-info"><div class="list-name">'+l.desc+'</div><div class="list-meta">'+dataFmt(l.data)+' · '+l.categoria+(l.pagamento?' · '+l.pagamento:'')+(l.obs?' · '+l.obs:'')+' </div></div>' +
          '<div class="list-val" style="color:var(--red)">'+brl(l.valor)+'</div>' +
          '<button class="del-btn" onclick="delLanc(\''+l.id+'\')" ><i class="ti ti-trash"></i></button>' +
        '</div>';
      }).join('')
    : '<div class="empty"><i class="ti ti-inbox"></i><br>Nenhuma saída lançada ainda.</div>';

  document.getElementById('sec-junho').innerHTML =
    '<div class="sec-header"><div class="sec-title">Julho / 2026</div><button class="btn-add" onclick="openModal(\'modal-lanc\')"><i class="ti ti-plus"></i> Nova saída</button></div>' +
    '<div class="metrics">' +
      '<div class="mcard"><div class="mcard-label">Total saídas</div><div class="mcard-val val-red">'+brl(total)+'</div><div class="mcard-sub">'+julLancs.length+' lançamentos</div></div>' +
      '<div class="mcard"><div class="mcard-label">Barbearia</div><div class="mcard-val val-amber">'+brl(barb)+'</div><div class="mcard-sub">Pessoal: '+brl(pes)+'</div></div>' +
    '</div>' +
    '<div class="card"><div class="card-title">Lançamentos</div>'+lista+'</div>';
}

function selCat(i, btn) {
  catSel = i;
  document.querySelectorAll('#cat-grid-lanc .cat-btn').forEach(function(b,j){ b.classList.toggle('active', j===i); });
}
function selPag(v, btn) {
  pagSel = v;
  document.querySelectorAll('.pag-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
}

async function salvarLanc() {
  var desc = document.getElementById('l-desc').value.trim();
  var val  = parseFloat(document.getElementById('l-val').value);
  var data = document.getElementById('l-data').value;
  if (!desc || !val || !data) { showToast('Preencha todos os campos obrigatórios', 'err'); return; }
  var cat = CATS[catSel];
  try {
    await fbPush('lancamentos', {
      desc:desc, valor:val, data:data,
      categoria: cat.nome,
      conta: cat.nome==='Pessoal'?'Pessoal':'Barbearia',
      pagamento: pagSel,
      obs: document.getElementById('l-obs').value.trim(),
    });
    closeModal('modal-lanc');
    ['l-desc','l-val','l-obs'].forEach(function(id){ document.getElementById(id).value=''; });
    document.getElementById('l-data').value = hoje();
    showToast('Saída registrada!');
  } catch(e) { console.error(e); showToast('Erro ao salvar.','err'); }
}

async function delLanc(id) {
  await fbRemove('lancamentos/'+id);
  showToast('Lançamento removido.');
}

function renderAlertas() {
  var agora = new Date();
  var vencComDiff = VENCIMENTOS.map(function(v){
    var vd = new Date(2026,6,v.dia); // mês 6 = julho (0-indexed)
    var diff = Math.round((vd-agora)/86400000);
    return Object.assign({},v,{diff:diff});
  }).sort(function(a,b){ return a.diff-b.diff; });

  var urgentes = vencComDiff.filter(function(v){ return v.diff>=0&&v.diff<=3; });
  var proximos = vencComDiff.filter(function(v){ return v.diff>3&&v.diff<=10; });
  var html = '';

  if (urgentes.length) {
    html += '<div class="card"><div class="card-title" style="color:var(--red)">⚠ Atenção imediata</div>';
    urgentes.forEach(function(v){
      var label = v.diff===0?'Vence hoje!':v.diff===1?'Amanhã':'Em '+v.diff+' dias';
      html += '<div class="alert alert-red"><i class="ti ti-bell"></i><div><div class="alert-title">'+v.nome+(v.encerra?' <span class="pill pill-green">último mês</span>':'')+' </div><div class="alert-sub">'+label+' · '+v.tipo+' · '+brl(v.valor)+'</div></div></div>';
    });
    html += '</div>';
  }
  if (proximos.length) {
    html += '<div class="card"><div class="card-title">Próximos 10 dias</div>';
    proximos.forEach(function(v){
      html += '<div class="alert alert-amber"><i class="ti ti-clock"></i><div><div class="alert-title">'+v.nome+(v.encerra?' <span class="pill pill-green">último mês</span>':'')+' </div><div class="alert-sub">Em '+v.diff+' dias · dia '+v.dia+' · '+brl(v.valor)+'</div></div></div>';
    });
    html += '</div>';
  }
  html += '<div class="card"><div class="card-title">Calendário de julho</div>';
  vencComDiff.forEach(function(v){
    var passado = v.diff<0;
    var corDot = passado?'var(--text3)':v.diff<=3?'var(--red)':v.diff<=10?'var(--amber)':'var(--green)';
    html += '<div class="row" style="'+(passado?'opacity:0.4':'')+'">'+
      '<div class="dot" style="background:'+corDot+';width:8px;height:8px;flex-shrink:0"></div>' +
      '<div class="row-label"><div>'+v.nome+(v.encerra?' ★':'')+'</div><div class="row-sub">dia '+v.dia+' · '+v.tipo+'</div></div>' +
      '<div class="row-val">'+brl(v.valor)+'</div></div>';
  });
  html += '</div>';
  html += '<div class="alert alert-green"><i class="ti ti-confetti"></i><div><div class="alert-title">Papo de Barbeira encerra em julho!</div><div class="alert-sub">Última parcela R$99. A partir de agosto: R$ 552,93/mês liberados no caixa.</div></div></div>';
  document.getElementById('sec-alertas').innerHTML = html;
}

function renderReserva() {
  var pct    = Math.round((reserva.valor/reserva.metaTotal)*100);
  var faltam = Math.max(0, reserva.metaTotal-reserva.valor);
  var hist   = (reserva.historico||[]).slice().sort(function(a,b){ return b.data.localeCompare(a.data); });

  var histHtml = hist.length ? hist.map(function(d){
    return '<div class="list-item">' +
      '<div class="list-icon" style="background:rgba(76,175,125,0.15)"><i class="ti ti-piggy-bank" style="color:var(--green)"></i></div>' +
      '<div class="list-info"><div class="list-name">'+(d.obs||'Depósito')+'</div><div class="list-meta">'+dataFmt(d.data)+'</div></div>' +
      '<div class="list-val" style="color:var(--green)">'+brl(d.valor)+'</div>' +
      (d.id!=='mai-dep'?'<button class="del-btn" onclick="delDeposito(\''+d.id+'\')"><i class="ti ti-trash"></i></button>':'') +
    '</div>';
  }).join('') : '<div class="empty"><i class="ti ti-piggy-bank"></i><br>Nenhum depósito ainda.</div>';

  var projHtml = ['Jun','Jul','Ago','Set','Out','Nov','Dez'].map(function(m,i){
    var v = Math.min(reserva.metaTotal, reserva.valor+(i+1)*1000);
    var p = Math.round((v/reserva.metaTotal)*100);
    var done = p>=100;
    return '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px">' +
      '<span style="min-width:28px;color:var(--text2)">'+m+'</span>' +
      '<div class="prog-wrap" style="flex:1"><div class="prog-bar" style="width:'+p+'%;background:'+(done?'var(--gold)':'var(--green)')+'"></div></div>' +
      '<span style="min-width:60px;text-align:right;'+(done?'color:var(--gold);font-weight:500':'color:var(--text2)')+'">'+brl(v)+(done?' ✓':'')+'</span>' +
    '</div>';
  }).join('');

  document.getElementById('sec-reserva').innerHTML =
    '<div class="reserva-big">' +
      '<div class="reserva-val">'+brl(reserva.valor)+'</div>' +
      '<div class="reserva-label">Cofrinho Mercado Pago</div>' +
      '<div style="margin-top:12px">' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,0.4);margin-bottom:4px"><span>'+pct+'% da meta</span><span>meta: '+brl(reserva.metaTotal)+'</span></div>' +
        '<div class="prog-wrap" style="height:7px"><div class="prog-bar" style="width:'+pct+'%;background:var(--green)"></div></div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:6px">Faltam '+brl(faltam)+' · meta em dezembro/2026</div>' +
      '</div>' +
    '</div>' +
    '<button class="btn-primary" onclick="openModal(\'modal-dep\')" style="margin-bottom:16px"><i class="ti ti-piggy-bank"></i> Registrar depósito</button>' +
    '<div class="card"><div class="card-title">Histórico de depósitos</div>'+histHtml+'</div>' +
    '<div class="card"><div class="card-title">Projeção mensal</div>'+projHtml+'</div>';
}

async function salvarDeposito() {
  var val  = parseFloat(document.getElementById('d-val').value);
  var data = document.getElementById('d-data').value;
  var obs  = document.getElementById('d-obs').value.trim();
  if (!val||val<=0||!data) { showToast('Preencha valor e data','err'); return; }
  try {
    var dep = { id: Date.now().toString(), data:data, valor:val, obs:obs };
    var novoHist  = (reserva.historico||[]).concat([dep]);
    var novoValor = reserva.valor + val;
    await fbSet('reserva', Object.assign({},reserva,{valor:novoValor,historico:novoHist}));
    closeModal('modal-dep');
    ['d-val','d-obs'].forEach(function(id){ document.getElementById(id).value=''; });
    showToast('Depósito registrado!');
  } catch(e) { showToast('Erro ao salvar.','err'); }
}

async function delDeposito(id) {
  var dep = (reserva.historico||[]).filter(function(d){ return d.id===id; })[0];
  if (!dep) return;
  var novoHist  = reserva.historico.filter(function(d){ return d.id!==id; });
  var novoValor = reserva.valor - dep.valor;
  await fbSet('reserva', Object.assign({},reserva,{valor:novoValor,historico:novoHist}));
  showToast('Depósito removido.');
}

function renderMetas() {
  var jun = HIST[5]; // junho/2026
  var items = [
    { l:'Faturamento mínimo',    meta:metas.fat,     real:jun.fat,     fmt:function(v){ return 'R$'+Math.round(v).toLocaleString('pt-BR'); } },
    { l:'Limite de despesas',    meta:metas.desp,    real:3858.28,     fmt:function(v){ return 'R$'+Math.round(v).toLocaleString('pt-BR'); }, inv:true },
    { l:'Atendimentos/mês',      meta:metas.atend,   real:jun.atend,   fmt:function(v){ return v+' atend.'; } },
    { l:'Ticket médio mínimo',   meta:metas.ticket,  real:jun.ticket,  fmt:function(v){ return 'R$'+Number(v).toFixed(2); } },
    { l:'Depósito reserva/mês',  meta:metas.reserva, real:400,         fmt:function(v){ return 'R$'+Math.round(v).toLocaleString('pt-BR'); } },
    { l:'Participação produtos',  meta:metas.prod,    real:5.5,         fmt:function(v){ return v+'%'; } },
  ];
  var itensHtml = items.map(function(it){
    var pct = Math.min(100,Math.round((it.real/it.meta)*100));
    var ok  = it.inv?(it.real<=it.meta):(it.real>=it.meta);
    return '<div style="padding:10px 0;border-bottom:0.5px solid var(--border)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">' +
        '<span style="font-size:13px">'+it.l+'</span>' +
        '<span class="pill '+(ok?'pill-green':'pill-amber')+'">'+(ok?'✓ atingido':'em andamento')+'</span>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:3px">' +
        '<span>Realizado: <strong style="color:var(--text)">'+it.fmt(it.real)+'</strong></span>' +
        '<span>Meta: <strong style="color:var(--text)">'+it.fmt(it.meta)+'</strong></span>' +
      '</div>' +
      '<div class="prog-wrap"><div class="prog-bar" style="width:'+pct+'%;background:'+(ok?'var(--green)':'var(--amber)')+'"></div></div>' +
    '</div>';
  }).join('');

  document.getElementById('sec-metas').innerHTML =
    '<div class="sec-header"><div class="sec-title">Metas</div><button class="btn-add" onclick="openModal(\'modal-meta\')"><i class="ti ti-edit"></i> Editar</button></div>' +
    '<div class="card"><div class="card-title">Metas vs. junho/2026</div>'+itensHtml+'</div>';
}

async function salvarMetas() {
  var novo = {
    fat:    parseFloat(document.getElementById('m-fat').value)    ||metas.fat,
    desp:   parseFloat(document.getElementById('m-desp').value)   ||metas.desp,
    atend:  parseInt(document.getElementById('m-atend').value)    ||metas.atend,
    ticket: parseFloat(document.getElementById('m-ticket').value) ||metas.ticket,
    reserva:parseFloat(document.getElementById('m-reserva').value)||metas.reserva,
    prod:   parseFloat(document.getElementById('m-prod').value)   ||metas.prod,
  };
  await fbSet('metas', novo);
  closeModal('modal-meta');
  showToast('Metas atualizadas!');
}

function renderBebidas() {
  var total = bebidas.reduce(function(s,b){ return s+b.valor; },0);
  var qtd   = bebidas.reduce(function(s,b){ return s+b.qtd; },0);
  var rank  = {};
  bebidas.forEach(function(b){ rank[b.produto]=(rank[b.produto]||0)+b.qtd; });
  var rankArr = Object.entries(rank).sort(function(a,b){ return b[1]-a[1]; }).slice(0,5);
  var maxR = rankArr[0]?rankArr[0][1]:1;
  var sorted = bebidas.slice().sort(function(a,b){ return b.data.localeCompare(a.data); });

  var rankHtml = rankArr.length ? '<div class="card"><div class="card-title">Mais comprados</div>'+
    rankArr.map(function(entry){
      return '<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px"><span>'+entry[0]+'</span><span style="color:var(--text2)">'+entry[1]+' un.</span></div><div class="prog-wrap"><div class="prog-bar" style="width:'+Math.round(entry[1]/maxR*100)+'%;background:var(--gold)"></div></div></div>';
    }).join('')+'</div>' : '';

  var listaHtml = sorted.length ? sorted.map(function(b){
    return '<div class="list-item">' +
      '<div class="list-icon" style="background:rgba(127,119,221,0.15)"><i class="ti ti-beer" style="color:#AFA9EC"></i></div>' +
      '<div class="list-info"><div class="list-name">'+b.produto+'</div><div class="list-meta">'+b.fornecedor+' · '+dataFmt(b.data)+' · '+b.qtd+' un. · '+brl(b.valor)+'</div></div>' +
      '<button class="del-btn" onclick="delBebida(\''+b.id+'\')"><i class="ti ti-trash"></i></button>' +
    '</div>';
  }).join('') : '<div class="empty"><i class="ti ti-beer"></i><br>Nenhuma compra registrada.</div>';

  document.getElementById('sec-bebidas').innerHTML =
    '<div class="sec-header"><div class="sec-title">Bebidas</div><button class="btn-add" onclick="openModal(\'modal-bev\')"><i class="ti ti-plus"></i> Registrar</button></div>' +
    '<div class="metrics">' +
      '<div class="mcard"><div class="mcard-label">Total investido</div><div class="mcard-val val-amber">'+brl(total)+'</div><div class="mcard-sub">'+bebidas.length+' compras</div></div>' +
      '<div class="mcard"><div class="mcard-label">Unidades</div><div class="mcard-val">'+qtd+'</div><div class="mcard-sub">no período</div></div>' +
    '</div>' + rankHtml +
    '<div class="card"><div class="card-title">Histórico de compras</div>'+listaHtml+'</div>';
}

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

async function delBebida(id) {
  await fbRemove('bebidas/'+id);
  showToast('Registro removido.');
}

function initCatGrid() {
  var grid = document.getElementById('cat-grid-lanc');
  if (!grid) return;
  grid.innerHTML = CATS.map(function(c,i){
    return '<button class="cat-btn '+(i===0?'active':'')+'" onclick="selCat('+i+',this)"><i class="ti '+c.icon+'" style="color:'+c.cor+'"></i>'+c.nome+'</button>';
  }).join('');
}

function initReserva() {
  db.ref('reserva').once('value', function(snap){
    if (!snap.val()) {
      fbSet('reserva', {
        valor: 7199, meta: 1000, metaTotal: 11742,
        historico: [{ id:'mai-dep', data:'2026-05-31', valor:400, obs:'Guardado em maio/2026' }]
      });
    }
  });
}

window.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('main').style.display = 'block';
    initCatGrid();
    var h = hoje();
    ['l-data','d-data','b-data'].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.value = h;
    });
    initReserva();
    loadFirebase();
    renderPainel();
  }, 800);
});
