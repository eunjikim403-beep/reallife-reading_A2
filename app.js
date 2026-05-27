const readings = window.READING_DATA || [];

const els = {
  menuPage: document.querySelector("#menuPage"),
  studyPage: document.querySelector("#studyPage"),
  search: document.querySelector("#searchInput"),
  list: document.querySelector("#readingList"),
  menu: document.querySelector("#menuButton"),
  prev: document.querySelector("#prevReading"),
  next: document.querySelector("#nextReading"),
  title: document.querySelector("#readingTitle"),
  passage: document.querySelector("#passageContainer"),
  questions: document.querySelector("#questionContainer"),
  summary: document.querySelector("#summaryNote"),
  vocab: document.querySelector("#vocabNote"),
  timer: document.querySelector("#readingTimer"),
  resetTimer: document.querySelector("#resetTimer"),
};

let currentId = "";
let timerId = null;

function getStore() {
  return JSON.parse(localStorage.getItem("toefl-reallife-a2") || "{}");
}

function setStore(store) {
  localStorage.setItem("toefl-reallife-a2", JSON.stringify(store));
}

function getReading() {
  return readings.find((reading) => reading.id === currentId);
}

function getWork(readingId) {
  const store = getStore();
  if (!store[readingId]) {
    store[readingId] = { answers: {}, summary: "", vocab: "", timeRemaining: null, timeLimit: null, timedOut: false };
    setStore(store);
  }
  store[readingId].answers = store[readingId].answers || {};
  store[readingId].summary = store[readingId].summary || "";
  store[readingId].vocab = store[readingId].vocab || "";
  return store[readingId];
}

function saveWork(readingId, updater) {
  const store = getStore();
  store[readingId] = store[readingId] || { answers: {}, summary: "", vocab: "", timeRemaining: null, timeLimit: null, timedOut: false };
  updater(store[readingId]);
  setStore(store);
}

function timeLimitFor(reading) {
  return Math.max(1, reading.questions.length || 0) * 60;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const rest = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

function setTimerView(work) {
  els.timer.textContent = formatTime(work.timeRemaining ?? 0);
  els.timer.classList.toggle("urgent", (work.timeRemaining ?? 0) <= 30 && !work.timedOut);
  els.timer.classList.toggle("done", Boolean(work.timedOut));
  els.resetTimer.disabled = !currentId;
}

function prepareTimer(reading, work) {
  const limit = timeLimitFor(reading);
  if (work.timeLimit !== limit || typeof work.timeRemaining !== "number") {
    saveWork(reading.id, (draft) => {
      draft.timeLimit = limit;
      draft.timeRemaining = limit;
      draft.timedOut = false;
    });
    return getWork(reading.id);
  }
  return work;
}

function startTimer() {
  stopTimer();
  if (!currentId) return;
  const reading = getReading();
  const work = getWork(currentId);
  setTimerView(work);
  if (work.timedOut || work.timeRemaining <= 0) return;

  timerId = setInterval(() => {
    const latest = getWork(currentId);
    latest.timeRemaining = Math.max(0, (latest.timeRemaining ?? timeLimitFor(reading)) - 1);
    latest.timedOut = latest.timeRemaining <= 0;
    saveWork(currentId, (draft) => {
      draft.timeLimit = latest.timeLimit ?? timeLimitFor(reading);
      draft.timeRemaining = latest.timeRemaining;
      draft.timedOut = latest.timedOut;
    });
    setTimerView(latest);
    if (latest.timedOut) {
      stopTimer();
      renderQuestions(reading, getWork(currentId));
    }
  }, 1000);
}

function resetTimer() {
  if (!currentId) return;
  const reading = getReading();
  const limit = timeLimitFor(reading);
  saveWork(currentId, (draft) => {
    draft.timeLimit = limit;
    draft.timeRemaining = limit;
    draft.timedOut = false;
  });
  renderQuestions(reading, getWork(currentId));
  startTimer();
}

function renderMenu() {
  const query = els.search.value.trim().toLowerCase();
  els.list.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "reading-grid";

  readings
    .filter((reading) => reading.title.toLowerCase().includes(query))
    .forEach((reading) => {
      const work = getWork(reading.id);
      const answered = Object.values(work.answers).filter(Boolean).length;
      const button = document.createElement("button");
      button.className = "reading-card";
      button.innerHTML = `
        <strong>${reading.title}</strong>
        <span>문제 ${answered}/${reading.questions.length || 0}</span>
      `;
      button.addEventListener("click", () => openReading(reading.id));
      grid.appendChild(button);
    });

  els.list.appendChild(grid);
}

function updateReadingNav() {
  const index = readings.findIndex((reading) => reading.id === currentId);
  els.prev.disabled = index <= 0;
  els.next.disabled = index < 0 || index >= readings.length - 1;
}

function openReading(readingId) {
  currentId = readingId;
  const reading = getReading();
  const work = prepareTimer(reading, getWork(readingId));

  els.title.textContent = reading.title;
  els.summary.value = work.summary || "";
  els.vocab.value = work.vocab || "";
  renderPassage(reading);
  renderQuestions(reading, work);
  updateReadingNav();

  els.menuPage.classList.add("hidden");
  els.studyPage.classList.remove("hidden");
  startTimer();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function moveReading(direction) {
  const index = readings.findIndex((reading) => reading.id === currentId);
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= readings.length) return;
  openReading(readings[nextIndex].id);
}

function renderPassage(reading) {
  els.passage.innerHTML = "";

  if (reading.header?.length) {
    const info = document.createElement("article");
    info.className = "document-info";
    info.innerHTML = `
      <span class="document-info-title">문서 정보</span>
      <div></div>
    `;
    const list = info.querySelector("div");
    reading.header.forEach((line) => {
      const row = document.createElement("p");
      row.textContent = line;
      list.appendChild(row);
    });
    els.passage.appendChild(info);
  }

  if (reading.messages?.length) {
    const thread = document.createElement("div");
    thread.className = "message-thread";
    reading.messages.forEach((message) => {
      const bubble = document.createElement("article");
      bubble.className = "message-bubble";

      const meta = document.createElement("div");
      meta.className = "message-meta";
      meta.innerHTML = `<strong></strong><span></span>`;
      meta.querySelector("strong").textContent = message.speaker;
      meta.querySelector("span").textContent = `[${message.time}]`;

      const text = document.createElement("p");
      text.textContent = message.text;

      bubble.appendChild(meta);
      bubble.appendChild(text);
      thread.appendChild(bubble);
    });
    els.passage.appendChild(thread);
    return;
  }

  if (reading.articleTitle) {
    const headline = document.createElement("article");
    headline.className = "article-headline";
    headline.textContent = reading.articleTitle;
    els.passage.appendChild(headline);
  }

  reading.paragraphs.forEach((paragraph, index) => {
    const block = document.createElement("article");
    block.className = "paragraph";
    block.innerHTML = `
      <span class="paragraph-number">P${index + 1}</span>
      <p></p>
    `;
    block.querySelector("p").textContent = paragraph;
    els.passage.appendChild(block);
  });
}

function parseQuestion(question) {
  const markerPattern = /(^|\s)(\(?\s*([A-Da-d])\s*[.)]\)?)(?=\s)/g;
  const matches = [];
  let match;

  while ((match = markerPattern.exec(question)) !== null) {
    const markerStart = match.index + match[1].length;
    matches.push({
      letter: match[3].toUpperCase(),
      start: markerStart,
      end: markerStart + match[2].length,
    });
  }

  if (!matches.length) {
    return { stem: question, options: [] };
  }

  const stem = question.slice(0, matches[0].start).trim();
  const options = matches.map((item, index) => {
    const next = matches[index + 1]?.start ?? question.length;
    return {
      letter: item.letter,
      text: question.slice(item.end, next).trim(),
    };
  });

  return { stem, options };
}

function renderQuestions(reading, work) {
  els.questions.innerHTML = "";

  if (!reading.questions.length) {
    els.questions.innerHTML = '<p class="empty">이 리딩은 추출된 문제가 없습니다.</p>';
    return;
  }

  if (work.timedOut || work.timeRemaining <= 0) {
    const notice = document.createElement("p");
    notice.className = "time-up-note";
    notice.textContent = "제한시간이 끝났습니다. 다시 풀려면 타이머를 다시 시작하세요.";
    els.questions.appendChild(notice);
  }

  reading.questions.forEach((question, index) => {
    const parsed = parseQuestion(question);
    const card = document.createElement("article");
    card.className = "question-card";

    const text = document.createElement("p");
    text.className = "question-text";
    text.textContent = parsed.stem;
    card.appendChild(text);

    if (parsed.options.length) {
      const optionList = document.createElement("div");
      optionList.className = "option-list";
      parsed.options.forEach((option) => {
        const row = document.createElement("div");
        row.className = "option-line";

        const label = document.createElement("strong");
        label.textContent = option.letter;

        const optionText = document.createElement("span");
        optionText.textContent = option.text;

        row.appendChild(label);
        row.appendChild(optionText);
        optionList.appendChild(row);
      });
      card.appendChild(optionList);
    }

    const choices = document.createElement("div");
    choices.className = "choice-row";
    ["A", "B", "C", "D"].forEach((choice) => {
      const button = document.createElement("button");
      button.textContent = choice;
      button.className = work.answers[index] === choice ? "selected" : "";
      button.disabled = work.timedOut || work.timeRemaining <= 0;
      button.addEventListener("click", () => {
        if (work.timedOut || work.timeRemaining <= 0) return;
        saveWork(reading.id, (draft) => {
          draft.answers[index] = choice;
        });
        renderQuestions(reading, getWork(reading.id));
        renderMenu();
      });
      choices.appendChild(button);
    });
    card.appendChild(choices);
    els.questions.appendChild(card);
  });
}

els.search.addEventListener("input", renderMenu);

els.menu.addEventListener("click", () => {
  stopTimer();
  els.studyPage.classList.add("hidden");
  els.menuPage.classList.remove("hidden");
  renderMenu();
});

els.prev.addEventListener("click", () => moveReading(-1));
els.next.addEventListener("click", () => moveReading(1));
els.resetTimer.addEventListener("click", resetTimer);

els.summary.addEventListener("input", () => {
  if (!currentId) return;
  saveWork(currentId, (draft) => {
    draft.summary = els.summary.value;
  });
});

els.vocab.addEventListener("input", () => {
  if (!currentId) return;
  saveWork(currentId, (draft) => {
    draft.vocab = els.vocab.value;
  });
});

renderMenu();
