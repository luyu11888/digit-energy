/* ============================================================
 * 数字能量馆 · 号码磁场分析 core.js
 * ------------------------------------------------------------
 * 依赖：data.js（八星知识库）。纯函数，浏览器 / Node 皆可用。
 * 说明：磁场拆解采用“数字能量学”通行的相邻两两组合法，由左至右
 * 能量逐段加重；0 与 5 视为特殊数字不参与判星。评分与评级均为
 * 按流派规则整理的“娱乐参考模型”，供趣味参考。
 * ============================================================ */

var NE = (function () {

  var GAN = ['天医', '生气', '延年'];       /* 吉星 */
  var XIONG = ['绝命', '五鬼', '六煞', '祸害']; /* 凶星 */
  var PING = ['伏位'];

  /* ---------- 校验 ---------- */
  function cleanPhone(s) {
    if (!s) return '';
    s = String(s).replace(/[\s\-（）()]/g, '');
    return (/^1[3-9]\d{9}$/.test(s)) ? s : '';
  }

  /* ---------- 相邻两两拆解 ----------
   * 例：13812345678 → 13 38 81 12 23 34 45 56 67 78（10 组）
   * 位置权重由左到右线性上升：号段侧的数组只是“底色”。
   */
  function splitGroups(phone) {
    var groups = [], n = phone.length;
    for (var i = 0; i < n - 1; i++) {
      var pair = phone.substr(i, 2);
      var m = NUM_MAP[pair];
      var w = 0.55 + (i / (n - 2)) * 0.85; /* 0.55 → 1.4 */
      var special = false;
      if (!m) {
        /* 不在八星表 → 多为含 0 或 5 的组合，作特殊位处理 */
        special = (pair.indexOf('0') > -1 || pair.indexOf('5') > -1);
      }
      groups.push({
        i: i,
        pair: pair,
        star: m ? m.star : '',
        lv: m ? m.lv : 0,
        type: m ? m.type : (special ? '特殊' : '平'),
        w: Math.round(w * 100) / 100,
        special: special
      });
    }
    return groups;
  }

  /* ---------- 数字五行含量统计 ---------- */
  function numWxStat(phone) {
    var st = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
    var n = 0;
    phone.split('').forEach(function (ch) {
      var d = parseInt(ch, 10);
      if (!isNaN(d)) { st[NUM_WX[d]]++; n++; }
    });
    return { st: st, n: n };
  }

  /* ---------- 主分析 ---------- */
  function analyzePhone(phone) {
    var groups = splitGroups(phone);
    var posW = 0, negW = 0, neuW = 0, spW = 0;
    var starHit = {};           /* 各星被命中组数（伏位不含） */
    var tail = [];              /* 尾段两组 */
    var n0 = 0, n5 = 0;
    phone.split('').forEach(function (ch) {
      if (ch === '0') n0++;
      if (ch === '5') n5++;
    });

    groups.forEach(function (g) {
      if (g.i >= groups.length - 2) tail.push(g);
      if (g.special) { spW += g.w * 0.35; return; }
      var v = (4 - g.lv); /* lv1 最强者记 3 分 */
      if (g.type === '吉') { posW += g.w * v; }
      else if (g.type === '凶') { negW += g.w * v; }
      else { neuW += g.w * 0.8; }
      if (g.type !== '平') {
        if (!starHit[g.star]) starHit[g.star] = 0;
        starHit[g.star]++;
      }
    });

    var posCnt = groups.filter(function (g) { return g.type === '吉'; }).length;
    var negCnt = groups.filter(function (g) { return g.type === '凶'; }).length;
    var neuCnt = groups.filter(function (g) { return g.type === '平' && !g.special; }).length;
    var spCnt = groups.filter(function (g) { return g.special; }).length;

    var denom = posW + negW + neuW + spW;
    var score01 = (denom <= 0) ? 0.55 : (posW + neuW * 0.5 + spW * 0.35) / denom;

    /* 尾组收尾的微调（展示用） */
    var last = groups[groups.length - 1];
    var tailAdj = 0;
    if (last && last.type === '吉') tailAdj = 4;
    else if (last && last.type === '凶') tailAdj = -6;
    var display = Math.max(6, Math.min(96, Math.round(score01 * 100) + tailAdj));

    /* 评级 */
    var levelName, levelNote;
    if (score01 >= 0.8) { levelName = '气场上佳'; levelNote = '吉星磁场充分且收尾有力，整体属于“越用越顺”的配置。'; }
    else if (score01 >= 0.7) { levelName = '气场良顺'; levelNote = '吉多于凶，整体平稳向上；把尾段多看两眼即可。'; }
    else if (score01 >= 0.6) { levelName = '气场平稳'; levelNote = '吉凶大体均衡，中性磁场较多，属“无功无过、贵在踏实”。'; }
    else if (score01 >= 0.5) { levelName = '吉凶参半'; levelNote = '凶星略占上风，重点留意尾段，生活中宜以行动化解犹疑。'; }
    else { levelName = '宜多加调和'; levelNote = '凶星磁场偏强，若近期确有诸多不顺，可考虑择吉调整号码。'; }

    return {
      phone: phone,
      groups: groups,
      posW: posW, negW: negW, neuW: neuW,
      posCnt: posCnt, negCnt: negCnt, neuCnt: neuCnt, spCnt: spCnt,
      starHit: starHit,
      tail: tail,
      tailAdj: tailAdj,
      display: display,
      score01: score01,
      levelName: levelName,
      levelNote: levelNote,
      n0: n0, n5: n5,
      numWx: numWxStat(phone),
      fmt: phone.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1 $2 $3')
    };
  }

  /* ---------- 规则化生成白话解说 ---------- */
  function explain(an) {
    var arr = [];
    var fmt = an.phone.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1 $2 $3');

    /* 1. 概览 */
    var desc;
    if (an.score01 >= 0.8) desc = '本号「' + fmt + '」拆出 ' + an.groups.length + ' 组两两磁场，其中吉星 ' + an.posCnt + ' 组、凶星 ' + an.negCnt + ' 组' +
      (an.neuCnt ? '、伏位等中性 ' + an.neuCnt + ' 组' : '') +
      (an.spCnt ? '、0/5 特殊位 ' + an.spCnt + ' 组' : '') + '。吉气明显压过凶气，是让人安心的底子。';
    else if (an.score01 >= 0.6) desc = '本号「' + fmt + '」共拆出 ' + an.groups.length + ' 组两两磁场：吉星 ' + an.posCnt + ' 组、凶星 ' + an.negCnt + ' 组' +
      (an.neuCnt ? '、中性 ' + an.neuCnt + ' 组' : '') + '。没有一边倒，属于「看得见的起伏都在可控范围」。';
    else desc = '本号「' + fmt + '」共拆出 ' + an.groups.length + ' 组两两磁场：吉星 ' + an.posCnt + ' 组、凶星 ' + an.negCnt + ' 组。凶星声量偏大，号码若已用多年也不必焦虑——' +
      '磁场是“比例”而非“判刑”，先看懂哪里在耗，再从生活里补回来。';
    arr.push({ icon: '总', text: desc });

    /* 2. 主调星 */
    var sorted = [];
    for (var s in an.starHit) sorted.push({ star: s, c: an.starHit[s] });
    sorted.sort(function (a, b) { return b.c - a.c; });
    if (sorted.length) {
      var top = sorted[0];
      var topText = '本号磁场以「' + top.star + '」为最突出主调（命中 ' + top.c + ' 组）。' +
        (EIGHT_STARS[top.star] ? EIGHT_STARS[top.star].text : '');
      arr.push({ icon: '主', text: topText });
      if (sorted.length > 1) {
        var sec = sorted[1];
        arr.push({ icon: '次', text: '其次是「' + sec.star + '」' + sec.c + ' 组，' + (EIGHT_STARS[sec.star] ? EIGHT_STARS[sec.star].text : '') });
      }
    } else {
      arr.push({ icon: '主', text: '本号几乎没有命中标准吉凶数组，以 0/5 与中性磁场为主——这类号码“个性不显”，好坏更多取决于使用者本人的状态。' });
    }

    /* 3. 凶星连续段 */
    var runs = [];
    for (var i = 0; i < an.groups.length; i++) {
      var g = an.groups[i];
      if (g.type === '凶') {
        var j = i;
        while (j + 1 < an.groups.length && an.groups[j + 1].type === '凶') j++;
        if (j - i >= 1) runs.push({ from: i, to: j });
        i = j;
      }
    }
    if (runs.length) {
      runs.forEach(function (r) {
        var seg = an.groups.slice(r.from, r.to + 1).map(function (x) { return x.pair + '「' + x.star + '」'; }).join(' → ');
        arr.push({ icon: '连', text: '第 ' + (r.from + 1) + '–' + (r.to + 1) + ' 位出现连续凶星（' + seg + '），' +
          '连续凶星易把同一类消耗“串起来”，是调号时优先想动的地方。' });
      });
    } else if (an.negCnt >= 2) {
      arr.push({ icon: '吉', text: '凶星没有连续扎堆，说明负面磁场被吉星间隔打断，消耗会被自然化解。' });
    }

    /* 4. 尾段 */
    if (an.tail.length) {
      var tailTxt = an.tail.map(function (g) {
        if (g.special) return '第' + (g.i + 1) + '位含 0/5（特殊位）';
        return '第' + (g.i + 1) + '组 ' + g.pair + '「' + g.star + '」';
      }).join('、');
      var last = an.tail[an.tail.length - 1];
      var lastGood = (last.type === '吉');
      var lastTxt = lastGood
        ? '尾数收在吉星「' + last.star + '」上，是很漂亮的收尾——号码的“后劲”偏暖，越到后面越有托底。'
        : (last.type === '凶'
          ? '尾数落在「' + last.star + '」上，凶星收尾会放大“结尾感”：做事易虎头蛇尾或在临门一脚出状况，是调号首选要改的位置。'
          : (last.special
            ? '尾数含特殊位（0/5），能量偏隐偏藏：好事不易张扬，坏事也不易放大，属“低调型”收尾。'
            : '尾数为伏位等延续磁场，后劲平稳，属于慢热型。'));
      arr.push({ icon: '尾', text: '看号码先看尾。本号尾段：' + tailTxt + '。' + lastTxt });
    }

    /* 5. 0 与 5 */
    if (an.n0 || an.n5) {
      var t = [];
      if (an.n5) t.push('含「5」' + an.n5 + ' 个——' + ZERO_FIVE_TEXT['5']);
      if (an.n0) t.push('含「0」' + an.n0 + ' 个——' + ZERO_FIVE_TEXT['0']);
      arr.push({ icon: '特', text: t.join('；') });
    }
    return arr;
  }

  /* ---------- 八字 → 本命幸运数字 / 建议五行 ---------- */
  function baziLucky(b) {
    if (!b || !b.ok) return null;
    var wx = b.suggest;
    return {
      favorWx: wx,
      nums: WX_NUMS[wx].slice(),
      strength: b.strength,
      xi: b.xi,
      ji: b.ji,
      most: b.most,
      least: b.least
    };
  }

  /* ---------- 号码与本命喜用的契合度 ---------- */
  function phoneFit(an, b) {
    if (!b || !b.ok) return null;
    var lucky = baziLucky(b);
    var wantSet = {};
    lucky.nums.forEach(function (d) { wantSet[d] = true; });
    var hit = 0, total = 0;
    an.phone.split('').forEach(function (ch) {
      var d = parseInt(ch, 10);
      if (isNaN(d)) return;
      total++;
      if (wantSet[d]) hit++;
    });
    var pct = total ? Math.round((hit / total) * 100) : 0;
    var lv, note;
    if (pct >= 45) { lv = '高契合'; note = '号码里属「' + lucky.favorWx + '」的数字浓度高，与本命“宜补之气”相当合拍。'; }
    else if (pct >= 30) { lv = '契合良好'; note = '喜用数字含量中等偏上，气场大方向对路。'; }
    else if (pct >= 18) { lv = '契合一般'; note = '喜用数字偏少，但可借颜色、方位等日常小物补益，不必急于换号。'; }
    else { lv = '契合偏弱'; note = '本号很少“撞”到命主宜补的数字；若常感号码气场不对，可参考下方尾号建议。'; }
    return { pct: pct, lv: lv, note: note, lucky: lucky };
  }

  /* ---------- 推荐尾号（吉星组合 + 命主数字筛选） ---------- */
  function isSafeCross(p) {
    /* 拼接后中间生成的两位不可是凶星 / 0-5 */
    if (!NUM_MAP[p]) return !(p.indexOf('0') > -1 || p.indexOf('5') > -1);
    return NUM_MAP[p].type !== '凶';
  }

  function pairScore(pair, luckyNums) {
    var m = NUM_MAP[pair];
    var hit = 0;
    pair.split('').forEach(function (ch) {
      if (luckyNums && luckyNums.indexOf(parseInt(ch, 10)) > -1) hit++;
    });
    var starRank = { '天医': 0, '延年': 1, '生气': 2 };
    var base = (4 - (m ? m.lv : 0)) * 2 + (hit * 6) + (starRank[m.star] !== undefined ? (2 - starRank[m.star]) : 0);
    return base;
  }

  function recommendTails(b, wantCount) {
    wantCount = wantCount || 4;
    var lucky = (b && b.ok) ? baziLucky(b) : { nums: [], favorWx: '' };
    var luckyNums = lucky.nums || [];
    var pool = [];
    GAN.forEach(function (sn) {
      EIGHT_STARS[sn].nums.forEach(function (p) {
        pool.push({ p: p, star: sn, sc: pairScore(p, luckyNums) });
      });
    });
    pool.sort(function (a, b2) { return b2.sc - a.sc; });
    var topPairs = pool.slice(0, 6).map(function (x) { return x.p; });

    var cands = [];
    for (var i = 0; i < topPairs.length; i++) {
      for (var j = 0; j < topPairs.length; j++) {
        if (i === j) continue;
        var A = topPairs[i], B = topPairs[j];
        var cross = A.charAt(1) + B.charAt(0); /* 拼接 A+B：…ab cd… 中间组 = b+c → A尾 + B头 */
        if (!isSafeCross(cross)) continue;
        var tail4 = A + B;
        var hit = 0;
        tail4.split('').forEach(function (ch) {
          if (luckyNums.indexOf(parseInt(ch, 10)) > -1) hit++;
        });
        cands.push({
          tail4: tail4,
          first: NUM_MAP[A].star, second: NUM_MAP[B].star,
          hit: hit, crossOK: true
        });
      }
    }
    /* 去重 */
    var seen = {}, out = [];
    cands.forEach(function (c) {
      if (seen[c.tail4]) return;
      seen[c.tail4] = true;
      out.push(c);
    });
    out.sort(function (a, b2) {
      if (b2.hit !== a.hit) return b2.hit - a.hit;
      return a.tail4 < b2.tail4 ? -1 : 1;
    });
    /* 尽量保证不同组合的多样性 */
    var final = [], used1 = {};
    out.forEach(function (c) {
      if (final.length >= wantCount) return;
      var key = c.first + '|' + c.second;
      if (used1[key]) return;
      used1[key] = true;
      final.push(c);
    });
    if (final.length < wantCount) {
      out.forEach(function (c) {
        if (final.length >= wantCount) return;
        if (final.indexOf(c) === -1) final.push(c);
      });
    }
    return { lucky: lucky, tails: final.slice(0, wantCount) };
  }

  return {
    cleanPhone: cleanPhone,
    splitGroups: splitGroups,
    analyzePhone: analyzePhone,
    explain: explain,
    baziLucky: baziLucky,
    phoneFit: phoneFit,
    recommendTails: recommendTails,
    GAN: GAN, XIONG: XIONG, PING: PING
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NE;
}
