// Configuration of available sets in the 'sets' folder
const availableSets = [
    { file: 'hardest', name: '🔥 The hardest' },
    // am, gal, pmat, md
    { file: 'am.csv', name: 'AM' },
    { file: 'gal.csv', name: 'GAL' },
    { file: 'pmat.csv', name: 'PMAT' },
    { file: 'md.csv', name: 'MD' },
    { file: 'rp.csv', name: 'RP' },
    { file: 'asd.csv', name: 'ASD' },
    { file: 'jaio.csv', name: 'JAIO' },
    { file: 'bd.csv', name: 'BD' },
    { file: 'pw.csv', name: 'PW' },
    { file: 'po.csv', name: 'PO' },
    { file: 'akso.csv', name: 'AKSO' },
    { file: 'awww.csv', name: 'AWWW' },
    { file: 'sik.csv', name: 'SIK' },
    { file: 'wum.csv', name: 'WUM' },
    { file: 'nlp 1-8.csv', name: 'NLP 1-8' },
    { file: 'oc.csv', name: 'OC' }
];

let allCards = []; // All flashcards from the loaded set
let currentQueue = []; // Indices of flashcards the user hasn't learned yet
let currentCardIndex = -1; // Currently displayed flashcard (index in allCards)
let currentSetName = '';
let previousQueue = null;
const btnUndo = document.getElementById('btn-undo');

// DOM elements
const setSelector = document.getElementById('set-selector');
const flashcardContainer = document.getElementById('flashcard-container');
const flashcard = document.getElementById('flashcard');
const cardFront = document.getElementById('card-front');
const cardBack = document.getElementById('card-back');
const controls = document.getElementById('controls');
const messageEl = document.getElementById('message');
const cardsLeftEl = document.getElementById('cards-left');

// Funkcja zamieniająca znaki HTML na bezpieczny tekst
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, function (tag) {
        const charsToReplace = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        };
        return charsToReplace[tag] || tag;
    });
}

// Initialize dropdown list
availableSets.forEach(set => {
    const option = document.createElement('option');
    option.value = set.file;
    option.textContent = set.name;
    setSelector.appendChild(option);
});

async function updateSetOptions() {
    for (const option of setSelector.options) {
        if (!option.value) continue;

        const setFile = option.value;
        const setDef = availableSets.find(s => s.file === setFile);
        if (!setDef) continue;

        let remaining = 0;

        const progress = localStorage.getItem(`flashcards_progress_${setFile}`);
        if (progress) {
            remaining = JSON.parse(progress).length;
        } else {
            if (setFile === 'hardest') {
                const savedCards = localStorage.getItem('flashcards_hardest_cards');
                if (savedCards) {
                    remaining = JSON.parse(savedCards).length;
                } else {
                    let allHardestCount = 0;
                    for (const s of availableSets) {
                        if (s.file === 'hardest') continue;
                        const mistakes = JSON.parse(localStorage.getItem(`flashcards_mistakes_${s.file}`) || '{}');
                        allHardestCount += Object.values(mistakes).filter(v => v >= 1).length;
                    }
                    remaining = Math.min(allHardestCount, 100);
                }
            } else {
                try {
                    const response = await fetch(`sets/${setFile}`);
                    if (response.ok) {
                        const text = await response.text();
                        const lines = text.split('\n').filter(line => line.trim() !== '');
                        let validCount = 0;
                        lines.forEach(line => {
                            const [front, ...backArr] = line.split(';');
                            const back = backArr.join(';');
                            if (front && back) validCount++;
                        });
                        remaining = validCount;
                    }
                } catch (e) {
                    console.error("Error fetching set info", e);
                }
            }
        }

        option.textContent = `${setDef.name} (${remaining})`;
    }
}

updateSetOptions();

// Listen for set selection
setSelector.addEventListener('change', (e) => {
    loadSet(e.target.value);
});

function updateMistake(setId, index, change) {
    if (setId === 'hardest') return;
    const key = `flashcards_mistakes_${setId}`;
    const mistakes = JSON.parse(localStorage.getItem(key) || '{}');
    mistakes[index] = Math.max(0, (mistakes[index] || 0) + change);
    localStorage.setItem(key, JSON.stringify(mistakes));
}

async function loadSet(filename) {
    currentSetName = filename;
    try {
        if (filename === 'hardest') {
            await loadHardestSet();
            return;
        }

        const response = await fetch(`sets/${filename}`);
        if (!response.ok) throw new Error("Unable to load file. Make sure you're using a local server.");
        const text = await response.text();

        parseCSV(text);
        loadProgress();
        showCards();
    } catch (error) {
        messageEl.textContent = "Error: " + error.message;
        flashcardContainer.style.display = 'none';
        controls.style.display = 'none';
    }
}

function showCards() {
    flashcardContainer.style.display = 'block';
    controls.style.display = 'flex';
    messageEl.textContent = '';
    nextCard();
}

async function loadHardestSet() {
    const savedCards = localStorage.getItem('flashcards_hardest_cards');
    if (savedCards) {
        allCards = JSON.parse(savedCards);
        loadProgress();
        showCards();
        return;
    }

    const fetchPromises = availableSets
        .filter(set => set.file !== 'hardest')
        .map(async (set) => {
            try {
                const response = await fetch(`sets/${set.file}`);
                if (!response.ok) return null;
                const text = await response.text();
                return { file: set.file, name: set.name, text };
            } catch (e) {
                return null;
            }
        });

    const results = await Promise.all(fetchPromises);
    let allHardest = [];

    results.forEach(result => {
        if (!result) return;
        const lines = result.text.split('\n').filter(line => line.trim() !== '');
        const mistakes = JSON.parse(localStorage.getItem(`flashcards_mistakes_${result.file}`) || '{}');

        lines.forEach((line, index) => {
            const [front, ...backArr] = line.split(';');
            const back = backArr.join(';');
            const errCount = mistakes[index] || 0;
            if (front && back && errCount >= 1) {
                allHardest.push({
                    front: escapeHTML(front.trim()) + ` <br><span style="font-size: 0.7em; color: #888;">(${result.name})</span>`,
                    back: escapeHTML(back.trim()),
                    mistakes: errCount,
                    originalIndex: index,
                    originalSet: result.file
                });
            }
        });
    });

    allHardest.sort((a, b) => b.mistakes - a.mistakes);
    allHardest = allHardest.slice(0, 100);

    allCards = allHardest.map(c => ({
        front: c.front,
        back: c.back,
        originalSet: c.originalSet,
        originalIndex: c.originalIndex
    }));

    if (allCards.length === 0) {
        messageEl.textContent = "You don't have any hard flashcards yet. Keep studying other sets!";
        flashcardContainer.style.display = 'none';
        controls.style.display = 'none';
        return;
    }

    localStorage.setItem('flashcards_hardest_cards', JSON.stringify(allCards));
    loadProgress();
    showCards();
}

function parseCSV(text) {
    allCards = [];
    const lines = text.split('\n').filter(line => line.trim() !== '');

    lines.forEach((line, index) => {
        const [front, ...backArr] = line.split(';');
        const back = backArr.join(';');

        if (front && back) {
            // Przepuszczamy front i back przez escapeHTML
            allCards.push({
                front: escapeHTML(front.trim()),
                back: escapeHTML(back.trim()),
                originalIndex: index
            });
        }
    });
}

function loadProgress() {
    const saved = localStorage.getItem(`flashcards_progress_${currentSetName}`);
    if (saved) {
        currentQueue = JSON.parse(saved);
    } else {
        // Jeśli nie ma zapisanego postępu, dołącz wszystkie indeksy
        currentQueue = allCards.map((_, index) => index);
    }
    updateStats();
}

function saveProgress() {
    localStorage.setItem(`flashcards_progress_${currentSetName}`, JSON.stringify(currentQueue));
}

function nextCard() {
    // Temporarily disable transition to prevent flip animation when moving to the next card
    flashcard.style.transition = 'none';
    flashcard.classList.remove('flipped');

    // Restore the transition asynchronously so the browser has time to apply the 'none' state
    setTimeout(() => {
        flashcard.style.transition = 'transform 0.5s cubic-bezier(0.4, 0.2, 0.2, 1)';
    }, 50);

    if (currentQueue.length === 0) {
        flashcardContainer.style.display = 'none';
        messageEl.textContent = "Congratulations! You have mastered the set.";
        return;
    }

    // Wyciągnij pierwszy element z kolejki nienauczonych
    currentCardIndex = currentQueue[0];

    cardFront.innerHTML = `<div class="card-content">${allCards[currentCardIndex].front}</div>`;
    cardBack.innerHTML = `<div class="card-content">${allCards[currentCardIndex].back}</div>`;

    // Wymuszenie przetworzenia składni LaTeX przez MathJax
    if (window.MathJax) {
        MathJax.typesetPromise([cardFront, cardBack]);
    }
}

// Funkcja zapisująca stan przed zmianą
function saveHistory() {
    previousQueue = [...currentQueue];
    btnUndo.style.display = 'block'; // Pokaż przycisk po pierwszej akcji
}

function undo() {
    if (previousQueue) {
        currentQueue = [...previousQueue];
        previousQueue = null;
        btnUndo.style.display = 'none'; // Ukryj po cofnięciu

        // Jeśli zestaw był ukończony, musimy przywrócić widoczność kontenera
        flashcardContainer.style.display = 'block';
        controls.style.display = 'flex';
        messageEl.textContent = '';

        saveProgress();
        updateStats();
        nextCard();
    }
}

function updateStats() {
    cardsLeftEl.textContent = currentQueue.length;
    const option = Array.from(setSelector.options).find(opt => opt.value === currentSetName);
    if (option) {
        const setDef = availableSets.find(s => s.file === currentSetName);
        if (setDef) {
            option.textContent = `${setDef.name} (${currentQueue.length})`;
        }
    }
}

function shuffleQueue() {
    // Algorytm Fisher-Yates
    for (let i = currentQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [currentQueue[i], currentQueue[j]] = [currentQueue[j], currentQueue[i]];
    }
    saveProgress();
    nextCard();
}

// Kliknięcie w samą fiszkę też ją obraca
flashcard.addEventListener('click', () => {
    flashcard.classList.toggle('flipped');
});

// Zaktualizowane listenery przycisków
document.getElementById('btn-know').addEventListener('click', () => {
    if (currentQueue.length > 0) {
        saveHistory(); // Zapisz zanim usuniesz

        const cardData = allCards[currentCardIndex];
        const actualSet = cardData.originalSet || currentSetName;
        const actualIndex = cardData.originalIndex !== undefined ? cardData.originalIndex : currentCardIndex;

        if (currentSetName === 'hardest') {
            updateMistake(actualSet, actualIndex, -1);
        }

        currentQueue.shift();
        saveProgress();
        updateStats();
        nextCard();
    }
});

document.getElementById('btn-dont-know').addEventListener('click', () => {
    if (currentQueue.length > 0) {
        saveHistory(); // Zapisz zanim przesuniesz

        const cardData = allCards[currentCardIndex];
        const actualSet = cardData.originalSet || currentSetName;
        const actualIndex = cardData.originalIndex !== undefined ? cardData.originalIndex : currentCardIndex;
        updateMistake(actualSet, actualIndex, 1);

        const card = currentQueue.shift();
        currentQueue.push(card);
        saveProgress();
        nextCard();
    }
});

btnUndo.addEventListener('click', undo);

// Przy zmianie zestawu ukryj przycisk undo
setSelector.addEventListener('change', (e) => {
    previousQueue = null;
    btnUndo.style.display = 'none';
    loadSet(e.target.value);
});

document.getElementById('btn-shuffle').addEventListener('click', () => {
    shuffleQueue();
});

document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm("Are you sure you want to reset progress for this set?")) {
        localStorage.removeItem(`flashcards_progress_${currentSetName}`);
        if (currentSetName === 'hardest') {
            localStorage.removeItem('flashcards_hardest_cards');
            loadHardestSet();
        } else {
            loadProgress();
            nextCard();
        }
    }
});