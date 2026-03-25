document.addEventListener("DOMContentLoaded", () => {
  const examList = document.getElementById("examList");

  // Example static data (replace with Supabase fetch)
  const exams = [
    { id: 1, title: "Math Full Mock", duration: 30, is_paid: false },
    { id: 2, title: "Physics Live Exam", duration: 45, is_paid: true }
  ];

  exams.forEach(exam => {
    const card = document.createElement("div");
    card.className = "bg-white p-4 rounded-xl shadow hover:shadow-lg transition cursor-pointer";
    card.innerHTML = `
      <h3 class="font-semibold text-lg">${exam.title}</h3>
      <p class="text-gray-500">Duration: ${exam.duration} min</p>
      <p class="text-gray-500">${exam.is_paid ? "Paid Exam 🔒" : "Free Exam"}</p>
      <button onclick="startExam(${exam.id})" class="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Start Exam</button>
    `;
    examList.appendChild(card);
  });
});

function startExam(examId) {
  // Redirect to exam page with query parameter
  window.location.href = `exam.html?examId=${examId}`;
}
