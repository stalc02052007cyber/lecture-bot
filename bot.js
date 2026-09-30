require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const Database = require("better-sqlite3");
const express = require("express");
const path = require("path");
const { Readable } = require("stream");

const app = express();

const PORT = process.env.PORT || 3000;

// ========================================
// CONFIG
// ========================================

const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = Number(process.env.ADMIN_ID);
const ACADEMIC_YEAR = "2026–2027";

// ========================================
// DATABASE
// ========================================

// ========================================
// DATABASE PATH
// LOCAL + RAILWAY
// ========================================

const DB_PATH =
  process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(
        process.env.RAILWAY_VOLUME_MOUNT_PATH,
        "lectures.db"
      )
    : path.join(
        __dirname,
        "lectures.db"
      );

console.log(
  "💾 Database path:",
  DB_PATH
);

const db =
  new Database(
    DB_PATH
  );

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


app.get(
  "/api/semesters",
  (req, res) => {

    const semesters =
      db.prepare(`
        SELECT
          semester,
          COUNT(*) AS count
        FROM lectures
        GROUP BY semester
        ORDER BY
          CASE
            WHEN semester = '1-семестр' THEN 1
            WHEN semester = '2-семестр' THEN 2
            ELSE 3
          END
      `).all();

    res.json(
      semesters
    );

  }
);


app.get(
  "/api/subjects",
  (req, res) => {

    const semester =
      req.query.semester;

    if (!semester) {

      return res
        .status(400)
        .json({
          error:
            "semester керек"
        });

    }

    const subjects =
      db.prepare(`
        SELECT
          subject,
          COUNT(*) AS count
        FROM lectures
        WHERE semester = ?
        GROUP BY subject
        ORDER BY subject
      `).all(
        semester
      );

    res.json(
      subjects
    );

  }
);


app.get(
  "/api/lectures",
  (req, res) => {

    const semester =
      req.query.semester;

    const subject =
      req.query.subject;

    if (
      !semester ||
      !subject
    ) {

      return res
        .status(400)
        .json({
          error:
            "semester жана subject керек"
        });

    }

    const lectures =
      db.prepare(`
        SELECT
          id,
          academic_year,
          semester,
          subject,
          topic,
          date,
          content,
          file_name,
          file_type
        FROM lectures
        WHERE semester = ?
          AND subject = ?
        ORDER BY id DESC
      `).all(
        semester,
        subject
      );

    res.json(
      lectures
    );

  }
);



app.get(
  "/api/lectures/:id",
  (req, res) => {

    const lecture =
      db.prepare(`
        SELECT
          id,
          academic_year,
          semester,
          subject,
          topic,
          date,
          content,
          file_name,
          file_type
        FROM lectures
        WHERE id = ?
      `).get(
        req.params.id
      );

    if (!lecture) {

      return res
        .status(404)
        .json({
          error:
            "Лекция табылган жок."
        });

    }

    res.json(
      lecture
    );

  }
);


app.listen(
  PORT,
  () => {

    console.log(
      `🌐 API жана сайт иштеп жатат: http://localhost:${PORT}`
    );

  }
);


app.get(
  "/api/lectures/:id/file",

  async (req, res) => {

    try {

      const lecture =
        db.prepare(`
          SELECT
            file_id,
            file_name,
            file_type
          FROM lectures
          WHERE id = ?
        `).get(
          req.params.id
        );

      if (
        !lecture ||
        !lecture.file_id
      ) {

        return res
          .status(404)
          .send(
            "Файл табылган жок."
          );
      }

      const fileLink =
        await bot.telegram.getFileLink(
          lecture.file_id
        );

      const telegramResponse =
        await fetch(
          fileLink.href
        );

      if (
        !telegramResponse.ok
      ) {

        return res
          .status(500)
          .send(
            "Файлды Telegram'дан алуу мүмкүн болгон жок."
          );
      }

      const contentType =
        telegramResponse.headers.get(
          "content-type"
        );

      if (contentType) {

        res.setHeader(
          "Content-Type",
          contentType
        );
      }

      const fileName =
        lecture.file_name ||
        "file";

      res.setHeader(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
      );

      const arrayBuffer =
        await telegramResponse.arrayBuffer();

      const buffer =
        Buffer.from(
          arrayBuffer
        );

      res.send(
        buffer
      );

    } catch (error) {

      console.error(
        "FILE ERROR:",
        error
      );

      res
        .status(500)
        .send(
          "Файлды ачууда ката кетти."
        );
    }
  }
);


// ========================================
// API - SEARCH
// ========================================

app.get(
  "/api/search",

  (req, res) => {

    try {

      const q =
        String(
          req.query.q || ""
        ).trim();

      if (!q) {

        return res.json([]);

      }

      const search =
        `%${q}%`;

      const results =
        db.prepare(`
          SELECT
            id,
            academic_year,
            semester,
            subject,
            topic,
            date,
            content,
            file_name,
            file_type

          FROM lectures

          WHERE
            subject LIKE ?
            OR topic LIKE ?
            OR content LIKE ?
            OR date LIKE ?

          ORDER BY id DESC
        `).all(
          search,
          search,
          search,
          search
        );

      res.json(
        results
      );

    } catch (error) {

      console.error(
        "SEARCH ERROR:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Издөөдө ката кетти."
        });
    }
  }
);

// ========================================
// API - STATISTICS
// ========================================

app.get(
  "/api/stats",

  (req, res) => {

    try {

      const lectures =
        db.prepare(`
          SELECT COUNT(*) AS count
          FROM lectures
        `).get();

      const subjects =
        db.prepare(`
          SELECT COUNT(
            DISTINCT semester || '|' || subject
          ) AS count
          FROM lectures
        `).get();

      const semesters =
        db.prepare(`
          SELECT COUNT(
            DISTINCT semester
          ) AS count
          FROM lectures
        `).get();

      res.json({
        lectures:
          lectures.count,

        subjects:
          subjects.count,

        semesters:
          semesters.count
      });

    } catch (error) {

      console.error(
        "STATS ERROR:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Статистиканы алуу мүмкүн болгон жок."
        });

    }

  }
);

// ========================================
// API - LATEST LECTURES
// ========================================

app.get(
  "/api/latest",

  (req, res) => {

    try {

      const lectures =
        db.prepare(`
          SELECT
            id,
            semester,
            subject,
            topic,
            date,
            file_name,
            file_type,
            created_at

          FROM lectures

          ORDER BY id DESC

          LIMIT 6
        `).all();

      res.json(
        lectures
      );

    } catch (error) {

      console.error(
        "LATEST ERROR:",
        error
      );

      res
        .status(500)
        .json({
          error:
            "Акыркы лекцияларды алуу мүмкүн болгон жок."
        });

    }

  }
);

/*  // */
db.prepare(`
  CREATE TABLE IF NOT EXISTS lectures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_year TEXT NOT NULL DEFAULT '2026–2027',
    semester TEXT NOT NULL DEFAULT '1-семестр',
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    date TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    file_id TEXT,
    file_type TEXT,
    file_name TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

function addColumnIfNotExists(column, type) {
  const columns = db
    .prepare("PRAGMA table_info(lectures)")
    .all();

  const exists = columns.some(
    (col) => col.name === column
  );

  if (!exists) {
    db.prepare(
      `ALTER TABLE lectures ADD COLUMN ${column} ${type}`
    ).run();

    console.log(
      `✅ ${column} колонкасы кошулду.`
    );
  }
}

addColumnIfNotExists(
  "academic_year",
  "TEXT DEFAULT '2026–2027'"
);

addColumnIfNotExists(
  "semester",
  "TEXT DEFAULT '1-семестр'"
);

addColumnIfNotExists(
  "file_id",
  "TEXT"
);

addColumnIfNotExists(
  "file_type",
  "TEXT"
);

addColumnIfNotExists(
  "file_name",
  "TEXT"
);

// ========================================
// UPDATE OLD DATA
// ========================================

try {

  db.prepare(`
    UPDATE lectures
    SET academic_year = ?
    WHERE academic_year IS NULL
       OR academic_year = ''
  `).run(
    ACADEMIC_YEAR
  );

  db.prepare(`
    UPDATE lectures
    SET semester = '1-семестр'
    WHERE semester IS NULL
       OR semester = ''
  `).run();

} catch (error) {

  console.log(
    "⚠️ Эски маалыматтарды жаңыртууда:",
    error.message
  );

}

console.log(
  "📚 Database даяр!"
);

// ========================================
// USERS STATE
// ========================================

const users = {};

// ========================================
// ADMIN
// ========================================

function isAdmin(ctx) {

  return Boolean(
    ctx.from &&
    ctx.from.id === ADMIN_ID
  );

}

// ========================================
// SEMESTER HELPERS
// ========================================

function semesterFromNumber(number) {

  return String(number) === "1"
    ? "1-семестр"
    : "2-семестр";

}

function semesterNumber(semester) {

  return semester === "1-семестр"
    ? "1"
    : "2";

}

// ========================================
// MAIN MENU
// ========================================

function mainMenu(
  isAdminUser = false
) {

  if (isAdminUser) {

    return Markup.keyboard([
      ["➕ Лекция кошуу"],

      [
        "🔎 Лекция издөө",
        "📚 Бардык лекциялар"
      ],

      [
        "📅 Дата боюнча",
        "📖 Сабактар"
      ],

      ["📊 Статистика"]

    ]).resize();

  }

  return Markup.keyboard([

    ["🔎 Лекция издөө"],

    ["📚 Бардык лекциялар"],

    [
      "📅 Дата боюнча",
      "📖 Сабактар"
    ]

  ]).resize();

}

// ========================================
// SEMESTER KEYBOARD
// ========================================

function semesterKeyboard(
  prefix = ""
) {

  return Markup.inlineKeyboard([

    [

      Markup.button.callback(
        "1️⃣ 1-семестр",
        `${prefix}semester_1`
      ),

      Markup.button.callback(
        "2️⃣ 2-семестр",
        `${prefix}semester_2`
      )

    ]

  ]);

}

// ========================================
// GET SUBJECTS
// ========================================

function getSubjects(
  semester
) {

  return db.prepare(`
    SELECT
      MIN(id) AS ref_id,
      subject,
      COUNT(*) AS count

    FROM lectures

    WHERE semester = ?

    GROUP BY subject

    ORDER BY subject COLLATE NOCASE
  `).all(
    semester
  );

}

// ========================================
// GET SUBJECT
// ========================================

function getSubjectByRef(
  semester,
  refId
) {

  return db.prepare(`
    SELECT subject

    FROM lectures

    WHERE id = ?
      AND semester = ?
  `).get(
    Number(refId),
    semester
  );

}

// ========================================
// SUBJECT KEYBOARD
// ========================================

function subjectKeyboard(
  semester,
  prefix,
  options = {}
) {

  const subjects =
    getSubjects(
      semester
    );

  const semNum =
    semesterNumber(
      semester
    );

  const buttons =
    subjects.map(
      (item) => [

        Markup.button.callback(

          `📚 ${item.subject} — ${item.count}`,

          `${prefix}_${semNum}_${item.ref_id}`

        )

      ]
    );

  if (
    options.allowNew
  ) {

    buttons.push([

      Markup.button.callback(

        "➕ Жаңы предмет",

        `${prefix}_new_${semNum}`

      )

    ]);

  }

  return {

    subjects,

    keyboard:
      Markup.inlineKeyboard(
        buttons
      )

  };

}

// ========================================
// LONG MESSAGE
// ========================================

async function sendLongMessage(
  ctx,
  text
) {

  const maxLength = 4000;

  for (
    let i = 0;
    i < text.length;
    i += maxLength
  ) {

    await ctx.reply(

      text.substring(
        i,
        i + maxLength
      )

    );

  }

}

// ========================================
// RESET USER
// ========================================

function resetUser(
  userId
) {

  users[userId] = {

    step: null,

    lesson: {}

  };

}

// ========================================
// ENSURE USER
// ========================================

function ensureUser(
  userId
) {

  if (
    !users[userId]
  ) {

    resetUser(
      userId
    );

  }

}

// ========================================
// SHOW LESSONS FOR SUBJECT
// ========================================

async function showLessonsForSubject(
  ctx,
  semester,
  subject,
  title = "📚 ЛЕКЦИЯЛАР"
) {

  const lessons =
    db.prepare(`
      SELECT *

      FROM lectures

      WHERE semester = ?
        AND subject = ?

      ORDER BY id DESC
    `).all(
      semester,
      subject
    );

  if (
    lessons.length === 0
  ) {

    return ctx.reply(

      `❌ ${subject} боюнча лекциялар жок.`

    );

  }

  const buttons =
    lessons.map(
      (lesson) => [

        Markup.button.callback(

          `📝 ${lesson.topic} — ${lesson.date}`,

          `lesson_${lesson.id}`

        )

      ]
    );

  return ctx.reply(

    `${title}\n\n` +

    `🎓 Семестр: ${semester}\n` +

    `📚 Предмет: ${subject}\n` +

    `📖 Лекциялар: ${lessons.length}\n\n` +

    "Керектүү лекцияны танда:",

    Markup.inlineKeyboard(
      buttons
    )

  );

}

// ========================================
// START
// ========================================

bot.start(
  (ctx) => {

    const admin =
      isAdmin(ctx);

    resetUser(
      ctx.from.id
    );

    return ctx.reply(

      "👋 Салам!\n\n" +

      "📚 Lecture Archive'ке кош келдиң!\n\n" +

      `🎓 Окуу жылы: ${ACADEMIC_YEAR}\n\n` +

      "Бул жерде лекцияларды сактап жана издей аласың.\n\n" +

      (
        admin
          ? "👨‍💼 Сен администраторсуң."
          : "👤 Сен көрүү режиминдесиң."
      ),

      mainMenu(
        admin
      )

    );

  }
);

// ========================================
// ADD LESSON
// ========================================

bot.hears(
  "➕ Лекция кошуу",

  (ctx) => {

    if (
      !isAdmin(ctx)
    ) {

      return ctx.reply(

        "⛔ Бул функция администратор үчүн гана."

      );

    }

    users[
      ctx.from.id
    ] = {

      step:
        "add_semester",

      lesson: {

        academic_year:
          ACADEMIC_YEAR

      }

    };

    return ctx.reply(

      "➕ ЛЕКЦИЯ КОШУУ\n\n" +

      `🎓 Окуу жылы: ${ACADEMIC_YEAR}\n\n` +

      "1️⃣ Семестрди танда:",

      semesterKeyboard(
        "add_"
      )

    );

  }
);

// ========================================
// ADD SEMESTER
// ========================================

bot.action(

  /^add_semester_(1|2)$/,

  async (ctx) => {

    if (
      !isAdmin(ctx)
    ) {

      return ctx.answerCbQuery(
        "⛔ Уруксат жок."
      );

    }

    const semester =
      semesterFromNumber(
        ctx.match[1]
      );

    const userId =
      ctx.from.id;

    users[userId] = {

      step:
        "add_choose_subject",

      lesson: {

        academic_year:
          ACADEMIC_YEAR,

        semester:
          semester

      }

    };

    await ctx.answerCbQuery();

    const {
      subjects,
      keyboard
    } =
      subjectKeyboard(

        semester,

        "add_subject",

        {
          allowNew: true
        }

      );

    if (
      subjects.length === 0
    ) {

      users[userId].step =
        "add_subject";

      return ctx.reply(

        `🎓 ${semester} тандалды.\n\n` +

        "Бул семестрде азырынча предмет жок.\n\n" +

        "2️⃣ Жаңы предметтин атын жаз.\n\n" +

        "Мисалы: Программалоо"

      );

    }

    return ctx.reply(

      `🎓 ${semester} тандалды.\n\n` +

      "2️⃣ Предметти танда же жаңы предмет кош:",

      keyboard

    );

  }
);

// ========================================
// ADD EXISTING SUBJECT
// ========================================

bot.action(

  /^add_subject_(1|2)_(\d+)$/,

  async (ctx) => {

    if (
      !isAdmin(ctx)
    ) {

      return ctx.answerCbQuery(
        "⛔ Уруксат жок."
      );

    }

    const semester =
      semesterFromNumber(
        ctx.match[1]
      );

    const row =
      getSubjectByRef(

        semester,

        ctx.match[2]

      );

    if (
      !row
    ) {

      return ctx.answerCbQuery(

        "❌ Предмет табылган жок."

      );

    }

    const userId =
      ctx.from.id;

    ensureUser(
      userId
    );

    users[userId].lesson = {

      ...(
        users[userId].lesson ||
        {}
      ),

      academic_year:
        ACADEMIC_YEAR,

      semester:
        semester,

      subject:
        row.subject

    };

    users[userId].step =
      "add_topic";

    await ctx.answerCbQuery();

    return ctx.reply(

      `🎓 Семестр: ${semester}\n` +

      `📚 Предмет: ${row.subject}\n\n` +

      "3️⃣ Лекциянын темасын жаз."

    );

  }
);

// ========================================
// ADD NEW SUBJECT BUTTON
// ========================================

bot.action(

  /^add_subject_new_(1|2)$/,

  async (ctx) => {

    if (
      !isAdmin(ctx)
    ) {

      return ctx.answerCbQuery(
        "⛔ Уруксат жок."
      );

    }

    const semester =
      semesterFromNumber(
        ctx.match[1]
      );

    const userId =
      ctx.from.id;

    ensureUser(
      userId
    );

    users[userId].lesson = {

      ...(
        users[userId].lesson ||
        {}
      ),

      academic_year:
        ACADEMIC_YEAR,

      semester:
        semester

    };

    users[userId].step =
      "add_subject";

    await ctx.answerCbQuery();

    return ctx.reply(

      `🎓 Семестр: ${semester}\n\n` +

      "2️⃣ Жаңы предметтин атын жаз.\n\n" +

      "Мисалы: Физика"

    );

  }
);

// ========================================
// SEARCH LESSON
// ========================================

bot.hears(

  "🔎 Лекция издөө",

  (ctx) => {

    resetUser(
      ctx.from.id
    );

    users[
      ctx.from.id
    ].step =
      "search_semester";

    return ctx.reply(

      "🔎 ЛЕКЦИЯ ИЗДӨӨ\n\n" +

      "🎓 Алгач семестрди танда:",

      semesterKeyboard(
        "search_"
      )

    );

  }
);

// ========================================
// SEARCH SEMESTER
// ========================================

bot.action(

  /^search_semester_(1|2)$/,

  async (ctx) => {

    const semester =
      semesterFromNumber(
        ctx.match[1]
      );

    const userId =
      ctx.from.id;

    users[userId] = {

      step:
        "search_choose_subject",

      lesson: {

        semester:
          semester

      }

    };

    await ctx.answerCbQuery();

    const {
      subjects,
      keyboard
    } =
      subjectKeyboard(

        semester,

        "search_subject"

      );

    if (
      subjects.length === 0
    ) {

      return ctx.reply(

        `❌ ${semester} ичинде предметтер жок.`

      );

    }

    return ctx.reply(

      `🎓 ${semester} тандалды.\n\n` +

      "📚 Эми предметти танда:",

      keyboard

    );

  }
);

// ========================================
// SEARCH SUBJECT
// ========================================

bot.action(

  /^search_subject_(1|2)_(\d+)$/,

  async (ctx) => {

    const semester =
      semesterFromNumber(
        ctx.match[1]
      );

    const row =
      getSubjectByRef(

        semester,

        ctx.match[2]

      );

    if (
      !row
    ) {

      return ctx.answerCbQuery(

        "❌ Предмет табылган жок."

      );

    }

    const userId =
      ctx.from.id;

    users[userId] = {

      step:
        "search_topic",

      lesson: {

        semester:
          semester,

        subject:
          row.subject

      }

    };

    await ctx.answerCbQuery();

    return ctx.reply(

      `🎓 Семестр: ${semester}\n` +

      `📚 Предмет: ${row.subject}\n\n` +

      "📝 Эми лекциянын темасын жаз.\n\n" +

      "Мисалы: React"

    );

  }
);

// ========================================
// DATE SEARCH
// ========================================

bot.hears(

  "📅 Дата боюнча",

  (ctx) => {

    resetUser(
      ctx.from.id
    );

    users[
      ctx.from.id
    ].step =
      "search_date_semester";

    return ctx.reply(

      "📅 ДАТА БОЮНЧА ИЗДӨӨ\n\n" +

      "🎓 Алгач семестрди танда:",

      semesterKeyboard(
        "date_"
      )

    );

  }
);

// ========================================
// DATE SEMESTER
// ========================================

bot.action(

  /^date_semester_(1|2)$/,

  async (ctx) => {

    const semester =
      semesterFromNumber(
        ctx.match[1]
      );

    const userId =
      ctx.from.id;

    users[userId] = {

      step:
        "search_date_choose_subject",

      lesson: {

        semester:
          semester

      }

    };

    await ctx.answerCbQuery();

    const {
      subjects,
      keyboard
    } =
      subjectKeyboard(

        semester,

        "date_subject"

      );

    if (
      subjects.length === 0
    ) {

      return ctx.reply(

        `❌ ${semester} ичинде предметтер жок.`

      );

    }

    return ctx.reply(

      `🎓 ${semester} тандалды.\n\n` +

      "📚 Эми предметти танда:",

      keyboard

    );

  }
);

// ========================================
// DATE SUBJECT
// ========================================

bot.action(

  /^date_subject_(1|2)_(\d+)$/,

  async (ctx) => {

    const semester =
      semesterFromNumber(
        ctx.match[1]
      );

    const row =
      getSubjectByRef(

        semester,

        ctx.match[2]

      );

    if (
      !row
    ) {

      return ctx.answerCbQuery(

        "❌ Предмет табылган жок."

      );

    }

    const userId =
      ctx.from.id;

    users[userId] = {

      step:
        "search_date",

      lesson: {

        semester:
          semester,

        subject:
          row.subject

      }

    };

    await ctx.answerCbQuery();

    return ctx.reply(

      `🎓 Семестр: ${semester}\n` +

      `📚 Предмет: ${row.subject}\n\n` +

      "📅 Эми датаны жаз.\n\n" +

      "Мисалы: 13.08.2026"

    );

  }
);

// ========================================
// SUBJECTS
// ========================================

bot.hears(

  "📖 Сабактар",

  (ctx) => {

    const semesters =
      db.prepare(`
        SELECT
          semester,
          COUNT(*) AS count

        FROM lectures

        GROUP BY semester

        ORDER BY
          CASE
            WHEN semester = '1-семестр' THEN 1
            WHEN semester = '2-семестр' THEN 2
            ELSE 3
          END
      `).all();

    if (
      semesters.length === 0
    ) {

      return ctx.reply(

        "📚 Азырынча лекциялар жок."

      );

    }

    const buttons =
      semesters.map(
        (item) => [

          Markup.button.callback(

            `🎓 ${item.semester} — ${item.count}`,

            `subjects_semester_${semesterNumber(item.semester)}`

          )

        ]
      );

    return ctx.reply(

      "📖 САБАКТАР\n\n" +

      `🎓 Окуу жылы: ${ACADEMIC_YEAR}\n\n` +

      "Семестрди танда:",

      Markup.inlineKeyboard(
        buttons
      )

    );

  }
);

// ========================================
// SUBJECTS SEMESTER
// ========================================

bot.action(

  /^subjects_semester_(1|2)$/,

  async (ctx) => {

    const semester =
      semesterFromNumber(
        ctx.match[1]
      );

    await ctx.answerCbQuery();

    const {
      subjects,
      keyboard
    } =
      subjectKeyboard(

        semester,

        "subjects_open"

      );

    if (
      subjects.length === 0
    ) {

      return ctx.reply(

        `❌ ${semester} ичинде предметтер жок.`

      );

    }

    return ctx.reply(

      `🎓 ${semester}\n\n` +

      "📚 Предметтер:\n\n" +

      "Керектүү предметти танда:",

      keyboard

    );

  }
);

// ========================================
// SUBJECT LESSONS
// ========================================

bot.action(

  /^subjects_open_(1|2)_(\d+)$/,

  async (ctx) => {

    const semester =
      semesterFromNumber(
        ctx.match[1]
      );

    const row =
      getSubjectByRef(

        semester,

        ctx.match[2]

      );

    if (
      !row
    ) {

      return ctx.answerCbQuery(

        "❌ Предмет табылган жок."

      );

    }

    await ctx.answerCbQuery();

    return showLessonsForSubject(

      ctx,

      semester,

      row.subject,

      "📖 САБАКТАР"

    );

  }
);

// ========================================
// ALL LESSONS
// ========================================

bot.hears(

  "📚 Бардык лекциялар",

  (ctx) => {

    const semesters =
      db.prepare(`
        SELECT
          semester,
          COUNT(*) AS count

        FROM lectures

        GROUP BY semester

        ORDER BY
          CASE
            WHEN semester = '1-семестр' THEN 1
            WHEN semester = '2-семестр' THEN 2
            ELSE 3
          END
      `).all();

    if (
      semesters.length === 0
    ) {

      return ctx.reply(

        "📚 Азырынча лекциялар жок."

      );

    }

    const buttons =
      semesters.map(
        (item) => [

          Markup.button.callback(

            `🎓 ${item.semester} — ${item.count}`,

            `all_semester_${semesterNumber(item.semester)}`

          )

        ]
      );

    return ctx.reply(

      "📚 БАРДЫК ЛЕКЦИЯЛАР\n\n" +

      `🎓 Окуу жылы: ${ACADEMIC_YEAR}\n\n` +

      "Семестрди танда:",

      Markup.inlineKeyboard(
        buttons
      )

    );

  }
);

// ========================================
// ALL SEMESTER
// ========================================

bot.action(

  /^all_semester_(1|2)$/,

  async (ctx) => {

    const semester =
      semesterFromNumber(
        ctx.match[1]
      );

    await ctx.answerCbQuery();

    const {
      subjects,
      keyboard
    } =
      subjectKeyboard(

        semester,

        "all_subject"

      );

    if (
      subjects.length === 0
    ) {

      return ctx.reply(

        `📚 ${semester} ичинде предметтер жок.`

      );

    }

    return ctx.reply(

      `🎓 ${semester}\n\n` +

      "📚 Предметти танда:",

      keyboard

    );

  }
);

// ========================================
// ALL SUBJECT LESSONS
// ========================================

bot.action(

  /^all_subject_(1|2)_(\d+)$/,

  async (ctx) => {

    const semester =
      semesterFromNumber(
        ctx.match[1]
      );

    const row =
      getSubjectByRef(

        semester,

        ctx.match[2]

      );

    if (
      !row
    ) {

      return ctx.answerCbQuery(

        "❌ Предмет табылган жок."

      );

    }

    await ctx.answerCbQuery();

    return showLessonsForSubject(

      ctx,

      semester,

      row.subject,

      "📚 БАРДЫК ЛЕКЦИЯЛАР"

    );

  }
);

// ========================================
// STATISTICS
// ========================================

bot.hears(

  "📊 Статистика",

  (ctx) => {

    if (
      !isAdmin(ctx)
    ) {

      return ctx.reply(

        "⛔ Бул функция администратор үчүн гана."

      );

    }

    const total =
      db.prepare(`
        SELECT COUNT(*) AS count
        FROM lectures
      `).get();

    const semesterStats =
      db.prepare(`
        SELECT
          semester,
          COUNT(*) AS count

        FROM lectures

        GROUP BY semester

        ORDER BY
          CASE
            WHEN semester = '1-семестр' THEN 1
            WHEN semester = '2-семестр' THEN 2
            ELSE 3
          END
      `).all();

    const subjectStats =
      db.prepare(`
        SELECT
          semester,
          subject,
          COUNT(*) AS count

        FROM lectures

        GROUP BY
          semester,
          subject

        ORDER BY
          semester,
          count DESC
      `).all();

    let message =

      "📊 СТАТИСТИКА\n\n" +

      `🎓 Окуу жылы: ${ACADEMIC_YEAR}\n\n` +

      `📚 Жалпы лекциялар: ${total.count}\n\n` +

      "🎓 СЕМЕСТРЛЕР:\n\n";

    semesterStats.forEach(
      (item) => {

        message +=

          `• ${item.semester}: ${item.count} лекция\n`;

      }
    );

    message +=

      "\n📖 ПРЕДМЕТТЕР:\n";

    let currentSemester = "";

    subjectStats.forEach(
      (item) => {

        if (
          currentSemester !==
          item.semester
        ) {

          currentSemester =
            item.semester;

          message +=

            `\n🎓 ${item.semester}\n`;

        }

        message +=

          `   • ${item.subject}: ${item.count}\n`;

      }
    );

    return ctx.reply(
      message
    );

  }
);

// ========================================
// TEXT HANDLER
// ========================================

bot.on(

  "text",

  async (ctx) => {

    const userId =
      ctx.from.id;

    const text =
      ctx.message.text.trim();

    const menuButtons = [

      "➕ Лекция кошуу",

      "🔎 Лекция издөө",

      "📚 Бардык лекциялар",

      "📅 Дата боюнча",

      "📖 Сабактар",

      "📊 Статистика"

    ];

    if (
      menuButtons.includes(
        text
      )
    ) {

      return;

    }

    if (
      !users[userId]
    ) {

      return ctx.reply(

        "⚠️ Алгач /start бас."

      );

    }

    const state =
      users[userId];

    // ====================================
    // ADD NEW SUBJECT
    // ====================================

    if (
      state.step ===
      "add_subject"
    ) {

      if (
        !isAdmin(ctx)
      ) {

        return ctx.reply(

          "⛔ Уруксат жок."

        );

      }

      state.lesson.subject =
        text;

      state.step =
        "add_topic";

      return ctx.reply(

        `🎓 Семестр: ${state.lesson.semester}\n` +

        `📚 Предмет: ${text}\n\n` +

        "3️⃣ Лекциянын темасын жаз."

      );

    }

    // ====================================
    // ADD TOPIC
    // ====================================

    if (
      state.step ===
      "add_topic"
    ) {

      if (
        !isAdmin(ctx)
      ) {

        return ctx.reply(

          "⛔ Уруксат жок."

        );

      }

      state.lesson.topic =
        text;

      state.step =
        "add_date";

      return ctx.reply(

        `📚 Предмет: ${state.lesson.subject}\n` +

        `📝 Тема: ${text}\n\n` +

        "4️⃣ Лекциянын датасын жаз.\n\n" +

        "Мисалы: 13.08.2026"

      );

    }

    // ====================================
    // ADD DATE
    // ====================================

    if (
      state.step ===
      "add_date"
    ) {

      if (
        !isAdmin(ctx)
      ) {

        return ctx.reply(

          "⛔ Уруксат жок."

        );

      }

      state.lesson.date =
        text;

      state.step =
        "add_content";

      return ctx.reply(

        `📅 Дата: ${text}\n\n` +

        "5️⃣ Эми лекциянын текстин жаз.\n\n" +

        "Же каалаган файлды жөнөт:\n\n" +

        "📄 PDF\n" +

        "📘 DOC / DOCX\n" +

        "📊 PPT / PPTX\n" +

        "📈 XLS / XLSX\n" +

        "📝 TXT / CSV\n" +

        "🗜️ ZIP / RAR\n" +

        "🖼️ Сүрөт\n" +

        "🎥 Видео\n" +

        "🎵 Аудио\n" +

        "📎 жана Telegram документ катары кабыл алган башка файлдар."

      );

    }

    // ====================================
    // ADD TEXT CONTENT
    // ====================================

    if (
      state.step ===
      "add_content"
    ) {

      if (
        !isAdmin(ctx)
      ) {

        return ctx.reply(

          "⛔ Уруксат жок."

        );

      }

      const lesson =
        state.lesson;

      db.prepare(`
        INSERT INTO lectures
        (
          academic_year,
          semester,
          subject,
          topic,
          date,
          content,
          file_id,
          file_type,
          file_name
        )

        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(

        lesson.academic_year ||
          ACADEMIC_YEAR,

        lesson.semester,

        lesson.subject,

        lesson.topic,

        lesson.date,

        text,

        null,

        null,

        null

      );

      resetUser(
        userId
      );

      return ctx.reply(

        "🎉 ЛЕКЦИЯ САКТАЛДЫ!\n\n" +

        `🎓 Семестр: ${lesson.semester}\n` +

        `📚 Предмет: ${lesson.subject}\n` +

        `📝 Тема: ${lesson.topic}\n` +

        `📅 Дата: ${lesson.date}\n\n` +

        "💾 Базага сакталды!",

        mainMenu(
          true
        )

      );

    }

    // ====================================
    // SEARCH TOPIC
    // ====================================

    if (
      state.step ===
      "search_topic"
    ) {

      const {
        semester,
        subject
      } =
        state.lesson;

      const topic =
        text;

      const results =
        db.prepare(`
          SELECT *

          FROM lectures

          WHERE semester = ?
            AND subject = ?
            AND topic LIKE ?

          ORDER BY id DESC
        `).all(

          semester,

          subject,

          `%${topic}%`

        );

      resetUser(
        userId
      );

      if (
        results.length === 0
      ) {

        return ctx.reply(

          "❌ Лекция табылган жок.\n\n" +

          `🎓 Семестр: ${semester}\n` +

          `📚 Предмет: ${subject}\n` +

          `📝 Тема: ${topic}`

        );

      }

      const buttons =
        results.map(
          (lesson) => [

            Markup.button.callback(

              `📝 ${lesson.topic} — ${lesson.date}`,

              `lesson_${lesson.id}`

            )

          ]
        );

      return ctx.reply(

        "🔎 ИЗДӨӨ ЖЫЙЫНТЫГЫ\n\n" +

        `🎓 Семестр: ${semester}\n` +

        `📚 Предмет: ${subject}\n` +

        `📝 Тема: ${topic}\n\n` +

        `📚 Табылды: ${results.length}\n\n` +

        "Керектүү лекцияны танда:",

        Markup.inlineKeyboard(
          buttons
        )

      );

    }

    // ====================================
    // SEARCH DATE
    // ====================================

    if (
      state.step ===
      "search_date"
    ) {

      const {
        semester,
        subject
      } =
        state.lesson;

      const date =
        text;

      const results =
        db.prepare(`
          SELECT *

          FROM lectures

          WHERE semester = ?
            AND subject = ?
            AND date LIKE ?

          ORDER BY id DESC
        `).all(

          semester,

          subject,

          `%${date}%`

        );

      resetUser(
        userId
      );

      if (
        results.length === 0
      ) {

        return ctx.reply(

          "❌ Лекция табылган жок.\n\n" +

          `🎓 Семестр: ${semester}\n` +

          `📚 Предмет: ${subject}\n` +

          `📅 Дата: ${date}`

        );

      }

      const buttons =
        results.map(
          (lesson) => [

            Markup.button.callback(

              `📝 ${lesson.topic} — ${lesson.date}`,

              `lesson_${lesson.id}`

            )

          ]
        );

      return ctx.reply(

        "📅 ИЗДӨӨ ЖЫЙЫНТЫГЫ\n\n" +

        `🎓 Семестр: ${semester}\n` +

        `📚 Предмет: ${subject}\n` +

        `📅 Дата: ${date}\n\n` +

        `📚 Табылды: ${results.length}\n\n` +

        "Керектүү лекцияны танда:",

        Markup.inlineKeyboard(
          buttons
        )

      );

    }

    // ====================================
    // EDIT TOPIC
    // ====================================

    if (
      state.step ===
      "edit_topic"
    ) {

      if (
        !isAdmin(ctx)
      ) {

        return ctx.reply(

          "⛔ Уруксат жок."

        );

      }

      state.lesson.topic =
        text;

      state.step =
        "edit_content";

      return ctx.reply(

        `✅ Жаңы тема: ${text}\n\n` +

        "Эми жаңы лекциянын текстин жаз."

      );

    }

    // ====================================
    // EDIT CONTENT
    // ====================================

    if (
      state.step ===
      "edit_content"
    ) {

      if (
        !isAdmin(ctx)
      ) {

        return ctx.reply(

          "⛔ Уруксат жок."

        );

      }

      const lessonId =
        state.editId;

      const newTopic =
        state.lesson.topic;

      db.prepare(`
        UPDATE lectures

        SET
          topic = ?,
          content = ?,
          file_id = NULL,
          file_type = NULL,
          file_name = NULL

        WHERE id = ?
      `).run(

        newTopic,

        text,

        lessonId

      );

      resetUser(
        userId
      );

      return ctx.reply(

        "✅ Лекция ийгиликтүү өзгөртүлдү!",

        mainMenu(
          true
        )

      );

    }

    return ctx.reply(

      "📚 Менюдан керектүү бөлүмдү танда."

    );

  }
);

// ========================================
// FILE HANDLER
// ALL DOCUMENT TYPES
// ========================================

bot.on(

  "message",

  async (ctx) => {

    const userId =
      ctx.from?.id;

    if (
      !userId ||
      !users[userId]
    ) {

      return;

    }

    if (
      !isAdmin(ctx)
    ) {

      return;

    }

    if (
      users[userId].step !==
      "add_content"
    ) {

      return;

    }

    const message =
      ctx.message;

    let fileId =
      null;

    let fileType =
      null;

    let fileName =
      null;

    // ====================================
    // PHOTO
    // ====================================

    if (
      message.photo
    ) {

      fileId =
        message.photo[
          message.photo.length - 1
        ].file_id;

      fileType =
        "photo";

      fileName =
        "photo.jpg";

    }

    // ====================================
    // ALL DOCUMENTS
    // PDF / DOC / DOCX / PPT / PPTX
    // XLS / XLSX / TXT / ZIP / RAR etc.
    // ====================================

    else if (
      message.document
    ) {

      const document =
        message.document;

      fileId =
        document.file_id;

      fileType =
        "document";

      fileName =
        document.file_name ||
        "document";

      console.log(

        "📎 Документ кабыл алынды:",

        fileName,

        document.mime_type ||
          "unknown"

      );

    }

    // ====================================
    // VIDEO
    // ====================================

    else if (
      message.video
    ) {

      fileId =
        message.video.file_id;

      fileType =
        "video";

      fileName =
        message.video.file_name ||
        "video.mp4";

    }

    // ====================================
    // AUDIO
    // ====================================

    else if (
      message.audio
    ) {

      fileId =
        message.audio.file_id;

      fileType =
        "audio";

      fileName =
        message.audio.file_name ||
        "audio";

    }

    // ====================================
    // VOICE
    // ====================================

    else if (
      message.voice
    ) {

      fileId =
        message.voice.file_id;

      fileType =
        "voice";

      fileName =
        "voice.ogg";

    }

    // ====================================
    // GIF / ANIMATION
    // ====================================

    else if (
      message.animation
    ) {

      fileId =
        message.animation.file_id;

      fileType =
        "animation";

      fileName =
        message.animation.file_name ||
        "animation.gif";

    }

    // ====================================
    // NO FILE
    // ====================================

    if (
      !fileId
    ) {

      return;

    }

    const lesson =
      users[userId].lesson;

    // ====================================
    // SAVE FILE TO DATABASE
    // ====================================

    db.prepare(`
      INSERT INTO lectures
      (
        academic_year,
        semester,
        subject,
        topic,
        date,
        content,
        file_id,
        file_type,
        file_name
      )

      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(

      lesson.academic_year ||
        ACADEMIC_YEAR,

      lesson.semester,

      lesson.subject,

      lesson.topic,

      lesson.date,

      "",

      fileId,

      fileType,

      fileName

    );

    resetUser(
      userId
    );

    return ctx.reply(

      "🎉 ЛЕКЦИЯ САКТАЛДЫ!\n\n" +

      `🎓 Семестр: ${lesson.semester}\n` +

      `📚 Предмет: ${lesson.subject}\n` +

      `📝 Тема: ${lesson.topic}\n` +

      `📅 Дата: ${lesson.date}\n` +

      `📎 Файл: ${fileName}\n\n` +

      "💾 Базага сакталды!",

      mainMenu(
        true
      )

    );

  }
);

// ========================================
// OPEN LESSON
// ========================================

bot.action(

  /^lesson_(\d+)$/,

  async (ctx) => {

    const lessonId =
      Number(
        ctx.match[1]
      );

    const lesson =
      db.prepare(`
        SELECT *

        FROM lectures

        WHERE id = ?
      `).get(
        lessonId
      );

    if (
      !lesson
    ) {

      return ctx.answerCbQuery(

        "❌ Лекция табылган жок."

      );

    }

    await ctx.answerCbQuery();

    let message =

      "📚 ЛЕКЦИЯ\n\n" +

      `🎓 Окуу жылы: ${lesson.academic_year}\n` +

      `🎓 Семестр: ${lesson.semester}\n` +

      `📚 Предмет: ${lesson.subject}\n` +

      `📝 Тема: ${lesson.topic}\n` +

      `📅 Дата: ${lesson.date}\n\n` +

      "━━━━━━━━━━━━━━\n\n";

    if (
      lesson.content
    ) {

      message +=
        lesson.content;

    }

    const adminButtons =
      Markup.inlineKeyboard([

        [

          Markup.button.callback(

            "✏️ Өзгөртүү",

            `edit_${lesson.id}`

          ),

          Markup.button.callback(

            "🗑️ Өчүрүү",

            `delete_${lesson.id}`

          )

        ]

      ]);

    // ====================================
    // SEND TEXT
    // ====================================

    if (
      message.length <= 4000
    ) {

      await ctx.reply(

        message,

        isAdmin(ctx)
          ? adminButtons
          : undefined

      );

    } else {

      await sendLongMessage(

        ctx,

        message

      );

      if (
        isAdmin(ctx)
      ) {

        await ctx.reply(

          "⚙️ Башкаруу:",

          adminButtons

        );

      }

    }

    // ====================================
    // SEND FILE
    // ====================================

    if (
      lesson.file_id
    ) {

      try {

        // PHOTO
        if (
          lesson.file_type ===
          "photo"
        ) {

          await ctx.replyWithPhoto(

            lesson.file_id,

            {

              caption:

                `📎 ${lesson.file_name || "Фото"}`

            }

          );

        }

        // VIDEO
        else if (
          lesson.file_type ===
          "video"
        ) {

          await ctx.replyWithVideo(

            lesson.file_id,

            {

              caption:

                `🎥 ${lesson.file_name || "Видео"}`

            }

          );

        }

        // AUDIO
        else if (
          lesson.file_type ===
          "audio"
        ) {

          await ctx.replyWithAudio(

            lesson.file_id,

            {

              caption:

                `🎵 ${lesson.file_name || "Аудио"}`

            }

          );

        }

        // VOICE
        else if (
          lesson.file_type ===
          "voice"
        ) {

          await ctx.replyWithVoice(

            lesson.file_id

          );

        }

        // GIF
        else if (
          lesson.file_type ===
          "animation"
        ) {

          await ctx.replyWithAnimation(

            lesson.file_id,

            {

              caption:

                `📎 ${lesson.file_name || "GIF"}`

            }

          );

        }

        // ALL DOCUMENTS
        else {

          await ctx.replyWithDocument(

            lesson.file_id,

            {

              caption:

                `📎 ${lesson.file_name || "Файл"}`

            }

          );

        }

      } catch (error) {

        console.log(

          "⚠️ Файл жөнөтүүдө ката:",

          error.message

        );

        await ctx.reply(

          "❌ Файлды ачууда ката кетти."

        ).catch(
          () => {}
        );

      }

    }

  }
);

// ========================================
// DELETE LESSON
// ========================================

bot.action(

  /^delete_(\d+)$/,

  async (ctx) => {

    if (
      !isAdmin(ctx)
    ) {

      return ctx.answerCbQuery(

        "⛔ Уруксат жок."

      );

    }

    const lessonId =
      Number(
        ctx.match[1]
      );

    const lesson =
      db.prepare(`
        SELECT *

        FROM lectures

        WHERE id = ?
      `).get(
        lessonId
      );

    if (
      !lesson
    ) {

      return ctx.answerCbQuery(

        "❌ Лекция табылган жок."

      );

    }

    await ctx.answerCbQuery();

    return ctx.reply(

      "⚠️ Чын эле өчүрөсүңбү?\n\n" +

      `🎓 ${lesson.semester}\n` +

      `📚 ${lesson.subject}\n` +

      `📝 ${lesson.topic}\n` +

      `📅 ${lesson.date}`,

      Markup.inlineKeyboard([

        [

          Markup.button.callback(

            "✅ Ооба, өчүр",

            `confirm_delete_${lesson.id}`

          ),

          Markup.button.callback(

            "❌ Жок",

            "cancel_delete"

          )

        ]

      ])

    );

  }
);

// ========================================
// CONFIRM DELETE
// ========================================

bot.action(

  /^confirm_delete_(\d+)$/,

  async (ctx) => {

    if (
      !isAdmin(ctx)
    ) {

      return ctx.answerCbQuery(

        "⛔ Уруксат жок."

      );

    }

    const lessonId =
      Number(
        ctx.match[1]
      );

    db.prepare(`
      DELETE FROM lectures

      WHERE id = ?
    `).run(
      lessonId
    );

    await ctx.answerCbQuery(

      "🗑️ Өчүрүлдү!"

    );

    return ctx.reply(

      "✅ Лекция ийгиликтүү өчүрүлдү."

    );

  }
);

// ========================================
// CANCEL DELETE
// ========================================

bot.action(

  "cancel_delete",

  async (ctx) => {

    await ctx.answerCbQuery(

      "Өчүрүү токтотулду."

    );

    return ctx.reply(

      "↩️ Лекция өчүрүлгөн жок."

    );

  }
);

// ========================================
// EDIT LESSON
// ========================================

bot.action(

  /^edit_(\d+)$/,

  async (ctx) => {

    if (
      !isAdmin(ctx)
    ) {

      return ctx.answerCbQuery(

        "⛔ Уруксат жок."

      );

    }

    const lessonId =
      Number(
        ctx.match[1]
      );

    const lesson =
      db.prepare(`
        SELECT *

        FROM lectures

        WHERE id = ?
      `).get(
        lessonId
      );

    if (
      !lesson
    ) {

      return ctx.answerCbQuery(

        "❌ Лекция табылган жок."

      );

    }

    users[
      ctx.from.id
    ] = {

      step:
        "edit_topic",

      editId:
        lessonId,

      lesson: {}

    };

    await ctx.answerCbQuery();

    return ctx.reply(

      "✏️ ЛЕКЦИЯНЫ ӨЗГӨРТҮҮ\n\n" +

      `🎓 Семестр: ${lesson.semester}\n` +

      `📚 Предмет: ${lesson.subject}\n` +

      `📝 Азыркы тема: ${lesson.topic}\n\n` +

      "Жаңы теманы жаз."

    );

  }
);

// ========================================
// ERROR HANDLER
// ========================================

bot.catch(

  (error, ctx) => {

    console.error(

      "BOT ERROR:",

      error

    );

    ctx.reply(

      "❌ Ката кетти.\n\n" +

      "Терминалды текшер."

    ).catch(
      () => {}
    );

  }
);

// ========================================
// LAUNCH
// ========================================

bot.launch();

console.log(
  "🤖 Telegram бот иштеп жатат..."
);

// ========================================
// STOP
// ========================================

process.once(

  "SIGINT",

  () =>
    bot.stop(
      "SIGINT"
    )

);

process.once(

  "SIGTERM",

  () =>
    bot.stop(
      "SIGTERM"
    )

);