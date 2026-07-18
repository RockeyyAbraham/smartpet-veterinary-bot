// Load environment variables first — must be before any retrieval module require()
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

// ---------------------------------------------------------------------------
// Retrieval methods
// ---------------------------------------------------------------------------
const faissRetrieval = require('../retrieval/faissRetrieval');
const bm25Retrieval = require('../retrieval/bm25Retrieval');
const hnswRetrieval = require('../retrieval/hnswRetrieval');
const hybridRetrieval = require('../retrieval/hybridRetrieval');
const rerankRetrieval = require('../retrieval/rerankRetrieval');
const graphRetrieval  = require('../retrieval/graphRetrieval');

// ---------------------------------------------------------------------------
// Evaluation data and metrics
// ---------------------------------------------------------------------------
const testQueriesModule = require('./testQueries');
const metricsModule = require('./metrics');

const testQueries = testQueriesModule.testQueries;
const precisionAtK = metricsModule.precisionAtK;
const recallAtK = metricsModule.recallAtK;
const meanReciprocalRank = metricsModule.meanReciprocalRank;
const ndcgAtK = metricsModule.ndcgAtK;
const measureLatency = metricsModule.measureLatency;
const averageMetrics = metricsModule.averageMetrics;
const statsModule = require('./stats.js');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Rank cut-off used for all @K metrics */
var K = 5;

/**
 * Cohere free-tier imposes a rate limit of 10 calls/minute.
 * rerankRetrieval.js includes a hardcoded 6-second sleep after every Cohere
 * API call to stay within this limit. This constant is subtracted from Rerank
 * latency measurements so the comparison table reflects real processing time
 * (FAISS retrieval + Cohere API round-trip) rather than artificial sleep time.
 *
 * Disclosed in the PDF report footnote.
 */
var RERANK_COHERE_SLEEP_MS = 6000;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Prints a horizontal separator line to the console.
 */
function printSeparator() {
  console.log('─'.repeat(72));
}

// ---------------------------------------------------------------------------
// Core evaluation runner
// ---------------------------------------------------------------------------

/**
 * Evaluates a single retrieval method across the full test query set.
 *
 * For each query:
 *   1. Calls retrieveFn(query, K) and measures wall-clock latency.
 *   2. Extracts titles from the result array.
 *   3. Computes Precision@K, Recall@K, MRR, NDCG@K, and latency.
 *
 * For the Rerank method only: the RERANK_COHERE_SLEEP_MS constant is subtracted
 * from each per-query latency measurement. This corrects for a 6-second sleep
 * that rerankRetrieval.js inserts to respect the Cohere free-tier rate limit.
 * The sleep is a deployment constraint, not retrieval cost, so removing it gives
 * a fair comparison. The PDF footnote discloses this adjustment.
 *
 * @param {string}   methodName  Human-readable label for this method.
 * @param {Function} retrieveFn  Async function (query, limit) => results[].
 * @param {Array}    queries     Array of { query, relevant_titles } objects.
 * @returns {Promise<object>}    Aggregated metrics for this method.
 */
async function runMethodEvaluation(methodName, retrieveFn, queries) {
  console.log('\n[runEvaluation] Evaluating: ' + methodName + ' (' + queries.length + ' queries)');
  printSeparator();

  // Whether to strip the Cohere rate-limit sleep from this method's latency
  var isRerank = methodName === 'Rerank (FAISS+Cohere)';

  var perQueryMetrics = [];

  for (var i = 0; i < queries.length; i++) {
    var queryObj = queries[i];
    var query = queryObj.query;
    var relevantTitles = queryObj.relevant_titles;

    var startTime = Date.now();
    var results = [];

    try {
      results = await retrieveFn(query, K);
    } catch (err) {
      console.error('[runEvaluation] ' + methodName + ' failed on query "' + query + '":', err.message);
      // results stays [] — all metrics will be 0 for this query
    }

    var endTime = Date.now();

    // Extract title strings from result objects
    var retrievedTitles = results.map(function (r) {
      return r.title || '';
    });

    var rawLatency = measureLatency(startTime, endTime);

    // For Rerank: subtract the hardcoded Cohere sleep so latency reflects
    // real retrieval cost. Floor at 0 to handle any edge-case timing.
    var latency = isRerank
      ? Math.max(0, rawLatency - RERANK_COHERE_SLEEP_MS)
      : rawLatency;

    var precision = precisionAtK(retrievedTitles, relevantTitles, K);
    var recall = recallAtK(retrievedTitles, relevantTitles, K);
    var mrr = meanReciprocalRank(retrievedTitles, relevantTitles);
    var ndcg = ndcgAtK(retrievedTitles, relevantTitles, K);

    perQueryMetrics.push({
      query: query,
      precision: precision,
      recall: recall,
      mrr: mrr,
      ndcg: ndcg,
      latencyMs: latency
    });

    // Progress dot every 10 queries
    if ((i + 1) % 10 === 0) {
      console.log('[runEvaluation] ' + methodName + ': ' + (i + 1) + '/' + queries.length + ' queries done');
    }
  }

  var averaged = averageMetrics(perQueryMetrics);

  var failedQueries = perQueryMetrics
    .filter(function(m) { return m.ndcg === 0; })
    .map(function(m) { return m.query; });

  return {
    method: methodName,
    avgPrecisionAtK: averaged.precision || 0,
    avgRecallAtK: averaged.recall || 0,
    avgMRR: averaged.mrr || 0,
    avgNDCG: averaged.ndcg || 0,
    avgLatencyMs: averaged.latencyMs || 0,
    totalQueries: queries.length,
    perQueryMetrics: perQueryMetrics,
    failedQueries: failedQueries
  };
}

// ---------------------------------------------------------------------------
// Results printing
// ---------------------------------------------------------------------------

/**
 * Prints a formatted comparison table for all method results.
 *
 * @param {Array<object>} results  Array of aggregated method result objects.
 */
function printComparisonTable(results) {
  printSeparator();
  console.log('\n[runEvaluation] RESULTS COMPARISON TABLE\n');

  // Column widths
  var col0 = 22; // method name
  var col1 = 13; // Precision@K
  var col2 = 10; // Recall@K
  var col3 = 8;  // MRR
  var col4 = 10; // NDCG@K
  var col5 = 16; // Avg Latency

  function padEnd(str, len) {
    str = String(str);
    while (str.length < len) { str = str + ' '; }
    return str;
  }

  function padStart(str, len) {
    str = String(str);
    while (str.length < len) { str = ' ' + str; }
    return str;
  }

  // Header
  console.log(
    padEnd('Method', col0) +
    padStart('Precision@' + K, col1) +
    padStart('Recall@' + K, col2) +
    padStart('MRR', col3) +
    padStart('NDCG@' + K, col4) +
    padStart('Avg Latency(ms)', col5)
  );
  console.log('─'.repeat(col0 + col1 + col2 + col3 + col4 + col5));

  for (var i = 0; i < results.length; i++) {
    var r = results[i];
    console.log(
      padEnd(r.method, col0) +
      padStart(r.avgPrecisionAtK.toFixed(4), col1) +
      padStart(r.avgRecallAtK.toFixed(4), col2) +
      padStart(r.avgMRR.toFixed(4), col3) +
      padStart(r.avgNDCG.toFixed(4), col4) +
      padStart(r.avgLatencyMs.toFixed(0), col5)
    );
  }

  console.log('');
}

/**
 * Finds the best-performing method for a given metric field and prints it.
 *
 * @param {Array<object>} results    Array of aggregated method result objects.
 * @param {string}        field      Key to compare (e.g. 'avgPrecisionAtK').
 * @param {string}        label      Human-readable metric name.
 */
function printWinner(results, field, label) {
  var best = results[0];
  for (var i = 1; i < results.length; i++) {
    if (results[i][field] > best[field]) {
      best = results[i];
    }
  }
  console.log('  Best ' + label + ': ' + best.method + ' (' + best[field].toFixed(4) + ')');
}

/**
 * Prints per-metric winners and an overall recommendation.
 *
 * @param {Array<object>} results  Array of aggregated method result objects.
 */
function printWinnersAndRecommendation(results) {
  printSeparator();
  console.log('\n[runEvaluation] WINNERS BY METRIC\n');

  printWinner(results, 'avgPrecisionAtK', 'Precision@' + K);
  printWinner(results, 'avgRecallAtK', 'Recall@' + K);
  printWinner(results, 'avgMRR', 'MRR');
  printWinner(results, 'avgNDCG', 'NDCG@' + K);

  // Fastest method (lowest latency)
  var fastest = results[0];
  for (var i = 1; i < results.length; i++) {
    if (results[i].avgLatencyMs < fastest.avgLatencyMs) {
      fastest = results[i];
    }
  }
  console.log('  Fastest:       ' + fastest.method + ' (' + fastest.avgLatencyMs.toFixed(0) + ' ms avg)');

  // Overall recommendation — simple combined score: P + R + MRR + NDCG (equal weights)
  var bestCombined = results[0];
  var bestScore = results[0].avgPrecisionAtK + results[0].avgRecallAtK + results[0].avgMRR + results[0].avgNDCG;

  for (var j = 1; j < results.length; j++) {
    var score = results[j].avgPrecisionAtK + results[j].avgRecallAtK + results[j].avgMRR + results[j].avgNDCG;
    if (score > bestScore) {
      bestScore = score;
      bestCombined = results[j];
    }
  }

  console.log('\n[runEvaluation] OVERALL RECOMMENDATION');
  printSeparator();
  console.log(
    '  ' + bestCombined.method + ' achieved the highest combined retrieval quality score (' +
    bestScore.toFixed(4) + ').'
  );
  console.log(
    '  Combined score = Precision@' + K + ' + Recall@' + K + ' + MRR + NDCG@' + K +
    ' (equal weights, range 0–4).'
  );
  console.log('');
}

/**
 * Generates a formatted PDF report with the comparison table.
 *
 * @param {Array<object>} results  Array of aggregated method result objects.
 * @param {string}        outputPath Path to save the PDF.
 * @returns {Promise<void>}
 */
function generateReport(results, outputPath) {
  return new Promise(function (resolve, reject) {
    try {
      var doc = new PDFDocument({ margin: 50 });
      var stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // Title
      doc.fontSize(20).text('Retrieval Evaluation Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text('Evaluated at: ' + new Date().toISOString());
      doc.text('Total Queries: ' + testQueries.length + ' | K = ' + K);
      doc.moveDown(2);

      // Table Header
      doc.font('Helvetica-Bold');
      var startY = doc.y;
      doc.text('Method', 50, startY);
      doc.text('P@' + K, 200, startY);
      doc.text('R@' + K, 260, startY);
      doc.text('MRR', 320, startY);
      doc.text('NDCG@' + K, 380, startY);
      doc.text('Latency(ms)', 460, startY);

      doc.moveTo(50, startY + 15).lineTo(550, startY + 15).stroke();
      doc.moveDown();

      // Table Rows
      doc.font('Helvetica');
      var currentY = startY + 25;

      for (var i = 0; i < results.length; i++) {
        var r = results[i];
        doc.text(r.method, 50, currentY);
        doc.text(r.avgPrecisionAtK.toFixed(4), 200, currentY);
        doc.text(r.avgRecallAtK.toFixed(4), 260, currentY);
        doc.text(r.avgMRR.toFixed(4), 320, currentY);
        doc.text(r.avgNDCG.toFixed(4), 380, currentY);
        doc.text(r.avgLatencyMs.toFixed(0), 460, currentY);
        currentY += 20;
      }

      // Winners section
      doc.moveDown(2);
      currentY = doc.y;
      doc.font('Helvetica-Bold').fontSize(14).text('Winners by Metric', 50, currentY);
      doc.moveDown();

      doc.font('Helvetica').fontSize(12);

      function getWinner(field) {
        var best = results[0];
        for (var j = 1; j < results.length; j++) {
          if (results[j][field] > best[field]) best = results[j];
        }
        return best;
      }

      var bestP = getWinner('avgPrecisionAtK');
      var bestR = getWinner('avgRecallAtK');
      var bestM = getWinner('avgMRR');
      var bestN = getWinner('avgNDCG');

      var fastest = results[0];
      for (var f = 1; f < results.length; f++) {
        if (results[f].avgLatencyMs < fastest.avgLatencyMs) fastest = results[f];
      }

      doc.text('Best Precision@' + K + ': ' + bestP.method + ' (' + bestP.avgPrecisionAtK.toFixed(4) + ')');
      doc.text('Best Recall@' + K + ': ' + bestR.method + ' (' + bestR.avgRecallAtK.toFixed(4) + ')');
      doc.text('Best MRR: ' + bestM.method + ' (' + bestM.avgMRR.toFixed(4) + ')');
      doc.text('Best NDCG@' + K + ': ' + bestN.method + ' (' + bestN.avgNDCG.toFixed(4) + ')');
      doc.text('Fastest: ' + fastest.method + ' (' + fastest.avgLatencyMs.toFixed(0) + ' ms avg)');

      // Methodology footnote
      doc.moveDown(2);
      doc.font('Helvetica-Oblique').fontSize(9);
      doc.text(
        'Methodology Note: Rerank (FAISS+Cohere) latency figures exclude a 6-second per-query ' +
        'sleep introduced to comply with the Cohere free-tier rate limit (10 req/min). ' +
        'This sleep is a deployment constraint, not a retrieval cost. ' +
        'Actual wall-clock time per Rerank query is ~6 seconds higher than the value shown. ' +
        'All other methods report unmodified wall-clock latency.',
        { width: 500 }
      );

      // --- STATISTICAL SIGNIFICANCE (appended to first page) ---
      doc.moveDown(2);
      doc.font('Helvetica-Bold').fontSize(12).text('Statistical Significance Analysis');
      doc.moveDown(0.5);
      
      var sortedByNdcg = results.slice().sort(function(a, b) { return b.avgNDCG - a.avgNDCG; });
      if (sortedByNdcg.length >= 2) {
        var best = sortedByNdcg[0];
        var second = sortedByNdcg[1];
        var statResult = statsModule.wilcoxonSignedRank(best.perQueryMetrics, second.perQueryMetrics);
        
        doc.font('Helvetica').fontSize(10);
        doc.text('Comparing Best (' + best.method + ') vs Second Best (' + second.method + ') using Wilcoxon Signed-Rank Test:');
        doc.text('p-value: ' + statResult.pValue.toFixed(4) + (statResult.significant ? ' (Statistically Significant at alpha=0.05)' : ' (Not statistically significant)'));
        doc.text('This confirms whether the top method\'s performance advantage is scientifically robust.');
      }

      doc.end();

      stream.on('finish', function () {
        resolve();
      });
      stream.on('error', function (err) {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Initializes all retrievers that need warm-up, then runs evaluation across
 * all five retrieval methods sequentially, prints results, and saves JSON.
 *
 * @returns {Promise<void>}
 */
async function main() {
  console.log('\n[runEvaluation] Starting evaluation across all retrieval methods...');
  console.log('[runEvaluation] Test set: ' + testQueries.length + ' queries | K = ' + K);
  printSeparator();

  // Initialize methods that require warm-up (idempotent — safe to call together)
  try {
    console.log('[runEvaluation] Initializing FAISS index...');
    await faissRetrieval.initialize();

    // rerankRetrieval.initialize() internally calls faissRetrieval.initialize()
    // (idempotent), then logs its own ready message
    console.log('[runEvaluation] Initializing reranker...');
    await rerankRetrieval.initialize();

    // hybridRetrieval.initialize() also calls faissRetrieval.initialize() (idempotent)
    console.log('[runEvaluation] Initializing hybrid retriever...');
    await hybridRetrieval.initialize();
  } catch (initErr) {
    console.error('[runEvaluation] Initialization failed:', initErr.message);
    process.exit(1);
  }

  var allResults = [];

  // ---- FAISS ---------------------------------------------------------------
  try {
    var faissResult = await runMethodEvaluation('FAISS', faissRetrieval.retrieve, testQueries);
    allResults.push(faissResult);
  } catch (err) {
    console.error('[runEvaluation] FAISS evaluation error:', err.message);
  }

  // ---- BM25 ----------------------------------------------------------------
  try {
    var bm25Result = await runMethodEvaluation('BM25', bm25Retrieval.retrieve, testQueries);
    allResults.push(bm25Result);
  } catch (err) {
    console.error('[runEvaluation] BM25 evaluation error:', err.message);
  }

  // ---- HNSW ----------------------------------------------------------------
  try {
    var hnswResult = await runMethodEvaluation('HNSW', hnswRetrieval.retrieve, testQueries);
    allResults.push(hnswResult);
  } catch (err) {
    console.error('[runEvaluation] HNSW evaluation error:', err.message);
  }

  // ---- Hybrid (FAISS + BM25 RRF) ------------------------------------------
  try {
    var hybridResult = await runMethodEvaluation('Hybrid (FAISS+BM25)', hybridRetrieval.retrieve, testQueries);
    allResults.push(hybridResult);
  } catch (err) {
    console.error('[runEvaluation] Hybrid evaluation error:', err.message);
  }



  // ---- Rerank (FAISS + Cohere) ---------------------------------------------
  try {
    var rerankResult = await runMethodEvaluation('Rerank (FAISS+Cohere)', rerankRetrieval.retrieve, testQueries);
    allResults.push(rerankResult);
  } catch (err) {
    console.error('[runEvaluation] Rerank evaluation error:', err.message);
  }

  // ---- GraphRAG (Neo4j + Groq LLaMA) ----------------------------------------
  try {
    var graphResult = await runMethodEvaluation('GraphRAG', graphRetrieval.retrieve, testQueries);
    allResults.push(graphResult);
  } catch (err) {
    console.error('[runEvaluation] GraphRAG evaluation error:', err.message);
  }

  if (allResults.length === 0) {
    console.error('[runEvaluation] No results collected — aborting.');
    process.exit(1);
  }

  // Print comparison table and winners
  printComparisonTable(allResults);
  printWinnersAndRecommendation(allResults);

  // Generate PDF report instead of JSON
  var outputPath = path.join(__dirname, 'results.pdf');

  try {
    await generateReport(allResults, outputPath);
    var fileUri = 'file:///' + outputPath.replace(/\\/g, '/');
    console.log('[runEvaluation] Full results saved to PDF. Click to open: ' + fileUri);
  } catch (writeErr) {
    console.error('[runEvaluation] Failed to save results.pdf:', writeErr.message);
  }

  // Close the Neo4j driver opened by graphRetrieval
  await graphRetrieval.closeDriver();
}

main().catch(function (err) {
  console.error('[runEvaluation] Unhandled error in main():', err.message);
  process.exit(1);
});
