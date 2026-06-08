/** @file api.js — 后端 API 封装 (axios)，统一 baseURL localhost:13002 */
import axios from 'axios';

axios.defaults.baseURL = 'http://localhost:13002';

/**
 * 上传题库文件（Excel/CSV）
 * @param {File} file - 要上传的文件
 * @param {string} [bankName] - 可选题库名称
 * @returns {Promise} axios POST 响应
 */
export function uploadFile(file, bankName) {
  const formData = new FormData();
  formData.append('file', file);
  if (bankName) formData.append('bankName', bankName);
  return axios.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/**
 * 获取所有题库列表
 * @returns {Promise} axios GET 响应
 */
export function getBanks() {
  return axios.get('/banks');
}

/**
 * 获取指定题库的题目
 * @param {string} bankName - 题库名称
 * @param {number} order - 题目序号（从0开始）
 * @param {string[]} [types] - 筛选题型数组
 * @returns {Promise} axios GET 响应
 */
export function getQuestion(bankName, order, types) {
  return axios.get('/question', { params: { bankName, order, types: types ? types.join(',') : undefined } });
}

/**
 * 提交用户答案并获取正误反馈
 * @param {string} id - 题目 ID
 * @param {string} userAnswer - 用户答案
 * @param {string} bankName - 所属题库名称
 * @returns {Promise} axios POST 响应
 */
export function submitAnswer(id, userAnswer, bankName) {
  return axios.post('/answer', { id, userAnswer, bankName });
}

/**
 * 生成考试试卷
 * @param {string} bankName - 题库名称
 * @param {number} count - 试卷题目数量
 * @returns {Promise} axios GET 响应
 */
export function generatePaper(bankName, count) {
  return axios.get('/generate-paper', { params: { bankName, count } });
}

/**
 * 删除指定题库
 * @param {string} bankName - 要删除的题库名称
 * @returns {Promise} axios DELETE 响应
 */
export function deleteBank(bankName) {
  return axios.delete('/bank', { params: { bankName } });
}
