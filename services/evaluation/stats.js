function normalCDF(x) {
  var t = 1 / (1 + 0.2316419 * Math.abs(x));
  var d = 0.3989423 * Math.exp(-x * x / 2);
  var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

function wilcoxonSignedRank(metricsA, metricsB) {
  var diffs = [];
  for (var i = 0; i < metricsA.length; i++) {
    var d = metricsA[i].ndcg - metricsB[i].ndcg;
    if (Math.abs(d) > 1e-9) diffs.push(d);
  }

  if (diffs.length === 0) return { pValue: 1, significant: false, W: 0 };

  var absDiffs = diffs.map(function(d, i) { return { absD: Math.abs(d), sign: Math.sign(d), index: i }; });
  absDiffs.sort(function(a, b) { return a.absD - b.absD; });

  var ranks = new Array(absDiffs.length);
  var i = 0;
  while (i < absDiffs.length) {
    var j = i;
    while (j < absDiffs.length && Math.abs(absDiffs[j].absD - absDiffs[i].absD) < 1e-9) {
      j++;
    }
    var rankSum = 0;
    for (var k = i; k < j; k++) rankSum += (k + 1);
    var avgRank = rankSum / (j - i);
    for (var k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }

  var wPlus = 0, wMinus = 0;
  for (var i = 0; i < absDiffs.length; i++) {
    if (absDiffs[i].sign > 0) wPlus += ranks[i];
    else wMinus += ranks[i];
  }

  var W = Math.min(wPlus, wMinus);
  var N = diffs.length;
  var meanW = N * (N + 1) / 4;
  var stdW = Math.sqrt(N * (N + 1) * (2 * N + 1) / 24);

  if (stdW === 0) return { pValue: 1, significant: false, W: W };
  var z = Math.abs((W - meanW) / stdW);
  var pValue = 2 * (1 - normalCDF(z));

  return {
    pValue: pValue,
    significant: pValue < 0.05,
    W: W,
    z: z
  };
}

module.exports = {
  wilcoxonSignedRank: wilcoxonSignedRank
};
