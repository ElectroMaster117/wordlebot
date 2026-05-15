// class constants
const VARIANT_WORDLE = 'Wordle';
const VARIANT_WOODLE = 'Woodle';
const VARIANT_PEAKS = 'W-Peaks';
const VARIANT_ANTI = 'Antiwordle';
const VARIANT_XORDLE = 'Xordle';
const VARIANT_THIRDLE = 'Thirdle';
const VARIANT_FIBBLE = 'Fibble';
const VARIANT_HARDLE = 'Hardle';
const VARIANT_DORDLE = 'Dordle';
const VARIANT_QUORDLE = 'Quordle';
const VARIANT_OCTORDLE = 'Octordle';
const VARIANT_WARMLE = 'Warmle';
const VARIANT_SPOTLE = 'Spotle';

spotleMode = false;


class GameVariantEngine {
    constructor(type) {
        this.type = type;
    }

    matchesVariant(type) {
        return this.type == type;
    }

    supportsStrictMode() {
        return true;
    }

    hasTurnCap() {
        return this.type != VARIANT_ANTI;
    }

    turnLimit() {
        if (this.type == VARIANT_ANTI) return INFINITY;
        const raw = document.getElementById("max-guesses")?.value;
        if (raw === "infinity") return INFINITY;
        const limit = parseInt(raw, 10);
        return isNaN(limit) ? INFINITY : limit;
    }

    bindTileHandlers(row) {
        if (this.type == VARIANT_WOODLE) {
            woodleDropdown(row);
        } else {
            wireTileCycling(row);
        }
    }

    computeFeedback(word1, word2, turn) {
        if (this.type == VARIANT_WOODLE) {
            return differencesWithoutPositions(word1, word2);
        } 
        
        if (this.type == VARIANT_PEAKS) {
            return getAlphabeticDifferences(word1, word2);
        } 
        
        if (typeof word2 == 'object') {
            return getDoubleDifference(word1, word2);
        } 
        
        if (this.type == VARIANT_WARMLE) {
            return getWarmleDifferences(word1, word2);
        }

        let diff = feedbackWithSlots(word1, word2);
        
        if (this.type == VARIANT_SPOTLE && spotleMode) {
            diff = addBlanks(diff, turn);
        }

        return diff;
    }

    readTurnPattern(row_number) {
        if (this.type == VARIANT_WOODLE) {
            return rowDifferencesWithoutPositions(row_number);
        } else if (this.boardCount() > 1) {
            return rowDifferencesWithPairs(row_number);
        } else {
            return rowDifferencesWithPositions(row_number);
        }
    }

    paintTurnPattern(difference, row) {
        if (this.type == VARIANT_DORDLE && difference.length == letterCount*2) {
            return setDordleDifferences(difference, row);
        } else if (this.type == VARIANT_WOODLE) {
            return setRowDifferencesWithoutPositions(difference, row);
        } else {
            return setRowDifferencesWithPositions(difference, row);
        }
    }

    pickLetterWeights(list) {
        if (this.type == VARIANT_PEAKS) {
            return lettersClosestToCenter(list);
        } 

        if (this.type == VARIANT_WARMLE) {
            return bestWarmleLetters(list);
        }

        return mostCommonLetters(list);
    }

    scoreGuessReduction(answers, guesses, future_guess) {
        if (this.type == VARIANT_ANTI) {
            return reducesListLeast(answers, guesses);
        } else {
            return reducesListMost(answers, guesses, future_guess);
        }
    }

    expandPatternVariants(difference, guess, reduced_filter) {
        if (reduced_filter) {
            return getAntiWordleDiffs(difference, guess);
        }
        
        if (this.type == VARIANT_XORDLE) {
            return getXordleDiffs(difference, 0, [difference]);
        } 
        
        if (this.type == VARIANT_FIBBLE) {
            return getFibbleDiffs(difference);
        }
        
        if (this.type == VARIANT_HARDLE) {
            return getHardleDiffs(difference);
        } 
        
        if (this.boardCount() > 1) {
            return difference;
        }

        return [difference];
    }

    prefersScore(a, b) {
        if (engine.matchesVariant(VARIANT_ANTI)) {
            return scoreIsHigher(a, b);
        } else {
            return scoreIsLower(a, b);
        }
    }

    boardCount() {
        if (engine.matchesVariant(VARIANT_DORDLE)) return 2;
        if (engine.matchesVariant(VARIANT_QUORDLE)) return 4;
        if (engine.matchesVariant(VARIANT_OCTORDLE)) return 8;
        else return 1;
    }

    narrowSolutionsFrom(list) {
        list = applyClueFilters(list, 0, 0, engine.boardCount() > 1);
        
        if (engine.matchesVariant(VARIANT_XORDLE)) {
            list = xordleFilter(dedupeWords(list));
        }

        return list;
    }

    solutionCount(answers) {
        if (engine.boardCount() > 1) {
            return lengthOfAllLists(answers);
        }   
        
        return answers.length;
    }

    isCuratedSolution(answer) {
        if (this.type == VARIANT_XORDLE && typeof answer == 'object') {
            return this.isCuratedSolution(answer.word1) && this.isCuratedSolution(answer.word2);
        }

        return solutionLexicon.includes(answer);
    }

    isAllowedGuess(guess) {
        if (guess.length != letterCount) return false;

        if (engine.matchesVariant(VARIANT_THIRDLE)) return true;

        return guessLexicon.includes(guess);
    }
}

function scoreIsHigher(a, b) {
    return a > b;
}

function scoreIsLower(a, b) {
    return a < b;
}

// Wordle Specific Functions
function wireTileCycling(row) {
    let tiles = row.getElementsByClassName('tile');

    Array.from(tiles).forEach(function(t) {
      t.addEventListener('click', function() {
        if (playedTurnCount() > 0 && t.innerHTML == " ") {
            return;
        }

        cycleTileState(t);

        spotleMode = true;
      });
    });
}


function applyTileMark(tile, mark) {
    tile.classList.remove(MARK_EXACT, MARK_SHIFT, MARK_MISS, MARK_BLANK);
    tile.classList.add(mark);
    tile.setAttribute("data-mark", mark);
}

function cycleTileState(tile) {
    let old_color = readTileMark(tile);
    let new_color = advanceTileMark(old_color);
    applyTileMark(tile, new_color);
}

function advanceTileMark(color) {
    if (engine.matchesVariant(VARIANT_SPOTLE)) {
        if (playedTurnCount() == 0) {
            return color == MARK_BLANK ? MARK_MISS : MARK_BLANK;
        }

        if (color == MARK_BLANK) return MARK_BLANK;
    }

    return color == MARK_EXACT ? MARK_SHIFT : (color == MARK_SHIFT ? MARK_MISS : MARK_EXACT)
}

function readTileMark(tile) {
    if (tile.classList.contains(MARK_EXACT)) return MARK_EXACT;
    if (tile.classList.contains(MARK_SHIFT)) return MARK_SHIFT;
    if (tile.classList.contains(MARK_BLANK)) return MARK_BLANK;
    return MARK_MISS;
}

function addBlanks(difference, turn) {
    if (turn == null) {
        turn = playedTurnCount();
    }

    let current = engine.readTurnPattern(turn);

    for (let i = 0; i < letterCount; i++) {
        if (current.charAt(i) == MARK_BLANK) {
            difference = spliceChar(difference, MARK_BLANK, i);
        }
    }

    return difference;
}

function feedbackWithSlots(word1, word2) {
    if (patternCache[word1]) {
        if (patternCache[word1][word2]) return patternCache[word1][word2];
    } else patternCache[word1] = [];
    
    
    let temp1 = word1;
    let temp2 = word2;
    let diff = MARK_BLANK.repeat(letterCount);
    let pos = 0;

    for (let j = 0; j < temp1.length; j++) {        
        let word1_c = temp1.charAt(j);
        let word2_c = temp2.charAt(j);

        if (word1_c == word2_c) {
            temp1 = temp1.slice(0, j) + temp1.slice(j+1);
            temp2 = temp2.slice(0, j) + temp2.slice(j+1);
            diff = spliceChar(diff, MARK_EXACT, pos);
            j--;
        }
        pos++;
    }

    pos = 0;
    for (let j = 0; j < temp1.length; j++) {
        if (diff.charAt(pos) != 'X') {
            j--;
            pos++;
            continue;
        }

        let word1_c = temp1.charAt(j);
        if (temp2.includes(word1_c)) {
            diff = spliceChar(diff, MARK_SHIFT, pos);

            let index = temp2.indexOf(word1_c);
            temp2 = temp2.slice(0, index) + temp2.slice(index+1);
        } else {
            diff = spliceChar(diff, MARK_MISS, pos);
        }


        pos++;
    }

    patternCache[word1][word2] = diff;
    return diff;
}

function getDoubleDifference(guess, answers) {
    let diff1 = engine.computeFeedback(guess, answers.word1);
    let diff2 = engine.computeFeedback(guess, answers.word2);

    let new_diff = "";
    for (let i = 0; i < letterCount; i++) {
        if (diff1.charAt(i) != MARK_MISS) {
            new_diff += diff1.charAt(i);
        } else if (diff2.charAt(i) != MARK_MISS) {
            new_diff += diff2.charAt(i);
        } else {
            new_diff += MARK_MISS;
        }
    }

    return new_diff;
}

function dordleDifference(guess, answers) {
    return [feedbackWithSlots(guess, answers.word1), 
            feedbackWithSlots(guess, answers.word2)];
}

function rowDifferencesWithPositions(row_number) {
    let row = getPlayRows()[row_number];
    if (!row) return MARK_MISS.repeat(letterCount);
    let coloring = "";

    for (let i = 0; i < letterCount; i++) {
        coloring += readTileMark(row.getElementsByClassName("tile")[i]);
    }

    return coloring;
}

function rowDifferencesWithPairs(row_number) {
    let colors = [];
    let grids = getPlayRack().getElementsByClassName("grid");

    for (let i = 0; i < grids.length; i++) {
        let row = grids[i].getElementsByClassName('row')[row_number];
        let coloring = "";

        for (let j = 0; j < letterCount; j++) {
            coloring += readTileMark(row.getElementsByClassName("tile")[j]);
        }

        colors.push(coloring);
    }
    
    return colors;
}

function getAlphabeticDifferences(word1, word2) {
    let diff = "";
    for (let i = 0; i < letterCount; i++) {
        let a = word1.charAt(i), b = word2.charAt(i);

        if (a == b) {
            diff += MARK_EXACT;
        } else if (a > b) {
            diff += MARK_MISS;
        } else if (a < b) {
            diff += MARK_SHIFT;
        }
    }

    return diff;
}

function getWarmleDifferences(word1, word2) {
    let diff = "";
    let distance = document.getElementsByClassName('warmle-selector')[0].value;

    for (let i = 0; i < letterCount; i++) {
        let a = word1.charAt(i).charCodeAt(0), b = word2.charAt(i).charCodeAt(0);

        if (a == b) {
            diff += MARK_EXACT;
        } else if (Math.abs(a-b) <= distance ) {
            diff += MARK_SHIFT;
        } else {
            diff += MARK_MISS;
        }
    }

    return diff;
}

function setDordleDifferences(colorings, row) {
    setRowDifferencesWithPositions(colorings[0], row);
    setRowDifferencesWithPositions(colorings[1], row.nextSibling);
}

function setRowDifferencesWithPositions(coloring, row) {
    let tiles = row.getElementsByClassName('tile');

    for (let i = 0; i < letterCount; i++) {
        applyTileMark(tiles[i], coloring.charAt(i));
    }
}

// Woodle Specific Functions
function woodleDropdown(row) {
    let selector = row.getElementsByClassName('woodle-count');
    for (let i = 0; i < selector.length; i++) {
        if (selector[i].getElementsByTagName('option').length) {
            continue;
        }

        let options = "";
        for (let j = 0; j <= letterCount; j++) {
            options += "<option value='" + j + "'>" + j + "</option>"
        }

        selector[i].innerHTML = options;
    }
}

function rowDifferencesWithoutPositions(row) {
    let num_correct = document.getElementsByClassName('woodle-count ' + MARK_EXACT)[row].value;
    let num_wrong_spots = document.getElementsByClassName('woodle-count ' + MARK_SHIFT)[row].value;
    let num_wrong = letterCount - num_correct - num_wrong_spots;

    return MARK_EXACT.repeat(num_correct) + MARK_SHIFT.repeat(num_wrong_spots) + MARK_MISS.repeat(num_wrong);
}

function differencesWithoutPositions(word1, word2) {
    let temp1 = word1;
    let temp2 = word2;

    if (patternCache[word1]) {
        if (patternCache[word1][word2]) return patternCache[word1][word2];
    } else patternCache[word1] = [];

    let correct = "";
    let wrong_spots = "";
    let num_wrong = letterCount;

    for (let j = 0; j < temp1.length; j++) {
        if (num_wrong == 0) break;
        
        let word1_c = temp1.charAt(j);
        let word2_c = temp2.charAt(j);

        if (word1_c == word2_c) {
            correct += MARK_EXACT;
            num_wrong--;
            
            temp1 = temp1.slice(0, j) + temp1.slice(j+1);
            temp2 = temp2.slice(0, j) + temp2.slice(j+1);
            j--;
        }
    }

    for (let j = 0; j < temp1.length && num_wrong > 0; j++) {
        let word1_c = temp1.charAt(j);

        if (temp2.includes(word1_c)) {
            wrong_spots += MARK_SHIFT;
            num_wrong--;

            let index = temp2.indexOf(word1_c);
            temp2 = temp2.slice(0, index) + temp2.slice(index+1);
        }
    }

    let diff = correct + wrong_spots + MARK_MISS.repeat(num_wrong);
    patternCache[word1][word2] = diff;

    return diff;
}

function setRowDifferencesWithoutPositions(coloring, row) {
    let selectors = row.getElementsByClassName('tracker')[0];
    let num_correct = selectors.getElementsByClassName('woodle-count ' + MARK_EXACT)[0];
    let num_wrong_spots = selectors.getElementsByClassName('woodle-count ' + MARK_SHIFT)[0];

    let correct = count(coloring, MARK_EXACT);
    let wrong_spots = count(coloring, MARK_SHIFT);
    num_correct.innerHTML = "<option value='" + correct + "'>" + correct + "</option>";
    num_wrong_spots.innerHTML = "<option value='" + wrong_spots + "'>" + wrong_spots + "</option>";
}



// calculates which letters appear most often throughout the remaining answers
// used to rough sort the list if the entire list is too large to check
// info is also prited underneath 'Most Common Letters' section
function mostCommonLetters(list) {
    if (!list.length) return [];

    let letters = makeAlphabetArray(parseInt(letterCount)+1);
    let checked;

    for (let i = 0; i < list.length; i++) {
        checked = [];
        for (let j = 0; j < letterCount; j++) {
            c = list[i].charAt(j);

            letters[c][j]++;

            if (checked[c] != true) letters[c][letterCount]++;  // only counts letters once per word
            checked[c] = true;
        }
    }
    return letters;
}

function lettersClosestToCenter() {
    let letters = [];

    for (let c = 65; c <= 90; c++) {
        let char = String.fromCharCode(c);
        let val = 1/Math.abs(c - (90+65)/2);
        letters[char] = [];

        for (let i = 0; i < letterCount+1; i++) {
            letters[char].push(val);
        }
    }

    return letters;
}

function bestWarmleLetters(list) {
    let letters = makeAlphabetArray(parseInt(letterCount)+1);

    list.forEach(function(word) {
        for (let i = 0; i < letterCount; i++) {
            let c = word.charAt(i);
            letters[c][i]++;
            letters[c][word.length]++;
        }
    });

    let new_letters = makeAlphabetArray(parseInt(letterCount)+1);

    for (let i = 65; i <= 90; i++) {
        let pos = intToChar(i);

        for (let j = 0; j < letterCount; j++) {
            new_letters[pos][j] = letters[pos][j];

            let distance = document.getElementsByClassName('warmle-selector')[0].value;
            for (let k = 1; k <= distance; k++) {    
                let c = charToInt(pos)+k;

                if (c <= 90) {
                    c = intToChar(c);
                    new_letters[pos][j] += letters[c][j];
                }
                
                c = charToInt(pos)-k;
                if (c >= 65) {
                    c = intToChar(c);
                    new_letters[pos][j] += letters[c][j];
                }
            }

        }

        new_letters[pos][letterCount] = letters[pos][letterCount];
    }

    return new_letters;
}

function makeAlphabetArray(size) {
    let letters = [];
    
    for (let i = 65; i <= 90; i++) {
        let c = String.fromCharCode(i);

        letters[c] = [];
        for (let i = 0; i < size; i++) {
            letters[c].push(0);
        }
    }    

    return letters;
}

function reducesListMost(answers, guesses, future_guess) {
    let best_words = [];
    let min = answers.length;

    for (let i = 0; i < guesses.length; i++) {
        let data;

        if (engine.boardCount() > 1 && typeof answers[0] == 'object') {
            let data_per_list = [];

            for (let j = 0; j < answers.length; j++) {
                
                min = answers[j].length;
                data_per_list.push(calculateAverageBucketSize(guesses[i], answers[j], min, future_guess));
            }
            
            data = averageBucketSizeFromAllLists(data_per_list);
        } else {
            data = calculateAverageBucketSize(guesses[i], answers, min, future_guess);
        }

        if (!data) continue;
  
        min = Math.min(min, data.adjusted);
        best_words.push({word: guesses[i], average: data.adjusted, differences: data.differences, wrong: 0});

        if (data.weighted < 1 && future_guess) break;
        if (min == 0 && best_words.length >= answers.length && future_guess) break;
    }

    best_words = sortListByAverage(best_words);
    return best_words;
}

function averageBucketSizeFromAllLists(data) {
    let differences = {};
    let average = 0;

    for (let i = 0; i < data.length; i++) {
        average += data[i].adjusted;
        let keys = [...new Set([...Object.keys(differences),...Object.keys(data[i].differences)])]
        let op = {};

        differences = keys.forEach(key=>{
            op[key] = {
                ...differences[key],
                ...data[i].differences[key]
            }
        });

        differences = op;
    }

    average /= engine.boardCount();

    return {adjusted: average, differences: differences};
}

function reducesListLeast(answers, guesses) {
    let best_words = [];

    for (let i = 0; i < guesses.length; i++) {
        let data = calculateAverageBucketSize(guesses[i], answers, 0, 0);

        best_words.push({word: guesses[i], average: data.weighted, differences: data.differences});
    }

    best_words = sortListByAverage(best_words);
    return best_words;    
}

function calculateAverageBucketSize(guess, answers, min, future_guess) {
    let differences = [];
    let list_size = answers.length;
    let weighted = adjusted = 0;
    let threes = 1;

    for (let i = 0; i < list_size; i++) {
        let diff = engine.computeFeedback(guess, answers[i], future_guess); 

        if (differences[diff] == null) {
            differences[diff] = [];
        }

        if (diff != MARK_EXACT.repeat(letterCount) || engine.matchesVariant(VARIANT_XORDLE)) {
            differences[diff].push(answers[i]);
        }

        let freq = differences[diff].length;
        
        if (freq > 0) {
            weighted += (freq/list_size)*freq - ((freq-1)/list_size)*(freq-1);
            if (freq > 1) {
                threes -= 1/list_size;
            }
        }

        adjusted = (1-threes)*weighted;
        if (!engine.matchesVariant(VARIANT_ANTI) && (adjusted > min && future_guess || adjusted > min*SIZE_FACTOR)) {
            return;
        }
    }
    let bucket_data = {word: guess, weighted: weighted, threes: threes, adjusted: adjusted, differences: differences};
    return bucket_data;
}

function getXordleDiffs(difference, index, diff_list) {
    if (index == difference.length) return [...new Set(diff_list)];

    if (difference.charAt(index) != MARK_MISS) {
        let alt = spliceChar(difference, MARK_MISS, index);

        diff_list.push(alt);
        getXordleDiffs(alt, index+1, diff_list);
    } 

    return getXordleDiffs(difference, index+1, diff_list);
}

function getFibbleDiffs(diff) {
    let differences = [];

    for (let i = 0; i < diff.length; i++) {
        if (diff.charAt(i) != MARK_MISS) {
            let new_diff = spliceChar(diff, MARK_MISS, i);
            differences.push(new_diff);
        }

        if (diff.charAt(i) != MARK_EXACT) {
            let new_diff = spliceChar(diff, MARK_EXACT, i);
            differences.push(new_diff);
        }

        if (diff.charAt(i) != MARK_SHIFT) {
            let new_diff = spliceChar(diff, MARK_SHIFT, i);
            differences.push(new_diff);
        }
    }

    if (differences.length > 1) {
        differences = differences.filter(a => a != MARK_EXACT.repeat(letterCount));
    }

    return differences;
}

function getHardleDiffs(diff) {
    let differences = [diff];
    let new_diff = "";

    if (diff == MARK_SHIFT.repeat(letterCount)) {
        return differences;
    }
    
    for (let i = 0; i < diff.length; i++) {
        if (diff.charAt(i) == MARK_EXACT) {
            new_diff += MARK_SHIFT;
        } else if (diff.charAt(i) == MARK_SHIFT) {
            new_diff += MARK_EXACT;
        } else new_diff += MARK_MISS;
    }

    differences.push(new_diff);
    return differences;
}

function getAntiWordleDiffs(diff, guess) {
    let wrong_letters = findWrongSpotLetters(diff, guess);
    let differences = antiRecursion(guess, diff, wrong_letters, [], 0);

    if (differences.length > 1) {
        differences = differences.filter(a => a != MARK_EXACT.repeat(letterCount));
    }
    
    includesAllWrongSpots(differences, wrong_letters, guess);

    return differences;
}

function includesAllWrongSpots(differences, wrong_letters, word) {
    if (!wrong_letters.length) return differences;

    outer:
    for (let i = 0; i < differences.length; i++) {
        let check_list = [];

        for (let j = 0; j < letterCount; j++) {
            if (differences[i].charAt(j) != MARK_MISS) {
                let c = word.charAt(j);

                if (!check_list.includes(c)) {
                    check_list.push(c);

                    if (check_list.length == wrong_letters.length) {
                        continue outer;
                    }
                }
            }
        }
        
        differences.splice(i, 1);
        i--;
    }
}

function antiRecursion(word, difference, wrong_letters, diff_list, i) {
    diff_list.push(difference);

    if (i == letterCount) {
        diff_list = [...new Set(diff_list)];
        return diff_list;
    }
    
    if (wrong_letters.includes(word.charAt(i)) && difference.charAt(i) != MARK_EXACT) {
        antiRecursion(word, spliceChar(difference, MARK_EXACT, i), wrong_letters, diff_list, i+1);

        if (difference.charAt(i) != MARK_MISS) {
            antiRecursion(word, spliceChar(difference, MARK_MISS, i), wrong_letters, diff_list, i+1);
        }

        if (difference.charAt(i) != MARK_SHIFT) {
            antiRecursion(word, spliceChar(difference, MARK_SHIFT, i), wrong_letters, diff_list, i+1);
        }
    }

    return antiRecursion(word, difference, wrong_letters, diff_list, i+1);
}

function findWrongSpotLetters(diff, guess) {
    // find index of every Y character in the differences
    let wrong_spots = allInstancesOf(MARK_SHIFT, diff);
    let correct = allInstancesOf(MARK_EXACT, diff);
    let indices = mergeUnique(wrong_spots, correct);
    let c = [];

    // indentify all letters marked as Y
    for (let i = 0; i < indices.length; i++) {
        c.push(guess.charAt(indices[i]));
    }

    c = [...new Set(c)];
    return c;
}

function lengthOfAllLists(lists) {
    if (lists.length && typeof lists[0] == 'string') {
        return lists.length;
    }

    let new_list = [];

    lists.forEach(function(a) {
        new_list = mergeUnique(new_list, a);
    });

    new_list = dedupeWords(new_list);
    return new_list.length;
}