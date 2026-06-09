/** @file index.js — AI 路由，API Key + 模型配置、题库生成、AI 判题、模型列表 */
const { generateQuestions } = require('./generator');
const { judgeQuestion } = require('./judge');
const { fetchModels, chat } = require('./deepseek');
const db = require('../db');
const fs = require('fs');
const path = require('path');

// ─── 持久化 ───
function getConfigPath() {
  const { app } = require('electron');
  if (app) return path.join(app.getPath('userData'), 'ai-config.json');
  return path.join(__dirname, '..', '..', 'ai-config.json');
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(getConfigPath(), 'utf8')); } catch { return {}; }
}

function saveConfig(config) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(config));
}

function createAiRoutes() {
  const router = require('express').Router();
  let genStatus = null;
  let cachedConfig = loadConfig();

  // ─── POST /config：保存 API Key + 模型 ───
  router.post('/config', (req, res) => {
    const { apiKey, model, provider } = req.body;
    if (!apiKey) return res.status(400).json({ error: '缺少 apiKey' });
    cachedConfig = {
      apiKey,
      model: model || cachedConfig.model || 'deepseek-v4-pro',
      provider: provider || 'deepseek',
    };
    saveConfig(cachedConfig);
    res.json({ ok: true, model: cachedConfig.model });
  });

  // ─── PUT /config/model：单独更新模型 ───
  router.put('/config/model', (req, res) => {
    const { model } = req.body;
    if (!model) return res.status(400).json({ error: '缺少 model' });
    if (!cachedConfig.apiKey) return res.status(400).json({ error: '请先配置 API Key' });
    cachedConfig.model = model;
    saveConfig(cachedConfig);
    res.json({ ok: true, model });
  });

  // ─── GET /config ───
  router.get('/config', (req, res) => {
    const key = cachedConfig.apiKey || '';
    const masked = key ? key.slice(0, 7) + '...' + key.slice(-4) : '';
    res.json({
      configured: !!key,
      apiKey: masked,
      model: cachedConfig.model || 'deepseek-v4-pro',
      provider: cachedConfig.provider || 'deepseek',
    });
  });

  // ─── GET /models：获取可用模型列表 ───
  router.get('/models', async (req, res) => {
    if (!cachedConfig.apiKey) return res.status(400).json({ error: '请先配置 API Key' });
    try {
      const models = await fetchModels(cachedConfig.apiKey);
      res.json({ models, current: cachedConfig.model || 'deepseek-v4-pro' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /generate ───
  router.post('/generate', async (req, res) => {
    const apiKey = cachedConfig.apiKey;
    if (!apiKey) return res.status(400).json({ error: '请先配置 API Key' });

    const { topic = '通用知识', total = 500, bankName, model } = req.body;
    const name = bankName || `AI题库_${topic}_${Date.now().toString(36)}`;

    const existing = db.prepare('SELECT id FROM banks WHERE name = ?').get(name);
    if (existing) return res.status(409).json({ error: `题库 "${name}" 已存在` });

    genStatus = { running: true, progress: 0, total, bankName: name };

    // 使用请求指定的 model 或全局默认
    const useModel = model || cachedConfig.model || 'deepseek-v4-pro';

    generateQuestions(apiKey, topic, total, (info) => {
      genStatus.progress = info.questions;
      genStatus.batch = info.batch;
      genStatus.totalBatches = info.totalBatches;
    }, useModel).then(async (questions) => {
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
        for (const q of qs) stmt.run(bankId, q.question, q.options, q.answer, q.explanation, q.type, q.meta);
        return qs.length;
      });
      const count = insertMany(name, questions);
      genStatus = { running: false, done: true, bankName: name, count };
    }).catch(err => {
      genStatus = { running: false, error: err.message };
    });

    res.json({ ok: true, bankName: name, message: '开始生成' });
  });

  // ─── GET /status ───
  router.get('/status', (req, res) => {
    res.json(genStatus || { running: false });
  });

  // ─── POST /judge ───
  router.post('/judge', async (req, res) => {
    const apiKey = cachedConfig.apiKey;
    if (!apiKey) return res.status(400).json({ error: '请先配置 API Key' });
    const { questionId, question, type, options, answer, userAnswer, model } = req.body;

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
      const useModel = model || cachedConfig.model || 'deepseek-v4-pro';
      const result = await judgeQuestion(apiKey, {
        question: qData.question,
        type: qData.type,
        options: qData.options,
        answer: qData.answer,
        userAnswer,
        bankName,
      }, useModel);
      result.answer = qData.answer;
      result.explanation = result.explanation || qData.explanation;
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── POST /diagnose ───
  router.post('/diagnose', async (req, res) => {
    const apiKey = cachedConfig.apiKey;
    if (!apiKey) return res.status(400).json({ error: '请先配置 API Key' });
    const { stats } = req.body;
    if (!stats) return res.status(400).json({ error: '缺少统计数据' });

    const { total, correct, incorrect, rate, byType, wrongTopics } = stats;
    const byTypeLines = Object.entries(byType || {})
      .filter(([, v]) => v.total > 0)
      .map(([type, v]) => {
        const r = v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0;
        return `- ${type}: ${v.correct}/${v.total} (正确率${r}%)`;
      })
      .join('\n');
    const topicLines = (wrongTopics || []).length ? `- 易错知识点: ${wrongTopics.join('、')}` : '';

    const prompt = `你是学习诊断助手。分析以下答题数据，给出薄弱点诊断和一条学习建议。用中文回复，不超过150字。

总题数: ${total} | 正确: ${correct} | 错误: ${incorrect} | 正确率: ${rate}%
题型表现:
${byTypeLines || '暂无'}
${topicLines}

请直接输出分析（无需复述数据）：`;

    try {
      const model = cachedConfig.model || 'deepseek-v4-pro';
      const result = await chat(apiKey, [
        { role: 'system', content: '你是学习诊断助手，用中文回复。回答简洁准确，不超过150字。' },
        { role: 'user', content: prompt },
      ], { model, temperature: 0.7, max_tokens: 300 });
      res.json({ ok: true, diagnosis: result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createAiRoutes;
