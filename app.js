/* ============================================================
 * 数字能量馆 · 前端交互 app.js
 * ------------------------------------------------------------
 * 依赖加载顺序：lunar.js → data.js → astro.js → core.js → app.js
 * 职责：渲染分析结果、结缘线索收集（localStorage + 可选远程转发）、
 * 店主后台（#admin）与导出。
 * ============================================================ */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var KEY = 'NE_leads_v1';
  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ============ 每日一测 · 随缘添灯（与易学馆同款模式） ============
   * 每日免费分析一次；用罄后再点“开始分析”，先弹打赏浮层，
   * 客户随喜（扫码自证）后当日放行。额度记在本机，清缓存可重置，
   * 与易学馆一致的“诚信问心”机制。 */
  var DAILY_FREE = 1;
  var QUOTA_KEY = 'NE_quota_v1';
  var pendingPhone = null;
  var payImgChecked = false;

  function todayKey() {
    var d = new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }
  function quota() {
    var s = { date: todayKey(), free: 0, paid: false };
    try {
      var x = JSON.parse(localStorage.getItem(QUOTA_KEY) || '{}');
      if (x && x.date === s.date) { s.free = +x.free || 0; s.paid = !!x.paid; }
    } catch (e) { /* 忽略 */ }
    return s;
  }
  function saveQuota(q) { try { localStorage.setItem(QUOTA_KEY, JSON.stringify(q)); } catch (e) { /* 忽略 */ } }

  function refreshDaily() {
    var el = $('dailyTick');
    if (!el) return;
    var q = quota();
    if (q.free >= DAILY_FREE && !q.paid) {
      el.innerHTML = '今日免费分析已用罄 · 再测请先随缘添灯';
      el.style.color = '#a33327';
    } else if (q.paid) {
      el.innerHTML = '今日已随喜 · 随测随行';
      el.style.color = '#3f6b26';
    } else {
      el.innerHTML = '今日免费分析 · 尚余 ' + (DAILY_FREE - q.free) + ' 次';
      el.style.color = '#3f6b26';
    }
  }

  function openPay() {
    $('paySub').innerHTML = '今日免费一测已用罄 · 再测一回，请先添灯一盏。';
    $('payMsg').innerHTML =
      '一测一灯，灯亮号明。此测确有所问，请君<b>随缘添一盏灯</b>，随即放行；' +
      '随喜之后，今日随测随行，明日此时免费数缘复满。若暂不测，合上即可，来去自在。';
    $('payWxId').textContent = SHOP.wxId || '';
    $('payOverlay').classList.add('show');
    checkPayImg();
  }
  function closePay() { $('payOverlay').classList.remove('show'); }
  function checkPayImg() {
    if (payImgChecked) return;
    payImgChecked = true;
    var host = $('payQrMain');
    if (!host) return;
    var im = new Image();
    im.onerror = function () { host.classList.add('missing'); };
    im.src = 'wechat-pay.png';
    setTimeout(function () {
      if (im.complete && im.naturalWidth === 0) host.classList.add('missing');
    }, 4000);
  }
  function bindPay() {
    $('payClose').addEventListener('click', closePay);
    $('payLater').addEventListener('click', closePay);
    $('payDone').addEventListener('click', function () {
      var q = quota();
      if (q.free >= DAILY_FREE && !q.paid) { q.paid = true; saveQuota(q); }
      closePay();
      refreshDaily();
      var ph = pendingPhone;
      pendingPhone = null;
      execAnalysis(ph);
    });
  }

  /* 剪贴板助手（留灯备注复制等） */
  function copyAny(text, ok) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok || function () { }, function () { legacyCopy(text, ok); });
    } else legacyCopy(text, ok);
  }
  function legacyCopy(text, ok) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* 忽略 */ }
    document.body.removeChild(ta);
    if (ok) ok();
  }

  /* ============ 品牌 / 页面骨架 ============ */
  function initChrome() {
    $('plaqueTop').textContent = SHOP.plaqueTop || '';
    $('shopName').textContent = SHOP.hall || '数字能量馆';
    $('plaqueLine').textContent = (SHOP.name || '') + ' · 手机号磁场 × 本命幸运数字';
    $('shopMotto').innerHTML = SHOP.motto || '';
    $('disclaimer').textContent = DISCLAIMER;

    /* 站群导航（仅配置了 otherHalls 才显示） */
    var nav = $('topNav');
    if (SHOP.otherHalls && SHOP.otherHalls.length) {
      var html = '<a class="xz-brand" href="' + esc(SHOP.home || './') + '">' + esc(SHOP.name || '玄学馆') + '<small>玄 学 馆</small></a>';
      html += '<span class="xz-links"><span class="xz-on">数 字 能 量</span>';
      SHOP.otherHalls.forEach(function (h) {
        html += '<a href="' + esc(h.href) + '">' + esc(h.label) + '</a>';
      });
      html += '</span>';
      nav.innerHTML = html;
    } else { nav.style.display = 'none'; }

    /* 八星速查表 */
    var order = ['天医', '生气', '延年', '伏位', '绝命', '五鬼', '六煞', '祸害'];
    var cls = { '吉': 't-j', '凶': 't-x', '平': 't-p' };
    var g = '';
    order.forEach(function (sn) {
      var s = EIGHT_STARS[sn];
      g += '<div class="cheat-item"><div class="cn ' + cls[s.type] + '">' + sn + '</div>' +
        '<div class="cd"><b>' + s.theme + '</b> · <span class="nn">' + s.nums.join(' ') + '</span><p>' + s.text + '</p></div></div>';
    });
    $('cheatGrid').innerHTML = g;
  }

  /* ============ 手机号输入格式化 ============ */
  function bindPhoneInput(el, enterRun) {
    el.addEventListener('input', function () {
      var d = el.value.replace(/\D/g, '').slice(0, 11);
      var out = d;
      if (d.length > 7) out = d.slice(0, 3) + ' ' + d.slice(3, 7) + ' ' + d.slice(7);
      else if (d.length > 3) out = d.slice(0, 3) + ' ' + d.slice(3);
      el.value = out;
    });
    if (enterRun) {
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); doRun(); }
      });
    }
  }

  /* ============ 分析主流程 ============ */
  function readBaziOpts() {
    var d = $('bdDate').value;
    if (!d) return null;
    var p = d.split('-');
    var y = +p[0], m = +p[1], day = +p[2];
    var h = 12, min = 0;
    if (!$('noTime').checked && $('bdTime').value) {
      var tp = $('bdTime').value.split(':');
      h = +tp[0]; min = +tp[1];
    }
    return { y: y, m: m, d: day, h: h, min: min };
  }

  function doRun() {
    var ph = NE.cleanPhone($('phInput').value);
    if (!ph) { toast('请先填一个 11 位大陆手机号哦'); $('phInput').focus(); return; }
    var q = quota();
    if (q.free >= DAILY_FREE) { pendingPhone = ph; openPay(); return; }
    q.free++;
    saveQuota(q);
    refreshDaily();
    execAnalysis(ph);
  }

  function execAnalysis(_ph) {
    var ph = _ph || NE.cleanPhone($('phInput').value);
    if (!ph) return;

    var an = NE.analyzePhone(ph);
    renderSummary(an);
    renderGroups(an);
    renderTexts(an);
    renderStars(an);

    var bazi = null;
    var opt = readBaziOpts();
    if (opt) {
      try { bazi = calcBaziDigest(opt); } catch (e) { bazi = null; }
      if (bazi && !bazi.ok) bazi = null;
    }
    renderFortune(an, bazi);

    var res = $('result');
    res.classList.remove('hidden');
    setTimeout(function () {
      res.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  /* ---- 总评卡 ---- */
  function renderSummary(an) {
    var ring = $('rRing');
    ring.style.setProperty('--p', an.display);
    ring.querySelector('b').textContent = an.display;
    $('rLevel').textContent = an.levelName;
    $('rPhone').textContent = '号码 ' + an.fmt;
    $('rNote').textContent = an.levelNote;
    var stats =
      '<span class="ok">吉星 ' + an.posCnt + ' 组</span>' +
      '<span class="no">凶星 ' + an.negCnt + ' 组</span>' +
      '<span class="mid">伏位·中性 ' + an.neuCnt + ' 组</span>' +
      '<span class="mid">0/5 特殊 ' + an.spCnt + ' 组</span>';
    $('rStats').innerHTML = stats;
  }

  /* ---- 逐段拆解格 ---- */
  function renderGroups(an) {
    var typeMap = { '吉': ['g', 't-j', 'b-j'], '凶': ['x', 't-x', 'b-x'], '平': ['p', 't-p', 'b-p'], '特殊': ['s', 't-s', 'b-s'] };
    var g = '';
    var n = an.groups.length;
    an.groups.forEach(function (it, idx) {
      var k = typeMap[it.type] || typeMap['平'];
      var isTail = idx >= n - 2;
      var nm, lv;
      if (it.type === '特殊') { nm = '0/5 特殊'; lv = '能量隐伏'; }
      else { nm = it.star; lv = (it.type === '吉' || it.type === '凶')
        ? '磁场 ' + ['一', '二', '三', '四'][it.lv - 1] + ' 等'
        : '延续磁场'; }
      var wxLine = it.pair.split('').map(function (ch) { return ch + NUM_WX[+ch]; }).join(' · ');
      g += '<div class="gd' + (isTail ? ' tail' : '') + (it.type === '特殊' ? ' sp' : '') + '">' +
        (isTail ? '<div class="gd-tailmark">' + (idx === n - 1 ? '收尾' : '尾段') + '</div>' : '') +
        '<div class="pos ' + k[2] + '"></div>' +
        '<div class="pair">' + it.pair + '</div>' +
        '<div class="nm ' + (it.type === '特殊' ? 't-s' : k[1]) + '">' + nm + '</div>' +
        '<div class="lv">' + lv + '</div>' +
        '<div class="wx">' + wxLine + '</div>' +
        '</div>';
    });
    $('rGroups').innerHTML = g;
    $('rGN').textContent = '自左而右每次取相邻两位成组，越靠右的位置权重越高——号段那几组只是“底色”，真正观气要看后段（右下角“尾段 / 收尾”两组）。';
    $('rLegend').innerHTML =
      '<span style="color:#8c2418;">■</span> 吉星 　<span style="color:#31586d;">■</span> 凶星 　' +
      '<span style="color:#6b5638;">■</span> 伏位等中性 　<span style="color:#7d6a8c;">■</span> 0/5 特殊位（不判吉凶）';
  }

  /* ---- 白话解说 ---- */
  function renderTexts(an) {
    var lines = NE.explain(an);
    var h = '';
    lines.forEach(function (x) {
      h += '<div class="exp"><span class="ic">' + x.icon + '</span><div>' + x.text + '</div></div>';
    });
    $('rTexts').innerHTML = h || '<div class="plain small">暂无更多解说。</div>';
  }

  /* ---- 八星分布条 ---- */
  function renderStars(an) {
    var order = ['天医', '生气', '延年', '伏位', '绝命', '五鬼', '六煞', '祸害'];
    var cls = { '吉': 'b-j', '凶': 'b-x', '平': 'b-p' };
    var max = 1;
    order.forEach(function (sn) { if ((an.starHit[sn] || 0) > max) max = an.starHit[sn]; });
    var h = '';
    order.forEach(function (sn) {
      var v = an.starHit[sn] || 0;
      var pct = Math.round((v / max) * 100);
      var s = EIGHT_STARS[sn];
      h += '<div class="sb' + (v === 0 ? ' zero' : '') + '">' +
        '<span class="sn" style="color:' + (v ? '#3a2a10' : '#b5a685') + ';">' + sn + '</span>' +
        '<span class="bar"><i style="width:' + pct + '%" class="' + (v ? cls[s.type] : '') + '"></i></span>' +
        '<span class="sc">' + (v ? v + ' 组' : '未现') + '</span></div>';
    });
    $('rStars').innerHTML = h;
  }

  /* ---- 五行能量条（八字/号码共用） ---- */
  function wxBarsHTML(energy, maxOverride) {
    var max = maxOverride || 1;
    WX_ORDER.forEach(function (w) { if (energy[w] > max) max = energy[w]; });
    var h = '';
    WX_ORDER.forEach(function (w) {
      var v = Math.round(energy[w] * 100) / 100;
      var pct = Math.round((energy[w] / max) * 100);
      h += '<div class="wx-item"><span class="wx-dot" style="background:' + WX_COLOR[w] + '"></span>' +
        '<span class="wx-name">' + w + '</span>' +
        '<span class="wx-bar"><i style="width:' + pct + '%;background:' + WX_COLOR[w] + '"></i></span>' +
        '<span class="wx-num">' + v + '</span></div>';
    });
    return h;
  }

  /* ---- 命理契合区 ---- */
  function renderFortune(an, bazi) {
    var box = $('fortuneBox');
    if (!bazi) {
      box.innerHTML =
        '<div class="sec-title">本命幸运数字 · 专属尾号</div>' +
        '<div class="callout"><b>还差一步：</b>回到上方填上「出生日期与时间」（不知时辰可勾选按午时粗参），再点一次分析，即可拿到 <b>本命幸运数字 + 五行契合度 + 专属尾号参考</b>（若当日免费次数已用罄，请先随缘添灯再测）。现在先看一组通用吉星尾号结构作参考：</div>' +
        genericTailsHTML();
      return;
    }
    var lucky = NE.baziLucky(bazi);
    var fit = NE.phoneFit(an, bazi);
    var tails = NE.recommendTails(bazi, 4);

    /* 八字侧 */
    var pillarH = '<div class="cols4">';
    bazi.pillars.forEach(function (p) {
      pillarH += '<div class="col-pillar' + (p.key === 'd' ? ' day' : '') + '">' +
        '<div class="nm">' + p.name + '</div>' +
        '<div class="gz"><span style="color:' + WX_COLOR[p.gWx] + '">' + p.g + '</span>' +
        '<span style="color:' + WX_COLOR[p.zWx] + '">' + p.z + '</span></div>' +
        '<div class="hz">藏 ' + p.hide.map(function (x) {
          return '<span style="color:' + WX_COLOR[x.wx] + '">' + x.g + '</span>';
        }).join(' ') + '</div></div>';
    });
    pillarH += '</div>';

    var strengthTxt;
    var strengthLines = {
      '身强': '身强能担，喜用「克泄耗」以泄旺气',
      '偏强': '偏强主势足，喜用「克泄耗」稍作疏导',
      '中和': '中和之局顺势流通，按五行均衡略补即可',
      '偏弱': '偏弱宜「印比」生扶，先补自身底气',
      '身弱': '身弱宜「印比」生扶，靠山与同路最养身'
    };
    var why = '';
    if (bazi.strength === '中和') {
      why = '命局五行能量总体中和，不必强行分喜忌；此处取原局最缺的「' + lucky.favorWx + '」（' + bazi.least + '偏弱）作补益方向，属柔和的均衡参考。';
    } else {
      why = '您日主属「' + bazi.dayWx + '」，命局' + bazi.strength + '。按扶抑法参考，喜用五行：<b>' + lucky.xi.join('、') + '</b>（' + strengthLines[bazi.strength] + '）；忌神五行：' + lucky.ji.join('、') + '。选号 / 用数时让「' + lucky.favorWx + '」声量略高，气场更顺。';
    }

    var numTiles = '';
    lucky.nums.forEach(function (n) {
      numTiles += '<div class="num-tile"><b style="color:' + WX_COLOR[lucky.favorWx] + '">' + n + '</b>' +
        '<span>河图 · ' + lucky.favorWx + '</span><em>宜补·' + lucky.favorWx + '</em></div>';
    });

    var fitH = '<div class="sec-title">号码 × 命理 · 契合度</div>' +
      '<div class="fit-box"><div class="fit-pct">' + fit.pct + '%<small>' + fit.lv + '</small></div>' +
      '<div class="fit-info"><b>本号数字五行中，「' + lucky.favorWx + '」（' + lucky.nums.join('、') + '）占比 ' + fit.pct + '%</b><p>' + fit.note + '</p></div></div>';

    /* 尾号推荐 */
    var tailH = '<div class="sec-title">专属尾号参考 · 与本命数字相配</div>' +
      '<div class="tail-list">';
    var counter = 0;
    tails.tails.forEach(function (t) {
      counter++;
      tailH += '<div class="tail-item">' +
        '<b>' + t.tail4 + '</b>' +
        '<span class="tp">「' + t.first + '」+「' + t.second + '」两吉衔接，中间组无凶冲撞；' +
        (t.first + t.second === '天医天医' ? '财气连贯' : '') +
        (t.hit === 2 ? '其中两数皆为本命数字，共鸣最足。' : (t.hit === 1 ? '其中含 1 个本命数字。' : '为通用纯吉结构，可作备选。')) + '</span>' +
        (t.hit ? '<span class="tg">含本命数 ×' + t.hit + '</span>' : '<span class="tg" style="color:#31586d;background:#e0edf1;border-color:#b3cdd6;">通用吉构</span>') +
        '</div>';
    });
    tailH += '</div>';

    var numWx = an.numWx.st;
    var numBarH = '<div class="sec-title">号码数字五行 · 含量</div>' +
      '<div class="wx-grid">' + wxBarsHTML(numWx, an.phone.length) + '</div>' +
      '<div class="plain small">' + NUM_WX_TEXT + '</div>';

    box.innerHTML =
      '<div class="sec-title">命理契合 · 您的八字画像</div>' +
      '<div class="fate-line">出生公历：' + ($('bdDate').value) + '　' +
      (($('noTime').checked ? '时辰不详（按午时粗参）' : '出生时间 ' + ($('bdTime').value || '—')) ) +
      '　日主：<b>「' + bazi.dayGan + '」</b>（' + bazi.dayWx + '）　强弱：' + bazi.strength + '</div>' +
      pillarH +
      '<div class="plain" style="margin-top:10px;">' +
      '日主天干：' + bazi.dayGan + '（' + bazi.dayWx + '）。五行能量分布如下，月令所趋基本写在这张表里。' +
      '喜用忌神由「得令 · 通根 · 透干」简化模型按扶抑法粗取，仅供趣味参考。' + '</div>' +
      '<div class="sec-title">八字五行能量</div>' +
      '<div class="wx-grid">' + wxBarsHTML(bazi.energy) + '</div>' +
      numBarH +
      '<div class="sec-title">本命幸运数字</div>' +
      '<div class="lucky-card"><div class="lucky-head">您的本命幸运数字 · 属「' + lucky.favorWx + '」（河图数）</div>' +
      '<div class="lucky-nums">' + numTiles + '</div>' +
      '<div class="lucky-why">' + why + '</div></div>' +
      fitH +
      tailH +
      '<div class="callout"><b>换号小提醒：</b>以上尾号为“结构参考”，实际挑号还应看整号后段不要连续出现绝命、五鬼、六煞、祸害，也不宜让 0、5 扎堆收尾；最省心的办法是把纠结的候选号带到页底「留灯结缘」，加馆主微信，让馆主帮您逐个过一遍。改号量力而行，号码只是助缘，生活里的行动才是真改运。</div>';
  }

  function genericTailsHTML() {
    var tails = NE.recommendTails(null, 3);
    var h = '<div class="tail-list">';
    tails.tails.forEach(function (t) {
      h += '<div class="tail-item"><b>' + t.tail4 + '</b>' +
        '<span class="tp">「' + t.first + '」+「' + t.second + '」两吉衔接，中间无凶冲撞。</span>' +
        '<span class="tg" style="color:#31586d;background:#e0edf1;border-color:#b3cdd6;">通用吉构</span></div>';
    });
    h += '</div>';
    return h;
  }

  /* ============ 结缘线索收集 ============ */
  function getLeads() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function saveLeads(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* 隐私模式等 */ }
  }
  function bindLead() {
    var noteTxt = '';
    $('leadBtn').addEventListener('click', function () {
      var txt = ($('leadWish').value || '').trim();
      if (!txt) { toast('先写一句您想解决的方向，馆主才知道怎么帮您'); $('leadWish').focus(); return; }

      /* 本机留档（店主 #admin 可看） */
      var now = new Date();
      function p(n) { return n < 10 ? '0' + n : '' + n; }
      var rec = {
        id: now.getTime(),
        t: now.getFullYear() + '-' + p(now.getMonth() + 1) + '-' + p(now.getDate()) + ' ' + p(now.getHours()) + ':' + p(now.getMinutes()),
        wish: txt
      };
      var list = getLeads();
      list.push(rec);
      saveLeads(list);

      /* 远程转发（可选）：配置了 SHOP.collectEndpoint 才发送 */
      if (SHOP.collectEndpoint) {
        var payload = { wish: txt, source: 'digit-energy' };
        try {
          fetch(SHOP.collectEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(function () { /* 静默 */ });
        } catch (e) { /* 静默 */ }
      }

      /* 把“想解决的方向”复制成加好友备注，再弹出店主微信二维码 */
      noteTxt = (SHOP.name || '数字能量馆') + '留灯 · ' + txt;
      copyAny(noteTxt, function () {
        $('leadSub').innerHTML = '想解决的方向已复制 ✓<br>扫一扫加馆主，粘贴即为备注';
        $('leadOverlay').classList.add('show');
        toast('备注已复制 · 去微信加馆主粘贴');
      });
      refreshAdmin();
    });

    $('leadCopyBtn').addEventListener('click', function () {
      copyAny(noteTxt, function () { toast('备注已再次复制 · 去微信粘贴'); });
    });
    $('leadClose').addEventListener('click', function () { $('leadOverlay').classList.remove('show'); });
    $('leadCancel').addEventListener('click', function () { $('leadOverlay').classList.remove('show'); });
  }

  /* ============ 店主后台 ============ */
  function csvField(v) {
    var s = String(v == null ? '' : v).replace(/"/g, '""');
    return '"' + s + '"';
  }
  function leadsToCSV(list) {
    var rows = [['时间', '想解决的方向'].map(csvField).join(',')];
    list.forEach(function (r) {
      rows.push([r.t, (r.wish || r.memo || '')].map(csvField).join(','));
    });
    return '\ufeff' + rows.join('\r\n');
  }
  function nowStamp() {
    var d = new Date();
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate());
  }
  function refreshAdmin() {
    if (!$('adminArea').hidden) renderAdmin();
  }
  function renderAdmin() {
    var list = getLeads();
    $('adminCount').innerHTML = '<div class="plain small">共收录 <b style="color:#a33327;">' + list.length + '</b> 条客户留灯（本机浏览器）。</div>';
    var h = '<table><tr><th>时间</th><th>想解决的方向（即复制给客户的加微信备注）</th></tr>';
    if (!list.length) {
      h = '<div class="empty">还没有客户留灯。页面底部「留灯结缘」提交后会自动收在这里（本机）。</div>';
    } else {
      list.forEach(function (r) {
        h += '<tr><td>' + esc(r.t || '') + '</td><td>' + esc(r.wish || r.memo || '') + '</td></tr>';
      });
      h += '</table>';
    }
    $('adminRows').innerHTML = h;
  }
  function bindAdmin() {
    function check() {
      var show = (location.hash === '#admin');
      $('adminArea').hidden = !show;
      if (show) {
        renderAdmin();
        window.scrollTo(0, document.body.scrollHeight);
      }
    }
    window.addEventListener('hashchange', check);
    if (location.hash === '#admin') check();

    $('exportCsv').addEventListener('click', function () {
      var csv = leadsToCSV(getLeads());
      if (!getLeads().length) { toast('还没有线索可导出'); return; }
      try {
        var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'leads-' + nowStamp() + '.csv';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
        toast('已导出 CSV');
      } catch (e) { toast('导出失败，试试“复制为表格文本”'); }
    });
    $('copyCsv').addEventListener('click', function () {
      var csv = leadsToCSV(getLeads());
      if (!getLeads().length) { toast('还没有线索可复制'); return; }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = csv;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); toast('已复制'); }
        catch (e) { toast('复制失败，请手动全选'); }
        ta.remove();
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(csv).then(function () { toast('已复制为表格文本'); }, fallback);
      } else fallback();
    });
    $('clearLeads').addEventListener('click', function () {
      if (!getLeads().length) { toast('本来就没有线索'); return; }
      if (window.confirm('确定清空本机收集的全部客户留灯？此操作不可恢复。')) {
        saveLeads([]);
        renderAdmin();
        toast('已清空');
      }
    });
  }

  /* ============ 启动 ============ */
  document.addEventListener('DOMContentLoaded', function () {
    initChrome();
    refreshDaily();
    bindPhoneInput($('phInput'), true);
    $('runBtn').addEventListener('click', doRun);
    bindPay();
    bindLead();
    bindAdmin();
  });
})();
