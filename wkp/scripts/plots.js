// Elementy DOM
const resultsInput = document.getElementById('results-input');
const analyzeBtn = document.getElementById('analyze-btn');
const resultsContainer = document.getElementById('results-container');
const totalQuestionsSpan = document.getElementById('total-questions');
const correctAnswersSpan = document.getElementById('correct-answers');
const correctPercentageSpan = document.getElementById('correct-percentage');
const totalTimeSpan = document.getElementById('total-time');
const avgTimeSpan = document.getElementById('avg-time');
const groupStatsContainer = document.getElementById('group-stats-container');

// Zmienne
let questionsData = [];
let groupsData = {};
let timeChart, accuracyChart, timeGroupChart;

// Funkcje
function parseResults(questions) {

    // "id": "${id}",
    // "type": "${type}",
    // "your-odp": ${JSON.stringify(yourOdp)},
    // "correct-odp": ${JSON.stringify(correctOdp)},
    // "time": ${time}

    questionsData = [];

    for (const q of questions) {
        questionsData.push({
            answer: q['your-odp'],
            time: q['time'],
            group: q['group'] || 'Inne',
            correctAnswer: q['correct-odp'],
            correct: q['your-odp'] === q['correct-odp']
        });
    }
    
    // Oblicz statystyki grup
    calculateGroupStats();
    
    return {
        totalQuestions: questionsData.length,
        correctAnswers: questionsData.filter(q => q.correct).length,
        totalTime: questionsData.reduce((sum, q) => sum + q.time, 0)
    };
}

function calculateGroupStats() {
    groupsData = {};
    
    questionsData.forEach(q => {
        if (!groupsData[q.group]) {
            groupsData[q.group] = {
                count: 0,
                correct: 0,
                totalTime: 0
            };
        }
        
        groupsData[q.group].count++;
        groupsData[q.group].totalTime += q.time;
        if (q.correct) {
            groupsData[q.group].correct++;
        }
    });
    
    // Oblicz średnie i procenty
    for (const group in groupsData) {
        groupsData[group].avgTime = groupsData[group].totalTime / groupsData[group].count;
        groupsData[group].accuracy = (groupsData[group].correct / groupsData[group].count) * 100;
    }
}

function displayResults(stats) {
    // Podsumowanie
    totalQuestionsSpan.textContent = stats.totalQuestions;
    correctAnswersSpan.textContent = stats.correctAnswers;
    correctPercentageSpan.textContent = (stats.correctAnswers / stats.totalQuestions * 100).toFixed(1);
    totalTimeSpan.textContent = stats.totalTime;
    avgTimeSpan.textContent = (stats.totalTime / stats.totalQuestions).toFixed(1);
    
    // Statystyki grup
    groupStatsContainer.innerHTML = '';
    for (const group in groupsData) {
        const groupStat = groupsData[group];
        const statDiv = document.createElement('div');
        statDiv.className = 'group-stat';
        statDiv.innerHTML = `
            <h3>${group}</h3>
            <p>Liczba pytań: ${groupStat.count}</p>
            <p>Poprawne odpowiedzi: ${groupStat.correct} (${groupStat.accuracy.toFixed(1)}%)</p>
            <p>Średni czas: ${groupStat.avgTime.toFixed(1)} s</p>
        `;
        groupStatsContainer.appendChild(statDiv);
    }
    
    // Wykresy
    createCharts();
    
    // Pokaż wyniki
    resultsContainer.style.display = 'block';
}

function createCharts() {
    const timeCtx = document.getElementById('time-chart').getContext('2d');
    const accuracyCtx = document.getElementById('group-accuracy-chart').getContext('2d');
    const timeGroupCtx = document.getElementById('group-time-chart').getContext('2d');
    
    // Zniszcz poprzednie wykresy jeśli istnieją
    if (timeChart) timeChart.destroy();
    if (accuracyChart) accuracyChart.destroy();
    if (timeGroupChart) timeGroupChart.destroy();
    
    // Wykres czasów odpowiedzi
    timeChart = new Chart(timeCtx, {
        type: 'bar',
        data: {
            labels: questionsData.map((_, i) => `Pytanie ${i + 1}`),
            datasets: [{
                label: 'Czas odpowiedzi (s)',
                data: questionsData.map(q => q.time),
                backgroundColor: questionsData.map(q => q.correct ? 'rgba(75, 192, 192, 0.7)' : 'rgba(255, 99, 132, 0.7)'),
                borderColor: questionsData.map(q => q.correct ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)'),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Czas (s)'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const index = context.dataIndex;
                            const question = questionsData[index];
                            return `Twoja odpowiedź: ${question.answer}\nPoprawna odpowiedź: ${question.correctAnswer}\nPoprawna: ${question.correct ? 'Tak' : 'Nie'}\nGrupa: ${question.group}`;
                        }
                    }
                }
            }
        }
    });
    
    // Wykres dokładności grup
    const groupLabels = Object.keys(groupsData);
    accuracyChart = new Chart(accuracyCtx, {
        type: 'bar',
        data: {
            labels: groupLabels,
            datasets: [{
                label: 'Procent poprawnych odpowiedzi',
                data: groupLabels.map(group => groupsData[group].accuracy),
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Procent poprawnych odpowiedzi (%)'
                    }
                }
            }
        }
    });
    
    // Wykres średnich czasów grup
    timeGroupChart = new Chart(timeGroupCtx, {
        type: 'bar',
        data: {
            labels: groupLabels,
            datasets: [{
                label: 'Średni czas odpowiedzi (s)',
                data: groupLabels.map(group => groupsData[group].avgTime),
                backgroundColor: 'rgba(255, 159, 64, 0.7)',
                borderColor: 'rgba(255, 159, 64, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Średni czas (s)'
                    }
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    stats = parseResults(questions);
    displayResults(stats);
});