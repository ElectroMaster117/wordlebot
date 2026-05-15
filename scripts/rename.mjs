import fs from "fs";

const pairs = [
  ["class Bot", "class GameVariantEngine"],
  ["new Bot(", "new GameVariantEngine("],
  [/\bbot\./g, "engine."],
  [/\bbot\b/g, "engine"],
  ["spotle =", "spotleMode ="],
  [/\bspotle\b/g, "spotleMode"],
  ["const CORRECT", "const MARK_EXACT"],
  ["const INCORRECT", "const MARK_MISS"],
  ["const WRONG_SPOT", "const MARK_SHIFT"],
  ["const EMPTY", "const MARK_BLANK"],
  [/\bCORRECT\b/g, "MARK_EXACT"],
  [/\bINCORRECT\b/g, "MARK_MISS"],
  [/\bWRONG_SPOT\b/g, "MARK_SHIFT"],
  [/\bEMPTY\b/g, "MARK_BLANK"],
  ["const WORDLE", "const VARIANT_WORDLE"],
  ["const WOODLE", "const VARIANT_WOODLE"],
  ["const PEAKS", "const VARIANT_PEAKS"],
  ["const ANTI", "const VARIANT_ANTI"],
  ["const XORDLE", "const VARIANT_XORDLE"],
  ["const THIRDLE", "const VARIANT_THIRDLE"],
  ["const FIBBLE", "const VARIANT_FIBBLE"],
  ["const HARDLE", "const VARIANT_HARDLE"],
  ["const DORDLE", "const VARIANT_DORDLE"],
  ["const QUORDLE", "const VARIANT_QUORDLE"],
  ["const OCTORDLE", "const VARIANT_OCTORDLE"],
  ["const WARMLE", "const VARIANT_WARMLE"],
  ["const SPOTLE", "const VARIANT_SPOTLE"],
  [/\bWORDLE\b/g, "VARIANT_WORDLE"],
  [/\bWOODLE\b/g, "VARIANT_WOODLE"],
  [/\bPEAKS\b/g, "VARIANT_PEAKS"],
  [/\bANTI\b/g, "VARIANT_ANTI"],
  [/\bXORDLE\b/g, "VARIANT_XORDLE"],
  [/\bTHIRDLE\b/g, "VARIANT_THIRDLE"],
  [/\bFIBBLE\b/g, "VARIANT_FIBBLE"],
  [/\bHARDLE\b/g, "VARIANT_HARDLE"],
  [/\bDORDLE\b/g, "VARIANT_DORDLE"],
  [/\bQUORDLE\b/g, "VARIANT_QUORDLE"],
  [/\bOCTORDLE\b/g, "VARIANT_OCTORDLE"],
  [/\bWARMLE\b/g, "VARIANT_WARMLE"],
  [/\bSPOTLE\b/g, "VARIANT_SPOTLE"],
  ["const SMALLEST_WORD", "const MIN_LETTERS"],
  ["const LARGEST_WORD", "const MAX_LETTERS"],
  ["const NORMAL", "const MODE_STANDARD"],
  ["const HARD", "const MODE_STRICT"],
  ["const CHECK_SIZE", "const RANK_POOL_SIZE"],
  ["const TOP_TEN_LENGTH", "const SUGGESTION_LIMIT"],
  [/\bSMALLEST_WORD\b/g, "MIN_LETTERS"],
  [/\bLARGEST_WORD\b/g, "MAX_LETTERS"],
  [/\bNORMAL\b/g, "MODE_STANDARD"],
  [/\bHARD\b/g, "MODE_STRICT"],
  [/\bCHECK_SIZE\b/g, "RANK_POOL_SIZE"],
  [/\bTOP_TEN_LENGTH\b/g, "SUGGESTION_LIMIT"],
  ["var word_length", "let letterCount"],
  [/\bword_length\b/g, "letterCount"],
  ["var wordbank", "let poolMode"],
  [/\bwordbank\b/g, "poolMode"],
  ["var pairings", "let patternCache"],
  [/\bpairings\b/g, "patternCache"],
  [/\bwords\b/g, "guessLexicon"],
  [/\bcommon\b/g, "solutionLexicon"],
  ["big_list", "masterLexicon"],
  ["common_words", "curatedSolutions"],
  ["all_common_words", "expandedSolutions"],
  ["function clearHTML", "function wipeNode"],
  ["function setHTML", "function paintNode"],
  ["function clearValue", "function resetField"],
  ["function createElement", "function el"],
  ["function combineLists", "function mergeUnique"],
  ["function pluralOrSingle", "function pluralize"],
  ["function decimalToPercent", "function toPercent"],
  ["function replaceAt", "function spliceChar"],
  ["function setBotMode", "function activateVariant"],
  ["function setMaxGuesses", "function seedGuessLimit"],
  ["function setLength", "function applyLetterCount"],
  ["function setWordbank", "function applyPoolMode"],
  ["function update()", "function refreshAnalysis()"],
  ["function getPotentialGuessesAndAnswers", "function assemblePools"],
  ["function filterList", "function applyClueFilters"],
  ["function separateListByLikelihood", "function splitByLikelihood"],
  ["function getBestGuesses", "function rankCandidateGuesses"],
  ["function makeTables", "function appendGuessRow"],
  ["function addButtons", "function mountActionButtons"],
  ["function resetPage", "function resetBoard"],
  ["function clearGrids", "function clearBoardGrids"],
  ["function createPage", "function bootstrapApp"],
  ["function drawPage", "function renderShell"],
  ["function guessesMadeSoFar", "function playedTurnCount"],
  ["function numberOfGuessesMadeIs", "function turnCountEquals"],
  ["function getWord(", "function readTurnWord("],
  ["function calculateProbabilities", "function renderOddsPanel"],
  ["function hideProbabilities", "function clearOddsPanel"],
  ["function setupTest", "function launchBenchmark"],
  ["function testStartingWords", "function runOpenerBenchmark"],
  ["unfound_answers =", "let missedSingles ="],
  [/\bunfound_answers\b/g, "missedSingles"],
  [".isFor(", ".matchesVariant("],
  [".hasHardMode(", ".supportsStrictMode("],
  [".getDifference(", ".computeFeedback("],
  [".getRowColor(", ".readTurnPattern("],
  [".setRowColor(", ".paintTurnPattern("],
  [".getBestLetters(", ".pickLetterWeights("],
  [".getAllPossibleAnswersFrom(", ".narrowSolutionsFrom("],
  [".getAnswerListLength(", ".solutionCount("],
  [".isLikely(", ".isCuratedSolution("],
  [".isValidGuess(", ".isAllowedGuess("],
  [".guessesAllowed(", ".turnLimit("],
  [".getCount(", ".boardCount("],
  ["function tilesChangeColor", "function wireTileCycling"],
  ["function changeTileColor", "function cycleTileState"],
  ["function nextColor", "function advanceTileMark"],
  ["function getTileColor", "function readTileMark"],
  ["function differencesWithPositions", "function feedbackWithSlots"],
  ["function createFilteredList", "function filterByPattern"],
  ["function differencesMatch", "function patternMatches"],
];

function transform(src) {
  let out = src;
  for (const [from, to] of pairs) {
    out = typeof from === "string" ? out.split(from).join(to) : out.replace(from, to);
  }
  return out;
}

const files = {
  "js/general.js": "js/dom-kit.js",
  "js/class.js": "js/variant-engine.js",
  "js/main.js": "js/solver-engine.js",
  "js/setup.js": "js/ui-shell.js",
  "js/bot.js": "js/opener-benchmark.js",
  "js/probabilities.js": "js/odds-panel.js",
};

for (const [src, dest] of Object.entries(files)) {
  let code = fs.readFileSync(src, "utf8");
  code = transform(code);
  if (dest.endsWith("dom-kit.js")) {
    code = code.replace(
      /function el\(object, html, class_name, id\) \{[\s\S]*?return new_object;\n\}/,
      `function el(tag, html, className, id) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (id) node.id = id;
    if (html != null && html !== "") node.innerHTML = html;
    return node;
}`
    );
  }
  if (dest.endsWith("odds-panel.js")) {
    code = code.replace(
      /"%<\/span> <span class="prob-count">\(" \+/g,
      "'%</span> <span class=\"prob-count\">(' +"
    );
    code = code.replace(/"\)<\/span>",/, "')</span>',");
    code = code.replace(/getElementById\("probabilities"\)/g, 'getElementById("odds-mount")');
    code = code.replace(/\.classList\.add\("visible"\)/g, ".hidden = false");
    code = code.replace(/\.classList\.remove\("visible"\)/g, ".hidden = true");
  }
  fs.writeFileSync(dest, code);
  console.log("wrote", dest);
}
