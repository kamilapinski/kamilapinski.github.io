function resultsAsHtml(questions, userAnswers, times) {

    let questionsText = '';

    for (let i = 0; i < questions.length; i++) {
        id = questions[i].id;
        type = questions[i].type;
        yourOdp = userAnswers[i];
        correctOdp = questions[i].correctAnswer;
        time = times[i];

        questionsText += `
        {
            "id": "${id}",
            "type": "${type}",
            "your-odp": ${JSON.stringify(yourOdp)},
            "correct-odp": ${JSON.stringify(correctOdp)},
            "time": ${time}
        },
        `;
    }

    let content = `
        <!DOCTYPE html>
        <html lang="pl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Wyniki testu</title>
                
                <link href="https://kamilapinski.github.io/wkp/style.css" rel="stylesheet">

                <style>
                    .questions-list > button {
                        margin: 0;
                    }

                    .questions-list > button.active {
                        background-color: #ccc;
                        color: green;
                    }

                    .question-container {
                        display: none;
                    }
                </style>
                <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            </head>

            <body>
                <header>
                    <h1>Wyniki testu</h1>
                </header>
                <main>
                    <h2>Pytania:</h2>
                    <div class="questions-list"></div>
                    <div class="question-container"></div>
                    <div id="results-container" style="display: none;">
                        <div class="summary">
                            <h3>Podsumowanie</h3>
                            <p>Liczba pytań: <span id="total-questions">0</span></p>
                            <p>Poprawne odpowiedzi: <span id="correct-answers">0</span> (<span id="correct-percentage">0</span>%)</p>
                            <p>Całkowity czas: <span id="total-time">0</span> sekund</p>
                            <p>Średni czas na pytanie: <span id="avg-time">0</span> sekund</p>
                        </div>
                        
                        <h2>Wykres czasów odpowiedzi</h2>
                        <div class="chart-container">
                            <canvas id="time-chart"></canvas>
                        </div>
                        
                        <h2>Statystyki grup zadań</h2>
                        <div class="group-stats" id="group-stats-container"></div>
                        
                        <div class="chart-container">
                            <canvas id="group-accuracy-chart"></canvas>
                        </div>
                        
                        <div class="chart-container">
                            <canvas id="group-time-chart"></canvas>
                        </div>
                    </div>
                </main>

                <script>
                    const questions = [
                        ${questionsText}
                    ];
                </script>
                <script src="https://kamilapinski.github.io/wkp/scripts/results.js"></script>
            </body>
        </html>
    `;

    return content;
}
