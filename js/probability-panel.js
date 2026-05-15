function flattenAnswerList(list) {
    if (!list || !list.length) return [];
    if (typeof list[0] === "string") return [...list];
    const out = [];
    for (let i = 0; i < list.length; i++) {
        out.push(...flattenAnswerList(list[i]));
    }
    return [...new Set(out)];
}

function getRemainingAnswers() {
    const lists = assemblePools();
    const likely = flattenAnswerList(lists.answers);
    const unlikely = flattenAnswerList(lists.unlikely);
    return { likely, unlikely, all: [...new Set([...likely, ...unlikely])] };
}

function patternLabel(pattern) {
    return pattern
        .split("")
        .map((c) => {
            if (c === MARK_EXACT) return "🟩";
            if (c === MARK_SHIFT) return "🟨";
            return "⬛";
        })
        .join("");
}

function getPatternProbabilities(guess, answers) {
    if (!guess || guess.length !== letterCount || !answers.length) return [];

    const buckets = {};
    for (let i = 0; i < answers.length; i++) {
        const pattern = engine.computeFeedback(guess, answers[i]);
        if (!buckets[pattern]) buckets[pattern] = 0;
        buckets[pattern]++;
    }

    const total = answers.length;
    return Object.keys(buckets)
        .map((pattern) => ({
            pattern,
            label: patternLabel(pattern),
            count: buckets[pattern],
            probability: ((buckets[pattern] / total) * 100).toFixed(2),
        }))
        .sort((a, b) => b.count - a.count);
}

function renderOddsPanel() {
    const { likely, unlikely, all } = getRemainingAnswers();
    const panel = document.getElementById("odds-mount");
    wipeNode(panel);

    if (!all.length) {
        panel.append(
            el(
                "p",
                "No remaining answers match your clues. Check your tile colors and try again.",
                "prob-empty"
            )
        );
        panel.hidden = false;
        return;
    }

    const pct = (100 / all.length).toFixed(2);
    const summary = el(
        "p",
        all.length +
            " possible " +
            pluralize(all.length, "answer", "answers") +
            " remain. Each has a " +
            pct +
            "% chance of being the solution (uniform over the filtered list).",
        "prob-summary"
    );
    panel.append(summary);

    if (likely.length && unlikely.length) {
        panel.append(
            el(
                "p",
                likely.length +
                    " on the official-style list, " +
                    unlikely.length +
                    " additional possibilities.",
                "prob-meta"
            )
        );
    }

    let guessForPatterns = document.getElementById("word-entered").value.toUpperCase();
    if (playedTurnCount() > 0) {
        guessForPatterns = readTurnWord(playedTurnCount() - 1);
    }
    const topSuggestion = document.querySelector("#answers .word-list .click");
    const topGuess = topSuggestion ? topSuggestion.textContent.trim() : guessForPatterns;

    if (topGuess && topGuess.length === letterCount) {
        const patterns = getPatternProbabilities(topGuess, all);
        if (patterns.length) {
            const header = el(
                "h3",
                "Feedback odds if your next guess is " + topGuess,
                "prob-subheader"
            );
            panel.append(header);

            const patternList = el("ul", "", "prob-pattern-list");
            for (let i = 0; i < Math.min(patterns.length, 12); i++) {
                const p = patterns[i];
                const item = el(
                    "li",
                    '<span class="prob-pattern">' +
                        p.label +
                        '</span> <span class="prob-pct">' +
                        p.probability +
                        '%</span> <span class="prob-count">(' +
                        p.count +
                        ' word' +
                        pluralize(p.count, '', 's') +
                        ')</span>',
                    "prob-pattern-item"
                );
                patternList.append(item);
            }
            panel.append(patternList);

            if (patterns.length > 12) {
                panel.append(
                    el(
                        "p",
                        "+" + (patterns.length - 12) + " more patterns not shown.",
                        "prob-meta"
                    )
                );
            }
        }
    }

    const wordsHeader = el("h3", "Answer probabilities", "prob-subheader");
    panel.append(wordsHeader);

    const maxShow = 80;
    const wordList = el("ul", "", "prob-word-list");
    const sorted = all.slice().sort();

    for (let i = 0; i < Math.min(sorted.length, maxShow); i++) {
        const word = sorted[i];
        const item = el(
            "li",
            '<span class="prob-word">' +
                word +
                '</span><span class="prob-pct">' +
                pct +
                "%</span>",
            "prob-word-item"
        );
        wordList.append(item);
    }
    panel.append(wordList);

    if (sorted.length > maxShow) {
        panel.append(
            el(
                "p",
                "Showing " + maxShow + " of " + sorted.length + " words.",
                "prob-meta"
            )
        );
    }

    panel.hidden = false;
}

function clearOddsPanel() {
    const panel = document.getElementById("odds-mount");
    if (panel) {
        panel.hidden = true;
        wipeNode(panel);
    }
}

function resetOddsFlow() {
    clearOddsPanel();
}
