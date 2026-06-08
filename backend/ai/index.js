/** @file index.js — AI 路由，API Key 配置持久化、题库生成(带状态轮询)、AI 判题 */

// backend/ai/index.js — AI 路由
const { generateQuestions } = require('./generator');
const { judgeQuestion } = require('./judge');
const db = require('../db');
const fs = require('fs');
const path = require('path');

// ─── API Key 持久化文件路径 ───
function getConfigPath() {
  const { app } = require('electron');
  if (app) return path.join(app.getPath('userData'), 'ai-config.json');
  return path.join(__dirname, '..', '..', 'ai-config.json');
}

/**
 * 从持久化文件加载 AI 配置（API Key + provider）
 * @returns {{apiKey?: string, provider?: string}} 配置对象
 */
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8')); } catch { return {}; }
}

/**
 * 将 AI 配置持久化到文件
 * @param {{apiKey?: string, provider?: string}} config — 配置对象
 */
function saveConfig(config) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config));
}

/**
 * 创建 AI 相关路由：/config、/generate、/status、/judge
 * @returns {express.Router} Express 路由器实例
 */
function createAiRoutes() {
  const router = require('express').Router();

  let genStatus = null;
  let cachedConfig = loadConfig();

  // ─── 配置 API Key ───
  router.post('/config', (req, res) => {
    const { apiKey, provider } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 apiKey' });
    cachedConfig = { apiKey, provider: provider || 'deepseek' };
    saveConfig(cachedConfig);
    res.json({ ok: true });
  });

  // ─── GET /config：获取当前 API Key 配置状态（已脱敏）───
  router.get('/config', (req, res) => {
    const key = cachedConfig.apiKey || '';
    const masked = key ? key.slice(0, 7) + '...' + key.slice(-4) : '';
    res.json({
      configured: !!key,
      apiKey: masked,
      provider: cachedConfig.provider || 'deepseek',
    });
  });

  // ─── 生成题库 ───
  router.post('/generate', async (req, res) => {
    const apiKey = cachedConfig.apiKey;
    if (!apiKey) return res.status(400).json({ error: '请先配置 API Key' });

    const { topic = '通用知识', total = 500, bankName } = req.body;
    const name = bankName || `AI题库_${topic}_${Date.now().toString(36)}`;

    const existing = db.prepare('SELECT id FROM banks WHERE name = ?').get(name);
    if (existing) return res.status(409).json({ error: `题库 "${name}" 已存在` });

    genStatus = { running: true, progress: 0, total, bankName: name };

    generateQuestions(apiKey, topic, total, (info) => {
      genStatus.progress = info.questions;
      genStatus.batch = info.batch;
      genStatus.totalBatches = info.totalBatches;
    }).then(async (questions) => {
      if (questions.length === 0) {
        genStatus = { running: false, error: '未能生成题目，请检查 API Key 或网络' };
        return;
      }
      const insertMany = db.transaction((bn, qs) => {
        const bankInfo = db.prepare('INSERT INTO banks (name) VALUES (?)').run(bn);
        const bankId = bankInfo.lastInsertRowid;
        const stmt = db.prepare(
          'INSERT INTO questions (bank_id, question, options, answer, explanation, type, meta) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        for (const q of qs) {
          stmt.run(bankId, q.question, q.options, q.answer, q.explanation, q.type, q.meta);
        }
        return qs.length;
      });
      const count = insertMany(name, questions);
      genStatus = { running: false, done: true, bankName: name, count };
    }).catch(err => {
      genStatus = { running: false, error: err.message };
    });

    res.json({ ok: true, bankName: name, message: '开始生成' });
  });

  // ─── GET /status：查询生成任务进度 ───
  router.get('/status', (req, res) => {
    res.json(genStatus || { running: false });
  });

  // ─── POST /judge：AI 智能判题 ───
  router.post('/judge', async (req, res) => {
    const apiKey = cachedConfig.apiKey;
    if (!apiKey) return res.status(400).json({ error: '请先配置 API Key' });
    const { questionId, question, type, options, answer, userAnswer } = req.body;

    // 支持通过 questionId 查库，避免前端泄露答案
    let qData = { question, type, options, answer };
    let bankName = '';
    if (questionId) {
      const row = db.prepare(`
        SELECT q.*, b.name as bank_name FROM questions q
        JOIN banks b ON b.id = q.bank_id
        WHERE q.id = ?
      `).get(questionId);
      if (!row) return res.status(404).json({ error: '题目不存在' });
      try { qData.options = JSON.parse(row.options); } catch { qData.options = []; }
      qData.question = row.question;
      qData.type = row.type;
      qData.answer = row.answer;
      qData.explanation = row.explanation;
      bankName = row.bank_name || '';
    }

    if (!qData.question || userAnswer === undefined) return res.status(400).json({ error: '缺少必要参数' });
    try {
      const result = await judgeQuestion(apiKey, {
        question: qData.question,
        type: qData.type,
        options: qData.options,
        answer: qData.answer,
        userAnswer,
        bankName,
      });
      // 将数据库中的标准答案和解析也带回
      result.answer = qData.answer;
      result.explanation = result.explanation || qData.explanation;
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createAiRoutes;
