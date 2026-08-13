require("dotenv").config();

const { Telegraf, Markup } = require("telegraf");
const Database = require("better-sqlite3");

// ========================================
// CONFIG
// ========================================

const bot = new Telegraf(process.env.BOT_TOKEN);

const ADMIN_ID = Number(process.env.ADMIN_ID);

const db = new Database("lectures.db");

// ========================================
// DATABASE
// ========================================

db.prepare(`
  CREATE TABLE IF NOT EXISTS lectures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    topic TEXT NOT NULL,
    date TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

console.log("📚 Database даяр!");

// ========================================
// USERS
// ========================================

const users = {};

// ========================================
// ADMIN CHECK
// ========================================

function isAdmin(ctx) {
  return ctx.from && ctx.from.id === ADMIN_ID;
}

// ========================================
// LONG MESSAGE SPLITTER
// Telegram limit ≈ 4096
// ========================================

async function sendLongMessage(ctx, text) {
  const maxLength = 4000;

  for (let i = 0; i < text.length; i += maxLength) {
    await ctx.reply(text.substring(i, i + maxLength));
  }
}

// ========================================
// MAIN MENU
// ========================================

function mainMenu(isAdminUser = false) {

  if (isAdminUser) {

    return Markup.keyboard([
      ["➕ Лекция кошуу"],
      ["🔎 Лекция издөө", "📚 Бардык лекциялар"],
      ["📅 Дата боюнча", "📖 Сабактар"],
      ["📊 Статистика"],
    ]).resize();

  }

  return Markup.keyboard([
    ["🔎 Лекция издөө"],
    ["📚 Бардык лекциялар"],
    ["📅 Дата боюнча", "📖 Сабактар"],
  ]).resize();
}

// ========================================
// START
// ========================================

bot.start((ctx) => {

  const admin = isAdmin(ctx);

  users[ctx.from.id] = {
    step: null,
    lesson: {},
  };

  ctx.reply(
    "👋 Салам!\n\n" +
    "📚 Lecture Archive'ке кош келдиң!\n\n" +
    "Бул жерде лекцияларды тез сактап жана издей аласың.\n\n" +
    (admin
      ? "👨‍💼 Сен администраторсуң."
      : "👤 Сен көрүү режиминдесиң."),
    
    mainMenu(admin)
  );
});

// ========================================
// ADD LESSON
// ADMIN ONLY
// ========================================

bot.hears("➕ Лекция кошуу", (ctx) => {

  if (!isAdmin(ctx)) {
    return ctx.reply(
      "⛔ Бул функция администратор үчүн гана."
    );
  }

  users[ctx.from.id] = {
    step: "subject",
    lesson: {},
  };

  ctx.reply(
    "➕ Лекция кошуу\n\n" +
    "1️⃣ Сабактын атын жаз.\n\n" +
    "Мисалы:\n" +
    "Программалоо"
  );
});

// ========================================
// SEARCH
// ========================================

bot.hears("🔎 Лекция издөө", (ctx) => {

  users[ctx.from.id] = {
    step: "search",
    lesson: {},
  };

  ctx.reply(
    "🔎 Лекция издөө\n\n" +
    "Тема, сабак же каалаган сөздү жаз.\n\n" +
    "Мисалы:\n" +
    "React"
  );
});

// ========================================
// SEARCH BY DATE
// ========================================

bot.hears("📅 Дата боюнча", (ctx) => {

  users[ctx.from.id] = {
    step: "search_date",
    lesson: {},
  };

  ctx.reply(
    "📅 Дата боюнча издөө\n\n" +
    "Датаны төмөнкү форматта жаз:\n\n" +
    "13.08.2026"
  );
});

// ========================================
// SUBJECT LIST
// ========================================

bot.hears("📖 Сабактар", (ctx) => {

  const subjects = db.prepare(`
    SELECT subject, COUNT(*) as count
    FROM lectures
    GROUP BY subject
    ORDER BY subject
  `).all();

  if (subjects.length === 0) {
    return ctx.reply(
      "📚 Азырынча лекциялар жок."
    );
  }

  let message = "📖 Сабактар:\n\n";

  subjects.forEach((item, index) => {

    message +=
      `${index + 1}. ${item.subject} — ${item.count} лекция\n`;
  });

  ctx.reply(message);
});

// ========================================
// ALL LESSONS
// ========================================

bot.hears("📚 Бардык лекциялар", (ctx) => {

  const lessons = db.prepare(`
    SELECT *
    FROM lectures
    ORDER BY id DESC
  `).all();

  if (lessons.length === 0) {
    return ctx.reply(
      "📚 Азырынча лекциялар жок."
    );
  }

  const buttons = lessons.map((lesson) => [

    Markup.button.callback(
      `📚 ${lesson.topic} — ${lesson.date}`,
      `lesson_${lesson.id}`
    )

  ]);

  return ctx.reply(
    `📚 Бардык лекциялар: ${lessons.length}\n\n` +
    "Керектүү лекцияны танда:",
    
    Markup.inlineKeyboard(buttons)
  );
});

// ========================================
// STATISTICS
// ADMIN ONLY
// ========================================

bot.hears("📊 Статистика", (ctx) => {

  if (!isAdmin(ctx)) {
    return ctx.reply(
      "⛔ Бул функция администратор үчүн гана."
    );
  }

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM lectures
  `).get();

  const subjects = db.prepare(`
    SELECT subject, COUNT(*) as count
    FROM lectures
    GROUP BY subject
    ORDER BY count DESC
  `).all();

  let message =
    "📊 СТАТИСТИКА\n\n" +
    `📚 Жалпы лекциялар: ${total.count}\n\n` +
    "📖 Сабактар боюнча:\n\n";

  if (subjects.length === 0) {

    message += "Азырынча маалымат жок.";

  } else {

    subjects.forEach((item, index) => {

      message +=
        `${index + 1}. ${item.subject}: ${item.count}\n`;
    });
  }

  ctx.reply(message);
});

// ========================================
// TEXT HANDLER
// ========================================

bot.on("text", async (ctx) => {

  const userId = ctx.from.id;
  const text = ctx.message.text;

  // Menu buttons
  if (
    text === "➕ Лекция кошуу" ||
    text === "🔎 Лекция издөө" ||
    text === "📚 Бардык лекциялар" ||
    text === "📅 Дата боюнча" ||
    text === "📖 Сабактар" ||
    text === "📊 Статистика"
  ) {
    return;
  }

  // User not initialized
  if (!users[userId]) {

    return ctx.reply(
      "⚠️ Алгач /start бас."
    );
  }

  // ========================================
  // ADD: SUBJECT
  // ========================================

  if (users[userId].step === "subject") {

    if (!isAdmin(ctx)) {
      return ctx.reply(
        "⛔ Сага лекция кошууга уруксат жок."
      );
    }

    users[userId].lesson.subject = text;
    users[userId].step = "topic";

    return ctx.reply(
      `✅ Сабак: ${text}\n\n` +
      "2️⃣ Лекциянын темасын жаз."
    );
  }

  // ========================================
  // ADD: TOPIC
  // ========================================

  if (users[userId].step === "topic") {

    users[userId].lesson.topic = text;
    users[userId].step = "date";

    return ctx.reply(
      `✅ Тема: ${text}\n\n` +
      "3️⃣ Лекциянын датасын жаз.\n\n" +
      "Мисалы:\n" +
      "13.08.2026"
    );
  }

  // ========================================
  // ADD: DATE
  // ========================================

  if (users[userId].step === "date") {

    users[userId].lesson.date = text;
    users[userId].step = "content";

    return ctx.reply(
      `✅ Дата: ${text}\n\n` +
      "4️⃣ Эми лекциянын толук текстин жаз."
    );
  }

  // ========================================
  // ADD: CONTENT
  // ========================================

  if (users[userId].step === "content") {

    if (!isAdmin(ctx)) {
      return ctx.reply(
        "⛔ Уруксат жок."
      );
    }

    users[userId].lesson.content = text;

    const lesson = users[userId].lesson;

    db.prepare(`
      INSERT INTO lectures
      (subject, topic, date, content)
      VALUES (?, ?, ?, ?)
    `).run(
      lesson.subject,
      lesson.topic,
      lesson.date,
      lesson.content
    );

    users[userId].step = null;
    users[userId].lesson = {};

    return ctx.reply(
      "🎉 Лекция ийгиликтүү сакталды!\n\n" +
      `📚 Сабак: ${lesson.subject}\n` +
      `📝 Тема: ${lesson.topic}\n` +
      `📅 Дата: ${lesson.date}\n\n` +
      "💾 Базага сакталды!",
      mainMenu(true)
    );
  }

  // ========================================
  // SEARCH
  // ========================================

  if (users[userId].step === "search") {

    const results = db.prepare(`
      SELECT *
      FROM lectures
      WHERE subject LIKE ?
         OR topic LIKE ?
         OR content LIKE ?
      ORDER BY id DESC
    `).all(
      `%${text}%`,
      `%${text}%`,
      `%${text}%`
    );

    users[userId].step = null;

    if (results.length === 0) {

      return ctx.reply(
        `❌ "${text}" боюнча лекция табылган жок.`
      );
    }

    const buttons = results.map((lesson) => [

      Markup.button.callback(
        `📚 ${lesson.topic} — ${lesson.date}`,
        `lesson_${lesson.id}`
      )

    ]);

    return ctx.reply(
      `🔎 "${text}" боюнча ${results.length} лекция табылды.\n\n` +
      "Танда:",
      
      Markup.inlineKeyboard(buttons)
    );
  }

  // ========================================
  // SEARCH BY DATE
  // ========================================

  if (users[userId].step === "search_date") {

    const results = db.prepare(`
      SELECT *
      FROM lectures
      WHERE date LIKE ?
      ORDER BY id DESC
    `).all(`%${text}%`);

    users[userId].step = null;

    if (results.length === 0) {

      return ctx.reply(
        `❌ ${text} датасында лекция табылган жок.`
      );
    }

    const buttons = results.map((lesson) => [

      Markup.button.callback(
        `📚 ${lesson.topic}`,
        `lesson_${lesson.id}`
      )

    ]);

    return ctx.reply(
      `📅 ${text} боюнча ${results.length} лекция:\n\n` +
      "Танда:",
      
      Markup.inlineKeyboard(buttons)
    );
  }

  // ========================================
  // DEFAULT
  // ========================================

  return ctx.reply(
    "📚 Менюдан керектүү бөлүмдү танда."
  );
});

// ========================================
// OPEN LESSON
// ========================================

bot.action(/^lesson_(\d+)$/, async (ctx) => {

  const lessonId = Number(ctx.match[1]);

  const lesson = db.prepare(`
    SELECT *
    FROM lectures
    WHERE id = ?
  `).get(lessonId);

  if (!lesson) {

    return ctx.answerCbQuery(
      "❌ Лекция табылган жок."
    );
  }

  await ctx.answerCbQuery();

  let message =
    "📚 ЛЕКЦИЯ\n\n" +

    `📖 Сабак: ${lesson.subject}\n` +
    `📝 Тема: ${lesson.topic}\n` +
    `📅 Дата: ${lesson.date}\n\n` +

    "━━━━━━━━━━━━━━\n\n" +

    `📄 ${lesson.content}`;

  // Admin controls
  if (isAdmin(ctx)) {

    const buttons = Markup.inlineKeyboard([
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

    if (message.length <= 4000) {

      return ctx.reply(message, buttons);

    }

    await sendLongMessage(ctx, message);

    return ctx.reply(
      "⚙️ Башкаруу:",
      buttons
    );
  }

  await sendLongMessage(ctx, message);
});

// ========================================
// DELETE CONFIRMATION
// ========================================

bot.action(/^delete_(\d+)$/, async (ctx) => {

  if (!isAdmin(ctx)) {

    return ctx.answerCbQuery(
      "⛔ Уруксат жок."
    );
  }

  const lessonId = Number(ctx.match[1]);

  const lesson = db.prepare(`
    SELECT *
    FROM lectures
    WHERE id = ?
  `).get(lessonId);

  if (!lesson) {

    return ctx.answerCbQuery(
      "❌ Лекция табылган жок."
    );
  }

  await ctx.answerCbQuery();

  return ctx.reply(
    `⚠️ Чын эле өчүрөсүңбү?\n\n` +
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
});

// ========================================
// CONFIRM DELETE
// ========================================

bot.action(/^confirm_delete_(\d+)$/, async (ctx) => {

  if (!isAdmin(ctx)) {

    return ctx.answerCbQuery(
      "⛔ Уруксат жок."
    );
  }

  const lessonId = Number(ctx.match[1]);

  db.prepare(`
    DELETE FROM lectures
    WHERE id = ?
  `).run(lessonId);

  await ctx.answerCbQuery(
    "🗑️ Өчүрүлдү!"
  );

  return ctx.reply(
    "✅ Лекция ийгиликтүү өчүрүлдү."
  );
});

// ========================================
// CANCEL DELETE
// ========================================

bot.action("cancel_delete", async (ctx) => {

  await ctx.answerCbQuery(
    "Өчүрүү токтотулду."
  );

  return ctx.reply(
    "↩️ Лекция өчүрүлгөн жок."
  );
});

// ========================================
// EDIT LESSON
// ========================================

bot.action(/^edit_(\d+)$/, (ctx) => {

  if (!isAdmin(ctx)) {

    return ctx.answerCbQuery(
      "⛔ Уруксат жок."
    );
  }

  const lessonId = Number(ctx.match[1]);

  const lesson = db.prepare(`
    SELECT *
    FROM lectures
    WHERE id = ?
  `).get(lessonId);

  if (!lesson) {

    return ctx.answerCbQuery(
      "❌ Лекция табылган жок."
    );
  }

  users[ctx.from.id] = {
    step: "edit_topic",
    editId: lessonId,
    lesson: {}
  };

  ctx.answerCbQuery();

  return ctx.reply(
    "✏️ Лекцияны өзгөртүү\n\n" +
    `Азыркы тема: ${lesson.topic}\n\n` +
    "Жаңы теманы жаз."
  );
});

// ========================================
// EDIT TOPIC
// ========================================

bot.on("text", (ctx, next) => {

  const userId = ctx.from.id;
  const text = ctx.message.text;

  if (
    users[userId] &&
    users[userId].step === "edit_topic"
  ) {

    if (!isAdmin(ctx)) {
      return ctx.reply("⛔ Уруксат жок.");
    }

    users[userId].lesson.topic = text;
    users[userId].step = "edit_content";

    return ctx.reply(
      `✅ Жаңы тема: ${text}\n\n` +
      "Эми жаңы лекциянын текстин жаз."
    );
  }

  return next();
});

// ========================================
// EDIT CONTENT
// ========================================

bot.on("text", (ctx, next) => {

  const userId = ctx.from.id;
  const text = ctx.message.text;

  if (
    users[userId] &&
    users[userId].step === "edit_content"
  ) {

    if (!isAdmin(ctx)) {
      return ctx.reply("⛔ Уруксат жок.");
    }

    const lessonId = users[userId].editId;
    const topic = users[userId].lesson.topic;

    db.prepare(`
      UPDATE lectures
      SET topic = ?, content = ?
      WHERE id = ?
    `).run(
      topic,
      text,
      lessonId
    );

    users[userId] = {
      step: null,
      lesson: {}
    };

    return ctx.reply(
      "✅ Лекция ийгиликтүү өзгөртүлдү!"
    );
  }

  return next();
});

// ========================================
// ERROR HANDLER
// ========================================

bot.catch((error, ctx) => {

  console.error("BOT ERROR:", error);

  ctx.reply(
    "❌ Ката кетти. Терминалды текшер."
  );
});

// ========================================
// LAUNCH
// ========================================

bot.launch();

console.log("🤖 Telegram бот иштеп жатат...");

// Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));