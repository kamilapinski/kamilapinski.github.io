// Operatory i ich funkcje
const operators = [
    { symbol: '+', func: (a, b) => a + b, priority: 1 },
    { symbol: '-', func: (a, b) => a - b, priority: 1 },
    { symbol: '×', func: (a, b) => a * b, priority: 2 },
    { symbol: '^', func: (a, b) => Math.pow(a, b), priority: 3 }
];

// Funkcja obliczająca wartość wyrażenia z uwzględnieniem kolejności działań
function calculateExpression(expression) {
    const tokens = expression.split(' ');
    const output = [];
    const operatorsStack = [];
    
    // Funkcja pomocnicza do stosowania operatorów
    function applyOperator(operator, a, b) {
        const op = operators.find(o => o.symbol === operator);
        return op.func(a, b);
    }
    
    // Konwersja na odwrotną notację polską (RPN)
    tokens.forEach(token => {
        if (!isNaN(token)) {
            output.push(parseFloat(token));
        } else {
            const op = operators.find(o => o.symbol === token);
            while (operatorsStack.length > 0) {
                const topOp = operators.find(o => o.symbol === operatorsStack[operatorsStack.length - 1]);
                if (topOp.priority >= op.priority) {
                    output.push(operatorsStack.pop());
                } else {
                    break;
                }
            }
            operatorsStack.push(token);
        }
    });
    
    while (operatorsStack.length > 0) {
        output.push(operatorsStack.pop());
    }
    
    // Obliczanie wartości z RPN
    const stack = [];
    output.forEach(token => {
        if (!isNaN(token)) {
            stack.push(token);
        } else {
            const b = stack.pop();
            const a = stack.pop();
            stack.push(applyOperator(token, a, b));
        }
    });
    
    return stack[0];
}

// Generowanie losowego pytania
function generateQuestion() {
    const complexity = Math.floor(Math.random() * 4) + 1; // 1-4
    let expressionParts = [];
    let answer;
    
    // Generowanie pierwszych dwóch liczb i operatora
    const firstNum = Math.floor(Math.random() * 20) + 1;
    const secondNum = Math.floor(Math.random() * 10) + 1;
    let firstOp = operators[Math.floor(Math.random() * operators.length)];
    
    // Dla potęg ograniczamy wykładnik
    if (firstOp.symbol === '^') {
        firstOp = operators[Math.floor(Math.random() * (operators.length - 1))]; // Wykluczamy potęgę na początku
    }
    
    expressionParts.push(firstNum, firstOp.symbol, secondNum);
    
    // Dodawanie kolejnych części wyrażenia w zależności od złożoności
    for (let i = 1; i < complexity; i++) {
        let nextOp = operators[Math.floor(Math.random() * operators.length)];
        let nextNum;
        
        // Ograniczenia dla niektórych operatorów
        if (nextOp.symbol === '÷') {
            // Dla dzielenia upewniamy się, że wynik będzie całkowity
            const possibleNumbers = [1, 2, 3, 4, 5, 10];
            nextNum = possibleNumbers[Math.floor(Math.random() * possibleNumbers.length)];
        } else if (nextOp.symbol === '^') {
            // Dla potęg ograniczamy wykładnik do 2 lub 3
            nextNum = Math.floor(Math.random() * 2) + 2;
        } else {
            nextNum = Math.floor(Math.random() * 10) + 1;
        }
        
        expressionParts.push(nextOp.symbol, nextNum);
    }
    
    // Obliczanie prawidłowej odpowiedzi
    const expressionStr = expressionParts.join(' ');
    answer = calculateExpression(expressionStr);
    
    // Zaokrąglenie w przypadku dzielenia
    if (expressionStr.includes('÷') && !Number.isInteger(answer)) {
        answer = Math.round(answer * 100) / 100;
    }
    
    return {
        question: expressionParts.join(' ') + ' =',
        correctAnswer: String(answer)
    };
}

// Generowanie wszystkich pytań
function generateAllQuestions() {
    let questions = [];
    for (let i = 0; i < 30; i++) {
        questions.push(generateQuestion());
    }
    return questions;
}