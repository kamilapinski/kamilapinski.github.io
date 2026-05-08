# Flashcards App

A lightweight, mobile-friendly, and dark-themed flashcard application built with HTML, CSS, and JavaScript. It supports LaTeX syntax for mathematical equations and automatically saves your learning progress locally.

## Features

-   **LaTeX Support:** Render complex mathematical formulas using MathJax (use `$` for inline math).
-   **Persistent Progress:** Your "unlearned" cards are saved in your browser's `localStorage`. Even if you close the tab, the app remembers where you left off.
-   **Dark Mode:** Built-in dark theme for a comfortable learning experience.
-   **Mobile Optimized:** Large touch targets and responsive layout for studying on the go.
-   **Shuffling:** Randomize the order of your cards at any time.
-   **CSV-Based:** Easy to manage and add new study sets.

## How It Works

1.  **Loading Sets:** The app fetches CSV files from the `/sets` directory.
2.  **Learning Logic:** -   When you mark a card as **"Know"**, it is removed from the current session's queue.
    -   When you mark it as **"Don't Know"**, it is moved to the end of the queue.
3.  **Local Storage:** The list of remaining card indices is stored in your browser. Each set has its own independent progress tracker.

## How to Add New Sets

To add a new flashcard set, follow these steps:

### 1. Create the CSV File
Create a new `.csv` file inside the `sets/` folder.

### 2. Format the Content
The file must use a **semicolon (`;`)** as a separator between the front and the back of the card. Use **single dollar signs (`$`)** for LaTeX equations.

**Example (`calculus.csv`):**
```csv
What is the derivative of $x^n$?; The derivative is $nx^{n-1}$.
Definition of an integral; $\int f(x) dx$
Area of a circle; $A = \pi r^2$

```

### 3. Register the Set

Open `script.js` and add your new file to the `availableSets` array at the top of the file:

```javascript
const availableSets = [
    { file: 'math_basics.csv', name: 'Math Basics' },
    { file: 'calculus.csv', name: 'Calculus' } // Add your new set here
];

```

## Running the Project

Because the app uses the `fetch` API to load CSV files, it must be run through a **local web server** due to browser security (CORS) policies.

* **VS Code:** Use the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension.
* **Python:** Run `python -m http.server 8000` in the project folder.
* **Node.js:** Use `npx serve`.

## Technologies Used

* **MathJax:** For high-quality LaTeX rendering.
* **Vanilla JS:** For logic and local storage management.
* **CSS3:** For the 3D flip animation and dark-themed responsive UI.