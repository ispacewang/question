<template>
  <el-card>

    <!-- 
      上传对话框 
      - v-loading="isLoading": 核心！根据 isLoading 的值来显示或隐藏加载动画
      - element-loading-text: 自定义加载动画下方的提示文字
      - element-loading-background: 设置加载动画的背景色，半透明效果更佳
    -->
    <el-dialog
      v-model="dialogVisible"
      title="上传题库文件"
      width="400px"
      v-loading="isLoading"
      element-loading-text="正在上传并解析文件，请稍候..."
      element-loading-background="rgba(255, 255, 255, 0.7)"
    >
      <el-upload
        class="upload-demo"
        drag
        :action="null"
        :http-request="customRequest"
        :show-file-list="false"
        accept=".xlsx,.xls,.csv"
      >
        <el-icon class="el-icon--upload"><upload-filled /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">
            支持Excel/CSV，表头需包含：题型, 题干, 选项, 答案, 解析 等。
          </div>
        </template>
      </el-upload>
    </el-dialog>

    <!-- 上传成功后，在主界面显示的提示信息 -->
    <div v-if="successMessage" style="margin-top: 16px;">
      <el-alert :title="successMessage" type="success" show-icon @close="successMessage = ''" />
    </div>
  </el-card>
</template>

<script setup>
import { ref } from 'vue';
import { uploadFile } from '../api';
import { ElMessage } from 'element-plus'; // 引入 ElMessage 用于即时消息提示
import { UploadFilled } from '@element-plus/icons-vue'; // 引入图标

// 控制加载动画的显示
const isLoading = ref(false);
// 控制对话框的显示
const dialogVisible = ref(false);
// 用于存储上传成功后的提示信息
const successMessage = ref('');
const emit = defineEmits(['uploaded']);

const customRequest = async ({ file }) => {
  // 1. 开始加载，显示动画
  isLoading.value = true;
  successMessage.value = ''; // 清空上一次的成功提示

  try {
    // 2. 调用上传接口，等待后端处理
    const res = await uploadFile(file);

    // 3. 上传成功
    const count = res.data.count;
    successMessage.value = `题库上传成功，共 ${count} 题`;
    ElMessage.success(`上传成功，共处理 ${count} 题！`); // 弹出全局成功提示
    
    emit('uploaded'); // 通知父组件，题库已更新
    dialogVisible.value = false; // 关闭对话框

  } catch (e) {
    // 4. 上传失败
    const errorMessage = e.response?.data?.error || '上传失败，请检查文件格式或网络连接';
    ElMessage.error(errorMessage); // 弹出全局错误提示
    console.error(e); // 在控制台打印详细错误，方便调试

  } finally {
    // 5. 无论成功或失败，最后都要结束加载，隐藏动画
    isLoading.value = false;
  }
};
</script>

<style scoped>
.upload-mini-icon {
  font-size: 24px;
  color: #409EFF;
  cursor: pointer;
  vertical-align: middle;
  margin-bottom: 8px;
}
.upload-mini-icon:hover {
  color: #66b1ff;
}
.upload-demo {
  width: 100%;
}
.el-upload__tip {
  text-align: center;
  color: #909399;
  margin-top: 7px;
}
</style>
