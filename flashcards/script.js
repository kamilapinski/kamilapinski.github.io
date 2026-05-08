// Configuration of available sets in the 'sets' folder
const availableSets = [
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
    { file: 'sik.csv', name: 'SIK' }
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
    return str.replace(/[&<>'"]/g, function(tag) {
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

// Listen for set selection
setSelector.addEventListener('change', (e) => {
    loadSet(e.target.value);
});

async function loadSet(filename) {
    currentSetName = filename;
    try {
        const response = await fetch(`sets/${filename}`);
        if (!response.ok) throw new Error("Unable to load file. Make sure you're using a local server.");
        const text = await response.text();
        
        parseCSV(text);
        loadProgress();
        
        flashcardContainer.style.display = 'block';
        controls.style.display = 'flex';
        messageEl.textContent = '';
        
        nextCard();
    } catch (error) {
        messageEl.textContent = "Error: " + error.message;
        flashcardContainer.style.display = 'none';
        controls.style.display = 'none';
    }
}

function parseCSV(text) {
    allCards = [];
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    lines.forEach(line => {
        const [front, ...backArr] = line.split(';');
        const back = backArr.join(';'); 
        
        if (front && back) {
            // Przepuszczamy front i back przez escapeHTML
            allCards.push({ 
                front: escapeHTML(front.trim()), 
                back: escapeHTML(back.trim()) 
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
    flashcard.classList.remove('flipped');
    
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
        currentQueue.shift(); 
        saveProgress();
        updateStats();
        nextCard();
    }
});

document.getElementById('btn-dont-know').addEventListener('click', () => {
    if (currentQueue.length > 0) {
        saveHistory(); // Zapisz zanim przesuniesz
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
    if(confirm("Are you sure you want to reset progress for this set?")) {
        localStorage.removeItem(`flashcards_progress_${currentSetName}`);
        loadProgress();
        nextCard();
    }
});