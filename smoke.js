/* 冒烟测试：模拟浏览器按 index.html 的加载顺序执行各脚本，校验核心计算。
 * 运行：node smoke.js   （Node 8.9+）
 */
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

['lib/lunar.js', 'data.js', 'astro.js', 'core.js'].forEach(function (f) {
  var code = fs.readFileSync(path.join(__dirname, f), 'utf8');
  vm.runInThisContext(code, { filename: f });
});

/* 从 global 取函数（顶层 var 已被 runInThisContext 写入 global） */
var calcBaziDigest = global.calcBaziDigest;
var NE = global.NE;
var NUM_MAP = global.NUM_MAP;
var EIGHT_STARS = global.EIGHT_STARS;
var NUM_WX = global.NUM_WX;
var GAN_DETAIL = global.GAN_DETAIL;

var pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ ' + msg); }
}

console.log('— 数字五行 —');
ok(NUM_WX[3] === '木' && NUM_WX[6] === '水' && NUM_WX[0] === '土', '河图数 3/6/0 → 木/水/土');
ok(NUM_MAP['13'].star === '天医' && NUM_MAP['13'].type === '吉', '13 → 天医吉');
ok(NUM_MAP['81'].star === '五鬼' && NUM_MAP['81'].type === '凶', '81 → 五鬼凶');
ok(NUM_MAP['11'].type === '平', '11 → 伏位平');
ok(!NUM_MAP['45'], '45 不在八星表（0/5 特殊）');

console.log('— 号码分析 —');
var an = NE.analyzePhone('13812345678');
ok(an.groups.length === 10, '13812345678 拆出 10 组两两');
ok(an.groups[0].star === '天医', '首组 13 → 天医');
ok(an.groups[7].special === true, '第 8 组 56 属 0/5 特殊');
ok(an.posCnt === 4 && an.negCnt === 4 && an.spCnt === 2, '吉4/凶4/特殊2 统计正确');
ok(an.display >= 6 && an.display <= 96, '总评显示值范围合理（' + an.display + '）');
ok(NE.explain(an).length >= 3, '白话解说至少 3 条');
var bad = NE.cleanPhone('12345678901');
ok(bad === '', '非法号码（12 开头）被拦截');

console.log('— 八字抽取（1995-08-08 08:30 坤造） —');
var b = calcBaziDigest({ y: 1995, m: 8, d: 8, h: 8, min: 30 });
ok(b && b.ok === true, '历法排盘成功');
ok(b.dayGan && GAN_DETAIL[b.dayGan], '日主存在: ' + b.dayGan);
var tot = 0; for (var w in b.energy) tot += b.energy[w];
ok(tot > 0, '五行能量合计 > 0（' + tot.toFixed(1) + '）');
ok(b.xi.length + b.ji.length > 0 || b.strength === '中和', '喜用忌神模型输出正常');
ok(['身强', '偏强', '中和', '偏弱', '身弱'].indexOf(b.strength) > -1, '强弱档位合法: ' + b.strength);

console.log('— 命理契合 & 尾号 —');
var fit = NE.phoneFit(an, b);
ok(fit && fit.pct >= 0 && fit.pct <= 100, '契合度 0-100：' + (fit && fit.pct));
var tails = NE.recommendTails(b, 4);
ok(tails.tails.length > 0, '八字版尾号推荐 ≥1（得 ' + tails.tails.length + '）');
var gs = NE.recommendTails(null, 3);
ok(gs.tails.length > 0, '通用版（无八字）尾号推荐 ≥1');
gs.tails.forEach(function (t) {
  ok(/^\d{4}$/.test(t.tail4), '尾号 ' + t.tail4 + ' 为 4 位数字');
});

console.log('— 无八字降级 —');
ok(NE.baziLucky({ ok: false }) === null, 'baziLucky 对失败输入返回 null');

console.log('\n通过 ' + pass + ' 项 / 失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
