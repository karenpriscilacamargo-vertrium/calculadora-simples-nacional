(function(){
'use strict';
var CFG=window.CONFIG||{};
var VEM_DE_LINK=/[?&]code=/.test(location.search)||/type=recovery/.test(location.hash);
var $=function(id){return document.getElementById(id)};

/* Nomes dos anexos (as tabelas e os cálculos ficam no servidor) */
var NOMES={
  I:{n:'Anexo I',a:'Comércio'},
  II:{n:'Anexo II',a:'Indústria'},
  III:{n:'Anexo III',a:'Serviços'},
  IV:{n:'Anexo IV',a:'Construção, vigilância e limpeza'},
  V:{n:'Anexo V',a:'Serviços intelectuais'}
};
var faixasAtual=[];
var LIMITE=4800000, FATOR_R=0.28;
var MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
var MESL=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
var DIA=['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
var HINTS={
  R:'TI, advocacia, contabilidade, consultoria, medicina, engenharia, arquitetura e outros serviços do Anexo V: Anexo III se a folha for ao menos 28% do RBT12, senão Anexo V (LC 123/2006, art. 18, §§ 5º-I a 5º-M).',
  III:'Serviços tributados diretamente no Anexo III, sem fator R.',
  V:'Serviços do Anexo V sem considerar o fator R. Para alternar com o Anexo III, use a primeira opção.',
  I:'Revenda de mercadorias.',
  II:'Venda de produtos fabricados pela empresa.',
  IV:'Construção de imóveis, vigilância, limpeza e conservação. A CPP patronal é recolhida por fora do DAS, via GPS.'
};

/* formatação */
function brl(n){return n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function num2(n){return n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
function pct(x,d){return (x*100).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d})+'%'}
function compact(n){
  if(n>=1e6) return 'R$ '+(n/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi';
  if(n>=1e3) return 'R$ '+Math.round(n/1e3).toLocaleString('pt-BR')+' mil';
  return 'R$ '+Math.round(n);
}
function parseBR(s){
  if(s==null) return 0;
  s=String(s).replace(/R\$|\s|%/g,'');
  if(!s) return 0;
  if(s.indexOf(',')>-1) s=s.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
  var n=parseFloat(s);
  return isFinite(n)?n:0;
}
function sum(a){var t=0;for(var i=0;i<a.length;i++)t+=a[i];return t}

function faixaTxt(i){
  var f=faixasAtual, lo=i?f[i-1].lim:0;
  return (i? 'R$ '+num2(lo+0.01):'R$ 0,00')+' a R$ '+num2(f[i].lim);
}
function lab(comp,k){
  var d=new Date(comp.y,comp.m-1+k,1);
  return MES[d.getMonth()]+'/'+String(d.getFullYear()).slice(2);
}
function labL(comp,k){
  var d=new Date(comp.y,comp.m-1+k,1);
  return MESL[d.getMonth()]+' de '+d.getFullYear();
}
function vencimento(comp){
  var d=new Date(comp.y,comp.m,20);
  while(d.getDay()===0||d.getDay()===6) d.setDate(d.getDate()+1);
  var dd=('0'+d.getDate()).slice(-2), mm=('0'+(d.getMonth()+1)).slice(-2);
  return {txt:dd+'/'+mm+'/'+d.getFullYear(), dia:DIA[d.getDay()]};
}

/* leitura dos campos */
var gridEls=[];
function readState(){
  var s={
    modo:$('anexo').value,
    comp:{m:parseInt($('compM').value,10),y:parseInt($('compY').value,10)},
    fat:parseBR($('fat').value),
    g:parseBR($('g').value)/100,
    gf:parseBR($('gf').value)/100,
    sub:parseInt($('sub').value,10),
    nova:$('nova').checked,
    modoGrid:false
  };
  var hist=gridEls.map(function(e){return parseBR(e.value)});
  var gs=sum(hist);
  if(s.nova){
    var n=Math.min(11,Math.max(1,parseInt($('meses').value,10)||0));
    var ac=parseBR($('acum').value), fa=parseBR($('folhaAcum').value);
    s.n=n; s.rbt12=n? ac/n*12:0; s.folha12=n? fa/n*12:0;
    s.hist=Array(12).fill(s.rbt12/12);
  }else if(gs>0){
    s.modoGrid=true; s.rbt12=gs; s.hist=hist; s.folha12=parseBR($('folha').value);
  }else{
    s.rbt12=parseBR($('rbt12').value); s.folha12=parseBR($('folha').value);
    s.hist=Array(12).fill(s.rbt12/12);
  }
  return s;
}

/* alertas */
function al(tipo,rot,txt){return '<li class="al '+tipo+'"><b>'+rot+'</b><span>'+txt+'</span></li>'}
function alertsAtual(s,r0){
  var a=[];
  if(r0.rbt>LIMITE) a.push(al('crit','Limite','RBT12 acima de R$ 4,8 milhões. O limite é aferido pela receita bruta do ano-calendário (LC 123/2006, art. 3º, II), então confira o acumulado do ano e o risco de exclusão do Simples.'));
  else if(r0.rbt>=4500000) a.push(al('warn','Limite','RBT12 próximo do limite de R$ 4,8 milhões (LC 123/2006, art. 3º, II). Em poucos meses o limite pode ser atingido, então vale comparar com o Lucro Presumido.'));
  if(r0.rbt>s.sub) a.push(al('warn','Sublimite','RBT12 acima do sublimite estadual de '+compact(s.sub)+'. ICMS e ISS passam a ser recolhidos fora do DAS (LC 123/2006, arts. 19 e 20). Confira a partilha no PGDAS-D, porque o valor abaixo pode incluir a parcela de ICMS e ISS.'));
  if(s.modo==='IV') a.push(al('info','Anexo IV','A CPP patronal não está no DAS e é recolhida por fora, na GPS (LC 123/2006, art. 18, § 5º-C).'));
  if(s.modo==='R'){
    var d=(r0.r-FATOR_R)*100;
    if(r0.anexo==='V') a.push(al('warn','Fator R','Fator R de '+pct(r0.r,2)+', abaixo de 28%. A empresa fica no Anexo V. Veja abaixo a folha necessária para migrar ao Anexo III.'));
    else if(d<2) a.push(al('warn','Fator R','Fator R de '+pct(r0.r,2)+', a menos de 2 pontos percentuais do mínimo de 28%. Uma queda da folha ou um salto do faturamento muda o anexo.'));
    else a.push(al('ok','Fator R','Fator R de '+pct(r0.r,2)+', acima de 28%. A empresa fica no Anexo III.'));
  }
  if(s.nova) a.push(al('info','Início','RBT12 e folha estimados pela média de '+s.n+' '+(s.n===1?'mês':'meses')+' de atividade, vezes 12. A projeção abaixo parte dessa estimativa.'));
  if(s.modoGrid) a.push(al('info','RBT12','RBT12 calculado pela soma dos 12 meses informados.'));
  return a.join('');
}

/* resultado da competência */
function renderAtual(s,rows,srv){
  var r0=rows[0], ven=vencimento(s.comp);
  $('oAe').textContent=pct(r0.ae,4);
  $('oDas').textContent=brl(r0.das);
  $('oVenc').textContent='Competência '+labL(s.comp,0)+'. Vence '+ven.dia+', '+ven.txt+'.';
  $('oPills').innerHTML='<span class="pill g">'+NOMES[r0.anexo].n+'</span><span class="pill">'+(r0.i+1)+'ª faixa</span>'+(s.modo==='R'?'<span class="pill">Fator R '+pct(r0.r,2)+'</span>':'');
  $('oStats').innerHTML=
    '<div><dt>RBT12</dt><dd>'+brl(r0.rbt)+'</dd></div>'+
    '<div><dt>Alíquota nominal</dt><dd>'+pct(r0.al,2)+'</dd></div>'+
    '<div><dt>Parcela a deduzir</dt><dd>'+brl(r0.pd)+'</dd></div>'+
    '<div><dt>Faturamento</dt><dd>'+brl(r0.fat)+'</dd></div>';
  $('oAlerts').innerHTML=alertsAtual(s,r0);

  var st='';
  st+='<li><span class="st">RBT12</span><span class="calc">'+brl(r0.rbt)+(s.modoGrid?', soma dos 12 meses informados':(s.nova?', média de '+s.n+' meses vezes 12':''))+'</span></li>';
  if(s.modo==='R'){
    st+='<li><span class="st">Fator R</span><span class="calc">'+brl(r0.fol)+' ÷ '+brl(r0.rbt)+' = <strong>'+pct(r0.r,2)+'</strong>, '+(r0.anexo==='III'?'igual ou acima de 28%, então <strong>Anexo III</strong>':'abaixo de 28%, então <strong>Anexo V</strong>')+'</span></li>';
  }
  st+='<li><span class="st">Faixa</span><span class="calc">'+faixaTxt(r0.i)+', <strong>'+(r0.i+1)+'ª faixa do '+NOMES[r0.anexo].n+'</strong>: alíquota nominal '+pct(r0.al,2)+' e parcela a deduzir '+brl(r0.pd)+'</span></li>';
  st+='<li><span class="st">Alíquota efetiva</span><span class="calc">('+num2(r0.rbt)+' × '+pct(r0.al,2)+' − '+num2(r0.pd)+') ÷ '+num2(r0.rbt)+' = <strong>'+pct(r0.ae,4)+'</strong></span></li>';
  st+='<li><span class="st">DAS</span><span class="calc">'+num2(r0.fat)+' × '+pct(r0.ae,4)+' = <strong>'+brl(r0.das)+'</strong></span></li>';
  $('oSteps').innerHTML=st;

  /* tabela de faixas do anexo aplicado */
  var f=faixasAtual.map(function(x){return [x.lim,x.al,x.pd]}), t='<thead><tr><th>Faixa</th><th class="r">RBT12 até</th><th class="r">Alíquota</th><th class="r">Parcela a deduzir</th></tr></thead><tbody>';
  for(var i=0;i<f.length;i++){
    t+='<tr'+(i===r0.i?' class="cur"':'')+'><td>'+(i+1)+'ª</td><td class="r">'+num2(f[i][0])+'</td><td class="r">'+pct(f[i][1],2)+'</td><td class="r">'+num2(f[i][2])+'</td></tr>';
  }
  $('oFaixas').innerHTML=t+'</tbody>';
  $('oFaixasT').textContent=NOMES[r0.anexo].n+', '+NOMES[r0.anexo].a.toLowerCase();
  $('oFaixasN').textContent='Valores em R$. A linha destacada é a faixa do RBT12 informado.';

  /* fator R */
  var rc=$('rCard');
  if(s.modo!=='R'){ rc.hidden=true; }
  else{
    rc.hidden=false;
    var need=FATOR_R*r0.rbt, gap=Math.max(0,need-r0.fol);
    var c3=srv.c3, c5=srv.c5, d3=r0.fat*c3.ae, d5=r0.fat*c5.ae, dif=d5-d3;
    var scale=Math.max(0.4,r0.r*1.15), pFill=Math.min(100,r0.r/scale*100), pMk=FATOR_R/scale*100;
    var b='<div class="gauge" role="img" aria-label="Fator R de '+pct(r0.r,2)+' contra o mínimo de 28%"><div class="fill '+(r0.anexo==='III'?'a3':'a5')+'" style="width:'+pFill.toFixed(2)+'%"></div><div class="mk" style="left:'+pMk.toFixed(2)+'%"><span>MÍNIMO 28%</span></div></div>';
    b+='<dl class="facts">'+
      '<div><dt>Fator R atual</dt><dd>'+pct(r0.r,2)+'</dd></div>'+
      '<div><dt>Folha mínima nos 12 meses para o Anexo III</dt><dd>'+brl(need)+'</dd></div>'+
      '<div><dt>'+(gap>0?'Falta na folha de 12 meses':'Folha acima do mínimo em')+'</dt><dd>'+brl(gap>0?gap:r0.fol-need)+'</dd></div>'+
      '<div><dt>Folha média mensal necessária</dt><dd>'+brl(need/12)+' (hoje '+brl(r0.fol/12)+')</dd></div>'+
      '</dl>';
    b+='<div class="tw" style="margin-top:16px"><table class="tbl"><thead><tr><th>Cenário</th><th class="r">Alíq. efetiva</th><th class="r">DAS do mês</th></tr></thead><tbody>'+
      '<tr'+(r0.anexo==='III'?' class="cur"':'')+'><td>Anexo III</td><td class="r">'+pct(c3.ae,4)+'</td><td class="r">'+brl(d3)+'</td></tr>'+
      '<tr'+(r0.anexo==='V'?' class="cur"':'')+'><td>Anexo V</td><td class="r">'+pct(c5.ae,4)+'</td><td class="r">'+brl(d5)+'</td></tr>'+
      '<tr class="tot"><td>Diferença</td><td class="r">'+pct(c5.ae-c3.ae,4)+'</td><td class="r">'+brl(dif)+'</td></tr></tbody></table></div>';
    b+='<p class="note">'+(r0.anexo==='V'
      ? 'Mantido o faturamento do mês, estar no Anexo III em vez do V representaria cerca de '+brl(dif*12)+' a menos de DAS em 12 meses. Compare esse ganho com o custo de elevar a folha ou o pró-labore (encargos e INSS) antes de decidir.'
      : 'Se o fator R cair abaixo de 28%, o DAS do mês subiria cerca de '+brl(dif)+', ou '+brl(dif*12)+' em 12 meses, mantido o faturamento.')+'</p>';
    $('rBody').innerHTML=b;
  }
}

/* projeção */
var chartData=null;
function renderProj(s,rows){
  var r0=rows[0], rl=rows[11];
  var totDas=sum(rows.map(function(r){return r.das})), totFat=sum(rows.map(function(r){return r.fat}));
  $('projAssume').textContent='Faturamento crescendo '+pct(s.g,1)+' ao mês'+(s.modo==='R'?' e folha crescendo '+pct(s.gf,1)+' ao mês':'')+'. Os 12 meses anteriores são '+(s.modoGrid?'os valores informados':'distribuídos por igual (RBT12 ÷ 12)')+', e o RBT12 de cada competência rola sobre os 12 meses que a antecedem.';

  var firstChange=null, firstSub=null, firstLim=null, i;
  for(i=1;i<rows.length;i++){
    if(firstChange===null && rows[i].anexo!==rows[i-1].anexo) firstChange=i;
    if(firstSub===null && rows[i].acimaSub && !rows[i-1].acimaSub) firstSub=i;
    if(firstLim===null && rows[i].acimaLim && !rows[i-1].acimaLim) firstLim=i;
  }
  var status=rl.acimaLim?'Acima de R$ 4,8 mi':(rl.acimaSub?'Acima do sublimite':'Dentro do sublimite');
  var k='<div class="kpi"><div class="k">Alíquota efetiva</div><div class="v">'+pct(r0.ae,2)+' → '+pct(rl.ae,2)+'</div><div class="d">Competência atual até '+lab(s.comp,11)+'</div></div>'+
    '<div class="kpi"><div class="k">DAS em 12 meses</div><div class="v">'+brl(totDas)+'</div><div class="d">Média de '+brl(totDas/12)+' por mês, sobre '+compact(totFat)+' faturados</div></div>'+
    '<div class="kpi"><div class="k">RBT12 em '+lab(s.comp,11)+'</div><div class="v">'+brl(rl.rbt)+'</div><div class="d">'+status+'</div></div>';
  if(s.modo==='R'){
    k+='<div class="kpi"><div class="k">Anexo ao fim do período</div><div class="v">'+NOMES[rl.anexo].n+'</div><div class="d">'+(firstChange!==null?'Muda de '+NOMES[rows[firstChange-1].anexo].n+' para '+NOMES[rows[firstChange].anexo].n+' em '+lab(s.comp,firstChange):'Sem mudança de anexo no período')+'</div></div>';
  }else{
    k+='<div class="kpi"><div class="k">Faixa ao fim do período</div><div class="v">'+(rl.i+1)+'ª faixa</div><div class="d">'+(rl.i!==r0.i?'Hoje na '+(r0.i+1)+'ª faixa':'Mesma faixa de hoje')+'</div></div>';
  }
  $('pKpis').innerHTML=k;

  var a='';
  if(firstChange!==null){
    var to=rows[firstChange].anexo;
    a+=al(to==='V'?'warn':'ok','Fator R','Em '+lab(s.comp,firstChange)+' o fator R passa a '+pct(rows[firstChange].r,2)+' e a empresa migra para o '+NOMES[to].n+'. A alíquota efetiva vai de '+pct(rows[firstChange-1].ae,2)+' para '+pct(rows[firstChange].ae,2)+'.');
  }
  if(firstSub!==null) a+=al('warn','Sublimite','Em '+lab(s.comp,firstSub)+' o RBT12 passa de '+compact(s.sub)+'. ICMS e ISS saem do DAS e são recolhidos ao Estado e ao município (LC 123/2006, arts. 19 e 20).');
  else if(rows[0].acimaSub) a+=al('warn','Sublimite','O RBT12 já está acima do sublimite de '+compact(s.sub)+' em toda a projeção.');
  if(firstLim!==null) a+=al('crit','Limite','Em '+lab(s.comp,firstLim)+' o RBT12 passa de R$ 4,8 milhões. O limite do Simples é aferido pela receita do ano-calendário (LC 123/2006, art. 3º, II), então planeje a comparação de regimes antes dessa data.');
  else if(rows[0].acimaLim) a+=al('crit','Limite','O RBT12 está acima de R$ 4,8 milhões em toda a projeção.');
  if(!a) a=al('ok','Projeção','Sem mudança de anexo e sem cruzar sublimite ou limite nos próximos 12 meses.');
  $('pAlerts').innerHTML=a;

  var hasR=s.modo==='R';
  var t='<thead><tr><th>Competência</th><th class="r">Faturamento</th><th class="r">RBT12</th>'+(hasR?'<th class="r">Fator R</th>':'')+'<th>Anexo</th><th>Faixa</th><th class="r">Alíq. efetiva</th><th class="r">DAS</th></tr></thead><tbody>';
  rows.forEach(function(r){
    var flag=(r.acimaLim?' <span class="pill crit">Limite</span>':(r.acimaSub?' <span class="pill warn">Sublimite</span>':''));
    t+='<tr class="'+(r.k===0?'cur ':'')+(r.anexo==='V'&&hasR?'a5':'')+'"><td>'+lab(s.comp,r.k)+(r.k===0?' (atual)':'')+'</td><td class="r">'+brl(r.fat)+'</td><td class="r">'+brl(r.rbt)+'</td>'+(hasR?'<td class="r">'+pct(r.r,2)+'</td>':'')+'<td><span class="pill '+(r.anexo==='V'?'a5':(r.anexo==='III'?'a3':''))+'">'+NOMES[r.anexo].n.replace('Anexo ','')+'</span></td><td>'+(r.i+1)+'ª'+flag+'</td><td class="r">'+pct(r.ae,4)+'</td><td class="r">'+brl(r.das)+'</td></tr>';
  });
  t+='<tr class="tot"><td>Total</td><td class="r">'+brl(totFat)+'</td><td></td>'+(hasR?'<td></td>':'')+'<td></td><td></td><td class="r">'+pct(totDas/totFat,4)+'</td><td class="r">'+brl(totDas)+'</td></tr></tbody>';
  $('pTable').innerHTML=t;
  var note='O total traz a alíquota média ponderada pelo faturamento.';
  var d2027=new Date(s.comp.y,s.comp.m-1+11,1).getFullYear()>=2027 || new Date(s.comp.y,s.comp.m-1,1).getFullYear()>=2027;
  if(d2027) note+=' Competências a partir de 01/2027 usam as tabelas vigentes em 2026. Confirme as regras e tabelas do período (Resolução CGSN 190/2026).';
  $('pNote').textContent=note;

  chartData={s:s,rows:rows};
  $('leg1').innerHTML=hasR
    ? '<span><i class="l" style="border-color:var(--gold-text)"></i>Alíquota no Anexo III</span><span><i class="l" style="border-color:var(--rose-text)"></i>Alíquota no Anexo V</span><span><i style="background:var(--ink-strong)"></i>Aplicada, com ponto dourado (III) ou rosé (V)</span>'
    : '<span><i style="background:var(--ink-strong)"></i>Alíquota efetiva do '+NOMES[s.modo].n+'</span>';
  $('leg2').innerHTML='<span><i style="background:var(--ink-strong)"></i>RBT12 projetado</span><span><i class="l" style="border-color:var(--warn-fg)"></i>Sublimite '+compact(s.sub)+'</span><span><i class="l" style="border-color:var(--crit-fg)"></i>Limite R$ 4,8 mi</span>';
  drawCharts();
}

/* gráficos em SVG, escalados à largura real do contêiner */
function niceTicks(min,max,n){
  var span=max-min||1, raw=span/n, mag=Math.pow(10,Math.floor(Math.log(raw)/Math.LN10)), nr=raw/mag;
  var step=(nr<1.5?1:nr<3?2:nr<7?5:10)*mag, t=[], v=Math.ceil(min/step-1e-9)*step;
  while(v<=max+step*1e-6){t.push(v);v+=step}
  return t;
}
function svgChart(el,cfg){
  var w=Math.max(260,el.clientWidth), h=250, p={l:cfg.padL||52,r:20,t:20,b:30};
  var iw=w-p.l-p.r, ih=h-p.t-p.b, n=cfg.x.length;
  var X=function(i){return p.l+(n>1?i*iw/(n-1):iw/2)};
  var Y=function(v){return p.t+(1-(v-cfg.min)/(cfg.max-cfg.min))*ih};
  var o='<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+cfg.aria+'" xmlns="http://www.w3.org/2000/svg">';
  cfg.ticks.forEach(function(v){
    o+='<line class="ch-grid" x1="'+p.l+'" x2="'+(w-p.r)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'"/><text class="ch-ax" x="'+(p.l-8)+'" y="'+(Y(v)+4).toFixed(1)+'" text-anchor="end">'+cfg.fmt(v)+'</text>';
  });
  var every=w<520?3:(w<760?2:1);
  cfg.x.forEach(function(lb,i){
    if(i%every===0 || i===n-1){ if(i===n-1 && i%every!==0 && (n-1-(i-(i%every)))<3 && every>1) return; o+='<text class="ch-ax" x="'+X(i).toFixed(1)+'" y="'+(h-8)+'" text-anchor="middle">'+lb+'</text>'; }
  });
  (cfg.hlines||[]).forEach(function(L){
    var y=Y(L.v).toFixed(1);
    o+='<line class="'+L.cls+'" x1="'+p.l+'" x2="'+(w-p.r)+'" y1="'+y+'" y2="'+y+'"/><text class="ch-lbl '+L.lc+'" x="'+(p.l+6)+'" y="'+(Y(L.v)-6).toFixed(1)+'">'+L.label+'</text>';
  });
  (cfg.lines||[]).forEach(function(L){
    var d=L.ys.map(function(v,i){return (i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)}).join(' ');
    o+='<path class="'+L.cls+'" d="'+d+'"/>';
  });
  var m=cfg.main;
  m.ys.forEach(function(v,i){ o+='<circle class="'+m.dots[i]+'" cx="'+X(i).toFixed(1)+'" cy="'+Y(v).toFixed(1)+'" r="4.5"/>'; });
  o+='<text class="ch-lbl" x="'+(X(0)+8).toFixed(1)+'" y="'+(Y(m.ys[0])-10).toFixed(1)+'">'+cfg.fmt(m.ys[0],1)+'</text>';
  o+='<text class="ch-lbl" x="'+(X(n-1)-8).toFixed(1)+'" y="'+(Y(m.ys[n-1])-10).toFixed(1)+'" text-anchor="end">'+cfg.fmt(m.ys[n-1],1)+'</text>';
  el.innerHTML=o+'</svg>';
}
function drawCharts(){
  if(!chartData) return;
  var s=chartData.s, rows=chartData.rows, hasR=s.modo==='R';
  var xl=rows.map(function(r){return lab(s.comp,r.k)});
  /* alíquota efetiva */
  var ys=rows.map(function(r){return r.ae}), all=ys.slice(), lines=[];
  if(hasR){
    var a3=rows.map(function(r){return r.ae3}), a5=rows.map(function(r){return r.ae5});
    all=all.concat(a3,a5);
    lines.push({ys:a3,cls:'ch-r3'},{ys:a5,cls:'ch-r5'});
  }
  lines.push({ys:ys,cls:'ch-line'});
  var lo=Math.min.apply(null,all), hi=Math.max.apply(null,all), padv=(hi-lo)*0.18||0.005;
  var tk=niceTicks(Math.max(0,lo-padv),hi+padv,4);
  var mn=Math.min(tk[0],lo-padv*0.5), mx=Math.max(tk[tk.length-1],hi+padv*0.5);
  svgChart($('ch1'),{
    x:xl,min:mn,max:mx,ticks:tk,lines:lines,
    fmt:function(v,d){return (v*100).toLocaleString('pt-BR',{minimumFractionDigits:d||0,maximumFractionDigits:d||(tk.length&&(tk[1]-tk[0])<0.01?1:0)})+'%'},
    main:{ys:ys,dots:rows.map(function(r){return r.anexo==='V'?'d5':'d3'})},
    aria:'Alíquota efetiva por competência nos próximos 12 meses', padL:48
  });
  /* RBT12 */
  var rb=rows.map(function(r){return r.rbt}), top=Math.max(LIMITE*1.1,Math.max.apply(null,rb)*1.08);
  var tk2=niceTicks(0,top,4);
  svgChart($('ch2'),{
    x:xl,min:0,max:tk2[tk2.length-1]>top?tk2[tk2.length-1]:top,ticks:tk2,
    hlines:[{v:s.sub,cls:'ch-sub',lc:'w',label:'Sublimite'},{v:LIMITE,cls:'ch-lim',lc:'c',label:'Limite do Simples'}],
    fmt:function(v,d){return d? compact(v):compact(v).replace('R$ ','')},
    main:{ys:rb,dots:rows.map(function(r){return r.acimaSub?'dx':'d3'})},
    aria:'RBT12 projetado por competência, com sublimite e limite do Simples', padL:54
  });
}
if(window.ResizeObserver){
  var ro=new ResizeObserver(function(){drawCharts()});
  ro.observe($('ch1')); ro.observe($('ch2'));
}else{ window.addEventListener('resize',drawCharts); }

/* memória de cálculo para copiar */
function memoria(s,r0){
  var ven=vencimento(s.comp), L=[];
  L.push('2AK · Simples Nacional · memória de cálculo');
  L.push('Competência: '+labL(s.comp,0)+' · '+NOMES[r0.anexo].n+' ('+NOMES[r0.anexo].a+')');
  L.push('RBT12: '+brl(r0.rbt));
  if(s.modo==='R') L.push('Fator R: '+brl(r0.fol)+' ÷ '+brl(r0.rbt)+' = '+pct(r0.r,2)+(r0.anexo==='III'?' (≥ 28%, Anexo III)':' (< 28%, Anexo V)'));
  L.push('Faixa: '+(r0.i+1)+'ª ('+faixaTxt(r0.i)+') · alíquota nominal '+pct(r0.al,2)+' · parcela a deduzir '+brl(r0.pd));
  L.push('Alíquota efetiva = ('+num2(r0.rbt)+' × '+pct(r0.al,2)+' − '+num2(r0.pd)+') ÷ '+num2(r0.rbt)+' = '+pct(r0.ae,4));
  L.push('DAS = '+num2(r0.fat)+' × '+pct(r0.ae,4)+' = '+brl(r0.das));
  L.push('Vencimento: '+ven.dia+', '+ven.txt);
  L.push('Base: LC 123/2006, art. 18 e Anexos I a V. Estimativa; a apuração oficial é feita no PGDAS-D.');
  return L.join('\n');
}

/* atualização geral */
var current=null, edited=false;
function syncUI(s){
  var isR=s.modo==='R';
  $('anexoHint').textContent=HINTS[s.modo];
  $('folhaWrap').hidden=!isR; $('gfWrap').hidden=!isR; $('folhaAcumWrap').hidden=!isR;
  $('novaWrap').hidden=!s.nova;
  var lockR=s.nova||s.modoGrid;
  $('rbt12').readOnly=lockR; $('rbtBox').classList.toggle('lock',lockR);
  if(lockR) $('rbt12').value=s.rbt12? num2(s.rbt12):'';
  $('rbtHint').textContent=s.nova?'Estimado pela média dos meses de atividade.':(s.modoGrid?'Soma dos 12 meses detalhados abaixo.':'Soma dos 12 meses anteriores à competência, sem incluir o mês apurado.');
  $('folha').readOnly=s.nova; $('folhaBox').classList.toggle('lock',s.nova);
  if(s.nova) $('folha').value=s.folha12? num2(s.folha12):'';
  $('exTag').hidden=edited;
  /* rótulos dos 12 meses */
  gridEls.forEach(function(e,i){ var lb=$('ml'+i); if(lb) lb.textContent=lab(s.comp,i-12); });
}
function update(){
  var s=readState(); syncUI(s); current=s;
  var ok=s.rbt12>0 && s.fat>0;
  $('empty').hidden=ok; $('resBlock').hidden=!ok; $('projBody').hidden=!ok; $('projAssume').hidden=!ok;
  if(!ok){ chartData=null; seq++; clearTimeout(timer); setCalc(''); return; }
  if(appAtivo) agendar(s);
}

/* montagem inicial */
(function init(){
  var i, mS=$('compM'), yS=$('compY'), g=$('mgrid');
  for(i=0;i<12;i++){ var o=document.createElement('option'); o.value=i+1; o.textContent=MESL[i]; mS.appendChild(o); }
  for(i=2024;i<=2032;i++){ var y=document.createElement('option'); y.value=i; y.textContent=i; yS.appendChild(y); }
  mS.value='10'; yS.value='2026';
  for(i=0;i<12;i++){
    var d=document.createElement('div'); d.className='f';
    d.innerHTML='<label for="m'+i+'" id="ml'+i+'"></label><div class="inp"><span>R$</span><input id="m'+i+'" class="money" inputmode="decimal"></div>';
    g.appendChild(d); gridEls.push(d.querySelector('input'));
  }
})();

var form=$('form');
form.addEventListener('submit',function(e){e.preventDefault()});
form.addEventListener('input',function(e){
  if(e.target.id!=='' ) edited=true;
  update();
});
form.addEventListener('change',function(){update()});
form.addEventListener('focusout',function(e){
  var t=e.target;
  if(t.classList&&t.classList.contains('money')&&!t.readOnly){ var v=parseBR(t.value); t.value=v? num2(v):''; update(); }
});

var EX={anexo:'R',compM:'10',compY:'2026',fat:'85.000,00',rbt12:'960.000,00',folha:'240.000,00',g:'2,0',gf:'0,0',sub:'3600000'};
function setEx(){
  Object.keys(EX).forEach(function(k){ $(k).value=EX[k]; });
  gridEls.forEach(function(e){e.value=''});
  $('nova').checked=false; $('meses').value='6'; $('acum').value=''; $('folhaAcum').value='';
  edited=false; update();
}
$('btnEx').addEventListener('click',setEx);
$('btnClear').addEventListener('click',function(){
  ['fat','rbt12','folha','acum','folhaAcum'].forEach(function(k){$(k).value=''});
  gridEls.forEach(function(e){e.value=''});
  $('nova').checked=false; edited=true; update();
});
$('mesClear').addEventListener('click',function(){ gridEls.forEach(function(e){e.value=''}); update(); });

$('btnCopy').addEventListener('click',function(){
  if(!current||!current.rows) return;
  var txt=memoria(current,current.rows[0]), box=$('copyBox'), msg=$('copyMsg');
  function fallback(){ box.value=txt; box.hidden=false; box.focus(); box.select(); msg.style.color='var(--warn-fg)'; msg.textContent='Selecionado. Copie com Ctrl+C ou Cmd+C.'; }
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(function(){ box.hidden=true; msg.style.color='var(--ok-fg)'; msg.textContent='Memória copiada.'; },fallback);
    }else fallback();
  }catch(err){ fallback(); }
});

/* ---------- servidor ---------- */
if(!window.supabase||!CFG.supabaseUrl){
  $('v-carregando').textContent='Não foi possível carregar a página. Atualize e tente de novo.';
  return;
}
var sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseChave,{
  auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});
var appAtivo=false, appIniciado=false, seq=0, timer=null, recuperando=false, ultimoEmail='';

function setCalc(t){ var e=$('calcEstado'); if(e) e.textContent=t; }
function corpoServidor(s){ return {modo:s.modo,fat:s.fat,g:s.g,gf:s.gf,sub:s.sub,folha12:s.folha12,hist:s.hist}; }
function agendar(s){ clearTimeout(timer); setCalc('Calculando…'); timer=setTimeout(function(){chamar(s)},350); }
function chamar(s){
  var meu=++seq;
  return sb.functions.invoke('calcular',{body:corpoServidor(s)}).then(function(r){
    if(meu!==seq) return;
    if(r.error) return tratarErro(r.error);
    var srv=r.data;
    faixasAtual=srv.faixas; s.rows=srv.rows;
    renderAtual(s,srv.rows,srv); renderProj(s,srv.rows); setCalc('Atualizado');
  }).catch(function(){ if(meu===seq) setCalc('Não foi possível calcular. Verifique a conexão.'); });
}
function tratarErro(err){
  var st=err&&err.context&&err.context.status;
  if(st===401){ setCalc(''); return sb.auth.signOut(); }
  if(st===403){ mostrarLiberar('',''); return; }
  setCalc(st===400?'Confira os valores informados.':'Não foi possível calcular. Tente de novo em instantes.');
}

/* ---------- telas ---------- */
var VIEWS=['carregando','entrar','cadastro','confirmar','recuperar','nova-senha','liberar'];
function mostrar(id){
  appAtivo=false; clearTimeout(timer); seq++;
  $('tela-app').hidden=true; $('auth').hidden=false;
  VIEWS.forEach(function(v){ $('v-'+v).hidden=(v!==id); });
  window.scrollTo(0,0);
  var h=$('v-'+id).querySelector('h2'); if(h&&id!=='carregando') try{ h.focus({preventScroll:true}); }catch(e){}
}
function mostrarApp(){
  $('auth').hidden=true; $('tela-app').hidden=false; appAtivo=true;
  if(!appIniciado){ appIniciado=true; setEx(); } else update();
}
function mostrarLiberar(tipo,txt){
  mostrar('liberar'); ocupado($('btnJaComprei'),false);
  if(!txt && !CFG.linkCompra){ tipo='info'; txt='O link de compra ainda não foi configurado. Fale com a 2AK para liberar o acesso.'; }
  aviso('liberarMsg',tipo,txt);
}
function definirUsuario(u){
  var nome=(u.user_metadata&&u.user_metadata.nome)||u.email||'';
  $('userNome').textContent=nome; $('userBox').hidden=false;
  $('liberarEmail').textContent=u.email||'';
}
var verificando=false;
function depoisDoLogin(sessao){
  if(appAtivo||verificando) return;
  verificando=true;
  definirUsuario(sessao.user);
  function falha(){ verificando=false; if(!$('v-liberar').hidden) return; mostrarLiberar('erro','Não foi possível verificar o seu acesso agora. Tente de novo em instantes.'); }
  return sb.rpc('meu_acesso').then(function(r){
    verificando=false;
    if(r.error){ falha(); return; }
    if(r.data===true) mostrarApp();
    else if($('v-liberar').hidden) mostrarLiberar('','');   /* já na tela de liberação: mantém a mensagem exibida */
  }).catch(falha);
}

sb.auth.onAuthStateChange(function(ev,sessao){
  if(ev==='PASSWORD_RECOVERY'){ recuperando=true; setTimeout(function(){ mostrar('nova-senha'); },0); return; }
  if(ev==='TOKEN_REFRESHED'||ev==='USER_UPDATED') return;
  setTimeout(function(){
    if(sessao){
      if(ev==='INITIAL_SESSION'||ev==='SIGNED_IN'){
        /* quem chega por link de e-mail pode estar em recuperação de senha: espera o evento específico */
        setTimeout(function(){ if(!recuperando) depoisDoLogin(sessao); }, VEM_DE_LINK?500:0);
      }
    }else{
      $('userBox').hidden=true; current=null; chartData=null; appIniciado=false; verificando=false; $('rBody').innerHTML='';
      if(recuperando) return;
      var h=(location.hash||'').replace('#','');
      mostrar(h==='cadastro'||h==='recuperar'?h:'entrar');
    }
  },0);
});

/* ---------- formulários de conta ---------- */
function val(id){ return ($(id).value||'').trim(); }
function emailOk(e){ return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }
function aviso(id,tipo,txt){ var e=$(id); e.className='aviso'+(tipo?' '+tipo:''); e.textContent=txt; e.hidden=!txt; }
function ocupado(b,on,rot){
  if(on){ if(!b.disabled) b.setAttribute('data-rot',b.textContent); b.disabled=true; b.textContent=rot; }
  else{ b.disabled=false; if(b.getAttribute('data-rot')) b.textContent=b.getAttribute('data-rot'); }
}
function traduz(e){
  var m=((e&&e.message)||'').toLowerCase();
  if(m.indexOf('invalid login')>-1) return 'E-mail ou senha incorretos.';
  if(m.indexOf('not confirmed')>-1) return 'Confirme o seu e-mail antes de entrar. Procure o link na caixa de entrada e no spam.';
  if(m.indexOf('rate limit')>-1||m.indexOf('too many')>-1||m.indexOf('security purposes')>-1) return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.';
  if(m.indexOf('password')>-1&&(m.indexOf('least')>-1||m.indexOf('weak')>-1||m.indexOf('short')>-1)) return 'Essa senha é fraca. Use pelo menos 8 caracteres, com letras e números.';
  if(m.indexOf('same password')>-1||m.indexOf('different from the old')>-1) return 'Escolha uma senha diferente da anterior.';
  return 'Não foi possível concluir agora. Tente de novo em instantes.';
}
function senhaOk(p){ return p.length>=8 && /[A-Za-z]/.test(p) && /[0-9]/.test(p); }
var VOLTA=location.origin+'/';

document.addEventListener('click',function(e){
  var t=e.target.closest?e.target.closest('[data-ir]'):null;
  if(t){ mostrar(t.getAttribute('data-ir')); return; }
  var v=e.target.closest?e.target.closest('[data-alvo]'):null;
  if(v){
    var c=$(v.getAttribute('data-alvo')), mostra=c.type==='password';
    c.type=mostra?'text':'password'; v.textContent=mostra?'Ocultar':'Mostrar';
    v.setAttribute('aria-label',mostra?'Ocultar senha':'Mostrar senha');
  }
});

$('f-entrar').addEventListener('submit',function(e){
  e.preventDefault();
  var em=val('e-email').toLowerCase(), pw=$('e-senha').value, b=$('e-enviar');
  $('e-reenviar').hidden=true;
  if(!emailOk(em)||!pw){ aviso('e-msg','erro','Informe o e-mail e a senha.'); return; }
  aviso('e-msg','',''); ocupado(b,true,'Entrando…');
  sb.auth.signInWithPassword({email:em,password:pw}).then(function(r){
    ocupado(b,false);
    if(r.error){
      aviso('e-msg','erro',traduz(r.error));
      if(/not confirmed/i.test(r.error.message||'')){ ultimoEmail=em; $('e-reenviar').hidden=false; }
    }
  }).catch(function(){ ocupado(b,false); aviso('e-msg','erro','Sem conexão. Verifique a internet e tente de novo.'); });
});

$('e-reenviar').addEventListener('click',function(){
  if(!ultimoEmail) return;
  sb.auth.resend({type:'signup',email:ultimoEmail,options:{emailRedirectTo:VOLTA}}).then(function(r){
    aviso('e-msg',r.error?'erro':'ok',r.error?traduz(r.error):'Enviamos um novo e-mail de confirmação.');
  });
});

$('f-cadastro').addEventListener('submit',function(e){
  e.preventDefault();
  var nome=val('c-nome'), em=val('c-email').toLowerCase(), wa=val('c-whats'), prof=$('c-prof').value, crc=val('c-crc');
  var s1=$('c-senha').value, s2=$('c-senha2').value, b=$('c-enviar');
  var dig=wa.replace(/\D/g,'');
  var erro='';
  if(nome.length<3||nome.indexOf(' ')<0) erro='Informe o nome completo.';
  else if(!emailOk(em)) erro='Informe um e-mail válido.';
  else if(dig.length<10||dig.length>13) erro='Informe o WhatsApp com DDD, por exemplo (11) 90000-0000.';
  else if(!prof) erro='Escolha a opção que melhor descreve você.';
  else if(!senhaOk(s1)) erro='A senha precisa ter pelo menos 8 caracteres, com letras e números.';
  else if(s1!==s2) erro='As duas senhas não são iguais.';
  else if(!$('c-aceite').checked) erro='Para criar a conta, aceite os Termos de Uso e a Política de Privacidade.';
  if(erro){ aviso('c-msg','erro',erro); return; }
  aviso('c-msg','',''); ocupado(b,true,'Criando conta…');
  sb.auth.signUp({
    email:em, password:s1,
    options:{ emailRedirectTo:VOLTA, data:{nome:nome,whatsapp:wa,profissao:prof,crc:crc,aceite_versao:CFG.versaoTermos||'1'} }
  }).then(function(r){
    ocupado(b,false);
    if(r.error){ aviso('c-msg','erro',traduz(r.error)); return; }
    ultimoEmail=em; $('c-email-enviado').textContent=em;
    $('c-senha').value=''; $('c-senha2').value='';
    if(!r.data||!r.data.session) mostrar('confirmar');
  }).catch(function(){ ocupado(b,false); aviso('c-msg','erro','Sem conexão. Verifique a internet e tente de novo.'); });
});

$('c-reenviar').addEventListener('click',function(){
  if(!ultimoEmail) return;
  sb.auth.resend({type:'signup',email:ultimoEmail,options:{emailRedirectTo:VOLTA}}).then(function(r){
    aviso('c-msg2',r.error?'erro':'ok',r.error?traduz(r.error):'Enviamos o e-mail de novo. Confira também o spam.');
  });
});

$('f-recuperar').addEventListener('submit',function(e){
  e.preventDefault();
  var em=val('r-email').toLowerCase(), b=$('r-enviar');
  if(!emailOk(em)){ aviso('r-msg','erro','Informe um e-mail válido.'); return; }
  ocupado(b,true,'Enviando…');
  sb.auth.resetPasswordForEmail(em,{redirectTo:VOLTA}).then(function(r){
    ocupado(b,false);
    if(r.error && /rate|security|many/i.test(r.error.message||'')){ aviso('r-msg','erro',traduz(r.error)); return; }
    aviso('r-msg','ok','Se esse e-mail tiver conta, enviamos um link para criar uma nova senha. Confira também o spam.');
  }).catch(function(){ ocupado(b,false); aviso('r-msg','erro','Sem conexão. Verifique a internet e tente de novo.'); });
});

$('f-nova-senha').addEventListener('submit',function(e){
  e.preventDefault();
  var s1=$('n-senha').value, s2=$('n-senha2').value, b=$('n-enviar');
  if(!senhaOk(s1)){ aviso('n-msg','erro','A senha precisa ter pelo menos 8 caracteres, com letras e números.'); return; }
  if(s1!==s2){ aviso('n-msg','erro','As duas senhas não são iguais.'); return; }
  ocupado(b,true,'Salvando…');
  sb.auth.updateUser({password:s1}).then(function(r){
    ocupado(b,false);
    if(r.error){ aviso('n-msg','erro',traduz(r.error)); return; }
    recuperando=false; $('n-senha').value=''; $('n-senha2').value='';
    sb.auth.getSession().then(function(x){ if(x.data&&x.data.session) depoisDoLogin(x.data.session); else mostrar('entrar'); });
  }).catch(function(){ ocupado(b,false); aviso('n-msg','erro','Sem conexão. Verifique a internet e tente de novo.'); });
});

function sair(){ sb.auth.signOut(); }
$('btnSair').addEventListener('click',sair);
$('btnSairLiberar').addEventListener('click',sair);

$('btnJaComprei').addEventListener('click',function(){
  var b=$('btnJaComprei'); ocupado(b,true,'Verificando…');
  sb.rpc('meu_acesso').then(function(r){
    ocupado(b,false);
    if(r.error){ aviso('liberarMsg','erro','Não foi possível verificar agora. Tente de novo em instantes.'); return; }
    if(r.data===true) mostrarApp();
    else aviso('liberarMsg','info','Ainda não identificamos a compra. Pode levar alguns minutos depois do pagamento. Confira se a compra foi feita com o mesmo e-mail desta conta.');
  }).catch(function(){ ocupado(b,false); aviso('liberarMsg','erro','Sem conexão. Verifique a internet e tente de novo.'); });
});

(function configurarCompra(){
  var a=$('linkCompra');
  if(CFG.linkCompra){ a.href=CFG.linkCompra; } else { a.hidden=true; }
  var p=$('liberarPreco');
  if(CFG.precoTexto){ p.textContent=CFG.precoTexto; p.hidden=false; }
})();

mostrar('carregando');
})();
