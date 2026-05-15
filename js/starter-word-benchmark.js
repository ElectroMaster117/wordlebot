var averages = [];
var newlist = [];
var benchmarkInterval = null;

function reduceTestList(list) {
    for (let i = 0; i < list.length; i++) {
        if (numberOfVowelsIn(list[i]) > 1) {
            list.splice(i, 1);
            i--;
        }
    }
    return list;
}

function numberOfVowelsIn(word) {
    return count(word, "A") + count(word, "E") + count(word, "I") + count(word, "O") + count(word, "U");
}

function getStartingWords(difficulty) {
    let guesses = getFirstGuesses(difficulty);
    return guesses.map(function (a) {
        return a.word;
    });
}

function runOpenerBenchmark() {
    let difficulty = MODE_STRICT;
    let check_list = getStartingWords(difficulty);
    let i = -1;

    let iv = setInterval(function () {
        if (averages.length > i) {
            i = averages.length;
            openStarterBenchmark();
            document.getElementById("testword").value = check_list[i];
            document.getElementsByClassName("engine")[0].click();
        }

        if (i >= check_list.length - 1) {
            clearInterval(iv);
        }
    }, 1);
}

function removeTest(animating) {
    if (animating) {
        clearTimeout(animating);
    }
    benchmarkInterval = null;
    clearBenchmarkPreview();
}

function clearBenchmarkPreview() {
    const preview = document.getElementById("benchmark-preview");
    if (!preview) return;

    const grids = preview.getElementsByClassName("grid");
    for (let i = 0; i < grids.length; i++) {
        wipeNode(grids[i]);
    }
    syncBenchmarkPreviewLayout();
}

function syncBenchmarkPreviewLayout() {
    const preview = document.getElementById("benchmark-preview");
    if (!preview) return;

    const rowCount = preview.querySelectorAll(".row").length;
    const rows = Math.max(rowCount, 1);
    const tileStep = 2.65;
    preview.style.setProperty("--sim-rows", String(rows));
    preview.style.minHeight = "calc(" + rows + " * " + tileStep + "rem + 1rem)";
    preview.style.maxHeight = "calc(" + Math.min(rows, 6) + " * " + tileStep + "rem + 1rem)";

    preview.scrollTop = preview.scrollHeight;
}

function createBarGraphs(max_guesses) {
    document.getElementById("benchmark-results")?.remove();

    let test_center = el("div", "", "benchmark-results");
    test_center.id = "benchmark-results";

    let stats = el("section", "", "benchmark-stats");
    let head = el("div", "", "benchmark-head");
    let average = el("div", "Average: —", "average");
    let progress = el("p", "Ready to run", "benchmark-progress");
    head.append(average);
    head.append(progress);
    stats.append(head);

    let chart = el("div", "", "benchmark-chart");
    for (let i = 0; i < max_guesses; i++) {
        addBar(chart, i + 1);
    }
    if (engine.turnLimit() != INFINITY) {
        addBar(chart, "X");
    }
    stats.append(chart);

    let summarySlot = el("div", "", "benchmark-summary-slot current");
    stats.append(summarySlot);

    let sim = el("aside", "", "benchmark-sim");
    sim.append(el("p", "Live simulation", "benchmark-sim-label"));
    let preview = el("div", "", "tile-rack benchmark-preview");
    preview.id = "benchmark-preview";
    let grid = el("div", "", "grid");
    preview.append(grid);
    sim.append(preview);

    let main = el("div", "", "benchmark-main");
    main.append(stats);
    main.append(sim);
    test_center.append(main);

    return test_center;
}

function updateBenchmarkProgress(done, total) {
    const progress = document.querySelector(".benchmark-progress");
    if (!progress) return;
    progress.textContent = "Game " + done + " / " + total;
}

function addBar(parent, guess_number) {
    let bar = el("div", "", "bar");
    let num_guesses = el("span", guess_number, "num-guesses");
    let count = el("span", "0", "count");

    bar.style.setProperty("--bar-h", "1.125rem");
    bar.append(num_guesses);
    bar.append(count);
    parent.append(bar);
}

function openStarterBenchmark() {
    if (typeof closeAllOverlays === "function") {
        closeAllOverlays();
    }
    launchBenchmark();
}

function toggleBenchmarkPage() {
    const modal = document.getElementById("benchmark-modal");
    if (modal.classList.contains("display")) {
        closeBenchmarkModal();
        return;
    }
    openStarterBenchmark();
}

function closeBenchmarkModal() {
    if (benchmarkInterval) {
        clearTimeout(benchmarkInterval);
    }
    benchmarkInterval = null;
    patternCache = [];
    removeTest();
    wipeNode(document.getElementById("benchmark-body"));
    closeOverlay(document.getElementById("benchmark-modal"));
}

function createBotMenu() {
    let menu = el("div", "", "test-settings");
    menu.id = "test-settings";

    let label = el("label", "Starting word to test", "benchmark-word-label");
    label.setAttribute("for", "testword");

    let input = el("input", "", "testword benchmark-word-input");
    input.id = "testword";
    input.type = "text";
    input.placeholder = "e.g. CRANE";
    input.setAttribute("maxlength", letterCount);
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    input.setAttribute("onkeypress", "return /[a-z]/i.test(event.key)");
    input.setAttribute("oninput", "this.value = this.value.toUpperCase()");

    let row = el("div", "", "benchmark-word-row");
    row.append(label);
    row.append(input);

    let hint = el(
        "p",
        "Runs " + TEST_SIZE + " random games using this opener and shows average guesses to solve.",
        "benchmark-word-hint"
    );
    menu.append(row);
    menu.append(hint);
    menu.append(el("p", BOT_MENU_TEXT, "disclaimer"));

    let submit_button = el("button", "Start benchmark", "engine");
    submit_button.type = "button";
    menu.append(submit_button);

    return menu;
}

function getTestSize() {
    return Math.min(500, solutionLexicon.length);
}

function launchBenchmark() {
    if (
        engine.matchesVariant(VARIANT_XORDLE) ||
        engine.matchesVariant(VARIANT_FIBBLE) ||
        engine.boardCount() > 1 ||
        engine.matchesVariant(VARIANT_SPOTLE)
    ) {
        const body = document.getElementById("benchmark-body");
        wipeNode(body);
        body.append(
            el(
                "p",
                "Benchmark is only available for standard single-board Wordle variants.",
                "benchmark-unavailable"
            )
        );
        openOverlay(document.getElementById("benchmark-modal"));
        return;
    }

    TEST_SIZE = getTestSize();

    const body = document.getElementById("benchmark-body");
    wipeNode(body);

    let number_of_bars = engine.turnLimit() == INFINITY ? 6 : engine.turnLimit();
    let test_center = createBarGraphs(number_of_bars);
    let menu = createBotMenu();
    test_center.insertBefore(menu, test_center.firstChild);

    body.append(test_center);

    const modal = document.getElementById("benchmark-modal");
    openOverlay(modal);

    document.getElementById("testword").focus();

    modal.querySelector(".benchmark-close").onclick = closeBenchmarkModal;

    function startBenchmarkRun() {
        let word = document.getElementById("testword").value;
        if (word.length == letterCount && engine.isAllowedGuess(word)) {
            document.getElementById("test-settings")?.remove();
            runBot(word, MODE_STRICT);
        }
    }

    modal.querySelector(".engine").addEventListener("click", startBenchmarkRun);
    document.getElementById("testword").addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            e.preventDefault();
            startBenchmarkRun();
        }
    });
}

function getTestAnswers(TEST_SIZE, random_answers) {
    if (TEST_SIZE >= solutionLexicon.length) return solutionLexicon.slice();
    if (TEST_SIZE == random_answers.length) return random_answers;

    random_answers.push(getRandomAnswer());
    return getTestAnswers(TEST_SIZE, random_answers);
}

function getRandomAnswer() {
    let index = Math.floor(Math.random() * (solutionLexicon.length - 1));
    if (engine.boardCount() > 1) {
        let indices = [index];

        for (let i = 0; i < engine.boardCount() - 1; i++) {
            let new_index = indices[0];

            while (indices.includes(new_index)) {
                new_index = Math.floor(Math.random() * (solutionLexicon.length - 1));
            }

            indices.push(new_index);
        }

        let answers = [];

        for (let i = 0; i < engine.boardCount(); i++) {
            answers.push(solutionLexicon[indices[i]]);
        }

        return answers;
    } else if (engine.matchesVariant(VARIANT_XORDLE)) {
        let pair_index = Math.round(Math.random() * (solutionLexicon.length - 1));
        if (
            engine.computeFeedback(solutionLexicon[index], solutionLexicon[pair_index]) ==
            MARK_MISS.repeat(letterCount)
        ) {
            return { word1: solutionLexicon[index], word2: solutionLexicon[pair_index] };
        }
    }

    return solutionLexicon[index];
}

function adjustBarHeight(points, scores, total_sum, games_played) {
    const chart = document.querySelector(".benchmark-chart");
    if (!chart) return;

    let bars = chart.querySelectorAll(".bar");
    if (points >= bars.length) {
        extendBarGraphs(bars.length, points);
        bars = chart.querySelectorAll(".bar");
    }

    let max = Math.max(...scores, 1);

    for (let x = 0; x < bars.length; x++) {
        let countEl = bars[x].querySelector(".count");
        if (countEl) countEl.textContent = scores[x] || 0;
        let ratio = (scores[x] || 0) / max;
        bars[x].style.setProperty("--bar-h", "calc(1.125rem + " + ratio * 4.5 + "rem)");
    }

    document.querySelector("#benchmark-results .average").textContent =
        "Average: " + (total_sum / games_played).toFixed(3);
}

function extendBarGraphs(current_length, new_max) {
    let chart = document.querySelector(".benchmark-chart");
    if (!chart) return;

    for (let i = current_length; i <= new_max; i++) {
        addBar(chart, i + 1);
    }
}

function showResults(guess, correct, total_tested, average, words_missed) {
    clearBenchmarkPreview();
    updateBenchmarkProgress(total_tested, total_tested);

    let summary =
        guess +
        " solved " +
        correct +
        "/" +
        total_tested +
        " words with an average of " +
        average +
        " guesses per solve.";

    if (words_missed.length) {
        summary += " " + showMissedWords(words_missed).textContent;
    }

    const slot = document.querySelector(".benchmark-summary-slot");
    if (slot) {
        wipeNode(slot);
        slot.append(el("div", summary, "summary"));
    }
}

function showMissedWords(words_missed) {
    let missed = el("div", "Missed words: ", "wrongs");

    for (let i = 0; i < words_missed.length; i++) {
        missed.innerHTML += printAnswer(words_missed[i]);
        if (i < words_missed.length - 1) {
            missed.innerHTML += ", ";
        }
    }

    return missed;
}

function runBot(guess, difficulty) {
    const start_time = performance.now();

    let sum = 0;
    let count = 0;
    let missed = [];

    let num_guesses = engine.turnLimit() == INFINITY ? 6 : engine.turnLimit();
    let scores = new Array(num_guesses).fill(0);

    let testing_sample = getTestAnswers(TEST_SIZE, []);
    let final_scores = [];

    if (benchmarkInterval) {
        clearTimeout(benchmarkInterval);
        benchmarkInterval = null;
    }

    function runNextGame() {
        if (count >= TEST_SIZE) {
            return;
        }

        clearBenchmarkPreview();

        let points = wordleBot(guess, testing_sample[count], difficulty);
        if (points > engine.turnLimit()) {
            missed.push(testing_sample[count]);
        }

        if (!final_scores[points]) final_scores[points] = [];
        final_scores[points].push(testing_sample[count]);

        patternCache = [];

        sum += points;

        if (points > scores.length) scores = extendArray(scores, points, 0);
        scores[points - 1] += 1;

        adjustBarHeight(points - 1, scores, sum, count + 1);
        updateBenchmarkProgress(count + 1, TEST_SIZE);
        count++;

        if (count >= TEST_SIZE) {
            let average = parseFloat(sum / count);
            let wrong = missed.length / solutionLexicon.length;

            showResults(guess, TEST_SIZE - missed.length, TEST_SIZE, average.toFixed(3), missed);
            updateWordData(guess, average, wrong);
            printData(newlist, guess, average, (performance.now() - start_time) / 1000);

            patternCache = [];
            benchmarkInterval = null;
            return;
        }

        benchmarkInterval = setTimeout(runNextGame, 0);
    }

    runNextGame();
}

function updateWordData(guess, average, wrong) {
    averages.push({ word: guess, average: average, wrong: wrong });
    averages.sort(function (a, b) {
        return a.average >= b.average ? 1 : -1;
    });
    if (TEST_SIZE < solutionLexicon.length) return;

    if (!newlist.length) {
        newlist = OPENER_RANKINGS_EASY;
    }

    let index = newlist[engine.type].map(function (a) {
        return a.word;
    }).indexOf(guess);
    let data = { average: average, wrong: wrong };

    if (index == -1) {
        newlist[engine.type].push({ word: guess });
        index = newlist[engine.type].length - 1;
    }

    newlist[engine.type][index][poolMode] = data;
}

function printData(all_words, guess, average, time) {
    console.log(all_words);
    console.log(
        averages.map(function (a) {
            return a.word;
        }).indexOf(guess) +
            ": " +
            guess +
            " --> " +
            average +
            " --> " +
            time +
            " seconds"
    );
    console.log(averages);
    console.log(seconds);
}

function wordleBot(guess, answer) {
    let attempts = 1;
    const preview = document.getElementById("benchmark-preview");
    let grids = preview.getElementsByClassName("grid");

    while (attempts <= engine.turnLimit()) {
        for (let i = 0; i < engine.boardCount(); i++) {
            let row = createRow(guess, "testing");
            grids[i].append(row);
            engine.bindTileHandlers(row);
        }
        let diff = [engine.computeFeedback(guess, answer)];
        colorGrids(diff, engine.boardCount(), attempts - 1, preview);
        syncBenchmarkPreviewLayout();

        if (answerFound(guess, answer)) {
            break;
        }

        attempts++;

        let lists = assemblePools();
        let final_guesses = rankCandidateGuesses(lists.answers, lists.guesses, lists.unique);
        guess = final_guesses[0].word;
    }

    return attempts;
}

function colorGrids(differences, number_of_grids, row_number, rack) {
    rack = rack || document.getElementById("benchmark-preview");
    let grids = rack.getElementsByClassName("grid");

    for (let i = 0; i < number_of_grids; i++) {
        let rows = grids[i].getElementsByClassName("row");
        if (rows[row_number]) {
            engine.paintTurnPattern(differences[i], rows[row_number]);
        }
    }
}

function getMultiDifference(guess, answers) {
    let diffs = [];

    for (let i = 0; i < answers.length; i++) {
        let color = engine.computeFeedback(guess, answers[i]);
        diffs.push(color);
    }

    return diffs;
}

function otherAnswer(answer, answers) {
    if (answer == answers.word1) return answers.word2;
    return answers.word1;
}

function answerFound(guess, answer) {
    if (guess == answer) return true;

    if (engine.matchesVariant(VARIANT_XORDLE)) {
        if (guess == answer.word1 || guess == answer.word2) return true;
    }

    if (engine.boardCount() > 1) {
        if (answer.includes(guess)) return true;
    }

    return false;
}

const BOT_MENU_TEXT =
    "The first runs can be slow; speed improves as more games complete.";
