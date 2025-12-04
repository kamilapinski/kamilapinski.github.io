const CORRECT_PASSWORD = "ORLYBOBOLI";
const PASSWORD_LENGTH = CORRECT_PASSWORD.length;

function checkPassword() {
    // ... (pozostały kod funkcji checkPassword pozostaje bez zmian)
    const userInput = document.getElementById('passwordInput').value.toUpperCase();
    const resultDiv = document.getElementById('result');

    if (userInput.length !== PASSWORD_LENGTH) {
        resultDiv.textContent = `Wpisz dokładnie ${PASSWORD_LENGTH} znaków!`;
        resultDiv.style.backgroundColor = '#f8d7da';
        return;
    }

    let correctCount = 0;
    for (let i = 0; i < PASSWORD_LENGTH; i++) {
        if (userInput[i] === CORRECT_PASSWORD[i]) {
            correctCount++;
        }
    }

    resultDiv.textContent = `Poprawnych znaków: ${correctCount} / ${PASSWORD_LENGTH}`;

    if (correctCount === PASSWORD_LENGTH) {
        resultDiv.style.backgroundColor = '#d4edda';
        resultDiv.textContent += " - BRAWO! Hasło poprawne!";
    } else {
        resultDiv.style.backgroundColor = '#fff3cd';
    }
    resultDiv.classList.remove('invisible');
}

// NOWA FUNKCJA DO CZYSZCZENIA
function clearInput() {
    // Czyści pole wprowadzania hasła
    document.getElementById('passwordInput').value = '';
    
    // Czyści i resetuje styl elementu wyniku
    const resultDiv = document.getElementById('result');
    resultDiv.textContent = '';
    resultDiv.style.backgroundColor = '#fff'; // Ustawia białe tło (lub inne domyślne)
    resultDiv.classList.add('invisible');
}