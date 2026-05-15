$(document).ready(function() {
    bindOverlayControls();
    getPreferences();
    bootstrapApp();

    $("#bot-type").change(function() {
        let val = $(this).val();
        localStorage.setItem('bot_type', val);
        activateVariant(val);
        resetBoard();
        // createPage();
    });

    $(document).on('input', '.warmle-selector', function() {
        let val = $(this).val();
        localStorage.setItem('warmle_dist', val);
        refreshAnalysis();
    });

    $("#word-length").on('input', function() {
        localStorage.setItem('letterCount' + engine.type, $(this).val());
        bootstrapApp();
    });

    $("#max-guesses").on('input', function() {
        localStorage.setItem('guesses' + engine.type, $(this).val());
        bootstrapApp();
    });

    $(".wordbank").on('input', function() {
        if (!$(this).is(':checked')) {
            $(this).prop('checked', true);
            return;
        }

        localStorage.setItem('wordbank', $(this).attr('id'));
        $("#" + otherWordbank($(this).attr('id'))).prop('checked', false);
        applyPoolMode();
        refreshAnalysis();
    });

    
    $("#word-entered").on('input', function(e) {
        let val = $("#word-entered").val();

        if (val.length == letterCount) {
            if (!guessLexicon.includes(val) && playedTurnCount() > 0) {
                return;
            }

            $("#word-entered").blur();
            
            appendGuessRow(val);
            
            if (letterCount == 11) {
                $(".tile").css('font-size', '1rem');
            }
        } 
    });

    $(document).on('click', '.click', function() {
        appendGuessRow($(this).html());
    })

    $(document).on("click", ".pool-toggle", function () {
        const panel = this.closest(".pool-panel");
        if (!panel) return;
        const isOpen = panel.classList.contains("is-open");
        setPoolExpanded(panel, !isOpen);
    });
});

function bootstrapApp() {
    renderShell();
    applyLetterCount();
    applyPoolMode();
    refreshAnalysis();
}

function resetBoard() {
    spotleMode = false;

    clearBoardGrids();
    resetOddsFlow();
    wipeNode(document.getElementById('next-previous-buttons'));
    document.getElementById("word-entered").value = "";
    renderShell();
    refreshAnalysis();
}

function clearBoardGrids() {
    let grids = document.getElementsByClassName('grid');

    for (let i = 0; i < grids.length; i++) {
        wipeNode(grids[i]);
    }
    
    let full_grid = document.getElementById('hints');
    full_grid.classList.add('empty');

    renderShell();
    refreshAnalysis();
}

function getPreferences() {
    if (localStorage.getItem('bot_type')) {
        let bot_type = localStorage.getItem('bot_type');
        activateVariant(bot_type);
        document.getElementById('bot-type').value = bot_type;
    } else {
        activateVariant(VARIANT_WORDLE);
    }

    if (localStorage.getItem('wordbank')) {
        let bank = localStorage.getItem('wordbank');
        document.getElementById(bank).checked = true;
        document.getElementById(otherWordbank(bank)).checked = false;
        applyPoolMode()
    }

    // if (engine.matchesVariant(VARIANT_WARMLE) && localStorage.getItem('warmle_dist')) {
    //     let dist = localStorage.getItem('warmle_dist');
    //     document.getElementsByClassName('warmle-selector')[0].value = dist;
    // }
}

function otherWordbank(bank) {
    if (bank == 'restricted') return 'complete';
    return 'restricted';
}

function renderShell() {
    let container = document.getElementById('container');
    let header = document.getElementById('top-of-screen');
    let hints = document.getElementById('hints');

    addGrid(hints);
    
    createMainHeader(header);
    createWordLengthSelector();
    
    createGuessInput(container);
    createAnswerSuggestions(container);
    
    updateSettings();
}

function updateSettings() {
    let extra = document.getElementsByClassName('extra-settings')[0];
    
    if (engine.matchesVariant(VARIANT_WARMLE)) {
        let selector = el('select', '', 'warmle-selector');

        for (let i = 3; i >= 1; i--) {
            let option = el('option', i);
            option.value = i;
            selector.append(option);            
        }

        paintNode(extra, 
                "Yellows are " + selector.outerHTML + " letters away from the correct letter.");

        if (localStorage.getItem('warmle_dist')) {
            document.getElementsByClassName('warmle-selector')[0].value = localStorage.getItem('warmle_dist');
        }
    } else {
        wipeNode(extra);
    }
}

function addGrid(hints) {
    wipeNode(hints);

    for (let i = 0; i < engine.boardCount(); i++) {
        let grid = el('div', '', 'grid');
        hints.append(grid);
    }

    if (engine.matchesVariant(VARIANT_SPOTLE)) {
        setUpBlankGrid();
    }
}

function setUpBlankGrid() {
    let grid_size = 6;

    for (let i = 0; i < grid_size; i++) {
        appendGuessRow(" ".repeat(letterCount));
    }

    addFinalizeGridButton();
}

function addFinalizeGridButton() {
    wipeNode(document.getElementById('next-previous-buttons'));

    let finalize = el('button', 'finalize grid', 'finalize');
    let button_container = document.getElementById('next-previous-buttons');

    finalize.addEventListener('click', function () {
        refreshAnalysis();
    });

    button_container.append(finalize);
}

function createMainHeader(div) {
    let main_header = document.getElementById('top-of-screen');
    let title = main_header.getElementsByTagName('h1')[0];

    title.textContent = "Wordle Bot";
    const tag = main_header.querySelector(".logo-tag");
    if (tag) tag.textContent = "Word assistant";
    const badge = main_header.querySelector(".logo-badge");
    if (badge) badge.textContent = "WB";
}

function createWordLengthSelector() {
    let select_length = document.getElementById('word-length');

    let options = "";
    for (let i = MIN_LETTERS; i <= MAX_LETTERS; i++) {
        let selected = "";
        if (i == 5) selected = "selected = 'selected'";
        options += "<option value='" + i + "' " + selected +">" + i + "</option>";
    }

    if (engine.matchesVariant(VARIANT_THIRDLE)) {
        localStorage.setItem('letterCount' + engine.type, 3);
        options = "<option value ='3' selected = 'selected'>3</option>";
    }

    if (engine.matchesVariant(VARIANT_SPOTLE)) {
        localStorage.setItem('letterCount' + engine.type, 5);
        options = "<option value ='5' selected = 'selected'>5</option>";
    }

    select_length.innerHTML = options;
    
    const storedLength = parseInt(localStorage.getItem("letterCount" + engine.type), 10);
    if (
        !isNaN(storedLength) &&
        (storedLength >= MIN_LETTERS || engine.matchesVariant(VARIANT_THIRDLE))
    ) {
        select_length.value = String(storedLength);
    }
}

function createMaxGuesses(div) {
    let max_input = document.getElementById('max-guesses');

    let options = "";
    for (let i = 3; i <= 21; i++) {
        let selected = "";
        if (i == 6) selected = "selected = 'selected'";
        options += "<option value='" + i + "' " + selected +">" + i + "</option>";    
    }

    if (engine.matchesVariant(VARIANT_THIRDLE)) {
        localStorage.setItem('guesses' + engine.type, 3);
        options = "<option value ='3' selected = 'selected'>3</option>";
    }

    if (engine.matchesVariant(VARIANT_SPOTLE)) {
        localStorage.setItem('guesses' + engine.type, 6);
        options = "<option value ='6' selected = 'selected'>6</option>";
    }

    max_input.innerHTML = options;
    
    const storedGuesses = localStorage.getItem("guesses" + engine.type);
    if (storedGuesses && max_input.querySelector('option[value="' + storedGuesses + '"]')) {
        max_input.value = storedGuesses;
    }
}

const EXAMPLE_LIST = 
    [
        {word: 'BLOKE', score: '2.188 guesses left', wrong: '96.77% solve rate'}, 
        {word: 'YOLKS', score: '2.250 guesses left'}, 
        {word: 'KOELS', score: '2.250 guesses left'},
        {word: 'KYLOE', score: '2.250 guesses left'}
    ];

function createExample() {
    let example_row = createRow('TRAIN', 'dummy');
    engine.paintTurnPattern('GBYBB', example_row);

    let example_list = el('ul', '', 'word-list dummy');
    
    for (let i = 0; i < EXAMPLE_LIST.length; i++) {
        // example_list.innerHTML += buildSuggestionRow(EXAMPLE_LIST[i].word, EXAMPLE_LIST[i].score, i+1);
        example_list.append(buildSuggestionRow(EXAMPLE_LIST[i].word, EXAMPLE_LIST[i].score, i+1));
    }

    return {row: example_row, list: example_list};
}

function createWrongExample() {
    let example_wrong = el('ul', '', 'word-list dummy');
    // example_wrong.innerHTML = buildSuggestionRow(EXAMPLE_LIST[0].word, EXAMPLE_LIST[0].wrong, 1);
    example_wrong.append(buildSuggestionRow(EXAMPLE_LIST[0].word, EXAMPLE_LIST[0].wrong, 1));

    return example_wrong;
}

function bindOverlayControls() {
    const backdrop = document.getElementById("overlay-backdrop");
    if (!backdrop || backdrop.dataset.bound === "1") return;
    backdrop.dataset.bound = "1";

    backdrop.addEventListener("click", closeAllOverlays);

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeAllOverlays();
    });

    const settingsClose = document.querySelector(".settings-close");
    if (settingsClose) {
        settingsClose.addEventListener("click", function () {
            closeOverlay(document.getElementById("settings-modal"));
        });
    }

    document.addEventListener("click", function (e) {
        const helpClose = e.target.closest(".info-close");
        if (helpClose) {
            closeOverlay(document.getElementById("help-modal"));
        }
    });

    const benchmarkClose = document.querySelector(".benchmark-close");
    if (benchmarkClose) {
        benchmarkClose.addEventListener("click", function () {
            if (typeof closeBenchmarkModal === "function") closeBenchmarkModal();
        });
    }
}

function syncOverlayBackdrop() {
    const open = document.querySelector(".overlay-panel.screen.display");
    const backdrop = document.getElementById("overlay-backdrop");
    if (!backdrop) return;

    if (open) {
        backdrop.hidden = false;
        backdrop.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    } else {
        backdrop.hidden = true;
        backdrop.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
    }
}

function openOverlay(panel) {
    if (!panel) return;
    closeAllOverlays(panel.id);
    panel.classList.remove("hide", "back");
    panel.classList.add("display");
    panel.setAttribute("aria-hidden", "false");
    syncOverlayBackdrop();
}

function closeOverlay(panel) {
    if (!panel) return;
    panel.classList.remove("display");
    panel.classList.add("hide");
    panel.setAttribute("aria-hidden", "true");
    syncOverlayBackdrop();
}

function closeAllOverlays(exceptId) {
    document.querySelectorAll(".overlay-panel.screen.display").forEach(function (panel) {
        if (panel.id === exceptId) return;
        if (panel.id === "benchmark-modal" && typeof closeBenchmarkModal === "function") {
            closeBenchmarkModal();
            return;
        }
        closeOverlay(panel);
    });
    syncOverlayBackdrop();
}

function toggleHelpPage() {
    const info = document.getElementById("help-modal");
    if (!info) return;

    if (info.classList.contains("display")) {
        closeOverlay(info);
        return;
    }

    info.classList.remove("hide", "back");
    openOverlay(info);
}

function toggleSettingsPage() {
    const settings = document.getElementById("settings-modal");
    if (settings.classList.contains("display")) {
        closeOverlay(settings);
        return;
    }
    openOverlay(settings);
}

function makeCloseButton(type) {
    let close_button = el("button", "×", "modal-close " + type + "-close");
    close_button.setAttribute("aria-label", "Close");
    close_button.addEventListener("click", function () {
        const panel = type === "info"
            ? document.getElementById("help-modal")
            : document.getElementById("settings-modal");
        closeOverlay(panel);
    });
    return close_button;
}

function createInfoParagraphs() {
    let p1 = el('p', `Enter your last guess and match the tile colors to Wordle. Tap 
                                <strong>Best next guess</strong> for recommendations and remaining answer lists.`);

    let p2 = el('p', `This means the best guess from this point would be ` + EXAMPLE_LIST[0].word + `,
                                and that you have an average of ` + EXAMPLE_LIST[0].score + `. If you see:`);

    let p3 = el('p', `That means ` + EXAMPLE_LIST[0].word + ` will only solve 96.77% of the remaining possible answers within ` + engine.turnLimit() + ` guesses.
                                Generally speaking, you should only see this if you're playing on hard mode.`);

    let p4 = el('p', `Want to see how good your starting word is? Open 
                                <strong>Benchmark</strong> in the header to test an opener against hundreds of random answers.`);

    return [p1, p2, p3, p4]
}

function explainExample() {
    let explanation = el('div', '', 'description');

    if (engine.matchesVariant(VARIANT_WORDLE)) {
        explanation.textContent =
            "T is in the correct position, A is in the word but not in the correct position, and R, I, and N are not in the word.";
    } else if (engine.matchesVariant(VARIANT_WOODLE)) {
        explanation.textContent =
            "TRAIN has one letter in the correct position, and one letter in the word, but not in the correct position.";
    } else if (engine.matchesVariant(VARIANT_PEAKS)) {
        explanation.textContent =
            "The 1st letter is T, the 2nd comes before R in the alphabet, the 3rd after A, the 4th before I, and the 5th before N.";
    } else if (engine.matchesVariant(VARIANT_WARMLE)) {
        explanation.textContent =
            "Green means the letter matches exactly. Yellow means the answer letter is within the distance set in Settings.";
    } else {
        explanation.textContent =
            "Match each tile color to the feedback you received in your game, then tap Best next guess.";
    }

    return explanation;
}

function createInfoPage() {
    let info = document.getElementById("help-modal");
    if (!info) return;

    wipeNode(info);

    let header = el("header", "", "overlay-header");
    let title = el("h2", "How Wordle Bot works", "top-header");
    title.id = "help-title";
    let close_button = makeCloseButton("info");
    header.append(title);
    header.append(close_button);

    let body = el("div", "", "overlay-body");
    let example = createExample();
    let explanation = explainExample();
    let example_wrong = createWrongExample();
    let paragraphs = createInfoParagraphs();
    let sub_header = el("h3", "After each guess you should see something like this:", "mini");

    body.append(paragraphs[0]);
    body.append(sub_header);
    body.append(example.row);
    body.append(explanation);
    body.append(example.list);
    body.append(paragraphs[1]);
    body.append(example_wrong);
    body.append(paragraphs[2]);
    body.append(paragraphs[3]);

    info.append(header);
    info.append(body);
    openOverlay(info);
}

function createSettingsPage() {
    openOverlay(document.getElementById("settings-modal"));
}

window.toggleHelpPage = toggleHelpPage;
window.toggleSettingsPage = toggleSettingsPage;

function createGuessInput(div) {
    let input = document.getElementById('word-entered');
    setInputAttributes(input);
}

function setInputAttributes(input) {
    input.setAttribute("autocomplete", "off");
    input.setAttribute("placeholder", "Type your " + letterCount + "-letter guess");
    input.setAttribute("onkeypress", "return /[a-z]/i.test(event.key)");
    input.setAttribute("oninput", "this.value = this.value.toUpperCase()");
}

function createAnswerSuggestions() {
    let suggestions = document.getElementById('suggestions');

    removeHardModeSwitch(suggestions);

    if (engine.hasTurnCap()) {
        createMaxGuesses(suggestions);
    } else {
        let max = document.getElementById('max-guesses');
        localStorage.setItem('guesses' + engine.type, 'infinity');
        max.innerHTML = "<option value ='infinity' selected = 'selected'> &#8734 </option>";    
    }

    createAnswerLists(suggestions);
}

function createAnswerLists(div) {
    document.getElementById("answers")?.remove();
}

function createHardModeSwitch(div) {
    let switch_label = el('div', "Show me the best guesses for 'Hard Mode':", 'hard label');
    let switch_container = el('label', '', 'hard switch');
    let switch_slider = el('span', '', 'slider round');
    let switch_checkbox = el('input', '', '', 'mode');
    switch_checkbox.setAttribute('type', 'checkbox');

    switch_container.append(switch_checkbox);
    switch_container.append(switch_slider);
    
    const anchor = document.getElementById("starter-guesses") || div.firstChild;
    div.insertBefore(switch_label, anchor);
    div.insertBefore(switch_container, anchor);

    switch_checkbox.addEventListener('change', function() {
        refreshAnalysis();
    });
}

function removeHardModeSwitch() {
    let label = document.getElementsByClassName('hard label')[0];
    let container = document.getElementsByClassName('hard switch')[0];

    if (label) label.remove();
    if (container) container.remove();
}
