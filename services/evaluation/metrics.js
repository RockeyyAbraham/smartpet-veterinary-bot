// ---------------------------------------------------------------------------
// Retrieval evaluation metrics.
//
// All functions operate on arrays of title strings (not result objects) so
// they remain agnostic to the retrieval method producing the results.
//
// Caller is responsible for extracting title strings from result objects
// before passing them here.
// ---------------------------------------------------------------------------

/**
 * Precision@K — proportion of the top-K retrieved titles that are relevant.
 *
 * Formula:  |relevant ∩ retrieved[0..K-1]| / K
 *
 * @param {string[]} retrievedTitles  Ordered array of retrieved titles.
 * @param {string[]} relevantTitles   Ground-truth relevant titles.
 * @param {number}   k                Cut-off rank.
 * @returns {number} Float in [0, 1].
 */
function precisionAtK(retrievedTitles, relevantTitles, k) {
  if (!retrievedTitles || retrievedTitles.length === 0 || k === 0) {
    return 0;
  }

  var topK = retrievedTitles.slice(0, k);
  var relevantSet = {};

  for (var i = 0; i < relevantTitles.length; i++) {
    relevantSet[relevantTitles[i].toLowerCase().trim()] = true;
  }

  var hits = 0;
  for (var j = 0; j < topK.length; j++) {
    if (relevantSet[topK[j].toLowerCase().trim()]) {
      hits++;
    }
  }

  return hits / k;
}

/**
 * Recall@K — proportion of ground-truth relevant titles found in top-K.
 *
 * Formula:  |relevant ∩ retrieved[0..K-1]| / |relevant|
 *
 * @param {string[]} retrievedTitles  Ordered array of retrieved titles.
 * @param {string[]} relevantTitles   Ground-truth relevant titles.
 * @param {number}   k                Cut-off rank.
 * @returns {number} Float in [0, 1].
 */
function recallAtK(retrievedTitles, relevantTitles, k) {
  if (!relevantTitles || relevantTitles.length === 0) {
    return 0;
  }
  if (!retrievedTitles || retrievedTitles.length === 0) {
    return 0;
  }

  var topK = retrievedTitles.slice(0, k);
  var relevantSet = {};

  for (var i = 0; i < relevantTitles.length; i++) {
    relevantSet[relevantTitles[i].toLowerCase().trim()] = true;
  }

  var hits = 0;
  for (var j = 0; j < topK.length; j++) {
    if (relevantSet[topK[j].toLowerCase().trim()]) {
      hits++;
    }
  }

  return hits / relevantTitles.length;
}

/**
 * Mean Reciprocal Rank (MRR) — reciprocal rank of the first relevant result.
 *
 * Formula:  1 / rank_of_first_relevant_result
 *           0 if no relevant result is found.
 *
 * @param {string[]} retrievedTitles  Ordered array of retrieved titles.
 * @param {string[]} relevantTitles   Ground-truth relevant titles.
 * @returns {number} Float in [0, 1].
 */
function meanReciprocalRank(retrievedTitles, relevantTitles) {
  if (!retrievedTitles || retrievedTitles.length === 0) {
    return 0;
  }
  if (!relevantTitles || relevantTitles.length === 0) {
    return 0;
  }

  var relevantSet = {};
  for (var i = 0; i < relevantTitles.length; i++) {
    relevantSet[relevantTitles[i].toLowerCase().trim()] = true;
  }

  for (var rank = 0; rank < retrievedTitles.length; rank++) {
    if (relevantSet[retrievedTitles[rank].toLowerCase().trim()]) {
      return 1 / (rank + 1); // rank is 0-based; +1 converts to 1-based
    }
  }

  return 0; // No relevant result found
}

/**
 * NDCG@K — Normalized Discounted Cumulative Gain at rank K.
 *
 * DCG  = Σ rel(i) / log2(i + 1)  for i = 1..K  (1-based rank)
 *        where rel(i) = 1 if relevant, 0 otherwise
 *
 * IDCG = DCG of the ideal ranking (all relevant docs at top)
 * NDCG = DCG / IDCG
 *
 * @param {string[]} retrievedTitles  Ordered array of retrieved titles.
 * @param {string[]} relevantTitles   Ground-truth relevant titles.
 * @param {number}   k                Cut-off rank.
 * @returns {number} Float in [0, 1].
 */
function ndcgAtK(retrievedTitles, relevantTitles, k) {
  if (!retrievedTitles || retrievedTitles.length === 0 || k === 0) {
    return 0;
  }
  if (!relevantTitles || relevantTitles.length === 0) {
    return 0;
  }

  var relevantSet = {};
  for (var i = 0; i < relevantTitles.length; i++) {
    relevantSet[relevantTitles[i].toLowerCase().trim()] = true;
  }

  // Compute DCG for the actual retrieved order
  var dcg = 0;
  var topK = retrievedTitles.slice(0, k);
  for (var rank = 0; rank < topK.length; rank++) {
    var relevance = relevantSet[topK[rank].toLowerCase().trim()] ? 1 : 0;
    dcg += relevance / Math.log2(rank + 2); // rank+2 because rank is 0-based and formula uses rank+1
  }

  // Compute ideal DCG — all relevant docs placed at the top positions
  var idealRelevantCount = Math.min(relevantTitles.length, k);
  var idcg = 0;
  for (var idealRank = 0; idealRank < idealRelevantCount; idealRank++) {
    idcg += 1 / Math.log2(idealRank + 2);
  }

  if (idcg === 0) {
    return 0;
  }

  return dcg / idcg;
}

/**
 * Measures retrieval latency in milliseconds.
 *
 * @param {number} startTime  Result of Date.now() before retrieval.
 * @param {number} endTime    Result of Date.now() after retrieval.
 * @returns {number} Latency in milliseconds (integer).
 */
function measureLatency(startTime, endTime) {
  return Math.round(endTime - startTime);
}

/**
 * Averages a metric across an array of per-query metric objects.
 * Handles any set of numeric keys uniformly — keys are discovered
 * from the first element of the array.
 *
 * @param {Array<object>} metricsArray  Array of metric result objects.
 * @returns {object} Object with averaged value for each metric key.
 */
function averageMetrics(metricsArray) {
  if (!metricsArray || metricsArray.length === 0) {
    return {};
  }

  var keys = Object.keys(metricsArray[0]);
  var sums = {};
  var averages = {};

  // Initialise sums to 0
  for (var k = 0; k < keys.length; k++) {
    sums[keys[k]] = 0;
  }

  // Accumulate sums
  for (var i = 0; i < metricsArray.length; i++) {
    var item = metricsArray[i];
    for (var j = 0; j < keys.length; j++) {
      var key = keys[j];
      var value = typeof item[key] === 'number' ? item[key] : 0;
      sums[key] += value;
    }
  }

  // Compute averages
  for (var m = 0; m < keys.length; m++) {
    averages[keys[m]] = sums[keys[m]] / metricsArray.length;
  }

  return averages;
}

module.exports = {
  precisionAtK:        precisionAtK,
  recallAtK:           recallAtK,
  meanReciprocalRank:  meanReciprocalRank,
  ndcgAtK:             ndcgAtK,
  measureLatency:      measureLatency,
  averageMetrics:      averageMetrics
};
