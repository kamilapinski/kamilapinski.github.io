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
