// backend/paper-pdf.js — 试卷 + 答案 PDF 生成（HTML → Electron printToPDF）
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
          marginsType: 0, // use CSS @page margins
          pageSize: 'A4',
          landscape: false,
          displayHeaderFooter: true,
          headerTemplate: '<span></span>',
          footerTemplate: '<div style="font-size:9pt;text-align:center;width:100%;font-family:SimSun,\'宋体\',serif;color:#888;">— <span class="pageNumber"></span> —</div>',
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

  // 未指定题型数量时，使用考试默认值（仅选择/判断题）
  const counts = typeCounts || {
    '单选题': 40, '多选题': 30, '判断题': 30,
  };

  const all = [];
  for (const [type, count] of Object.entries(counts)) {
    if (count <= 0) continue;
    // 查询该题型的实际数量，不超过 count
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
    let result = escapeHtml(text);
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => {
      try { return katex.renderToString(m.trim(), { displayMode: true, throwOnError: false, strict: false }); }
      catch { return `$${m}$`; }
    });
    result = result.replace(/(?<!\\)\$([^\s$](?:[^$]*?[^\s\\])?)\$/g, (_, m) => {
      try { return katex.renderToString(m, { displayMode: false, throwOnError: false, strict: false }); }
      catch { return `$${m}$`; }
    });
    return result;
  } catch { return escapeHtml(text); }
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

  // 答案汇总（用 renderMath 渲染公式）
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
  const titleLabel = isAnswer ? `${escapeHtml(bankName)} 试卷（答案版）` : `${escapeHtml(bankName)} 试卷`;
  const katexCss = getKatexCss();

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: A4;
    margin: 22mm 20mm 20mm 22mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ${katexCss}
  body {
    font-family: "SimSun","宋体","Noto Serif CJK SC","Source Han Serif SC",serif;
    font-size: 12pt; line-height: 1.8; color: #000;
    padding: 0;
  }
  .paper-header { text-align:center; margin-bottom:6mm; border-bottom:3px double #000; padding-bottom:4mm; }
  .paper-title { font-size:18pt; font-weight:bold; font-family:"SimHei","黑体","Noto Sans CJK SC",sans-serif; letter-spacing:3px; margin-bottom:5mm; }
  .paper-info { text-align:center; font-size:11pt; margin-top:3mm; }
  .paper-info span { margin:0 5mm; white-space:nowrap; }
  .paper-info .underline { display:inline-block; min-width:55px; border-bottom:1px solid #000; margin:0 2px; }
  .section-title { font-size:13pt; font-weight:bold; font-family:"SimHei","黑体","Noto Sans CJK SC",sans-serif; margin:5mm 0 2mm 0; }
  .instruction { font-size:10pt; color:#444; margin-bottom:2mm; padding-left:2mm; }
  .question { margin:3.5mm 0 1mm 0; line-height:1.7; }
  .q-num { font-weight:bold; }
  .q-bracket { font-size:11pt; color:#000; }
  .q-text { font-size:12pt; }
  .options { display:flex; flex-wrap:wrap; gap:2mm 8mm; padding-left:10mm; margin-bottom:3mm; font-size:11pt; }
  .opt { white-space:nowrap; }
  .blank-area { padding-left:8mm; font-size:11pt; margin-bottom:3mm; }
  .blank-line { display:inline-block; min-width:120px; border-bottom:1px solid #000; margin-left:2px; }
  .answer-area {
    padding-left: 6mm; font-size: 11pt; margin-bottom: 5mm;
    min-height: 25mm; border: 1px solid #ddd; padding: 3mm 6mm;
  }
  .diagram-box { text-align:center; margin:3mm 0; padding:2mm; border:1px solid #ddd; }
  .diagram-box svg { max-width:100%; height:auto; }
  .answer-row { margin:1.5mm 0; font-size:11pt; }
  .answer-val { color:#c00; font-weight:bold; }
  .answer-note { font-size:10pt; color:#555; padding-left:8mm; margin-bottom:1mm; }
  .page-break { page-break-after:always; }
  .katex { font-size:1em !important; }
  .katex-display { margin:1mm 0 !important; }
</style>
</head>
<body>
  <div class="paper-header">
    <div class="paper-title">${titleLabel}</div>
    <div class="paper-info">
      <span>姓名：<span class="underline"></span></span>
      <span>班级：<span class="underline"></span></span>
      <span>得分：<span class="underline"></span></span>
      <span>日期：${dateStr}</span>
    </div>
  </div>
  ${body}
  ${answerSummary}
</body>
</html>`;
}

function renderChoiceQs(qs, startIdx, isAnswer) {
  let html = '';
  qs.forEach((q, i) => {
    const idx = startIdx + i + 1;
    const opts = parseJsonSafe(q.options, []);
    const diagramHtml = getDiagramHtml(q);
    const answerTxt = isAnswer ? `<span class="answer-val">【${formatAnswer(q)}】</span>` : `<span class="q-bracket">（&ensp;&ensp;）</span>`;
    html += `<div class="question"><span class="q-num">${idx}.</span>${answerTxt}<span class="q-text">${renderMath(q.question)}</span></div>\n`;
    if (diagramHtml) html += diagramHtml;
    html += `<div class="options">`;
    opts.forEach((o, j) => {
      html += `<span class="opt">${String.fromCharCode(65 + j)}. ${renderMath(stripOptionPrefix(String(o)))}</span>`;
    });
    html += `</div>\n`;
    if (isAnswer && q.explanation) {
      html += `<div class="answer-note">解析：${renderMath(q.explanation)}</div>\n`;
    }
  });
  return html;
}

function renderJudgeQs(qs, startIdx, isAnswer) {
  let html = '';
  qs.forEach((q, i) => {
    const idx = startIdx + i + 1;
    const diagramHtml = getDiagramHtml(q);
    const answerTxt = isAnswer ? `<span class="answer-val">【${formatAnswer(q)}】</span>` : `<span class="q-bracket">（&ensp;&ensp;）</span>`;
    html += `<div class="question"><span class="q-num">${idx}.</span>${answerTxt}<span class="q-text">${renderMath(q.question)}</span></div>\n`;
    if (diagramHtml) html += diagramHtml;
  });
  return html;
}

function renderFillQs(qs, startIdx, isAnswer) {
  let html = '';
  qs.forEach((q, i) => {
    const idx = startIdx + i + 1;
    const diagramHtml = getDiagramHtml(q);
    html += `<div class="question"><span class="q-num">${idx}.</span><span class="q-text">${renderMath(q.question)}</span></div>\n`;
    if (diagramHtml) html += diagramHtml;
    if (isAnswer) {
      html += `<div class="answer-row"><span class="answer-val">答：${renderMath(formatAnswer(q))}</span></div>\n`;
    } else {
      html += `<div class="blank-area">答：<span class="blank-line"></span></div>\n`;
    }
  });
  return html;
}

function renderShortQs(qs, startIdx, isAnswer) {
  let html = '';
  qs.forEach((q, i) => {
    const idx = startIdx + i + 1;
    const diagramHtml = getDiagramHtml(q);
    html += `<div class="question"><span class="q-num">${idx}.</span><span class="q-text">${renderMath(q.question)}</span></div>\n`;
    if (diagramHtml) html += diagramHtml;
    if (isAnswer) {
      html += `<div class="answer-row"><span class="answer-val">参考答案：${renderMath(formatAnswer(q))}</span></div>\n`;
      if (q.explanation) html += `<div class="answer-note">评分要点：${renderMath(q.explanation)}</div>\n`;
    } else {
      html += `<div class="answer-area"></div>\n`;
    }
  });
  return html;
}

function formatAnswer(q) {
  let ans = q.answer || '';
  if (q.type === '判断题') {
    ans = ans === 'A' ? '正确（√）' : ans === 'B' ? '错误（×）' : ans;
  }
  return ans;
}

function stripOptionPrefix(s) {
  // 去掉 "A. " "B) " "C、 " 等前缀（支持连续的多个，如 "A. B. 选项" → "选项"）
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
