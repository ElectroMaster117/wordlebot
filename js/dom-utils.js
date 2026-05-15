function spliceChar(old_string, char, index) {
    return old_string.slice(0, index) + char + old_string.slice(index + 1);
}

function allInstancesOf(c, string) {
    const indices = [];
    for (let i = 0; i < string.length; i++) {
        if (string.charAt(i) === c) indices.push(i);
    }
    return indices;
}

function wipeNode(element) {
    element.innerHTML = "";
}

function paintNode(element, html) {
    element.innerHTML = html;
}

function resetField(element) {
    element.value = "";
}

function mkEl(tag, html, className, id) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (id) node.id = id;
    if (html != null && html !== "") node.innerHTML = html;
    return node;
}

const el = mkEl;

function count(string, char) {
    let n = 0;
    for (let i = 0; i < string.length; i++) {
        if (string[i] === char) n++;
    }
    return n;
}

function mergeUnique(a, b) {
    return [...new Set(a.concat(b))];
}

function pluralize(quantity, singular, plural) {
    return quantity === 1 ? singular : plural;
}

function intToChar(int) {
    return String.fromCharCode(int);
}

function charToInt(char) {
    return char.charCodeAt(0);
}

function isEmpty(list) {
    return !list || list.length === 0;
}

function toPercent(num) {
    return (num * 100).toFixed(2) + "%";
}

function randomElementOf(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function swapDivs(nodeA, nodeB) {
    const parent = nodeA.parentNode;
    if (!parent || nodeA === nodeB) return;
    const afterB = nodeB.nextSibling;
    parent.insertBefore(nodeA, nodeB);
    parent.insertBefore(nodeB, afterB);
}
