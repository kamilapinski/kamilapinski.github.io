const questionContainers = document.querySelectorAll('.question-container');

function showQuestion(questionNumber) {
    questionContainers.forEach((container, index) => {
        container.style.display = index === questionNumber ? 'block' : 'none';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const main = document.querySelector('main');
    const questionsList = document.querySelector('.questions-list');

    questions.forEach((question, index) => {
        const button = document.createElement('button');
        button.textContent = (index + 1).toString();
        questionsList.appendChild(button);

        const questionContainer = document.getElementsByClassName('question-container')[0];

        let correctAnswer = '';
        let yourAnswer = '';

        if (question['type'] === 'choose') {
            for (const [key, value] of Object.entries(question['your-odp'])) {
                if (value) {
                    yourAnswer = key;
                    break;
                }
            }
            for (const [key, value] of Object.entries(question['correct-odp'])) {
                if (value) {
                    correctAnswer = key;
                    break;
                }
            }
        }
        else if (question['type'] === 'input') {
            for (const [key, value] of Object.entries(question['your-odp'])) {
                yourAnswer = key + ": " + value + ", ";
            }
            for (const [key, value] of Object.entries(question['correct-odp'])) {
                correctAnswer = key + ": " + value + ", ";
            }
        }
        else {
            console.log('Unknown question type: ', question['type']);
        }

        let textContent = `
            <h3>${index + 1}. pytanie</h3>
            <div>
                <img src="https://kamilapinski.github.io/wkp/media/konkursowe/${question.id}.png" alt="Ilustracja do pytania" class="question-image">
            </div>
            <div class="options" id="answers-area">
                <span style="color: green;">Poprawna odpowiedź: ${correctAnswer}</span>
                <span style="color: red;">Twoja odpowiedź: ${yourAnswer}</span>
                <span>Twój czas: ${question.time} sekund</span>
            </div>
        `;

        questionContainer.innerHTML = textContent;
    });


    const buttons = document.querySelectorAll('.questions-list > button');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            showQuestion(parseInt(button.textContent) - 1);
        });
    });
});