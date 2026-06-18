/** @file app.js — Express 服务器，题库上传(Excel/CSV解析)、题目获取/提交、考试组卷、AI路由挂载 */

const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const db = require("./db");

/**
 * 解析 Excel/CSV 题库文件，返回标准化题目数组
 * @param {string} filePath — 上传的 Excel/CSV 文件路径
 * @returns {Array<{question, options, answer, explanation, type, meta}>} 题目对象数组
 */
function parseQuestions(filePath) {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    return data.map((row) => {
      const originalType = row["题型"] || "";
      let determinedType = "单选题";
      if (originalType.includes("多选")) {
        determinedType = "多选题";
      } else if (originalType.includes("判断")) {
        determinedType = "判断题";
      } else if (originalType.includes("简答")) {
        determinedType = "简答题";
      } else if (originalType.includes("填空")) {
        determinedType = "填空题";
      }

      let opts = [];
      if (row["选项"]) {
        opts = row["选项"]
          .split(/\||｜/)
          .map((s) => s.trim())
          .map((s) => s.replace(/^(?:[A-Za-z]\s*[.、)）：:．]\s*)+/, ''))
          .filter(Boolean);
      } else if (determinedType === "判断题") {
        opts = ["正确", "错误"];
      }

      let answer = (row["答案"] || "").toString().trim();
      switch (determinedType) {
        case "单选题":
        case "多选题":
          answer = answer.replace(/，/g, ",").replace(/\s+/g, "").toUpperCase();
          break;
      }

      const explanation = row["解析"] || row["说明"] || "";
      const meta = {
        一级纲要: row["一级纲要"] || "",
        二级纲要: row["二级纲要"] || "",
        题目分类: row["题目分类"] || "",
        题目依据: row["题目依据"] || "",
        试题分数: row["试题分数"] || "",
        试题编号: row["试题编号"] || "",
        备注: row["备注"] || "",
      };
      // 备注中含「保命题」则标记
      if (meta["备注"] && meta["备注"].includes("保命题")) {
        meta.isBaoMing = true;
      }

      return {
        question: row["题干"] || "",
        options: JSON.stringify(opts),
        answer: answer,
        explanation: explanation,
        type: determinedType,
        meta: JSON.stringify(meta),
      };
    });
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

/**
 * 创建并配置 Express 应用：上传路由、题库列表、组卷、答题、删除题库、AI路由、静态资源
 * @returns {express.Application} Express 应用实例
 */
function createServer(userDataPath) {
  const app = express();
  const uploadDir = userDataPath ? path.join(userDataPath, 'uploads') : os.tmpdir();
  // 确保上传目录存在（EXE/APPX 都需要）
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const upload = multer({ dest: uploadDir });
  app.use(cors());
  app.use(express.json());

  // ─── 上传题库（Excel/CSV）───
  app.post("/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const rawBuffer = Buffer.from(req.file.originalname, 'latin1');
    const decodedName = rawBuffer.toString('utf8');
    const originalFilename = decodedName;
    const bankName = path.basename(originalFilename, path.extname(originalFilename));

    if (!bankName) {
      return res.status(400).json({ error: "无效的文件名，无法生成题库名" });
    }
    const existingBank = db
      .prepare("SELECT id FROM banks WHERE name = ?")
      .get(bankName);
    if (existingBank) {
      return res.status(409).json({
        error: `题库 "${bankName}" 已存在。请使用其他文件名或先删除现有题库。`,
      });
    }
    const now = new Date();
    const timestamp = `${now.getFullYear()}${(now.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}_${now
      .getHours()
      .toString()
      .padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}${now
      .getSeconds()
      .toString()
      .padStart(2, "0")}`;
    const uniqueBankName = `${bankName}`;

    try {
      console.time("parseFile");
      const questions = parseQuestions(req.file.path);
      console.timeEnd("parseFile");

      const insertMany = db.transaction((bankName, questionsToInsert) => {
        const bankInfo = db
          .prepare("INSERT INTO banks (name) VALUES (?)")
          .run(bankName);
        const bankId = bankInfo.lastInsertRowid;
        const stmt = db.prepare(
          `INSERT INTO questions (bank_id, question, options, answer, explanation, type, meta) VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        for (const q of questionsToInsert) {
          stmt.run(
            bankId,
            q.question,
            q.options,
            q.answer,
            q.explanation,
            q.type,
            q.meta
          );
        }
        return { count: questionsToInsert.length };
      });

      console.time("dbWrite");
      const result = insertMany(uniqueBankName, questions);
      console.timeEnd("dbWrite");

      res.json({
        success: true,
        count: result.count,
        bankName: uniqueBankName,
      });
    } catch (e) {
      console.error("上传处理失败:", e);
      res.status(500).json({ error: "解析文件或写入数据库失败: " + e.message });
    }
  });

  // ─── 获取题库列表 ───
  app.get("/banks", (req, res) => {
    try {
      const stmt = db.prepare("SELECT name FROM banks");
      const rows = stmt.all();
      res.json({ banks: rows.map((r) => r.name) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 考试组卷：按题型数量随机抽取 ───
  app.get("/generate-paper", (req, res) => {
    const { bankName } = req.query;
    // 支持多种题型数量: ?counts={"单选题":40,"多选题":30,"判断题":30,"简答题":10,"填空题":10}
    // 默认仅选择题+判断题（上传题库）。AI题库会传完整counts
    let counts = { '单选题': 40, '多选题': 30, '判断题': 30 };
    if (req.query.counts) {
      try { counts = { ...counts, ...JSON.parse(req.query.counts) }; } catch {}
    }
    if (!bankName) {
      return res.status(400).json({ error: "缺少题库名称 (bankName) 参数" });
    }
    try {
      const bankRow = db
        .prepare("SELECT id FROM banks WHERE name = ?")
        .get(bankName);
      if (!bankRow) {
        return res.status(404).json({ error: "题库不存在" });
      }
      const bankId = bankRow.id;

      const allTypes = [
        { type: '单选题', key: '单选题' },
        { type: '多选题', key: '多选题' },
        { type: '判断题', key: '判断题' },
        { type: '简答题', key: '简答题' },
        { type: '填空题', key: '填空题' },
      ];

      let allQuestions = [];
      for (const { type, key } of allTypes) {
        const limit = counts[key] || 0;
        if (limit <= 0) continue;
        const rows = db
          .prepare(
            `SELECT id, question, options, type, meta, answer, explanation FROM questions WHERE bank_id = ? AND type = ? ORDER BY RANDOM() LIMIT ?`
          )
          .all(bankId, type, limit);
        allQuestions = allQuestions.concat(rows);
      }

      if (allQuestions.length === 0) {
        return res.status(404).json({ error: "该题库中没有符合条件的题目" });
      }
      const formattedQuestions = allQuestions.map((q) => ({
        id: q.id,
        question: q.question,
        options: JSON.parse(q.options),
        type: q.type,
        meta: q.meta ? JSON.parse(q.meta) : {},
      }));
      res.json(formattedQuestions);
    } catch (err) {
      console.error(`为题库 '${bankName}' 生成试卷时出错:`, err);
      res.status(500).json({ error: "服务器内部错误: " + err.message });
    }
  });

  let currentProgress = {
    bankName: null,
    isSequential: null,
    lastIndex: null,
  };
  // ─── 答题模式：顺序/随机获取单题 ───
  app.get("/question", (req, res) => {
    const { bankName, types } = req.query;
    const order = req.query.order !== 'false'; // query 参数是字符串，需显式转换
    const baoMingOnly = req.query.baoMing === 'true';

    if (!bankName) return res.status(400).json({ error: "缺少题库名" });

    try {
      const bankRow = db
        .prepare("SELECT id FROM banks WHERE name=?")
        .get(bankName);
      if (!bankRow) return res.status(400).json({ error: "题库不存在" });
      const bankId = bankRow.id;

      // 题型过滤
      let typeFilter = "type != '简答题'";
      if (types) {
        const typeList = types.split(',').map(t => t.trim()).filter(Boolean);
        if (typeList.length > 0) {
          typeFilter = `type IN (${typeList.map(t => `'${t}'`).join(',')})`;
        }
      }

      let q;
      if (order) {
        const allQuestions = db
          .prepare(`SELECT * FROM questions WHERE bank_id = ? AND ${typeFilter} ORDER BY id ASC`)
          .all(bankId);
        let candidates = allQuestions;
        if (baoMingOnly) {
          candidates = allQuestions.filter(q => {
            try { const m = JSON.parse(q.meta || '{}'); return m.isBaoMing; }
            catch { return false; }
          });
        }
        if (!candidates || candidates.length === 0) {
          return res.status(404).json({ error: "该题库没有符合条件的题目" });
        }
        const lastIndex = currentProgress.lastIndex;

        let nextIndex =
          lastIndex === null || lastIndex === undefined ? 0 : lastIndex + 1;

        if (nextIndex >= candidates.length) {
          nextIndex = 0;
        }

        q = candidates[nextIndex];

        currentProgress.lastIndex = nextIndex;
      } else {
        const questions = db
          .prepare(`SELECT * FROM questions WHERE bank_id=? AND ${typeFilter}`)
          .all(bankId);
        let candidates = questions;
        if (baoMingOnly) {
          candidates = questions.filter(q => {
            try { const m = JSON.parse(q.meta || '{}'); return m.isBaoMing; }
            catch { return false; }
          });
        }
        if (!candidates || candidates.length === 0) {
          return res.status(400).json({ error: "题库为空" });
        }
        const idx = Math.floor(Math.random() * candidates.length);
        q = candidates[idx];
      }

      if (!q) {
        return res.status(400).json({ error: "题库为空或未找到题目" });
      }

      res.json({
        id: q.id,
        question: q.question,
        options: JSON.parse(q.options),
        type: q.type,
        meta: q.meta ? JSON.parse(q.meta) : {},
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 提交答案并判题 ───
  app.post("/answer", (req, res) => {
    const { id, userAnswer, bankName } = req.body;
    if (!bankName || id === undefined || userAnswer === undefined) {
      return res
        .status(400)
        .json({ error: "参数错误，需要 bankName, id, userAnswer" });
    }
    try {
      const q = db.prepare("SELECT * FROM questions WHERE id = ?").get(id);
      if (!q) {
        return res.status(404).json({ error: "题目不存在" });
      }

      let correct = false;
      switch (q.type) {
        case "多选题": {
          const stdArr = q.answer
            .replace(/,/g, "")
            .split("")
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean)
            .sort();
          const usrArr = (Array.isArray(userAnswer) ? userAnswer : [userAnswer])
            .map((s) => String(s).trim().toUpperCase())
            .filter(Boolean)
            .sort();
          correct = JSON.stringify(stdArr) === JSON.stringify(usrArr);
          break;
        }
        case "判断题":
        case "单选题":
        default: {
          correct =
            q.answer.trim().toUpperCase() ===
            String(userAnswer).trim().toUpperCase();
          break;
        }
      }
      res.json({ correct, explanation: q.explanation, answer: q.answer });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 删除题库 ───
  app.delete("/bank", (req, res) => {
    const { bankName } = req.query;
    if (!bankName) {
      return res.status(400).json({ error: "缺少 bankName 参数" });
    }
    try {
      const bankRow = db
        .prepare("SELECT id FROM banks WHERE name = ?")
        .get(bankName);
      if (!bankRow) {
        return res.status(404).json({ error: "题库不存在" });
      }
      const bankId = bankRow.id;
      db.prepare("DELETE FROM questions WHERE bank_id = ?").run(bankId);
      db.prepare("DELETE FROM banks WHERE id = ?").run(bankId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── 下载试卷 PDF ───
  const { generatePaperPdf, generateAnswerPdf } = require('./paper-pdf');
  app.post('/api/download-paper', async (req, res) => {
    try {
      const { bankName, typeCounts, answer } = req.body;
      if (!bankName) return res.status(400).json({ error: '缺少题库名' });
      const genFn = answer ? generateAnswerPdf : generatePaperPdf;
      const pdfPath = await genFn(bankName, typeCounts || null);
      const label = answer ? '答案' : '试卷';
      res.download(pdfPath, `${bankName}_${label}.pdf`, (err) => {
        if (err) console.error('[paper-pdf] download error:', err.message);
        try { fs.unlinkSync(pdfPath); } catch {}
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── AI 路由（Beta）───
  const createAiRoutes = require('./ai/index');
  app.use('/api/ai', createAiRoutes());

  // 静态资源：先 public/（dev 模式模板等），再 dist/（生产构建）
  app.use(express.static(path.join(__dirname, "../frontend/public")));
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });

  return app;
}

module.exports = createServer;
