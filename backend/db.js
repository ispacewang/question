// backend/db.js (智能路径选择版)

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

/**
 * 智能获取数据库存储路径的函数
 * @returns {string} 返回一个绝对的、可写的数据库文件夹路径
 */
function getDbFolderPath() {
  // 尝试加载 electron 模块
  try {
    const { app } = require('electron');
    // 如果 app 对象存在，说明我们正运行在 Electron 环境中
    if (app) {
      // 使用 Electron 官方推荐的用户数据目录
      const userDataPath = app.getPath('userData');
      // 在用户数据目录下创建一个 'database' 文件夹，更规范
      return path.join(userDataPath, 'database');
    }
  } catch (error) {
    // 如果 require('electron') 失败或 app 不存在，说明在纯 Node.js 环境
    // 此时，我们将数据库放在项目后端目录下的 'database' 文件夹中，便于开发
    console.log('Running in Node.js development mode. Using local path.');
    return path.join(__dirname, 'database');
  }
  
  // 作为一个备用方案，如果上面的逻辑都失败了
  return path.join(__dirname, 'database');
}


// 1. 获取数据库存储文件夹路径
const dbFolderPath = getDbFolderPath();

// 2. 确保这个文件夹存在，如果不存在则创建它
if (!fs.existsSync(dbFolderPath)) {
  fs.mkdirSync(dbFolderPath, { recursive: true });
}

// 3. 定义数据库文件的最终完整路径
const dbPath = path.join(dbFolderPath, 'questions.db');

console.log('Database path:', dbPath); // 打印数据库路径，方便调试

// 4. 使用这个绝对、可写的路径来创建数据库实例
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// 初始化表的代码保持不变
db.exec(`
    CREATE TABLE IF NOT EXISTS banks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_id INTEGER,
        question TEXT NOT NULL,
        options TEXT,
        answer TEXT,
        explanation TEXT,
        type TEXT,
        meta TEXT,
        FOREIGN KEY (bank_id) REFERENCES banks (id)
    );
`);

// ─── 导出数据库实例供其他模块使用 ───
module.exports = db;
