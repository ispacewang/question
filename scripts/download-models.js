#!/usr/bin/env node
/**
 * scripts/download-models.js — 模型预下载工具
 *
 * 从 HuggingFace (或镜像站) 下载 ONNX 量化模型到本地 models/ 目录。
 *
 * 用法:
 *   node scripts/download-models.js                      # 下载全部 (自动选择可用源)
 *   node scripts/download-models.js --model 0.5B         # 仅下载轻量版
 *   node scripts/download-models.js --model 1.5B         # 仅下载标准版
 *   node scripts/download-models.js --mirror hf-mirror   # 强制使用 hf-mirror.com
 *   node scripts/download-models.js --list               # 列出可用模型
 *
 * 镜像选项: hf-mirror (hf-mirror.com), 自动 (auto, 默认)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { pipeline } = require('stream');
const { promisify } = require('util');
const streamPipeline = promisify(pipeline);

// ============================================================
// 模型清单
// ============================================================

const MODELS = {
  'qwen1.5': {
    name: 'Qwen1.5-0.5B-Chat',
    repo: 'Xenova/Qwen1.5-0.5B-Chat',
    label: 'Qwen1.5 0.5B (推荐)',
    description: 'Transformers.js 官方维护，兼容性最佳',
    diskMB: 400,
    ramGB: '1.0 - 1.5',
    speedDesc: '⚡ 快 (10-20 tokens/s)',
    qualityDesc: '中文答疑',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'generation_config.json',
      'vocab.json',
      'merges.txt',
      'special_tokens_map.json',
      'added_tokens.json',
      'onnx/decoder_model_merged_quantized.onnx',
    ],
  },
  '0.5B': {
    name: 'Qwen2.5-0.5B-Instruct',
    repo: 'onnx-community/Qwen2.5-0.5B-Instruct',
    label: '轻量版 (0.5B)',
    description: '最低资源占用，适合低配机器',
    diskMB: 510,
    ramGB: '1.0 - 1.5',
    speedDesc: '⚡ 快 (10-20 tokens/s)',
    qualityDesc: '基础中文答疑',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'generation_config.json',
      'merges.txt',
      'vocab.json',
      'special_tokens_map.json',
      'added_tokens.json',
      'quantize_config.json',
      'onnx/model_q4f16.onnx',
      'onnx/model_quantized.onnx',
    ],
  },
  '1.5B': {
    name: 'Qwen2.5-1.5B-Instruct',
    repo: 'onnx-community/Qwen2.5-1.5B-Instruct',
    label: '标准版 (1.5B)',
    description: '推荐选择，回答质量更好',
    diskMB: 1280,
    ramGB: '2.5 - 3.5',
    speedDesc: '中等 (5-10 tokens/s)',
    qualityDesc: '良好中文答疑',
    files: [
      'config.json',
      'tokenizer.json',
      'tokenizer_config.json',
      'generation_config.json',
      'merges.txt',
      'vocab.json',
      'special_tokens_map.json',
      'added_tokens.json',
      'quantize_config.json',
      'onnx/model_q4f16.onnx',
      'onnx/model_quantized.onnx',
    ],
  },
};

// ============================================================
// 镜像源
// ============================================================

const MIRRORS = {
  'auto': null,                  // 自动检测
  'hf-mirror': 'https://hf-mirror.com',
  'huggingface': 'https://huggingface.co',
};

const MODEL_ROOT = path.resolve(__dirname, '..', 'models');

// ============================================================
// 工具函数
// ============================================================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units;
}

/**
 * 测试一个镜像源是否可达
 */
function testMirror(baseUrl, timeout = 5000) {
  return new Promise((resolve) => {
    const url = new URL(baseUrl);
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.get(`${baseUrl}/api/status`, { timeout }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/**
 * 自动选择可用镜像
 */
async function autoSelectMirror() {
  console.log('🔍 检测可用下载源...');

  const candidates = [
    { name: 'hf-mirror (国内镜像)', url: MIRRORS['hf-mirror'] },
    { name: 'HuggingFace 官方', url: MIRRORS['huggingface'] },
  ];

  for (const c of candidates) {
    const ok = await testMirror(c.url);
    if (ok) {
      console.log(`   ✅ ${c.name} 可用: ${c.url}`);
      return c.url;
    }
    console.log(`   ❌ ${c.name} 不可达`);
  }

  console.error('\n❌ 所有下载源均不可达。请检查网络连接或使用代理。');
  console.error('   可设置环境变量: set HTTPS_PROXY=http://127.0.0.1:7890');
  process.exit(1);
}

// ============================================================
// 下载逻辑
// ============================================================

/**
 * 下载单个文件，支持断点续传
 */
async function downloadFile(baseUrl, repo, filename, destPath) {
  const url = `${baseUrl}/${repo}/resolve/main/${filename}`;
  ensureDir(path.dirname(destPath));

  if (fs.existsSync(destPath)) {
    const s = fs.statSync(destPath);
    if (s.size > 1024) {
      // 对大文件做完整性检查（config.json 开头应该是 {）
      if (filename === 'config.json') {
        const head = fs.readFileSync(destPath, 'utf8').slice(0, 1);
        if (head !== '{') {
          console.log(`  ⚠  文件损坏，重新下载: ${filename}`);
          fs.unlinkSync(destPath);
        } else {
          console.log(`  ⏭  跳过: ${filename} (${formatSize(s.size)})`);
          return;
        }
      } else {
        console.log(`  ⏭  跳过: ${filename} (${formatSize(s.size)})`);
        return;
      }
    } else {
      console.log(`  ⚠  文件太小，重新下载: ${filename}`);
      fs.unlinkSync(destPath);
    }
  }

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await doDownload(url, filename, destPath);
      return; // 成功
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        const wait = attempt * 2;
        console.log(`  🔄 重试 ${attempt}/${MAX_RETRIES} (${wait}s 后)...`);
        await new Promise(r => setTimeout(r, wait * 1000));
      } else {
        throw err;
      }
    }
  }
}

function doDownload(url, filename, destPath, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('重定向次数过多'));

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const mod = urlObj.protocol === 'https:' ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
    };

    const req = mod.request(options, (response) => {
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume(); // 消耗响应体
        const loc = response.headers.location;
        // 处理相对 URL
        const resolved = loc.startsWith('http') ? loc : new URL(loc, url).toString();
        doDownload(resolved, filename, destPath, redirectCount + 1)
          .then(resolve).catch(reject);
        return;
      }

      if (response.statusCode === 403) {
        response.resume();
        reject(new Error('HTTP 403 (可能需要登录或镜像不支持大文件)'));
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      handleResponse(response, filename, destPath, resolve, reject);
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('下载超时')); });
    req.on('error', reject);
    req.end();
  });
}

function handleResponse(response, filename, destPath, resolve, reject) {
  const totalSize = parseInt(response.headers['content-length'], 10) || 0;
  const tmpPath = destPath + '.tmp';
  const writeStream = fs.createWriteStream(tmpPath);

  let downloaded = 0;
  const startTime = Date.now();

  response.on('data', (chunk) => {
    downloaded += chunk.length;
    if (totalSize > 0) {
      const pct = Math.round((downloaded / totalSize) * 100);
      const elapsed = Math.max((Date.now() - startTime) / 1000, 0.1);
      const speed = downloaded / elapsed;
      process.stdout.write(`\r  📥 ${filename}: ${pct}% (${formatSize(downloaded)}/${formatSize(totalSize)} | ${formatSize(speed)}/s)  `);
    }
  });

  streamPipeline(response, writeStream)
    .then(() => {
      fs.renameSync(tmpPath, destPath);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r  ✅ ${filename}: ${formatSize(downloaded)} (${elapsed}s)${' '.repeat(20)}\n`);
      resolve();
    })
    .catch((err) => {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      reject(err);
    });
}

function getDirSize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else total += fs.statSync(p).size;
    }
  };
  walk(dir);
  return total;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const args = process.argv.slice(2);

  // --list
  if (args.includes('--list') || args.includes('-l')) {
    console.log('\n📦 可用 AI 模型:\n');
    for (const [key, m] of Object.entries(MODELS)) {
      console.log(`  ${key.padEnd(6)} ${m.label}`);
      console.log(`         ${m.description}`);
      console.log(`         磁盘: ~${m.diskMB} MB  |  内存: ~${m.ramGB} GB`);
      console.log(`         速度: ${m.speedDesc}`);
      console.log(`         质量: ${m.qualityDesc}`);
      console.log();
    }
    return;
  }

  // 镜像选择
  const mirrorArg = args.find(a => a.startsWith('--mirror='));
  const mirrorKey = mirrorArg ? mirrorArg.split('=')[1] : 'auto';

  let baseUrl;
  if (mirrorKey === 'auto') {
    baseUrl = await autoSelectMirror();
  } else if (MIRRORS[mirrorKey]) {
    baseUrl = MIRRORS[mirrorKey];
    console.log(`📡 使用镜像: ${baseUrl} (${mirrorKey})`);
  } else {
    console.error(`❌ 未知镜像: "${mirrorKey}"。可用: ${Object.keys(MIRRORS).join(', ')}`);
    process.exit(1);
  }

  // 模型选择
  const modelArg = args.find(a => a.startsWith('--model='));
  const modelKey = modelArg ? modelArg.split('=')[1] : null;

  let toDownload;
  if (modelKey) {
    if (!MODELS[modelKey]) {
      console.error(`❌ 未知模型: "${modelKey}"。可用: ${Object.keys(MODELS).join(', ')}`);
      process.exit(1);
    }
    toDownload = { [modelKey]: MODELS[modelKey] };
  } else {
    toDownload = MODELS;
  }

  const modelCount = Object.keys(toDownload).length;
  console.log(`\n🤖 开始下载 ${modelCount} 个模型到 ${MODEL_ROOT}/\n`);

  for (const [key, model] of Object.entries(toDownload)) {
    console.log(`━━━ ${model.label} (${model.repo}) ━━━`);
    console.log(`  预计大小: ~${model.diskMB} MB  |  内存需求: ~${model.ramGB} GB\n`);

    const baseDir = path.join(MODEL_ROOT, model.repo);
    let failed = 0;

    for (const file of model.files) {
      const destPath = path.join(baseDir, file);
      try {
        await downloadFile(baseUrl, model.repo, file, destPath);
      } catch (err) {
        console.error(`  ❌ 失败: ${file} — ${err.message}`);
        failed++;
      }
    }

    if (failed > 0) {
      console.error(`\n⚠️  ${model.label}: ${failed}/${model.files.length} 个文件下载失败。`);
      console.error(`   可重试: node scripts/download-models.js --model=${key} --mirror=${mirrorKey}\n`);
    } else {
      console.log(`\n✅ ${model.label}: 全部下载完成\n`);
    }
  }

  // 磁盘占用
  console.log('━━━ 磁盘占用汇总 ━━━');
  for (const [key, model] of Object.entries(toDownload)) {
    const dir = path.join(MODEL_ROOT, model.repo);
    const size = getDirSize(dir);
    console.log(`  ${key.padEnd(6)} ${model.label}: ${formatSize(size)} (预计 ~${model.diskMB} MB)`);
  }
  console.log();
}

main().catch(err => {
  console.error('\n❌ 下载中断:', err.message);
  process.exit(1);
});
