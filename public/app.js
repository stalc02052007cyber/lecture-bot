let currentPage = 1;

const lecturesPerPage = 6;

const notification = document.getElementById("notification");

let lastLectureId = null;
const latestLectures = document.getElementById("latestLectures");

const lectureCount = document.getElementById("lectureCount");

const subjectCount = document.getElementById("subjectCount");

const semesterCount = document.getElementById("semesterCount");

const logo = document.getElementById("logo");

const homeNav = document.getElementById("homeNav");

const lecturesNav = document.getElementById("lecturesNav");
const searchInput = document.getElementById("searchInput");

const searchButton = document.getElementById("searchButton");

const content = document.getElementById("content");

// ========================================
// СЕМЕСТРЛЕР
// ========================================

async function loadSemesters() {
  try {
    content.innerHTML = "Жүктөлүүдө...";

    const response = await fetch("/api/semesters");

    const semesters = await response.json();

    content.innerHTML = "";

    semesters.forEach((item) => {
      const card = document.createElement("div");

      card.className = "card";

      card.innerHTML = `
          <h3>
            🎓 ${item.semester}
          </h3>

          <p>
            📚 ${item.count} лекция
          </p>

          <p>
            Предметтерди көрүү →
          </p>
        `;

      card.addEventListener("click", () => {
        loadSubjects(item.semester);
      });

      content.appendChild(card);
    });
  } catch (error) {
    console.error(error);

    content.innerHTML = "❌ Семестрлерди жүктөөдө ката кетти.";
  }
}

// ========================================
// ПРЕДМЕТТЕР
// ========================================

async function loadSubjects(semester) {
  try {
    content.innerHTML = "Жүктөлүүдө...";

    const response = await fetch(
      `/api/subjects?semester=${encodeURIComponent(semester)}`,
    );

    const subjects = await response.json();

    content.innerHTML = "";

    // ====================================
    // АРТКА
    // ====================================

    const backButton = document.createElement("button");

    backButton.innerHTML = "← Артка";

    backButton.className = "back-button";

    backButton.addEventListener("click", () => {
      loadSemesters();
    });

    content.appendChild(backButton);

    // ====================================
    // TITLE
    // ====================================

    const title = document.createElement("div");

    title.className = "page-title";

    title.innerHTML = `
      <h2>
        🎓 ${semester}
      </h2>

      <p>
        Предметти танда
      </p>
    `;

    content.appendChild(title);

    // ====================================
    // ПРЕДМЕТ ЖОК
    // ====================================

    if (subjects.length === 0) {
      const empty = document.createElement("div");

      empty.className = "empty";

      empty.innerHTML = `
        ❌ Бул семестрде предмет жок.
      `;

      content.appendChild(empty);

      return;
    }

    // ====================================
    // ПРЕДМЕТТЕР
    // ====================================

    subjects.forEach((item) => {
      const card = document.createElement("div");

      card.className = "card";

      card.innerHTML = `
          <h3>
            📘 ${item.subject}
          </h3>

          <p>
            📚 ${item.count} лекция
          </p>

          <p>
            Лекцияларды көрүү →
          </p>
        `;

      // =================================
      // ПРЕДМЕТТИ БАСКАНДА
      // =================================

      card.addEventListener("click", () => {
        loadLectures(semester, item.subject);
      });

      content.appendChild(card);
    });
  } catch (error) {
    console.error(error);

    content.innerHTML = "❌ Предметтерди жүктөөдө ката кетти.";
  }
}

// ========================================
// ЛЕКЦИЯЛАР
// ========================================

async function loadLectures(semester, subject) {
  try {
    content.innerHTML = "Жүктөлүүдө...";

    // ====================================
    // API'ГА СУРОО
    // ====================================

    const response = await fetch(
      `/api/lectures?semester=${encodeURIComponent(semester)}&subject=${encodeURIComponent(subject)}`,
    );

    const lectures = await response.json();
    // ====================================
    // ЖАҢЫ ЛЕКЦИЯНЫ ТЕКШЕРҮҮ
    // ====================================

    if (lectures.length > 0) {
      const newest = lectures[0];

      // Сайт биринчи ачылганда
      if (lastLectureId === null) {
        lastLectureId = newest.id;
      }

      // Жаңы лекция табылса
      else if (newest.id !== lastLectureId) {
        showNotification(
          "✅ Жаңы лекция кошулду!",
          `${newest.subject} — ${newest.topic}`,
        );

        lastLectureId = newest.id;
      }
    }

    content.innerHTML = "";

    // ====================================
    // АРТКА
    // ====================================

    const backButton = document.createElement("button");

    backButton.innerHTML = "← Предметтерге кайтуу";

    backButton.className = "back-button";

    backButton.addEventListener("click", () => {
      loadSubjects(semester);
    });

    content.appendChild(backButton);

    // ====================================
    // TITLE
    // ====================================

    const title = document.createElement("div");

    title.className = "page-title";

    title.innerHTML = `
      <h2>
        📘 ${subject}
      </h2>

      <p>
        🎓 ${semester}
      </p>

      <p>
        Лекцияны танда
      </p>
    `;

    content.appendChild(title);

    // ====================================
    // ЛЕКЦИЯ ЖОК
    // ====================================

    if (lectures.length === 0) {
      const empty = document.createElement("div");

      empty.className = "empty";

      empty.innerHTML = `
        ❌ Бул предметте лекциялар жок.
      `;

      content.appendChild(empty);

      return;
    }

    // ====================================
    // ЛЕКЦИЯЛАР
    // ====================================

    lectures.forEach((lecture) => {
      const card = document.createElement("div");

      card.className = "card";

      card.innerHTML = `
          <h3>
            📝 ${lecture.topic}
          </h3>

          <p>
            📅 ${lecture.date}
          </p>

          ${
            lecture.file_name
              ? `
      <div class="file-box">

        <p>
          📎 ${lecture.file_name}
        </p>

        <a
          href="/api/lectures/${lecture.id}/file"
          target="_blank"
          class="file-button"
        >
          Файлды ачуу
        </a>

      </div>
    `
              : ""
          }

          <p>
            Лекцияны ачуу →
          </p>
        `;

      card.addEventListener("click", () => {
        openLecture(lecture.id, semester, subject);
      });

      content.appendChild(card);
    });
  } catch (error) {
    console.error(error);

    content.innerHTML = "❌ Лекцияларды жүктөөдө ката кетти.";
  }
}

// ========================================
// БИР ЛЕКЦИЯНЫ АЧУУ
// ========================================

async function openLecture(id, semester, subject) {
  try {
    content.innerHTML = "Жүктөлүүдө...";

    const response = await fetch(`/api/lectures/${id}`);

    const lecture = await response.json();

    content.innerHTML = "";

    // ====================================
    // АРТКА
    // ====================================

    const backButton = document.createElement("button");

    backButton.innerHTML = "← Лекцияларга кайтуу";

    backButton.className = "back-button";

    backButton.addEventListener("click", () => {
      loadLectures(semester, subject);
    });

    content.appendChild(backButton);

    // ====================================
    // ЛЕКЦИЯ
    // ====================================

    const lecturePage = document.createElement("div");

    lecturePage.className = "lecture-page";

    lecturePage.innerHTML = `

      <h1>
        ${lecture.topic}
      </h1>

      <div class="lecture-info">

        <p>
          🎓 ${lecture.semester}
        </p>

        <p>
          📘 ${lecture.subject}
        </p>

        <p>
          📅 ${lecture.date}
        </p>

      </div>

      <hr>

      ${
        lecture.content
          ? `
            <div class="lecture-text">
              ${lecture.content}
            </div>
          `
          : `
            <p>
              📎 Бул лекция файл түрүндө сакталган.
            </p>
          `
      }

      ${
        lecture.file_name
          ? `
            <p>
              📎 Файл:
              ${lecture.file_name}
            </p>
          `
          : ""
      }

    `;

    content.appendChild(lecturePage);
  } catch (error) {
    console.error(error);

    content.innerHTML = "❌ Лекцияны ачууда ката кетти.";
  }
}

// ========================================
// САЙТ АЧЫЛГАНДА
// ========================================
// ========================================
// SEARCH
// ========================================

async function searchLectures() {
  const query = searchInput.value.trim();

  if (!query) {
    loadSemesters();

    return;
  }

  content.innerHTML = "🔎 Изделүүдө...";

  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);

    const results = await response.json();

    content.innerHTML = "";

    // ====================================
    // АРТКА
    // ====================================

    const backButton = document.createElement("button");

    backButton.className = "back-button";

    backButton.innerHTML = "← Башкы бет";

    backButton.addEventListener("click", () => {
      searchInput.value = "";

      loadSemesters();
    });

    content.appendChild(backButton);

    // ====================================
    // TITLE
    // ====================================

    const title = document.createElement("div");

    title.className = "page-title";

    title.innerHTML = `
      <h2>
        🔎 Издөө жыйынтыгы
      </h2>

      <p>
        "${query}"
      </p>

      <p>
        Табылды: ${results.length}
      </p>
    `;

    content.appendChild(title);

    // ====================================
    // NOTHING FOUND
    // ====================================

    if (results.length === 0) {
      const empty = document.createElement("div");

      empty.className = "empty";

      empty.innerHTML = `
        ❌ "${query}" боюнча лекция табылган жок.
      `;

      content.appendChild(empty);

      return;
    }

    // ====================================
    // RESULTS
    // ====================================

    // ========================================
    // PAGINATION
    // ========================================

    currentPage = 1;

    function showLecturePage(page) {
      currentPage = page;

      const oldCards = content.querySelectorAll(".lecture-card");

      oldCards.forEach((card) => card.remove());

      const oldPagination = document.getElementById("pagination");

      if (oldPagination) {
        oldPagination.remove();
      }

      // КАЙСЫ ЛЕКЦИЯЛАР ЧЫГАТ

      const start = (page - 1) * lecturesPerPage;

      const end = start + lecturesPerPage;

      const pageLectures = lectures.slice(start, end);

      // ЛЕКЦИЯ КАРТОЧКАЛАРЫ

      pageLectures.forEach((lecture) => {
        const card = document.createElement("div");

        card.className = "card lecture-card";

        card.innerHTML = `

        <h3>
          📝 ${lecture.topic}
        </h3>

        <p>
          📅 ${lecture.date}
        </p>

        ${
          lecture.file_name
            ? `
              <p>
                📎 ${lecture.file_name}
              </p>
            `
            : ""
        }

        <p>
          Лекцияны ачуу →
        </p>

      `;

        card.addEventListener("click", () => {
          openLecture(lecture.id, semester, subject);
        });

        content.appendChild(card);
      });

      // ====================================
      // PAGE COUNT
      // ====================================

      const totalPages = Math.ceil(lectures.length / lecturesPerPage);

      // ====================================
      // PAGINATION BUTTONS
      // ====================================

      const pagination = document.createElement("div");

      pagination.id = "pagination";

      pagination.className = "pagination";

      // МУРУНКУ

      const previousButton = document.createElement("button");

      previousButton.textContent = "← Мурунку";

      previousButton.disabled = page === 1;

      previousButton.addEventListener("click", () => {
        if (page > 1) {
          showLecturePage(page - 1);
        }
      });

      // PAGE INFO

      const pageInfo = document.createElement("span");

      pageInfo.textContent = `${page} / ${totalPages}`;

      // КИЙИНКИ

      const nextButton = document.createElement("button");

      nextButton.textContent = "Кийинки →";

      nextButton.disabled = page === totalPages;

      nextButton.addEventListener("click", () => {
        if (page < totalPages) {
          showLecturePage(page + 1);
        }
      });

      pagination.appendChild(previousButton);

      pagination.appendChild(pageInfo);

      pagination.appendChild(nextButton);

      content.appendChild(pagination);
    }

    // БИРИНЧИ БАРАКТЫ АЧАБЫЗ

    showLecturePage(1);
  } catch (error) {
    console.error(error);

    content.innerHTML = "❌ Издөөдө ката кетти.";
  }
}

searchButton.addEventListener("click", () => {
  if (event.key === "Enter") {
    searchLectures();
  }
});

logo.addEventListener("click", () => {
  loadSemesters();
});

homeNav.addEventListener("click", () => {
  loadSemesters();
});

lecturesNav.addEventListener("click", () => {
  loadSemesters();
});

// ========================================
// STATISTICS
// ========================================

async function loadStats() {
  try {
    const response = await fetch("/api/stats");

    const stats = await response.json();

    lectureCount.textContent = stats.lectures;

    subjectCount.textContent = stats.subjects;

    semesterCount.textContent = stats.semesters;
  } catch (error) {
    console.error("STATS ERROR:", error);
  }
}

// ========================================
// LATEST LECTURES
// ========================================

async function loadLatest() {
  try {
    const response = await fetch("/api/latest");

    const lectures = await response.json();

    latestLectures.innerHTML = "";

    if (lectures.length === 0) {
      latestLectures.innerHTML = `
        <div class="empty">
          Азырынча лекциялар жок.
        </div>
      `;

      return;
    }

    lectures.forEach((lecture) => {
      const card = document.createElement("div");

      card.className = "latest-card";

      card.innerHTML = `

          <div class="latest-icon">
            📝
          </div>

          <div class="latest-info">

            <span class="latest-subject">
              ${lecture.subject}
            </span>

            <h3>
              ${lecture.topic}
            </h3>

            <p>
              🎓 ${lecture.semester}
            </p>

            <p>
              📅 ${lecture.date}
            </p>

            ${
              lecture.file_name
                ? `
                  <p>
                    📎 ${lecture.file_name}
                  </p>
                `
                : ""
            }

          </div>

        `;

      card.addEventListener("click", () => {
        openLecture(lecture.id, lecture.semester, lecture.subject);
      });

      latestLectures.appendChild(card);
    });
  } catch (error) {
    console.error("LATEST ERROR:", error);

    latestLectures.innerHTML = "❌ Лекцияларды жүктөөдө ката кетти.";
  }
}

// ========================================
// NOTIFICATION
// ========================================

function showNotification(title, text) {
  notification.innerHTML = `
    <strong>
      ${title}
    </strong>

    <span>
      ${text}
    </span>
  `;

  notification.classList.add("show");

  setTimeout(() => {
    notification.classList.remove("show");
  }, 4000);
}

//

// ========================================
// AUTO REFRESH
// ========================================

loadStats();
loadLatest();
loadSemesters();

setInterval(() => {
  loadStats();
  loadLatest();
}, 10000);
