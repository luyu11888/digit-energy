/* ============================================================
 * 数字能量馆 · 八字五行抽取 astro.js
 * ------------------------------------------------------------
 * 用途：仅从出生时间抽取「日主五行 / 五行能量 / 旺衰 / 喜用忌神」，
 * 供 core.js 匹配号码五行、计算本命幸运数字。不做完整排盘渲染。
 * 历法由 lib/lunar.js（6tail，MIT）计算；旺衰喜用采用与
 * bazi-mingli 项目一致的「得令 / 通根 / 透干」简化模型 + 扶抑取法。
 * ============================================================ */

/* 十神：以日干为主，看另一干五行关系 */
function ssRel(dayGan, otherGan) {
  var d = GAN_DETAIL[dayGan], o = GAN_DETAIL[otherGan];
  if (d.wx === o.wx) return '同';
  if (WX_SHENG[d.wx] === o.wx) return '我生';
  if (WX_SHENG[o.wx] === d.wx) return '生我';
  if (WX_KE[d.wx] === o.wx) return '我克';
  return '克我';
}

function _uniqueArr(a) { var o = {}, r = []; a.forEach(function (x) { if (!o[x]) { o[x] = 1; r.push(x); } }); return r; }

/* 找谁生/谁克某五行 */
function _whoSheng(wx) { for (var i = 0; i < WX_ORDER.length; i++) if (WX_SHENG[WX_ORDER[i]] === wx) return WX_ORDER[i]; return ''; }
function _whoKe(wx) { for (var i = 0; i < WX_ORDER.length; i++) if (WX_KE[WX_ORDER[i]] === wx) return WX_ORDER[i]; return ''; }

/**
 * opts: { y, m, d, h, min }
 * 返回轻量八字画像；出生信息不足时返回 { ok:false }。
 */
function calcBaziDigest(opts) {
  try {
    var solar = Solar.fromYmdHms(opts.y, opts.m, opts.d, opts.h, opts.min, 0);
  } catch (e) { return { ok: false }; }
  try {
    var lunar = solar.getLunar();
    var ec = lunar.getEightChar();
    ec.setSect(2); /* 子正换日（默认流派） */
  } catch (e) { return { ok: false }; }

  var dayGan = ec.getDayGan();

  /* 四柱干支 + 地支藏干五行 */
  var pillars = [
    { key: 'y', name: '年柱', g: ec.getYearGan(), z: ec.getYearZhi() },
    { key: 'm', name: '月柱', g: ec.getMonthGan(), z: ec.getMonthZhi() },
    { key: 'd', name: '日柱', g: dayGan, z: ec.getDayZhi() },
    { key: 't', name: '时柱', g: ec.getTimeGan(), z: ec.getTimeZhi() }
  ];

  /* 五行能量（加权：天干 1；本气 1.4；余气 0.35） */
  var energy = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
  var addE = function (wx, w) { energy[wx] += w; };
  pillars.forEach(function (p) {
    addE(GAN_DETAIL[p.g].wx, 1);
    ZHI_DETAIL[p.z].hide.forEach(function (hg, i) { addE(GAN_DETAIL[hg].wx, i === 0 ? 1.4 : 0.35); });
  });

  var dayWx = GAN_DETAIL[dayGan].wx;
  var monthZhi = pillars[1].z;
  var monthMainWx = ZHI_DETAIL[monthZhi].wx;
  var lingPoint;
  if (monthMainWx === dayWx) lingPoint = 2;
  else if (WX_SHENG[monthMainWx] === dayWx) lingPoint = 2;
  else if (WX_SHENG[dayWx] === monthMainWx) lingPoint = 0;
  else if (WX_KE[dayWx] === monthMainWx) lingPoint = 0;
  else lingPoint = 0;

  /* 通根：地支藏干同我者（本气/中余皆计根） */
  var genCount = 0, rootList = [];
  pillars.forEach(function (p) {
    ZHI_DETAIL[p.z].hide.forEach(function (hg, i) {
      if (GAN_DETAIL[hg].wx === dayWx) { genCount++; if (i === 0) rootList.push(p.name + '·' + p.z + '本气'); }
    });
  });

  /* 透干帮身：年月时干中 比劫(同)/印(生我) 个数 */
  var ganHelp = 0;
  [pillars[0], pillars[1], pillars[3]].forEach(function (p) {
    var rel = ssRel(dayGan, p.g);
    if (rel === '同' || rel === '生我') ganHelp++;
  });

  var strength;
  if (lingPoint === 2) {
    if (genCount >= 3) strength = '身强';
    else if (genCount >= 1) strength = '偏强';
    else strength = (ganHelp >= 2) ? '偏强' : '中和';
  } else {
    if (genCount === 0) strength = (ganHelp <= 0) ? '身弱' : (ganHelp === 1 ? '偏弱' : '中和');
    else if (genCount === 1) strength = (ganHelp >= 1) ? '中和' : '偏弱';
    else strength = '中和';
  }

  /* 喜用 / 忌神（扶抑取法，供娱乐参考） */
  var yinWx = _whoSheng(dayWx);      /* 印 */
  var guanWx = _whoKe(dayWx);        /* 官杀 */
  var shiShangWx = WX_SHENG[dayWx];  /* 食伤 */
  var caiWx = WX_KE[dayWx];          /* 财 */
  var xi = [], ji = [];
  if (strength === '身强' || strength === '偏强') { xi = [guanWx, shiShangWx, caiWx]; ji = [dayWx, yinWx]; }
  else if (strength === '身弱' || strength === '偏弱') { xi = [yinWx, dayWx]; ji = [shiShangWx, guanWx, caiWx]; }
  xi = _uniqueArr(xi); ji = _uniqueArr(ji);

  var sortedWx = WX_ORDER.slice().sort(function (a, b) { return energy[b] - energy[a]; });
  var most = sortedWx[0], least = sortedWx[sortedWx.length - 1];

  /* 身弱/中和时补“最缺”五行作趣味建议（中和无明确喜用则取最缺者） */
  var suggest = xi.length ? xi[0] : least;

  return {
    ok: true,
    pillars: pillars.map(function (p) {
      return {
        key: p.key, name: p.name, g: p.g, z: p.z,
        gWx: GAN_DETAIL[p.g].wx, zWx: ZHI_DETAIL[p.z].wx,
        hide: ZHI_DETAIL[p.z].hide.map(function (hg) { return { g: hg, wx: GAN_DETAIL[hg].wx }; })
      };
    }),
    dayGan: dayGan, dayWx: dayWx,
    energy: energy, sortedWx: sortedWx, most: most, least: least,
    strength: strength, genCount: genCount, ganHelp: ganHelp, rootList: rootList,
    xi: xi, ji: ji, suggest: suggest
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcBaziDigest: calcBaziDigest };
}
