// backend/paper-pdf.js — 试卷 + 答案 PDF 生成（HTML → Electron printToPDF）
// 排版风格：传统试卷，黑白打印友好，适合学生手写作答
const { BrowserWindow } = require('electron');
const db = require('./db');
const path = require('path');
const fs = require('fs');
const os = require('os');

// KaTeX
let katex = null;
try { katex = require('katex'); } catch {
  try { katex = require('../frontend/node_modules/katex'); } catch {}
}

/** 通用 PDF 生成 */
function renderToPdf(html, filename) {
  const tmpPath = path.join(os.tmpdir(), `${filename}_${Date.now()}.pdf`);
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 794, height: 1123, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    win.webContents.on('did-finish-load', async () => {
      try {
        const data = await win.webContents.printToPDF({
          printBackground: true,
          marginsType: 0,
          pageSize: 'A4',
          landscape: false,
          displayHeaderFooter: true,
          headerTemplate: '<span></span>',
          footerTemplate: '<div style="font-size:9pt;text-align:center;width:100%;font-family:SimSun,serif;color:#999;">— <span class="pageNumber"></span> —</div>',
        });
        fs.writeFileSync(tmpPath, data);
        win.close();
        resolve(tmpPath);
      } catch (e) { win.close(); reject(e); }
    });
    win.webContents.on('did-fail-load', (_, code, desc) => {
      win.close(); reject(new Error(`页面加载失败: ${code} ${desc}`));
    });
    setTimeout(() => { if (!win.isDestroyed()) { win.close(); reject(new Error('超时')); } }, 30000);
  });
}

async function generatePaperPdf(bankName, typeCounts = null) {
  const questions = fetchQuestions(bankName, typeCounts);
  if (!questions.length) throw new Error('题库为空');
  const html = buildPaperHtml(bankName, questions, false);
  return renderToPdf(html, `试卷_${bankName}`);
}

async function generateAnswerPdf(bankName, typeCounts = null) {
  const questions = fetchQuestions(bankName, typeCounts);
  if (!questions.length) throw new Error('题库为空');
  const html = buildPaperHtml(bankName, questions, true);
  return renderToPdf(html, `答案_${bankName}`);
}

function fetchQuestions(bankName, typeCounts) {
  const bank = db.prepare('SELECT id FROM banks WHERE name = ?').get(bankName);
  if (!bank) return [];

  const counts = typeCounts || {
    '单选题': 40, '多选题': 30, '判断题': 30,
  };

  const all = [];
  for (const [type, count] of Object.entries(counts)) {
    if (count <= 0) continue;
    const rows = db.prepare(
      `SELECT * FROM questions WHERE bank_id = ? AND type = ? ORDER BY RANDOM() LIMIT ?`
    ).all(bank.id, type, count);
    all.push(...rows);
  }
  return all;
}

function renderMath(text) {
  if (!text || !katex) return escapeHtml(text);
  try {
    // 先切分：纯文本和 $...$ / $$...$$ 公式块，只对纯文本做 HTML 转义
    const parts = [];
    let remaining = text;
    // 匹配 $$...$$ 或 $...$（不匹配 \$ 转义的）
    const regex = /(\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\\])+?\$)/g;
    let lastIdx = 0;
    let m;
    while ((m = regex.exec(remaining)) !== null) {
      if (m.index > lastIdx) {
        parts.push({ raw: false, text: remaining.slice(lastIdx, m.index) });
      }
      const full = m[0];
      const isDisplay = full.startsWith('$$');
      const formula = isDisplay ? full.slice(2, -2).trim() : full.slice(1, -1);
      try {
        parts.push({
          raw: true,
          html: katex.renderToString(formula, {
            displayMode: isDisplay,
            throwOnError: false,
            strict: false,
          }),
        });
      } catch {
        parts.push({ raw: false, text: full });
      }
      lastIdx = regex.lastIndex;
    }
    if (lastIdx < remaining.length) {
      parts.push({ raw: false, text: remaining.slice(lastIdx) });
    }
    // 组装：非公式段做 HTML 转义，公式段直接拼接 KaTeX HTML
    return parts.map(p => p.raw ? p.html : escapeHtml(p.text)).join('');
  } catch { return escapeHtml(text); }
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ══════════════════════════════════════════════
// 试卷 HTML 构建
// ══════════════════════════════════════════════

function buildPaperHtml(bankName, questions, isAnswer) {
  let globalIdx = 0;
  const grouped = groupByType(questions);
  const typeNames = {
    '单选题': '一、单项选择题',
    '多选题': '二、多项选择题',
    '判断题': '三、判断题',
    '填空题': '四、填空题',
    '简答题': '五、简答题',
  };

  let body = '';
  for (const [type, qs] of Object.entries(grouped)) {
    const title = typeNames[type] || type;
    body += `<div class="section-title">${title}</div>\n`;
    if (type === '单选题') {
      if (!isAnswer) body += `<div class="instruction">请将正确答案的字母填在题号前的括号内。每题只有一个正确选项。</div>\n`;
      body += renderChoiceQs(qs, globalIdx, isAnswer);
      globalIdx += qs.length;
    } else if (type === '多选题') {
      if (!isAnswer) body += `<div class="instruction">请将全部正确选项的字母填在题号前的括号内。每题有一个或多个正确选项，多选、少选均不得分。</div>\n`;
      body += renderChoiceQs(qs, globalIdx, isAnswer);
      globalIdx += qs.length;
    } else if (type === '判断题') {
      if (!isAnswer) body += `<div class="instruction">正确的在括号内填"√"，错误的填"×"。</div>\n`;
      body += renderJudgeQs(qs, globalIdx, isAnswer);
      globalIdx += qs.length;
    } else if (type === '填空题') {
      body += renderFillQs(qs, globalIdx, isAnswer);
      globalIdx += qs.length;
    } else if (type === '简答题') {
      body += renderShortQs(qs, globalIdx, isAnswer);
      globalIdx += qs.length;
    }
  }

  // 试卷版 — 末尾加总分统计行
  const scoreLine = !isAnswer
    ? `<div class="score-total">总分：________ 分&emsp;&emsp;阅卷人：________</div>`
    : '';

  // 答案版 — 参考答案汇总
  let answerSummary = '';
  if (isAnswer) {
    answerSummary = `<div class="page-break"></div><div class="section-title">参考答案</div>\n`;
    let ai = 0;
    for (const [type, qs] of Object.entries(grouped)) {
      for (const q of qs) {
        ai++;
        const ansRaw = formatAnswer(q);
        answerSummary += `<div class="answer-row"><span class="q-num">${ai}.</span> <span class="answer-val">${renderMath(ansRaw)}</span></div>\n`;
      }
    }
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  const titleLabel = isAnswer ? `${escapeHtml(bankName)}（答案）` : `${escapeHtml(bankName)}`;
  const katexCss = getKatexCss();

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: A4;
    margin: 20mm 22mm 22mm 22mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ${katexCss}

  /* ═══ 基础 ═══ */
  body {
    font-family: "SimSun","宋体","Noto Serif CJK SC",serif;
    font-size: 11pt;
    line-height: 2;
    color: #000;
    background: #fff;
  }

  /* ═══ 试卷头 ═══ */
  .paper-header {
    text-align: center;
    margin-bottom: 6mm;
    padding-bottom: 4mm;
    border-bottom: 1.5pt solid #000;
  }
  .paper-title {
    font-size: 16pt;
    font-weight: bold;
    font-family: "SimHei","黑体","Noto Sans CJK SC",sans-serif;
    letter-spacing: 2px;
    margin-bottom: 5mm;
  }
  .paper-meta {
    display: flex;
    justify-content: center;
    gap: 8mm;
    font-size: 10.5pt;
    flex-wrap: wrap;
  }
  .paper-meta .field {
    display: inline-flex;
    align-items: baseline;
    white-space: nowrap;
  }
  .paper-meta .blank {
    display: inline-block;
    min-width: 50px;
    border-bottom: 1px solid #000;
    margin: 0 1px;
  }

  /* ═══ 大题标题 ═══ */
  .section-title {
    font-size: 13pt;
    font-weight: bold;
    font-family: "SimHei","黑体","Noto Sans CJK SC",sans-serif;
    margin: 6mm 0 1.5mm 0;
  }
  .instruction {
    font-size: 10pt;
    color: #333;
    margin-bottom: 2mm;
    padding-left: 4mm;
    line-height: 1.6;
  }

  /* ═══ 题目 ═══ */
  .question {
    margin: 4mm 0 1mm 0;
    text-indent: 0;
  }
  .q-num { font-weight: bold; margin-right: 1mm; }
  .q-bracket {
    display: inline-block;
    width: 28px;
    text-align: center;
    font-size: 11pt;
    color: #000;
    margin-right: 2mm;
  }

  /* ═══ 选项（传统竖排） ═══ */
  .options {
    padding-left: 8mm;
    margin-bottom: 3mm;
    font-size: 10.5pt;
    line-height: 2;
  }
  .opt {
    display: block;
    padding: 0.3mm 0;
  }

  /* ═══ 判断题 ═══ */
  .judge-q { margin: 4mm 0 3mm 0; }

  /* ═══ 填空题 ═══ */
  .fill-q { margin: 4mm 0 3mm 0; }
  .blank-line {
    display: inline-block;
    min-width: 100px;
    border-bottom: 1px solid #000;
    margin: 0 3px;
  }

  /* ═══ 简答题 — 横线答卷区 ═══ */
  .answer-lines {
    padding-left: 6mm;
    margin: 1mm 0 5mm 0;
  }
  .answer-lines .rule {
    width: 100%;
    border-bottom: 1px solid #ccc;
    height: 8mm;
  }

  /* ═══ 配图 ═══ */
  .diagram-box {
    text-align: center;
    margin: 2mm 0;
    padding: 2mm;
    border: 1px solid #ccc;
  }
  .diagram-box svg { max-width: 100%; height: auto; }

  /* ═══ 答案版样式 ═══ */
  .answer-val {
    color: #000;
    font-weight: bold;
    font-family: "SimHei","黑体",sans-serif;
  }
  .answer-note {
    font-size: 10pt;
    color: #333;
    padding-left: 8mm;
    margin-bottom: 1.5mm;
    line-height: 1.7;
  }
  .answer-row {
    margin: 1.5mm 0;
    font-size: 10.5pt;
    padding-left: 4mm;
  }
  .answer-row .answer-val {
    font-size: 11pt;
  }

  /* ═══ 试卷版 — 总分/阅卷 ═══ */
  .score-total {
    margin-top: 8mm;
    padding-top: 3mm;
    border-top: 1px solid #ccc;
    text-align: right;
    font-size: 10.5pt;
    color: #333;
  }

  /* ═══ 分页 ═══ */
  .page-break { page-break-after: always; }

  /* ═══ KaTeX 微调 ═══ */
  .katex { font-size: 1em !important; }
  .katex-display { margin: 1mm 0 !important; }
</style>
</head>
<body>
  <div class="paper-header">
    <div class="paper-title">${titleLabel}</div>
    <div class="paper-meta">
      <span class="field">姓名：<span class="blank"></span></span>
      <span class="field">班级：<span class="blank"></span></span>
      <span class="field">学号：<span class="blank"></span></span>
      <span class="field">日期：${dateStr}</span>
    </div>
  </div>
  ${body}
  ${scoreLine}
  ${answerSummary}
</body>
</html>`;
}

// ══════════════════════════════════════════════
// 各题型渲染
// ══════════════════════════════════════════════

function renderChoiceQs(qs, startIdx, isAnswer) {
  let html = '';
  qs.forEach((q, i) => {
    const idx = startIdx + i + 1;
    const opts = parseJsonSafe(q.options, []);
    const diagramHtml = getDiagramHtml(q);
    const answerTxt = isAnswer
      ? `<span class="answer-val">【${formatAnswer(q)}】</span>`
      : `<span class="q-bracket">（&ensp;&ensp;）</span>`;
    html += `<div class="question"><span class="q-num">${idx}.</span>${answerTxt}&nbsp;${renderMath(q.question)}</div>\n`;
    if (diagramHtml) html += diagramHtml;
    html += `<div class="options">`;
    opts.forEach((o, j) => {
      html += `<span class="opt">${String.fromCharCode(65 + j)}. ${renderMath(stripOptionPrefix(String(o)))}</span>`;
    });
    html += `</div>\n`;
    if (isAnswer && q.explanation) {
      html += `<div class="answer-note">【解析】${renderMath(q.explanation)}</div>\n`;
    }
  });
  return html;
}

function renderJudgeQs(qs, startIdx, isAnswer) {
  let html = '';
  qs.forEach((q, i) => {
    const idx = startIdx + i + 1;
    const diagramHtml = getDiagramHtml(q);
    const answerTxt = isAnswer
      ? `<span class="answer-val">【${formatAnswer(q)}】</span>`
      : `<span class="q-bracket">（&ensp;&ensp;）</span>`;
    html += `<div class="judge-q"><span class="q-num">${idx}.</span>${answerTxt}&nbsp;${renderMath(q.question)}</div>\n`;
    if (diagramHtml) html += diagramHtml;
  });
  return html;
}

function renderFillQs(qs, startIdx, isAnswer) {
  let html = '';
  qs.forEach((q, i) => {
    const idx = startIdx + i + 1;
    const diagramHtml = getDiagramHtml(q);
    html += `<div class="fill-q"><span class="q-num">${idx}.</span>${renderMath(q.question)}</div>\n`;
    if (diagramHtml) html += diagramHtml;
    if (isAnswer) {
      html += `<div class="answer-note">答：<span class="answer-val">${renderMath(formatAnswer(q))}</span></div>\n`;
    } else {
      html += `<div style="padding-left:6mm;margin-bottom:3mm;">答：<span class="blank-line"></span></div>\n`;
    }
  });
  return html;
}

function renderShortQs(qs, startIdx, isAnswer) {
  let html = '';
  qs.forEach((q, i) => {
    const idx = startIdx + i + 1;
    const diagramHtml = getDiagramHtml(q);
    html += `<div class="question"><span class="q-num">${idx}.</span>${renderMath(q.question)}</div>\n`;
    if (diagramHtml) html += diagramHtml;
    if (isAnswer) {
      html += `<div class="answer-note">参考答：<span class="answer-val">${renderMath(formatAnswer(q))}</span></div>\n`;
      if (q.explanation) html += `<div class="answer-note">评分要点：${renderMath(q.explanation)}</div>\n`;
    } else {
      // 横线答卷区 — 6 条横线用于手写
      html += `<div class="answer-lines">`;
      for (let r = 0; r < 6; r++) {
        html += `<div class="rule"></div>`;
      }
      html += `</div>\n`;
    }
  });
  return html;
}

function formatAnswer(q) {
  let ans = q.answer || '';
  if (q.type === '判断题') {
    ans = ans === 'A' ? '√' : ans === 'B' ? '×' : ans;
  }
  return ans;
}

function stripOptionPrefix(s) {
  return s.replace(/^(?:[A-Fa-f]\s*[.、)）：:．]\s*)+/, '');
}

function getDiagramHtml(q) {
  try {
    const meta = parseJsonSafe(q.meta, {});
    if (meta.diagramSvg) {
      return `<div class="diagram-box">${meta.diagramSvg.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/\son\w+\s*=\s*"[^"]*"/gi,'')}</div>`;
    }
  } catch {}
  return '';
}

function getKatexCss() {
  try { return fs.readFileSync(require.resolve('katex/dist/katex.min.css'), 'utf8'); } catch {
    try { return fs.readFileSync(path.join(__dirname,'..','frontend','node_modules','katex','dist','katex.min.css'),'utf8'); } catch {
      return '';
    }
  }
}

function groupByType(qs) {
  const g = {};
  for (const q of qs) { if (!g[q.type]) g[q.type] = []; g[q.type].push(q); }
  return g;
}

function parseJsonSafe(str, fb) {
  try { return JSON.parse(str); } catch { return fb; }
}

module.exports = { generatePaperPdf, generateAnswerPdf, renderToPdf };
