import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getDatabase, ref, set, get, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAuyIARiYFW3rU_7mWOPYJ6WXx3keTJVgI",
    authDomain: "trigonometry-trainer.firebaseapp.com",
    databaseURL: "https://trigonometry-trainer-default-rtdb.firebaseio.com",
    projectId: "trigonometry-trainer",
    storageBucket: "trigonometry-trainer.firebasestorage.app",
    messagingSenderId: "259273032172",
    appId: "1:259273032172:web:da713f7c022e37d56200c9"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const leaderboardRef = ref(db, 'leaderboard');

let currentUser = null;
let currentCorrectAnswer = "";
let correctScore = 0;
let incorrectScore = 0;
let lastQuestion = "";
let isSpeedrun = false;
let timerInterval;
let speedrunHistory = new Set(); 

const trigData = [
    {rad: "0", sin: "0", cos: "1", tan: "0"},
    {rad: "\u03C0/6", sin: "1/2", cos: "\u221A3/2", tan: "\u221A3/3"},
    {rad: "\u03C0/4", sin: "\u221A2/2", cos: "\u221A2/2", tan: "1"},
    {rad: "\u03C0/3", sin: "\u221A3/2", cos: "1/2", tan: "\u221A3"},
    {rad: "\u03C0/2", sin: "1", cos: "0", tan: "undefined"},
    {rad: "2\u03C0/3", sin: "\u221A3/2", cos: "-1/2", tan: "-\u221A3"},
    {rad: "3\u03C0/4", sin: "\u221A2/2", cos: "-\u221A2/2", tan: "-1"},
    {rad: "5\u03C0/6", sin: "1/2", cos: "-\u221A3/2", tan: "-\u221A3/3"},
    {rad: "\u03C0", sin: "0", cos: "-1", tan: "0"},
    {rad: "7\u03C0/6", sin: "-1/2", cos: "-\u221A3/2", tan: "\u221A3/3"},
    {rad: "5\u03C0/4", sin: "-\u221A2/2", cos: "-\u221A2/2", tan: "1"},
    {rad: "4\u03C0/3", sin: "-\u221A3/2", cos: "-1/2", tan: "\u221A3"},
    {rad: "3\u03C0/2", sin: "-1", cos: "0", tan: "undefined"},
    {rad: "5\u03C0/3", sin: "-\u221A3/2", cos: "1/2", tan: "-\u221A3"},
    {rad: "7\u03C0/4", sin: "-\u221A2/2", cos: "\u221A2/2", tan: "-1"},
    {rad: "11\u03C0/6", sin: "-1/2", cos: "\u221A3/2", tan: "-\u221A3/3"}
];

const possibleAnswers = ["0", "1", "-1", "1/2", "-1/2", "\u221A2/2", "-\u221A2/2", "\u221A3/2", "-\u221A3/2", "\u221A3", "-\u221A3", "\u221A3/3", "-\u221A3/3", "undefined"];

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('practiceBtn').addEventListener('click', startPractice);
    document.getElementById('speedrunBtn').addEventListener('click', startSpeedrunSequence);
    document.getElementById('quitBtn').addEventListener('click', () => location.reload());
    
    document.getElementById('registerBtn').addEventListener('click', handleRegister);
    document.getElementById('loginBtn').addEventListener('click', handleLogin);
    document.getElementById('guestBtn').addEventListener('click', handleGuestMode);
    document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

    const high = localStorage.getItem('trigHighScore') || 0;
    document.getElementById('highScoreDisplay').innerText = `Personal Best (Speedrun): ${high}`;
    
    onAuthStateChanged(auth, (user) => {
        const authContainer = document.getElementById('authContainer');
        const userStatus = document.getElementById('userStatus');
        const mainMenuContent = document.getElementById('mainMenuContent');

        if (user) {
            currentUser = user;
            authContainer.style.display = 'none';
            userStatus.style.display = 'block'; // Dynamic activation explicitly handled
            mainMenuContent.style.display = 'block'; 
            
            const dynamicDisplayName = user.displayName || "Cool Competitor";
            userStatus.innerText = user.isAnonymous ? "Playing as: Anonymous Guest" : `Logged in as: ${dynamicDisplayName}`;
        } else {
            currentUser = null;
            authContainer.style.display = 'block';
            userStatus.style.display = 'none'; // Closes wrapper visually when empty
            mainMenuContent.style.display = 'none'; 
        }
    });

    loadGlobalLeaderboard();
});

async function handleRegister() {
    const username = document.getElementById('authUsername').value.trim();
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    
    if(!username) return alert("Please specify a cool username first.");
    if(!email || !password) return alert("Fill in email and password fields.");
    
    try { 
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: username });
        location.reload();
    } catch(err) { alert(err.message); }
}

async function handleLogin() {
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    if(!email || !password) return alert("Fill in email and password fields.");
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch(err) { alert(err.message); }
}

async function handleGuestMode() {
    try { await signInAnonymously(auth); } 
    catch(err) { alert(err.message); }
}

async function loadGlobalLeaderboard() {
    const leaderboardDiv = document.getElementById('globalLeaderboard');
    try {
        const topScoresQuery = query(leaderboardRef, orderByChild('score'), limitToLast(5));
        const snapshot = await get(topScoresQuery);
        
        if (snapshot.exists()) {
            let entries = [];
            snapshot.forEach((childSnapshot) => {
                entries.push(childSnapshot.val());
            });
            entries.reverse(); 

            let html = '<b>Global Top 5:</b><br>';
            entries.forEach((entry, index) => {
                html += `<div class="leaderboard-entry"><span>${index + 1}. ${entry.name}</span> <span><b>${entry.score}</b></span></div>`;
            });
            leaderboardDiv.innerHTML = html;
        } else {
            leaderboardDiv.innerText = "No global records yet. Be the first!";
        }
    } catch (error) {
        leaderboardDiv.innerText = "Failed to load leaderboard.";
    }
}

function startPractice() {
    isSpeedrun = false;
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('timer').style.display = 'none';
    document.getElementById('quitBtn').style.display = 'inline-block';
    resetScores();
    generateQuestion();
}

function startSpeedrunSequence() {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = '<div id="countdownText">5</div>';
    let count = 5;
    const countInterval = setInterval(() => {
        count--;
        if (count > 0) document.getElementById('countdownText').innerText = count;
        else { 
            clearInterval(countInterval); 
            overlay.style.display = 'none'; 
            startSpeedrun(); 
        }
    }, 1000);
}

function startSpeedrun() {
    isSpeedrun = true;
    speedrunHistory = new Set();
    resetScores();
    const timerDiv = document.getElementById('timer');
    timerDiv.style.display = 'block';
    document.getElementById('quitBtn').style.display = 'inline-block';
    
    let timeLeft = 300; 
    timerDiv.innerText = `Time Left: 5:00`;

    timerInterval = setInterval(() => {
        timeLeft--;
        let mins = Math.floor(timeLeft / 60);
        let secs = timeLeft % 60;
        timerDiv.innerText = `Time Left: ${mins}:${secs < 10 ? '0' : ''}${secs}`;
        if (timeLeft <= 0) endGame();
    }, 1000);
    generateQuestion();
}

function resetScores() {
    correctScore = 0;
    incorrectScore = 0;
    document.getElementById('correctCount').innerText = "0";
    document.getElementById('incorrectCount').innerText = "0";
}

function generateQuestion() {
    const feedback = document.getElementById('feedback');
    feedback.innerText = "";
    feedback.className = "";
    
    let angleObj, func, questionId;

    do {
        angleObj = trigData[Math.floor(Math.random() * trigData.length)];
        func = ['sin', 'cos', 'tan'][Math.floor(Math.random() * 3)];
        questionId = func + "(" + angleObj.rad + ")";
    } while (questionId === lastQuestion);

    lastQuestion = questionId;
    currentCorrectAnswer = angleObj[func];
    document.getElementById('questionArea').innerText = `${questionId} = ?`;

    let options = new Set();
    options.add(currentCorrectAnswer);

    if (currentCorrectAnswer !== "undefined" && currentCorrectAnswer !== "0") {
        let negativeDistractor = currentCorrectAnswer.startsWith('-') ? currentCorrectAnswer.substring(1) : '-' + currentCorrectAnswer;
        if (possibleAnswers.includes(negativeDistractor)) options.add(negativeDistractor);
    }

    if (func === 'tan') {
        options.add("0");
        options.add("undefined");
    } else {
        let partnerFunc = (func === 'sin') ? 'cos' : 'sin';
        options.add(angleObj[partnerFunc]);
    }

    while (options.size < 6) {
        let randAns = possibleAnswers[Math.floor(Math.random() * possibleAnswers.length)];
        options.add(randAns);
    }

    let shuffledOptions = Array.from(options).sort(() => Math.random() - 0.5);

    const optionsArea = document.getElementById('optionsArea');
    optionsArea.innerHTML = "";
    shuffledOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(opt);
        optionsArea.appendChild(btn);
    });
}

function checkAnswer(selected) {
    const feedback = document.getElementById('feedback');
    const buttons = document.querySelectorAll('#optionsArea button');
    buttons.forEach(btn => btn.disabled = true);

    if (selected === currentCorrectAnswer) {
        feedback.innerText = "Correct!";
        feedback.className = "correct";
        correctScore++;
        document.getElementById('correctCount').innerText = correctScore;
        
        setTimeout(generateQuestion, isSpeedrun ? 200 : 1000);
    } else {
        feedback.innerText = `Incorrect: ${currentCorrectAnswer}`;
        feedback.className = "incorrect";
        incorrectScore++;
        document.getElementById('incorrectCount').innerText = incorrectScore;

        if (isSpeedrun) {
            speedrunHistory.add(JSON.stringify({q: lastQuestion, a: currentCorrectAnswer}));
        }
        
        // Brief freeze on wrong answers to break up rapid spamming
        setTimeout(generateQuestion, 1000);
    }
}

async function endGame() {
    clearInterval(timerInterval);
    document.getElementById('quitBtn').style.display = 'none';
    
    // Calculate final net score with a floor of 0
    const finalNetScore = Math.max(0, correctScore - incorrectScore);
    const shouldSubmit = finalNetScore > 0;

    const currentHigh = localStorage.getItem('trigHighScore') || 0;
    if (finalNetScore > currentHigh) {
        localStorage.setItem('trigHighScore', finalNetScore);
    }

    let reviewHtml = "";
    if (speedrunHistory.size > 0) {
        reviewHtml = `<p><strong>Review Your Mistakes:</strong></p><div class="summary-list">`;
        speedrunHistory.forEach(itemStr => {
            const item = JSON.parse(itemStr);
            reviewHtml += `
                <div class="summary-item">
                    Question: <b>${item.q}</b><br>
                    Correct Answer: <b style="color: #28a745">${item.a}</b>
                </div>`;
        });
        reviewHtml += `</div>`;
    } else {
        reviewHtml = `<p>Perfect run! No mistakes.</p>`;
    }

    const overlay = document.getElementById('overlay');
    overlay.style.display = 'flex';
    
    let submitLayout = "";
    
    // Check if they are a registered user AND have a score worth saving
    if (currentUser && !currentUser.isAnonymous) {
        const userDisplayName = currentUser.displayName || "Account User";
        
        if (shouldSubmit) {
            submitLayout = `
                <div id="dbSubmitArea">
                    <p style='color:#28a745; font-weight:bold;'>✓ Score auto-saved to leaderboard!</p>
                    <p>Submitted as: <b>${userDisplayName}</b></p>
                </div>`;
                
            if (finalNetScore <= 250) {
                try {
                    const userScoreRef = ref(db, `leaderboard/${currentUser.uid}`);
                    await set(userScoreRef, {
                        name: userDisplayName,
                        score: finalNetScore,
                        timestamp: Date.now()
                    });
                } catch(err) {
                    console.error("Auto-save failed: ", err);
                    submitLayout = `<div id="dbSubmitArea"><p style='color:#dc3545;'>Auto-save failed under security rules.</p></div>`;
                }
            }
        } else {
            submitLayout = `<div id="dbSubmitArea"><p style='color:#6c757d;'>Scores of 0 are not recorded on the leaderboard.</p></div>`;
        }
    } else {
        // Guest layout conditional rendering
        if (shouldSubmit) {
            submitLayout = `
                <div id="dbSubmitArea">
                    <input type="text" id="playerName" class="name-input" placeholder="Guest Display Name" maxlength="15">
                    <button id="submitScoreBtn" class="menu-btn" style="padding:10px; width:100%;">Submit Guest Score</button>
                </div>`;
        } else {
            submitLayout = `<div id="dbSubmitArea"><p style='color:#6c757d;'>Scores of 0 are not recorded on the leaderboard.</p></div>`;
        }
    }

    overlay.innerHTML = `
        <div class="menu-card">
            <h2>Time's Up!</h2>
            <p style="font-size: 1.1em; margin-bottom: 5px;">Raw Breakdown: Correct: ${correctScore} | Incorrect: ${incorrectScore}</p>
            <p style="font-size: 1.4em; font-weight: bold; color: #007bff; margin-top: 0;">Final Score: ${finalNetScore}</p>
            ${submitLayout}
            ${reviewHtml}
            <button id="mainMenuBtn" class="menu-btn secondary-btn" style="display:block;">Main Menu</button>
        </div>
    `;

    // Only configure guest submission click handlers if submission is viable
    if (currentUser && currentUser.isAnonymous && shouldSubmit) {
        document.getElementById('submitScoreBtn').addEventListener('click', async () => {
            if(finalNetScore > 250) return alert("Score value is restricted outside bounds.");

            const nameInput = document.getElementById('playerName').value.trim();
            if(!nameInput) {
                alert("Please type a temporary display name first!");
                return;
            }
            const finalSubmissionName = nameInput + " (Guest)";

            document.getElementById('submitScoreBtn').disabled = true;
            document.getElementById('submitScoreBtn').innerText = "Submitting...";

            try {
                const userScoreRef = ref(db, `leaderboard/${currentUser.uid}`);
                await set(userScoreRef, {
                    name: finalSubmissionName,
                    score: finalNetScore,
                    timestamp: Date.now()
                });
                document.getElementById('dbSubmitArea').innerHTML = "<p style='color:#28a745; font-weight:bold;'>Score locked in successfully!</p>";
            } catch(err) {
                console.error(err);
                alert("Database rejected submission under security rules constraint rules.");
                document.getElementById('submitScoreBtn').disabled = false;
                document.getElementById('submitScoreBtn').innerText = "Submit to Leaderboard";
            }
        });
    }

    document.getElementById('mainMenuBtn').addEventListener('click', () => location.reload());
}
