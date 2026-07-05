// Load environment variables first — must be before any retrieval module require()
require('dotenv').config();

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Retrieval methods
// ---------------------------------------------------------------------------
const faissRetrieval  = require('../retrieval/faissRetrieval');
const bm25Retrieval   = require('../retrieval/bm25Retrieval');
const hnswRetrieval   = require('../retrieval/hnswRetrieval');
const hybridRetrieval = require('../retrieval/hybridRetrieval');
const rerankRetrieval = require('../retrieval/rerankRetrieval');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Prints a horizontal separator line to the console.
 */
function printSeparator() {
  console.log('═'.repeat(72));
}

/**
 * Prints a thinner section separator.
 */
function printThinSeparator() {
  console.log('─'.repeat(72));
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initializes all retrievers that require warm-up before serving queries.
 * faissRetrieval.initialize() is idempotent, so calling it via multiple
 * wrappers (hybridRetrieval, rerankRetrieval) is safe.
 *
 * @returns {Promise<void>}
 */
async function initializeAll() {
  try {
    await faissRetrieval.initialize();
    await rerankRetrieval.initialize();   // internally calls faissRetrieval.initialize() (no-op)
    await hybridRetrieval.initialize();   // internally calls faissRetrieval.initialize() (no-op)
    console.log('[compareResults] All retrievers initialized.\n');
  } catch (err) {
    console.error('[compareResults] initializeAll() failed:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Core comparison function
// ---------------------------------------------------------------------------

/**
 * Runs all five retrieval methods in parallel for a single query and
 * collects their results along with per-method latencies.
 *
 * Methods are run simultaneously via Promise.all to minimise total wall time.
 * Empty results (e.g. BM25 returning nothing for informal queries) are handled
 * gracefully — the method simply contributes an empty array.
 *
 * @param {string} query   The natural language query to compare.
 * @param {number} [limit=5]  Number of results per method.
 * @returns {Promise<object>} Full comparison object for this query.
 */
async function compareQuery(query, limit) {
  if (limit === undefined) {
    limit = 5;
  }

  console.log('[compareResults] Comparing query: "' + query + '"');

  // Wrap each retrieval call so it returns { results, latencyMs } without
  // rejecting the outer Promise.all on failure
  async function runWithLatency(retrieveFn, methodLabel) {
    var start = Date.now();
    var results = [];
    try {
      results = await retrieveFn(query, limit);
    } catch (err) {
      console.error('[compareResults] ' + methodLabel + ' failed:', err.message);
    }
    return {
      results:   results,
      latencyMs: Date.now() - start
    };
  }

  // Run all methods simultaneously
  var outcomes = await Promise.all([
    runWithLatency(faissRetrieval.retrieve,  'FAISS'),
    runWithLatency(bm25Retrieval.retrieve,   'BM25'),
    runWithLatency(hnswRetrieval.retrieve,   'HNSW'),
    runWithLatency(hybridRetrieval.retrieve, 'Hybrid'),
    runWithLatency(rerankRetrieval.retrieve, 'Rerank')
  ]);

  var faissOutcome  = outcomes[0];
  var bm25Outcome   = outcomes[1];
  var hnswOutcome   = outcomes[2];
  var hybridOutcome = outcomes[3];
  var rerankOutcome = outcomes[4];

  // Map each method's results to the slim schema for display and storage
  function mapResults(resultArray, usesCombinedScore) {
    return resultArray.map(function(r) {
      var item = {
        title:           r.title           || '',
        concise_summary: r.concise_summary || ''
      };
      if (usesCombinedScore) {
        item.combined_score  = typeof r.combined_score  === 'number' ? r.combined_score  : 0;
        item.relevance_score = typeof r.relevance_score === 'number' ? r.relevance_score : 0;
      } else {
        item.relevance_score = typeof r.relevance_score === 'number' ? r.relevance_score : 0;
      }
      // Preserve faiss_score for rerank results
      if (typeof r.faiss_score === 'number') {
        item.faiss_score = r.faiss_score;
      }
      return item;
    });
  }

  return {
    query:   query,
    results: {
      faiss:  mapResults(faissOutcome.results,  false),
      bm25:   mapResults(bm25Outcome.results,   false),
      hnsw:   mapResults(hnswOutcome.results,   false),
      hybrid: mapResults(hybridOutcome.results, true),
      rerank: mapResults(rerankOutcome.results, false)
    },
    latencies: {
      faiss:  Math.round(faissOutcome.latencyMs),
      bm25:   Math.round(bm25Outcome.latencyMs),
      hnsw:   Math.round(hnswOutcome.latencyMs),
      hybrid: Math.round(hybridOutcome.latencyMs),
      rerank: Math.round(rerankOutcome.latencyMs)
    }
  };
}

// ---------------------------------------------------------------------------
// Console display
// ---------------------------------------------------------------------------

/**
 * Prints a rich formatted report for a single comparison result to the
 * console, including per-method ranked lists, score columns, latencies,
 * and cross-method agreement analysis.
 *
 * @param {object} comparisonResult  Result returned by compareQuery().
 */
function printComparison(comparisonResult) {
  printSeparator();
  console.log('QUERY: "' + comparisonResult.query + '"');
  printSeparator();

  var methodKeys   = ['faiss', 'bm25', 'hnsw', 'hybrid', 'rerank'];
  var methodLabels = {
    faiss:  'FAISS  (dense, in-memory)',
    bm25:   'BM25   (full-text search)',
    hnsw:   'HNSW   (pgvector ANN)',
    hybrid: 'Hybrid (FAISS + BM25 RRF)',
    rerank: 'Rerank (FAISS + Cohere CE)'
  };

  // Build a frequency map: title → count of methods that returned it
  var titleFrequency = {};
  for (var m = 0; m < methodKeys.length; m++) {
    var methodResults = comparisonResult.results[methodKeys[m]];
    for (var r = 0; r < methodResults.length; r++) {
      var t = methodResults[r].title;
      if (t) {
        titleFrequency[t] = (titleFrequency[t] || 0) + 1;
      }
    }
  }

  // Print each method
  for (var mi = 0; mi < methodKeys.length; mi++) {
    var key     = methodKeys[mi];
    var label   = methodLabels[key];
    var items   = comparisonResult.results[key];
    var latency = comparisonResult.latencies[key];

    printThinSeparator();
    console.log('▶ ' + label + '   [' + latency + ' ms]');

    if (!items || items.length === 0) {
      console.log('  (no results)');
    } else {
      for (var ri = 0; ri < items.length; ri++) {
        var item  = items[ri];
        var freq  = titleFrequency[item.title] || 1;
        var star  = freq >= 3 ? ' ★' : (freq === 2 ? ' ◆' : '');  // ★ = 3+, ◆ = 2 methods
        var score = '';

        if (key === 'hybrid') {
          score = 'combined=' + (item.combined_score || 0).toFixed(6);
        } else if (key === 'rerank') {
          score = 'rerank=' + item.relevance_score.toFixed(6) +
                  (typeof item.faiss_score === 'number'
                    ? ' faiss=' + item.faiss_score.toFixed(6)
                    : '');
        } else {
          score = 'score=' + item.relevance_score.toFixed(6);
        }

        console.log('  ' + (ri + 1) + '. ' + item.title + star + '  [' + score + ']');
        if (item.concise_summary) {
          console.log('     ' + item.concise_summary.substring(0, 100) +
            (item.concise_summary.length > 100 ? '…' : ''));
        }
      }
    }
    console.log('');
  }

  // Agreement analysis
  printThinSeparator();
  console.log('AGREEMENT ANALYSIS');

  var inAll  = [];
  var inOne  = [];
  var titles = Object.keys(titleFrequency);

  for (var ti = 0; ti < titles.length; ti++) {
    var title = titles[ti];
    if (titleFrequency[title] >= methodKeys.length) {
      inAll.push(title);
    } else if (titleFrequency[title] === 1) {
      inOne.push(title);
    }
  }

  if (inAll.length > 0) {
    console.log('  ★ Titles returned by ALL methods:    ' + inAll.join(', '));
  } else {
    console.log('  ★ Titles returned by ALL methods:    (none)');
  }

  if (inOne.length > 0) {
    console.log('  ✦ Titles returned by ONE method only: ' + inOne.join(', '));
  } else {
    console.log('  ✦ Titles returned by ONE method only: (none)');
  }

  // Fastest method
  var latencies = comparisonResult.latencies;
  var fastestKey = methodKeys[0];
  for (var fi = 1; fi < methodKeys.length; fi++) {
    if (latencies[methodKeys[fi]] < latencies[fastestKey]) {
      fastestKey = methodKeys[fi];
    }
  }
  console.log('  ⚡ Fastest method: ' + methodLabels[fastestKey] + ' (' + latencies[fastestKey] + ' ms)');
  console.log('');
}

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

/**
 * Runs compareQuery() for each query string, prints each comparison, and
 * saves all results to evaluation/comparison_results.json.
 *
 * @param {string[]} queries  Array of natural language query strings.
 * @returns {Promise<void>}
 */
async function runComparisons(queries) {
  var allComparisons = [];

  for (var i = 0; i < queries.length; i++) {
    var query = queries[i];
    console.log('\n[compareResults] Processing query ' + (i + 1) + '/' + queries.length + '...');

    var result;
    try {
      result = await compareQuery(query, 5);
    } catch (err) {
      console.error('[compareResults] compareQuery() failed for "' + query + '":', err.message);
      continue;
    }

    printComparison(result);
    allComparisons.push(result);
  }

  // Save results to JSON
  var outputPath = path.join(__dirname, 'comparison_results.json');
  var outputData = {
    generatedAt: new Date().toISOString(),
    totalQueries: queries.length,
    comparisons:  allComparisons
  };

  try {
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');
    console.log('[compareResults] Results saved to: ' + outputPath);
  } catch (writeErr) {
    console.error('[compareResults] Failed to save comparison_results.json:', writeErr.message);
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Initializes all retrievers and runs the pre-defined set of comparison
 * queries, then saves results to evaluation/comparison_results.json.
 *
 * @returns {Promise<void>}
 */
async function main() {
  await initializeAll();

  var comparisonQueries = [
    'dog limping and difficulty walking',
    'my dog is vomiting and not eating',
    'cat has eye discharge and sneezing',
    'dog scratching ears and shaking head',
    'dog having seizures',
    'my pet is not acting like himself',
    'dog difficulty breathing and pale gums',
    'puppy has bloody diarrhea'
  ];

  await runComparisons(comparisonQueries);

  console.log('\n[compareResults] Comparison complete. Results saved to comparison_results.json');
}

main().catch(function(err) {
  console.error('[compareResults] Unhandled error in main():', err.message);
  process.exit(1);
});
