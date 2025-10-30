document.addEventListener('DOMContentLoaded', () => {
    const main = document.querySelector('main');
    const questionsList = document.querySelector('.questions-list');

    questions.forEach((question, index) => {
        const button = document.createElement('button');
        button.textContent = (index + 1).toString();
        button.value = index + 1;
        questionsList.appendChild(button);

        const questionContainer = document.createElement('div');
        questionContainer.classList.add('question-container');

        let correctAnswer = '';
        let yourAnswer = '';

        correctAnswer = question['correct-odp'];
        yourAnswer = question['your-odp'];

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
        console.log(textContent);
        main.appendChild(questionContainer);
    });


    const buttons = document.querySelectorAll('.questions-list > button');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            buttons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            try {
            let questionNumber = parseInt(button.value) - 1;
            const questionContainers = document.querySelectorAll('.question-container');
            questionContainers.forEach((container, index) => {
                container.style.display = index === questionNumber ? 'block' : 'none';
            });
            } catch (error) {
                console.error('Error displaying question:', error);
            }
        });
    });
});