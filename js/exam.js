const timerEl = document.getElementById("timer");
const examForm = document.getElementById("examForm");
let duration = 30 * 60; // 30 min in seconds (replace dynamically)

function startTimer() {
  const interval = setInterval(() => {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    timerEl.textContent = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
    duration--;
    if (duration < 0) {
      clearInterval(interval);
      submitExam();
    }
  }, 1000);
}

function loadQuestions() {
  // Example static data
  const questions = [
    { id: 1, question_text: "What is 2+2?", a: "3", b: "4", c: "5", d: "6", image_url: "" },
    { id: 2, question_text: "Physics formula?", a: "F=ma", b: "E=mc²", c: "V=IR", d: "P=IV", image_url: "" }
  ];

  questions.forEach((q, index) => {
    const div = document.createElement("div");
    div.className = "bg-white p-4 rounded-xl shadow";
    div.innerHTML = `
      <p class="font-semibold mb-2">${index + 1}. ${q.question_text}</p>
      ${q.image_url ? `<img src="${q.image_url}" class="mb-2 rounded" />` : ""}
      <div class="flex flex-col gap-2">
        ${["a","b","c","d"].map(opt => `
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="q${q.id}" value="${opt}" required />
            <span>${q[opt]}</span>
          </label>
        `).join("")}
      </div>
    `;
    examForm.appendChild(div);
  });
}

function submitExam() {
  alert("Exam submitted! Connect to Supabase to save results.");
}

document.getElementById("submitExam").addEventListener("click", submitExam);

loadQuestions();
startTimer();
