let letterCount = 5;
let poolMode = "restricted";
let patternCache = [];
let guessLexicon = [];
let solutionLexicon = [];
let engine;
var seconds = {};

// word length constants
const MIN_LETTERS = 3, MAX_LETTERS = 11, DEFAULT_LENGTH = 5;
// class constants to assign colors to tiles
const MARK_EXACT = "G", MARK_MISS = "B", MARK_SHIFT = "Y", MARK_BLANK = "X";
// difficulty constants
const MODE_STANDARD = 0, MODE_STRICT = 1;
// list size constants
const RANK_POOL_SIZE = 50, SUGGESTION_LIMIT = 10, MAX_TIME = 1000;
// misc constants
const NOT_YET_TESTED = .999, SIZE_FACTOR = 5, INFINITY = 9999999;

function activateVariant(type) {
    engine = new GameVariantEngine(type);
    seedGuessLimit();

    patternCache = [];
}

function seedGuessLimit() {
    if (!localStorage.getItem('guesses' + engine.type)) {
        if (engine.matchesVariant(VARIANT_DORDLE)) {
            localStorage.setItem('guesses' + engine.type, 7);
        } else if (engine.matchesVariant(VARIANT_WOODLE) || engine.matchesVariant(VARIANT_HARDLE)) {
            localStorage.setItem('guesses' + engine.type, 8);
        } else if (engine.matchesVariant(VARIANT_XORDLE) || engine.matchesVariant(VARIANT_FIBBLE) || engine.matchesVariant(VARIANT_QUORDLE)) {
            localStorage.setItem('guesses' + engine.type, 9);
        } else if (engine.matchesVariant(VARIANT_OCTORDLE)) {
            localStorage.setItem('guesses' + engine.type, 13);
        }
    }
}

function applyLetterCount() {
    let current = letterCount;
    const lengthSelect = document.getElementById("word-length");
    letterCount = parseInt(lengthSelect ? lengthSelect.value : DEFAULT_LENGTH, 10) || DEFAULT_LENGTH;

    const guessInput = document.getElementById("word-entered");
    if (guessInput) {
        guessInput.setAttribute("maxlength", letterCount);
        guessInput.value = "";
        if (typeof setInputAttributes === "function") {
            setInputAttributes(guessInput);
        }
    }
    // wipeNode(document.getElementById('next-previous-buttons'));
    
    guessLexicon = MASTER_DICTIONARY.filter((a) =>  a.length == letterCount);
    // guessLexicon = WORDLE_GUESSES.slice(); // uncomment to use original wordle guess list
    
    applyPoolMode();
    
    if (current != letterCount) {
        clearBoardGrids();
    }
}

function applyPoolMode() {
    let banks = document.getElementsByClassName('wordbank');

    for (let i = 0; i < banks.length; i++) {
        if (banks[i].checked == true) {
            poolMode = banks[i].id;
            break;
        }

        if (i == banks.length - 1) {
            banks[0].checked = true;
        }
    }

    if (poolMode == 'restricted') {
        solutionLexicon = CURATED_SOLUTIONS.slice();
    } else {
        solutionLexicon = EXPANDED_SOLUTIONS.slice();
    }

    solutionLexicon = solutionLexicon.filter(a => a.length == letterCount).sort();
    solutionLexicon = [...new Set(solutionLexicon)];
    // solutionLexicon = WORDLE_ANSWERS.slice(); // uncomment to use original wordle answer list 
}

function getBestOf(list) {
    let best_list;
    
    if (list[engine.type]) {
        best_list = list[engine.type];
        best_list = best_list.filter(a => a[poolMode] != null);
        best_list = best_list.map(a => Object.assign({}, {word: a.word, average: a[poolMode].average, wrong: a[poolMode].wrong}));
        return best_list;
    }

    list[engine.type] = [];
    return list[engine.type];
}

// gets all possible likely and unlikely answers left
// sorts the answer & potential guess list based on the most solutionLexicon letters
// gets the best guesses for normal and hard mode
// passes the data to update the list of suggestions and letters in the HTML
function refreshAnalysis() {
    let lists = assemblePools();
    let best_guesses = [];

    if (!shouldShowDuel(lists.unique)) {
        best_guesses = rankCandidateGuesses(lists.answers, lists.guesses, lists.unique);
        best_guesses = stripPlayedWords(best_guesses);
    }

    paintSuggestionPanels(lists.answers, lists.unlikely, best_guesses);
}

function stripPlayedWords(list) {
    for (let i = 0; i < playedTurnCount(); i++) {
        list = list.filter(function(a) { return a.word !== readTurnWord(i); });
    }

    return list;
}

function dedupeWords(list) {
    if (!list.length) return [];

    if (typeof list[0] == 'object') {
        let unique = [];
        for (let i = 0; i  < list.length; i++) {
            unique = mergeUnique(unique, Object.values(list[i]));
        }

        return [... new Set(unique)];
    } else return [... new Set(list)];
}

function skipHeavyRanking(answers, unique_answers) {
    return (answers.length <=2 && !engine.matchesVariant(VARIANT_ANTI) && engine.boardCount() == 1)
            || (unique_answers.length <= 2 && !engine.matchesVariant(VARIANT_ANTI))
            || turnCountEquals(0)
}

function splitByLikelihood(list) {
    let likely = [];
    let unlikely = [];
    
    for (let i = 0; i < list.length; i++) {
        if (Array.isArray(list[i])) {
            let new_lists = splitByLikelihood(list[i]);
            likely.push(new_lists.likely);
            unlikely.push(new_lists.unlikely)
        } 
        
        else if (engine.isCuratedSolution(list[i])) {
            likely.push(list[i]);
        } 
        
        else {
            unlikely.push(list[i]);
        }
    }

    return {likely: likely, unlikely: unlikely};
}

function assemblePools() {
    let all_possible_answers = engine.narrowSolutionsFrom(guessLexicon.slice());
    let separated_lists = splitByLikelihood(all_possible_answers);
    let answer_list = separated_lists.likely;
    let unlikely_answers = separated_lists.unlikely;
    let unique_answers= dedupeWords(answer_list);
    
    if (skipHeavyRanking(answer_list, unique_answers)) {
        return {
                guesses: unique_answers, 
                answers: answer_list, 
                unique: unique_answers,
                all: all_possible_answers, 
                unlikely: unlikely_answers, 
            };
    }

    let alphabet = engine.pickLetterWeights(unique_answers);
    let sorted_answer_list = sortList(unique_answers, alphabet);
    let sorted_guess_list = buildGuessPool(answer_list, sorted_answer_list, unique_answers, all_possible_answers, alphabet);

    return {
            guesses: sorted_guess_list, 
            answers: answer_list,
            unique: sorted_answer_list,
            all: all_possible_answers, 
            unlikely: unlikely_answers, 
        };
}

function buildGuessPool(answer_list, sorted_answer_list, unique_answers, all_possible_words, alphabet) {
    let sorted_guess_list = guessLexicon.slice();

    if (engine.matchesVariant(VARIANT_THIRDLE)) sorted_guess_list = allCombinations("", []);
    
    if (onlyTwoSolutionsLeft(answer_list) && !engine.matchesVariant(VARIANT_ANTI)) {
        // sorted_guess_list = unique_answers;
        sorted_guess_list = sorted_answer_list;
    } else if (isDifficulty(MODE_STRICT)){
        sorted_guess_list = dedupeWords(all_possible_words.slice());
        // sorted_guess_list = unique_answers.slice();
    } else if (engine.matchesVariant(VARIANT_ANTI)) {
        sorted_guess_list = applyClueFilters(sorted_guess_list, 0, true);
    }

    sorted_guess_list = sortList(sorted_guess_list, alphabet);
    
    if (!engine.matchesVariant(VARIANT_ANTI)) {
        sorted_guess_list = mergeUnique(sorted_answer_list, sorted_guess_list);
    }
    
    sorted_guess_list = reduceListSize(sorted_guess_list, sorted_answer_list, engine.solutionCount(answer_list));
    // new_lists = reduceListSize(sorted_guess_list, sorted_answer_list, engine.solutionCount(answer_list));
    // sorted_guess_list = new_lists.guesses;    

    return sorted_guess_list;
}

function onlyTwoSolutionsLeft(answers) {
    if (engine.boardCount() == 1) {
        return answers.length <= 2;
    }

    return dedupeWords(answers).length <= 2;
}

function findLoneCandidates(answer_lists) {
    let missedSingles = [];
    
    for (let i = 0; i < answer_lists.length; i++) {
        if (answer_lists[i].length == 1) {
            missedSingles.push(answer_lists[i][0]);
        }
    }

    
    for (let i = 0; i < playedTurnCount(); i++) {
        let colors = engine.readTurnPattern(i);

        if (colors.includes(MARK_EXACT.repeat(letterCount))) {
            let pos = missedSingles.indexOf(readTurnWord(i));

            if (pos != -1) {
                missedSingles.splice(pos, 1);
            }
        }
    }
    

    return missedSingles;
}

function allCombinations(string, list) {
    if (string.length == letterCount) {
        list.push(string);
    } else {
        for (let c = 65; c <= 90; c++) {
            allCombinations(string + String.fromCharCode(c), list);
        }
    }

    return list;
}

// creates the suggetsions for both normal and hard mode
// updates the headers to reflect how many guessLexicon are left
// adds those suggestions to the respective slides
// creates a dropdown list showing all possible guessLexicon
function paintSuggestionPanels(likely_answers, unlikely_answers, best_guesses) {
    const likelyCount = engine.solutionCount(likely_answers);
    const unlikelyCount = engine.solutionCount(unlikely_answers);
    const hasTurn = playedTurnCount() > 0;
    const starterBlock = document.getElementById("starter-guesses");
    const poolsBlock = document.getElementById("answer-pools");
    const extraBlock = document.getElementById("insights-extra");

    if (!extraBlock) return;

    paintPoolHeaders(likelyCount, unlikelyCount);

    if (starterBlock) starterBlock.hidden = hasTurn;
    if (poolsBlock) poolsBlock.hidden = !hasTurn;

    if (hasTurn) {
        renderAnswerPools(likely_answers, unlikely_answers, likelyCount, unlikelyCount);
    } else {
        injectSuggestionBlock("Top opening guesses", formatRankedGuesses(best_guesses));
    }

    wipeNode(extraBlock);

    if (isEmpty(likely_answers) && isEmpty(unlikely_answers)) {
        extraBlock.append(noWordsLeftMessage()[0]);
        if (poolsBlock) poolsBlock.hidden = true;
        return;
    }

    let missedSingles = findLoneCandidates(likely_answers);
    if (missedSingles.length) {
        unfoundAnswersMessage(missedSingles).forEach(function (node) {
            extraBlock.append(node);
        });
    }
}

function shouldShowDuel(answers) {
    return engine.solutionCount(answers) <= 2 && !engine.matchesVariant(VARIANT_ANTI)
}

// creates and returns the top 10 list of suggestions
// suggestions will then be added to the HTLM of either the suggestions
// for hard mode or normal mode
function formatRankedGuesses(guesses) {
    let data = "not fully tested";
    let list = [];
    let list_length = Math.min(guesses.length, SUGGESTION_LIMIT);

    for (let i = 0; i < list_length; i++) {
        let num_guesses = (guesses[i].average - playedTurnCount()).toFixed(3);
        let percent_wrong = toPercent(1-guesses[i].wrong);

        if (!isPartialScore(guesses[i])) {
            data = describeGuessScore(guesses[i], percent_wrong, num_guesses);
        }     

        let list_item = buildSuggestionRow(guesses[i].word, data, i+1);
        list.push(list_item);
    }

    return list;
}

function describeGuessScore(guess, percent_wrong, num_guesses) {
    if (guess.wrong > 0) {
        return percent_wrong + " solve rate";
    }

    if (!playedTurnCount(0)) {
        return num_guesses + " guesses";
    }

    return num_guesses + " guesses left";
}

function isPartialScore(guess) {
    return guess.wrong == NOT_YET_TESTED || engine.boardCount() > 1 || engine.matchesVariant(VARIANT_SPOTLE);
}

function buildSuggestionRow(word, data, rank) {
    let suggestion = el('span', word, 'click');
    let word_with_ranking = el('div', rank + ". " + suggestion.outerHTML, 'suggestion');
    let score = el('div', data, 'score');
    
    let list_item = el('li', word_with_ranking.outerHTML + score.outerHTML);
    return list_item;
}

function paintPoolHeaders(likely_length, unlikely_length) {
    let heading = document.getElementsByClassName("possibilities total")[0];
    let subheading = document.getElementsByClassName("possibilities separated")[0];
    let total_length = unlikely_length + likely_length;

    heading.textContent = total_length + " possibilit" + pluralize(total_length, "y", "ies") + " remaining";

    if (playedTurnCount() > 0) {
        subheading.textContent =
            likely_length + " probable · " + unlikely_length + " unlikely — expand lists below";
    } else {
        subheading.textContent =
            likely_length + " probable answers and " + unlikely_length + " unlikely in the dictionary.";
    }
}

function renderAnswerPools(likely_answers, unlikely_answers, likelyCount, unlikelyCount) {
    const likelyPanel = document.querySelector("#answer-pools .pool-likely");
    const unlikelyPanel = document.querySelector("#answer-pools .pool-unlikely");
    if (!likelyPanel || !unlikelyPanel) return;

    const likelyWords = likelyPanel.querySelector(".pool-words");
    const unlikelyWords = unlikelyPanel.querySelector(".pool-words");
    const likelyLabel = likelyPanel.querySelector(".pool-toggle-label");
    const unlikelyLabel = unlikelyPanel.querySelector(".pool-toggle-label");

    likelyLabel.textContent = likelyCount + " probable answer" + pluralize(likelyCount, "", "s");
    unlikelyLabel.textContent = unlikelyCount + " unlikely possibilit" + pluralize(unlikelyCount, "y", "ies");

    fillPoolWords(likelyWords, likely_answers, likelyCount);
    fillPoolWords(unlikelyWords, unlikely_answers, unlikelyCount);

    setPoolExpanded(likelyPanel, true);
    setPoolExpanded(unlikelyPanel, false);
}

function fillPoolWords(container, answers, count) {
    wipeNode(container);

    if (count < 1) {
        container.append(el("p", "None left", "pool-empty"));
        return;
    }

    const grid = el("div", "", "pool-grid");
    container.append(grid);

    function addEntry(entry, color) {
        if (Array.isArray(entry)) {
            entry.forEach(function (item) {
                addEntry(item, color);
            });
            return;
        }

        const word = typeof entry === "string" ? entry : String(entry);
        const chip = el("button", word, "pool-chip" + (color ? " " + color : ""));
        chip.type = "button";
        chip.addEventListener("click", function () {
            appendGuessRow(word);
        });
        grid.append(chip);
    }

    if (Array.isArray(answers)) {
        for (let i = 0; i < answers.length; i++) {
            addEntry(answers[i], engine.boardCount() > 1 ? COLORS[i] : "");
        }
    }
}

function setPoolExpanded(panel, expanded) {
    const toggle = panel.querySelector(".pool-toggle");
    const words = panel.querySelector(".pool-words");
    const icon = panel.querySelector(".pool-toggle-icon");

    toggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    words.hidden = !expanded;
    icon.textContent = expanded ? "▼" : "▶";
    panel.classList.toggle("is-open", expanded);
}

const COLORS = [
    "black", "green", "blue", "red", "purple", "orange", "brown", "gray"
];

function addWordsToDiv(guessLexicon, div, color) {
    if (Array.isArray(guessLexicon)) {
        for (let i = 0; i < guessLexicon.length; i++) {
            addWordsToDiv(guessLexicon[i], div, color);
        }
    } else {
        let answer = el('p', printAnswer(guessLexicon), color);
        div.append(answer);
    }

}

const NO_WORDS_LEFT_MESSAGE = "it doesn't look like we have this word. double check to make sure you all the clues you entered are correct.";
function noWordsLeftMessage() {
    let message = el('div', NO_WORDS_LEFT_MESSAGE, '', 'nowords')
    return [message];
}

function unfoundAnswersMessage(missedSingles) {
    let text = missedSingles.length + " of the answers " + pluralize(missedSingles.length, "is ", "are ");
                                                        
    for (let i = 0; i < missedSingles.length; i++) {
        let answer = el('span', printAnswer(missedSingles[i]), 'final');
        text += answer.outerHTML;

        if (i == missedSingles.length-1) {
            text += "."
        }

        else if (i == missedSingles.length-2) {
            text += ", and ";
        } else {
            text += ", ";
        }
    }                                                        

    let message = el('div', text, 'multi-answer');
    return [message];
}

// only called if there are less than two likely answers left
// shows: almost certainly 'THIS' or 'THAT'
// unlikely but it could be: 'SOMETHING', 'ELSE'
function showFinalOptions(sorted, less_likely, target) {
    let all_suggestions = [];

    if (engine.boardCount() > 1) {
        sorted = dedupeWords(sorted);
        less_likely = dedupeWords(less_likely);
    }
    
    if (engine.solutionCount(sorted)) {
        let final_words = el('li', '', 'likely');
        let first_answer = el('span', printAnswer(sorted[0]), 'final');
        final_words.innerHTML = "The word is almost certainly " + first_answer.outerHTML;

        if (sorted.length == 2) {
            let second_answer = el('span', printAnswer(sorted[1]), 'final');
            final_words.innerHTML += " or " + second_answer.outerHTML;
        } 

        final_words.innerHTML += ".";
        all_suggestions.push(final_words);
    }

    if (engine.solutionCount(less_likely)) {
        let unlikely = el('li', "Unlikely, but it might be ", 'others');

        for (let i = 0; i < less_likely.length; i++) {
            let unlikely_answer = el('span', printAnswer(less_likely[i]), 'final');
            unlikely.innerHTML += unlikely_answer.outerHTML;

            (i < less_likely.length - 1) ? unlikely.innerHTML += ", " : unlikely.innerHTML += ".";
        } 

        all_suggestions.push(unlikely);
    }

    const list = el("ul", "", "final-options word-list");
    all_suggestions.forEach(function (item) {
        list.append(item);
    });

    const box = el("div", "", "final-duel");
    box.append(list);

    if (target) {
        target.append(box);
    }
}

function printAnswer(answer) {
    if (typeof answer == 'string') {
        return el('span', answer, 'click').outerHTML;
    }

    if (Array.isArray(answer) && answer.length) {
        return printAnswer(answer[0]);
    }

    if (typeof answer == 'object' && engine.matchesVariant(VARIANT_XORDLE)) {
        return printAnswer(answer.word1) + "/" + printAnswer(answer.word2);
    }
}

// adds the heading, normal suggestsions, and hard suggestions
// to the respective HTML element
function injectSuggestionBlock(heading_html, suggestions) {
    const starter = document.getElementById("starter-guesses");
    const header = starter?.querySelector(".mini-title");
    const list = starter?.querySelector(".word-list");

    if (!header || !list) return;

    paintNode(header, heading_html);
    wipeNode(list);

    suggestions.forEach(function (a) {
        list.append(a);
    });
}

// returns the number of guesses made to far
function playedTurnCount() {
    if (engine.matchesVariant(VARIANT_SPOTLE)) {
        return spotleGuesses();
    }
    
    return Math.ceil(getPlayRows().length / engine.boardCount());
}

function spotleGuesses() {
    let rows = document.getElementsByClassName('row');
    let count = 0;

    for (let i = 0; i < rows.length; i++) {
        let tiles = rows[i].getElementsByClassName('tile');

        if (tiles[0].innerHTML == " ") {
            return count;
        }
        
        count++;
    }

    return count;
}

// checks if the number of guesses so far equals number
function turnCountEquals(number) {
    return playedTurnCount() == number;
}

// checks if we're playing on hard mode or normal mode
function isDifficulty(difficulty) {
    return getDifficulty() == difficulty;
}

function getDifficulty() {
    if (botIsOn()) return MODE_STRICT;
    return MODE_STANDARD;
}

function botIsOn() {
    return document.getElementById("benchmark-results");
}

function isBenchmarkActive() {
    return !!document.getElementById("benchmark-results");
}

/* 
    TABLE FUNCTIONS
    creates the rows of guesses & buttons
    modifies the tiles/buttons when clicked
    accesses information about the guesses/current state
*/
function getPlayRack() {
    const preview = document.getElementById("benchmark-preview");
    if (preview && isBenchmarkActive()) {
        return preview;
    }
    return document.getElementById("hints");
}

function getPlayRows() {
    return getPlayRack().querySelectorAll(".row");
}

function appendGuessRow(val, c) {
    if (c == null) c = "normal";
    let rack = getPlayRack();
    let grids = rack.getElementsByClassName("grid");

    if (val) {
        if (engine.matchesVariant(VARIANT_SPOTLE) && turnCountEquals() < 6 && val != " ".repeat(letterCount)) {
            replaceRow(playedTurnCount(), val);
        } else {
            for (let i = 0; i < engine.boardCount(); i++) {
                let row = createRow(val, c);
                grids[i].append(row);
                engine.bindTileHandlers(row);
            }
        }
    }

    if ((turnCountEquals(1) && c == 'normal') || engine.matchesVariant(VARIANT_SPOTLE)) {
        mountActionButtons();
        rack.classList.remove("empty");
    }

    document.getElementById("word-entered").value = "";
    resetField(document.getElementById('word-entered'));
}

function replaceRow(num, word) {
    let row = getPlayRows()[num];
    let tiles = row.getElementsByClassName('tile');

    for (let i = 0; i < tiles.length; i++) {
        tiles[i].innerHTML = word.charAt(i);
    }
}

function createRow(word, mode) {
    let row = el('div', '', 'row ' + mode + ' ' + engine.type);

    for (let i = 0; i < word.length; i++) {
        let button = el("button", word.charAt(i), MARK_MISS + " tile " + engine.type);
        button.type = "button";
        button.setAttribute("data-mark", MARK_MISS);
        button.setAttribute("aria-label", "Letter " + word.charAt(i) + ", tap to cycle color");
        row.append(button);
    }

    if (engine.matchesVariant(VARIANT_WOODLE)) {
        row.append(makeWoodleDropdowns())
    }

    return row;
}

function makeWoodleDropdowns() {
    let container = el('div', '', 'tracker');
    let correct_count = el('select', '', 'woodle-count ' + MARK_EXACT);
    let wrong_spot_count = el('select', '', 'woodle-count ' + MARK_SHIFT);

    container.append(correct_count);
    container.append(wrong_spot_count);

    return container;
}

function mountActionButtons() {
    let undo = el("button", "Undo turn", "undo");
    let filter = el("button", "Best next guess", "filter");
    let button_container = document.getElementById("next-previous-buttons");

    wipeNode(button_container);
    button_container.append(undo);
    button_container.append(filter);

    filter.addEventListener("click", function () {
        refreshAnalysis();
    });

    undo.addEventListener("click", function () {
        popLastTurn();
        resetOddsFlow();
        refreshAnalysis();
    });
}

function popLastTurn() {
    let grids = document.getElementsByClassName('grid');

    for (let i = 0; i < grids.length; i++) {
        let rows = grids[i].getElementsByClassName('row');
        remove(rows[playedTurnCount()-1]);
        // rows[rows.length-1].remove();
        
        // if (!rows.length) {
        if (turnCountEquals(0)) {
            // wipeNode(document.getElementById('next-previous-buttons'));
            // let full_grid = document.getElementById('hints');
            
            // if (!engine.matchesVariant(VARIANT_SPOTLE)) {
            //     full_grid.classList.add('empty');
            // }

            if (!engine.matchesVariant(VARIANT_SPOTLE)) {
                resetBoard();
            } else {
                addFinalizeGridButton();
            }
        }
    }    
}

function remove(row) {
    if (engine.matchesVariant(VARIANT_SPOTLE) && playedTurnCount() <= 6) {
        let tiles = row.getElementsByClassName('tile');

        for (let i = 0; i < tiles.length; i++) {
            tiles[i].innerHTML = " ";

            let old_color = readTileMark(tiles[i]);
            if (old_color != MARK_BLANK) {
                applyTileMark(tiles[i], MARK_MISS);
            }
        }
    } 

    else row.remove();
}

function readTurnWord(number) {
    let row = getPlayRows()[number];
    let tiles = row.getElementsByClassName("tile");

    let guess = "";

    for (let i = 0; i < letterCount; i++) {
        guess += tiles[i].innerHTML;
    }

    return guess;
}


/* 
    GUESS FUNCTIONS
    calculates the best guess at any given turn
    accesses guesses that are predetermined
    sets new guesses to memory
    finds the color difference between two guessLexicon
*/

function guessesArePrecomputed() {
    let diff = "";
    let word = "";
    for (let i = 0; i < playedTurnCount(); i++) {
        diff += engine.readTurnPattern(i);
        word += readTurnWord(i);
    }

    let hash = makeHash(engine.type, poolMode, 
                        engine.turnLimit(), document.getElementsByClassName('warmle-selector')[0]?.value, diff);

    if (seconds[word] != null) {
        if (seconds[word][hash] != null) {
            return JSON.parse(seconds[word][hash]);
        }
    } else seconds[word] = {};

    return 0;
}

function makeHash(game, list_type, guesses, extras, string) {
    return game + "/" + list_type + "/" + isDifficulty(MODE_STRICT) + "/" + guesses + "/" + extras + "/" + string;
}

function setBestGuesses(best_guesses) {
    let diff = "";
    let word = "";
    for (let i = 0; i < playedTurnCount(); i++) {
        diff += engine.readTurnPattern(i);
        word += readTurnWord(i);
    }

    let hash = makeHash(engine.type, poolMode, engine.turnLimit(), 
    document.getElementsByClassName('warmle-selector')[0]?.value, diff);

    seconds[word][hash] = JSON.stringify(best_guesses.slice(0, SUGGESTION_LIMIT));
}

function rankCandidateGuesses(answer_list, guess_list, unique_answers) {
    let best_guesses = guessesArePrecomputed();
    
    if (best_guesses) { 
        return sortByWrongThenAverage(best_guesses);
    }

    if (turnCountEquals(0)) {
        return getFirstGuesses();
    }
    
    if (answer_list.length > 1000) {
        return getTempList(guess_list, answer_list);
    }

    if (playedTurnCount() == engine.turnLimit()-1) {
        guess_list = unique_answers;
    }

    let initial_guesses = engine.scoreGuessReduction(answer_list, guess_list);
    
    if (engine.boardCount() > 1 || engine.matchesVariant(VARIANT_SPOTLE)) {
        best_guesses = initial_guesses;
    } else {
        best_guesses = calculateGuessList(unique_answers, guess_list, initial_guesses);
    }    

    setBestGuesses(best_guesses);
    return best_guesses;
}

// reduces list of possibilities when list is too large to check efficiently
function reduceListSize(guesses, answers, answers_size) {
    // if you have <10 guessLexicon left, removeUselessGuesses will actually remove some ideal guesses
    if (answers.length > 10 && !engine.matchesVariant(VARIANT_ANTI)) { 
        guesses = removeUselessGuesses(guesses, answers);
    }

    const MAXIMUM = 100000;
    if (answers_size * guesses.length * engine.boardCount() > MAXIMUM) {
        let current = answers_size * guesses.length * engine.boardCount();
        let ratio = current/MAXIMUM;
        
        guesses = guesses.slice(0, guesses.length/ratio);
    }

    for (let guess = 0; guess < playedTurnCount(); guess++) {
        guesses = guesses.filter(a => a != readTurnWord(guess));
    }
    
    return guesses;
}

// remove guessLexicon that have letters already grayed out
// remove guessLexicon that have yellow letters in the wrong spot
function removeUselessGuesses(list, possibilities) {
    let alphabet = engine.pickLetterWeights(possibilities);

    for (let i = 0; i < list.length; i++) {
        for (let j = 0; j < letterCount; j++) {
            let c = list[i].charAt(j);

            if (alphabet[c][letterCount] == 0 || // if letter isn't in any of the guessLexicon 
                (alphabet[c][j] == 0 && alphabet[c][letterCount] == possibilities.length)) { // if letter isn't in that spot in any word
                list.splice(i, 1);
                i--;
                break;
            } 
        }
    }

    return list;    
}

function getFirstGuesses() {
    let first_guesses = isDifficulty(MODE_STRICT) ? OPENER_RANKINGS_HARD : OPENER_RANKINGS_EASY;
    first_guesses = getBestOf(first_guesses).filter(a => a.word.length == letterCount);

    if (!first_guesses.length) {
        first_guesses = getTempList(guessLexicon.slice(), solutionLexicon.slice());
    }

    return sortByWrongThenAverage(first_guesses);
}

function getTempList(guesses, answers) {
    let letters = engine.pickLetterWeights(dedupeWords(answers.slice()));
    guesses = sortList(guesses.slice(), letters);
    
    guesses = engine.scoreGuessReduction(answers.slice(), guesses.slice(0, 100));
    guesses = guesses.map(a => Object.assign ({}, {word: a.word, average: a.adjusted, wrong: NOT_YET_TESTED}));
    return guesses;
}

function calculateGuessList(answers, guesses, best_words) {
    const start_time = performance.now();
    let can_finish = false;

    for (let i = 0; i < best_words.length; i++) { 
        let remaining = best_words[i].differences;
        
        let num_guesses = engine.turnLimit();
        if (num_guesses == INFINITY) num_guesses = 6;

        let results = Array.apply(null, Array(num_guesses));
        
        results.forEach(function(a, index) { results[index] = []});
        results['w'] = [];
        best_words[i].results = results;
        
        Object.keys(remaining).forEach(function(key) {
            countResults(best_words[i], remaining[key], guesses, results, playedTurnCount(), key);
        });

        best_words[i].wrong = best_words[i].results['w'].length/answers.length;
        // if (engine.matchesVariant(VARIANT_ANTI)) best_words[i].wrong = 1 - best_words[i].results.length/100; //uncomment to for longest path antiwordle

        if (best_words[i].wrong == 0) {
            can_finish = true;
        }

        // if (performance.now() - start_time > MAX_TIME || (can_finish && i >= RANK_POOL_SIZE)) {
        if (shouldStopTesting(start_time, performance.now(), can_finish, i)) {
            console.log("only calculated " + (i+1) + " guessLexicon in " + ((performance.now()-start_time)/1000).toFixed(3) + " seconds");
            best_words = best_words.slice(0, i+1);
            break;
        }
    }

    sortByWrongThenAverage(best_words);
    return best_words.map(a => Object.assign({}, {word: a.word, average: a.average, wrong: a.wrong})).slice(0, SUGGESTION_LIMIT);
}

function shouldStopTesting(start_time, end_time, can_finish, i) {
    return end_time - start_time > MAX_TIME || (can_finish && i >= RANK_POOL_SIZE);
}

function getNextGuesses(new_guesses, answers, best, differences) {
    let list;

    if (isDifficulty(MODE_STRICT)) {
        list = applyClueFilters(new_guesses, {word: best.word, colors: differences});
    } else if (!engine.matchesVariant(VARIANT_ANTI)) {
        list = reduceListSize(new_guesses, dedupeWords(answers), answers.length);
    } else {
        list = applyClueFilters(new_guesses, {word: best.word, colors: differences}, true);
    }    

    if (!engine.matchesVariant(VARIANT_ANTI) && !isDifficulty(MODE_STRICT)) {
        list = mergeUnique(dedupeWords(answers), new_guesses);
    }

    return list;
}

function countResults(best, answers, guesses, results, attempt, differences) {
    let new_guesses = mergeUnique(dedupeWords(answers), guesses);
    new_guesses = getNextGuesses(new_guesses, answers, best, differences);
    
    if (answers.length <= 2 && (!engine.matchesVariant(VARIANT_ANTI) || new_guesses.length == answers.length || !answers.length)) {
        addToResults(results, answers, attempt, best.word, engine.turnLimit()); 

    } else if (attempt < engine.turnLimit()-1) {
        if (attempt == engine.turnLimit()-2) {
            new_guesses = dedupeWords(answers.slice());
        }

        
        let best_words = engine.scoreGuessReduction(answers, new_guesses, true);
        if (!best_words[0]) return;
        let remaining = best_words[0].differences;

        Object.keys(remaining).forEach(function(key) {
            countResults(best_words[0], remaining[key], new_guesses, results, attempt+1, key);
        });
    }

    if (attempt >= engine.turnLimit()-1) {
            results['w'] = mergeUnique(results['w'], answers);
    }
    
    calculateAverageGuesses(best, results);
}

function addToResults(results, answers, attempt, current_answer, max_guesses) {
    // if (answers.length == 0) {
    if (isEmpty(answers)) {
        addToSpot(results, current_answer, attempt);

    } else if (attempt < max_guesses) {
        addToSpot(results, answers.pop(), attempt+1);
    }
        
    if (answers.length && attempt < max_guesses-1) {
        addToSpot(results, answers.pop(), attempt+2);
    }
}

function addToSpot(results, answer, index) {
    if (index >= results.length) {
        if (engine.matchesVariant(VARIANT_ANTI)) {
            for (let i = results.length; i <= index; i++) {
                results[i] = [];
            }
        } else {
            index = 'w';
        }
    }

    results[index].push(answer);
}

function calculateAverageGuesses(current_word, results) {
    let avg = 0;
    let sum = 0;

    for (let i = 0; i < results.length; i++) {
        let count = results[i].length;
        sum += count;
        avg += count*(i+1);
    }

    current_word.results = results;
    
    avg = avg/sum;
    current_word.average = avg;
}

/* FILTER FUNCTIONS */ 
function applyClueFilters(list, letters, reduced_filter, split) {
    if (turnCountEquals(0)) return list;

    if (letters) {
        return filterByPattern(list, letters.word, letters.colors, reduced_filter);
    }

    for (let guess = 0; guess < playedTurnCount(); guess++) {
        list = filterByPattern(list, readTurnWord(guess), engine.readTurnPattern(guess), reduced_filter, split, guess);
    }

    return list;
}

function filterByPattern(old_list, guess, difference, reduced_filter, split, turn) {
    let temp_list = dedupeWords(old_list);
    let new_list = new Array(engine.boardCount());
    for (let i = 0; i < new_list.length; i++) {
        new_list[i] = [];
    }

    difference = engine.expandPatternVariants(difference, guess, reduced_filter);

    for (let i = 0; i < temp_list.length; i++) {
        let list_index = patternMatches(guess, temp_list[i], difference, turn);
        if (list_index.length) {
            if (engine.boardCount() > 1) {
                addToList(old_list, list_index, temp_list[i], new_list);

            } else {
                new_list[0].push(temp_list[i]);
            }
        }
    }

    if (!split) new_list = dedupeWords(new_list);
    return new_list;
}

function addToList(all_lists, indices, new_word, new_lists) {
    for (let i = 0; i < indices.length; i++) {
        let pos = indices[i]

        if (typeof all_lists[0] == 'string' || all_lists[pos].includes(new_word)) {
            new_lists[pos].push(new_word);
        }
    }
}

function patternMatches(guess, answer, all_diffs, turn) {
    let correct_diff = engine.computeFeedback(guess, answer, turn);
    let indices = [];

    for (let i = 0; i < all_diffs.length; i++) {
        if (correct_diff == all_diffs[i]) {
            indices.push(i);
        }
    }

    return indices;
}

function tempXordleList(list) {
    let colors = [];
    let guessLexicon = [];
    let greens = [];

    for (let i = 0; i < playedTurnCount(); i++) {
        colors.push(engine.readTurnPattern(i));
        guessLexicon.push(readTurnWord(i)); 

        for (let j = 0; j < colors[i].length; j++) {
            if (colors[i].charAt(j) == MARK_EXACT) {
                if (!greens[j]) {
                    greens[j] = [];
                }
                
                if (!greens[j].includes(guessLexicon[i].charAt(j))) {
                    greens[j].push(guessLexicon[i].charAt(j));
                }
            }
        }
    }

    for (let i = 0; i < greens.length; i++) {
        if (!greens[i]) greens[i] = [];

        if (greens[i].length > 1) {
            for (let j = 0; j < list.length; j++) {
                if (!greens[i].includes(list[j].charAt(i))) {
                    list.splice(j, 1);
                    j--;
                }
            }
        }
    }

    return list;
}

function xordleFilter(list) {
    if (turnCountEquals(0)) return list;
    
    if (playedTurnCount() > 1) {
        list = tempXordleList(list);
    }

    if (list.length > 1000) return list;

    let doubles = [];
    for (let i = 0; i < list.length; i++) {
        let rest = list.slice(i+1).filter(a => engine.computeFeedback(list[i], a) == MARK_MISS.repeat(letterCount));

        for (let j = 0; j < rest.length; j++) {
            let guess = {word1: list[i], word2: rest[j]};

            if (couldBeAnswer(guess)) {
                doubles.push(guess);
            }
        }
    }    

    return doubles;
}

function couldBeAnswer(guess) {
    for (let i = 0; i < playedTurnCount(); i++) {
        if (engine.computeFeedback(readTurnWord(i), guess) != engine.readTurnPattern(i)) {
            return false;
        }
    }

    return true;
}

/* SORT FUNCTIONS */

// sorts the list based on which guessLexicon have the most solutionLexicon letters
// used when the list is too large to check against all possibilities
function sortList(list, alphabet) {
    if (!list.length) return [];
    if (!alphabet) alphabet = engine.pickLetterWeights(list);

    let newranks = [];

    list.forEach(function(w) {
        newranks.push({word: w, average: 0});
    });

    checked = [];

    for (let i = 0; i < newranks.length; i++) {
        for (let j = 0; j < letterCount; j++) {
            if (checked[i + " " + newranks[i].word.charAt(j)] == true) continue;  //no extra credit to letters with doubles
            // if (alphabet[newranks[i].word.charAt(j)][letterCount] == alphabet[newranks[i].word.charAt(j)][j]) continue;

            newranks[i].average += alphabet[newranks[i].word.charAt(j)][letterCount];
            newranks[i].average += alphabet[newranks[i].word.charAt(j)][j];
            checked[i + " " + newranks[i].word.charAt(j)] = true;
        }
        newranks[i].average = 1/newranks[i].average;
    }
        
    newranks = sortListByAverage(newranks);
    return newranks.map(a => a.word);
}

function sortListByAverage(list) {
    if (engine.matchesVariant(VARIANT_ANTI)) 
        return list.sort((a, b) => (a.average <= b.average) ? 1 : -1);

    return list.sort((a, b) => (a.average >= b.average) ? 1 : -1);
}

function sortByWrongThenAverage(guesses) {
    guesses.sort(function(a,b) {
        if(a.wrong > b.wrong) {return  1;}
        if(a.wrong < b.wrong) {return -1;}
        if(engine.prefersScore(a.average, b.average)) {return  -1;}
        if(!engine.prefersScore(a.average, b.average)) {return 1;}
        return 0;
    });

    return guesses;
}
