/** @file Exam.vue — 考试模式组件，三栏布局（答题卡|题目|提示），计时交卷，结果显示（环形分数图/统计条/错题回顾/满分碎屑） */
<template>
  <div class="w-full">
    <!-- ===== 加载状态 ===== -->
    <div
      v-if="!examStarted && !submitted"
      class="max-w-[500px] mx-auto my-16 py-8 text-center"
    >
      <div class="h-3 w-[35%] bg-muted rounded animate-pulse mx-auto mb-3.5" />
      <div class="h-3 w-full bg-muted rounded animate-pulse mx-auto mb-2.5" />
      <div class="h-3 w-[75%] bg-muted rounded animate-pulse mx-auto mb-2.5" />
      <p class="text-muted-foreground mt-4 text-sm">正在生成试卷…</p>
    </div>

    <!-- ===== 考试中 ===== -->
    <template v-else-if="examStarted">
      <!-- 信息栏 -->
      <div
        class="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/50"
      >
        <div class="flex items-center flex-wrap gap-1.5">
          <span class="inline-flex items-center gap-1.5">
            <span class="text-xs text-muted-foreground font-medium">题库</span>
            <span class="text-sm font-semibold">{{ examInfo.bank }}</span>
          </span>
          <span class="w-px h-3.5 bg-border mx-1" />
          <span class="inline-flex items-center gap-1.5">
            <span class="text-xs text-muted-foreground font-medium">时长</span>
            <span class="text-sm font-semibold">{{ examInfo.duration }}分钟</span>
          </span>
          <span class="w-px h-3.5 bg-border mx-1" />
          <span class="inline-flex items-center gap-1.5">
            <span class="text-xs text-muted-foreground font-medium">进度</span>
            <span class="text-sm font-semibold"
              >{{ currentIdx + 1 }}/{{ questions.length }}</span
            >
          </span>
          <span class="w-px h-3.5 bg-border mx-1" />
          <span class="inline-flex items-center gap-1.5">
            <span class="text-xs text-muted-foreground font-medium">剩余</span>
            <span class="text-sm font-semibold text-destructive tabular-nums">{{
              timeStr
            }}</span>
          </span>
        </div>
        <Button variant="destructive" size="sm" @click="onExitExam">退出考试</Button>
      </div>

      <!-- 三栏布局 -->
      <div
        class="grid"
        style="grid-template-columns: 180px 1fr 300px; height: calc(100vh - 130px)"
      >
        <!-- 左栏：答题卡 -->
        <div class="p-3.5 overflow-y-auto border-r border-border">
          <div
            class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3.5 pb-2.5 border-b border-border"
          >
            答题卡
          </div>
          <div class="grid grid-cols-4 gap-1">
            <template v-for="(ans, qi) in answers" :key="qi">
              <div
                v-if="isNewTypeSection(qi)"
                class="col-span-4 text-[10px] font-semibold text-muted-foreground mt-3 pb-1 border-b border-border first:mt-0"
              >
                {{ questions[qi].type }}
              </div>
              <div
                class="flex items-center justify-center w-[28px] h-[28px] text-[11px] font-medium cursor-pointer border rounded transition-all duration-150"
                :class="{
                  'bg-primary text-primary-foreground border-primary font-bold':
                    qi === currentIdx,
                  'bg-success/10 text-success border-success/25':
                    qi !== currentIdx && ans !== null,
                  'border-warning ring-1 ring-warning': markedSet.has(qi),
                  'border-border text-muted-foreground':
                    qi !== currentIdx && ans === null && !markedSet.has(qi),
                }"
                @click="goTo(qi)"
              >
                {{ qi + 1 }}
              </div>
            </template>
          </div>
        </div>

        <!-- 中间：题目 -->
        <div class="px-8 py-7 max-w-[740px] w-full mx-auto overflow-y-auto">
          <!-- 题头 -->
          <div
            class="flex justify-between items-center pb-3.5 mb-4 border-b border-border"
          >
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-base font-bold text-primary"
                >第 {{ currentIdx + 1 }} 题</span
              >
              <Badge variant="default">{{ questions[currentIdx].type }}</Badge>
              <Badge v-if="questions[currentIdx].meta?.['题目分类']" variant="success">{{
                questions[currentIdx].meta["题目分类"]
              }}</Badge>
              <Badge v-if="questions[currentIdx].meta?.['一级纲要']" variant="warning">{{
                questions[currentIdx].meta["一级纲要"]
              }}</Badge>
            </div>
            <Button variant="ghost" size="sm" @click="toggleMark">
              <Star class="size-3.5" :fill="markedSet.has(currentIdx) ? 'currentColor' : 'none'" />
            </Button>
          </div>

          <!-- 题干 -->
          <KatexRender class="text-base font-semibold leading-relaxed mb-8 block" :text="questions[currentIdx].question" />

          <!-- 配图 -->
          <DiagramBoard
            v-if="examDiagramConfig || examDiagramSvg"
            :config="examDiagramConfig"
            :svg="examDiagramSvg"
          />

          <!-- 简答/填空 -->
          <div v-if="questions[currentIdx].type === '简答题' || questions[currentIdx].type === '填空题'" class="space-y-2 mb-5">
            <div class="flex items-center justify-between">
              <span class="text-[10px] text-muted-foreground uppercase tracking-wider">{{ questions[currentIdx].type }}</span>
              <button
                @click="showExamPreview = !showExamPreview"
                class="text-[11px] px-2 py-0.5 border transition-colors"
                :class="showExamPreview ? 'border-primary/40 bg-primary/10 text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
              ><Ruler class="size-3.5 inline-block -mt-0.5" /> 预览公式</button>
            </div>
            <Textarea v-model="answers[currentIdx]" :rows="4" placeholder="输入答案...（支持 $公式$ 语法）" />
            <div v-if="showExamPreview && answers[currentIdx]" class="p-3 border border-border/50 bg-muted/30 min-h-[2em] text-sm leading-relaxed">
              <KatexRender :text="answers[currentIdx]" />
            </div>
          </div>

          <!-- 多选 -->
          <div
            v-else-if="questions[currentIdx].type === '多选题'"
            class="flex flex-col gap-2 mb-5 border border-border rounded-lg p-px"
          >
            <div
              v-for="(opt, i) in questions[currentIdx].options"
              :key="i"
              class="flex items-start gap-2.5 px-3.5 py-2.5 border border-border rounded-md cursor-pointer transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:translate-x-0.5"
              :class="{
                'border-primary bg-primary/5': answers[currentIdx]?.includes(
                  String.fromCharCode(65 + i)
                ),
              }"
              @click="toggleMultiOption(i)"
            >
              <span
                class="flex items-center justify-center w-6 h-6 border rounded text-xs font-semibold flex-shrink-0 transition-colors"
                :class="
                  answers[currentIdx]?.includes(String.fromCharCode(65 + i))
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border text-muted-foreground'
                "
                >{{ String.fromCharCode(65 + i) }}</span
              >
              <span class="text-sm leading-relaxed pt-0.5"><KatexRender :text="stripOpt(opt)" /></span>
            </div>
          </div>

          <!-- 单选/判断 -->
          <div
            v-else
            class="flex flex-col gap-2 mb-5 border border-border rounded-lg p-px"
          >
            <div
              v-for="(opt, i) in questions[currentIdx].options"
              :key="i"
              class="flex items-start gap-2.5 px-3.5 py-2.5 border border-border rounded-md cursor-pointer transition-all duration-200 hover:border-primary hover:bg-primary/5 hover:translate-x-0.5"
              :class="{
                'border-primary bg-primary/5':
                  answers[currentIdx] === String.fromCharCode(65 + i),
              }"
              @click="answers[currentIdx] = String.fromCharCode(65 + i)"
            >
              <span
                class="flex items-center justify-center w-6 h-6 border rounded text-xs font-semibold flex-shrink-0 transition-colors"
                :class="
                  answers[currentIdx] === String.fromCharCode(65 + i)
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-border text-muted-foreground'
                "
                >{{ String.fromCharCode(65 + i) }}</span
              >
              <span class="text-sm leading-relaxed pt-0.5"><KatexRender :text="stripOpt(opt)" /></span>
            </div>
          </div>

          <!-- 导航按钮 -->
          <div class="flex gap-2 pt-4 border-t border-border">
            <Button size="lg" variant="outline" :disabled="currentIdx === 0" @click="prev"
              >← 上一题</Button
            >
            <Button
              size="lg"
              variant="outline"
              :disabled="currentIdx === questions.length - 1"
              @click="next"
              >下一题 →</Button
            >
            <Button size="lg" class="ml-auto" :disabled="submitted" @click="onSubmitExam"
              >交卷</Button
            >
          </div>
        </div>

        <!-- 右栏：占位 -->
        <div class="border-l border-border p-4 overflow-y-auto">
          <div
            class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3.5 pb-2.5 border-b border-border"
          >
            提示
          </div>
          <p class="text-xs text-muted-foreground leading-relaxed">
            · 点击答题卡序号快速跳转<br />
            · <Star class="size-3 inline-block -mt-0.5" /> 标记可标记疑问题目<br />
            · 交卷后自动判分
          </p>
        </div>
      </div>
    </template>

    <!-- ===== 交卷结果 ===== -->
    <div v-else-if="submitted" class="relative flex-1 overflow-y-auto overflow-x-hidden" id="exam-result-top">
      <!-- 满分碎屑动画 -->
      <canvas
        v-if="showConfetti"
        ref="confettiCanvas"
        class="absolute inset-0 z-50 pointer-events-none block"
      />

      <div :class="['mx-auto px-6 py-8', wrongSet.size ? 'max-w-[900px]' : 'max-w-[640px]']">
        <!-- 顶部操作栏 -->
        <div id="result-top-bar" class="flex items-center justify-between mb-8">
          <button
            @click="onExitExam"
            class="group inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="group-hover:-translate-x-0.5 transition-transform"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
            返回题库
          </button>
          <button
            @click="saveExamRecord"
            :disabled="saved"
            class="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium border transition-colors"
            :class="saved ? 'border-success/30 bg-success/[0.06] text-success cursor-default' : 'border-border hover:border-primary hover:text-primary'"
          >
            <svg v-if="!saved" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>
            {{ saved ? '已保存' : '保存成绩' }}
          </button>
        </div>

        <!-- 分数卡片 -->
        <div class="text-center mb-10">
          <!-- 圆形/环形分数 -->
          <div class="relative inline-flex items-center justify-center mb-5">
            <svg class="w-36 h-36 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-border)" stroke-width="6" />
              <circle
                cx="60" cy="60" r="52" fill="none"
                :stroke="score / questions.length >= 0.6 ? 'var(--color-success)' : 'var(--color-destructive)'"
                stroke-width="6"
                stroke-linecap="round"
                :stroke-dasharray="326.7"
                :stroke-dashoffset="326.7 * (1 - score / questions.length)"
                class="transition-all duration-1000 ease-out"
              />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-4xl font-bold -tracking-[0.02em] tabular-nums">{{ score }}</span>
              <span class="text-sm text-muted-foreground">/ {{ questions.length }}</span>
            </div>
          </div>

          <!-- 等级评语 -->
          <div class="flex items-center justify-center gap-2 text-lg font-semibold mb-1">
            <Trophy v-if="score === questions.length" class="size-5 text-amber-500" />
            <ThumbsUp v-else-if="score / questions.length >= 0.6" class="size-5 text-primary" />
            <TrendingUp v-else class="size-5 text-muted-foreground" />
            <span>{{ gradeText }}</span>
          </div>
          <p class="text-sm text-muted-foreground">
            正确率 {{ Math.round(score / questions.length * 100) }}% · 答对 {{ score }} 题 · 答错 {{ wrongSet.size }} 题
          </p>
        </div>

        <!-- 统计条 -->
        <div class="flex gap-1.5 mb-8 rounded-none overflow-hidden h-2">
          <div
            class="h-full bg-success transition-all duration-700 ease-out"
            :style="{ width: (score / questions.length * 100) + '%' }"
          />
          <div
            class="h-full bg-destructive transition-all duration-700 ease-out"
            :style="{ width: (wrongSet.size / questions.length * 100) + '%' }"
          />
        </div>

        <!-- 错题详情 -->
        <div v-if="wrongSet.size" class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">错题回顾 ({{ wrongSet.size }} 题)</h3>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              v-for="wi in sortedWrong"
              :key="wi"
              class="border border-border p-5 space-y-3"
            >
            <!-- 题号 + 题型 -->
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-muted-foreground w-6 tabular-nums">{{ wi + 1 }}</span>
              <Badge variant="outline">{{ questions[wi].type }}</Badge>
            </div>

            <!-- 题干 -->
            <KatexRender class="text-sm font-medium leading-relaxed" :text="questions[wi].question" />

            <!-- 配图 -->
            <DiagramBoard
              v-if="questions[wi]?.meta?.diagram || questions[wi]?.meta?.diagramSvg"
              :config="questions[wi]?.meta?.diagram"
              :svg="questions[wi]?.meta?.diagramSvg"
              :width="360" :height="240"
            />

            <!-- 选项 -->
            <div v-if="questions[wi].options && questions[wi].options.length" class="flex flex-col gap-0.5">
              <div
                v-for="(opt, j) in questions[wi].options"
                :key="j"
                class="text-xs px-2.5 py-1.5 border border-transparent flex items-center gap-2.5"
                :class="{
                  'border-success/30 bg-success/[0.06] dark:bg-success/[0.10]': wrongDetails[wi]?.answer?.includes(String.fromCharCode(65 + j)),
                  'border-destructive/30 bg-destructive/[0.06] dark:bg-destructive/[0.08]': answers[wi] === String.fromCharCode(65 + j) && !wrongDetails[wi]?.answer?.includes(String.fromCharCode(65 + j)),
                }"
              >
                <span class="w-5 h-5 flex items-center justify-center border text-[10px] font-semibold flex-shrink-0"
                  :class="{
                    'border-success bg-success text-success-foreground': wrongDetails[wi]?.answer?.includes(String.fromCharCode(65 + j)),
                    'border-destructive bg-destructive text-destructive-foreground': answers[wi] === String.fromCharCode(65 + j) && !wrongDetails[wi]?.answer?.includes(String.fromCharCode(65 + j)),
                    'border-border text-muted-foreground': !wrongDetails[wi]?.answer?.includes(String.fromCharCode(65 + j)) && answers[wi] !== String.fromCharCode(65 + j),
                  }"
                >{{ String.fromCharCode(65 + j) }}</span>
                <KatexRender class="text-xs" :text="stripOpt(opt)" />
              </div>
            </div>

            <!-- 答案对比 -->
            <div class="flex flex-col gap-1.5 text-xs pt-2 border-t border-border/50">
              <div class="flex gap-2">
                <span class="text-muted-foreground w-9 flex-shrink-0">你的</span>
                <KatexRender class="text-destructive font-medium" :text="fmtAns(answers[wi], questions[wi])" />
              </div>
              <div class="flex gap-2">
                <span class="text-muted-foreground w-9 flex-shrink-0">正确</span>
                <KatexRender class="text-success font-medium" :text="wrongDetails[wi]?.answer || '?'" />
              </div>
            </div>

            <!-- 解析 -->
            <div v-if="wrongDetails[wi]?.explanation" class="p-3.5 bg-muted/50 border-l-2 border-primary">
              <span class="text-[10px] font-semibold text-primary uppercase tracking-wider block mb-1.5">解析</span>
              <KatexRender class="text-xs leading-relaxed text-muted-foreground" :text="wrongDetails[wi].explanation" />
            </div>
          </div>
          </div>
        </div>

        <!-- 全对 -->
        <div v-else class="py-6 text-center text-muted-foreground">
          <p class="text-sm">没有错题，继续保持！</p>
        </div>

        <!-- 底部操作 -->
        <div class="mt-10 pt-6 border-t border-border" />

        <!-- 返回顶部浮动按钮 -->
        <button
          v-if="showBackToTop"
          @click="scrollToTop"
          class="fixed bottom-6 right-6 z-30 w-10 h-10 flex items-center justify-center border border-border bg-background hover:border-primary/60 hover:text-primary transition-colors shadow-sm"
          title="返回顶部"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m18 15-6-6-6 6"/></svg>
        </button>
      </div>
    </div>

    <!-- AlertDialogs（在所有状态下可用） -->
    <AlertDialog
      :open="showExitDialog"
      title="确认退出"
      description="退出后本次答题不保存。"
      confirm-text="确定"
      cancel-text="取消"
      variant="destructive"
      @update:open="showExitDialog = $event"
      @confirm="confirmExit"
      @cancel="showExitDialog = false"
    />
    <AlertDialog
      :open="showSubmitDialog"
      title="交卷确认"
      description="交卷后立即判分。"
      confirm-text="确定"
      cancel-text="取消"
      @update:open="showSubmitDialog = $event"
      @confirm="confirmSubmit"
      @cancel="showSubmitDialog = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted, onMounted, watch, nextTick } from "vue";
import { toast } from "vue-sonner";
import Button from "./ui/Button.vue";
import Badge from "./ui/Badge.vue";
import Textarea from "./ui/Textarea.vue";
import AlertDialog from "./ui/AlertDialog.vue";
import KatexRender from "./KatexRender.vue";
import DiagramBoard from "./DiagramBoard.vue";
import * as api from "../api";
import { useExamHistory } from "../composables/useExamHistory";
import axios from "axios";
import { Star, Ruler, Trophy, ThumbsUp, TrendingUp } from 'lucide-vue-next'

const props = defineProps({ examInfo: { type: Object, required: true } });

const questions = ref([]);
const answers = ref([]);
const markedSet = ref(new Set());
const currentIdx = ref(0);
const timer = ref(null);
const timeLeft = ref(0);
const examStarted = ref(false);
const submitted = ref(false);
const showExamPreview = ref(false);
const score = ref(0);
const wrongSet = ref(new Set());
const correctSet = ref(new Set());
const wrongDetails = ref({});
const showConfetti = ref(false);
const confettiCanvas = ref(null);
const saved = ref(false);
const showBackToTop = ref(false);
let scrollObserver = null;

const { saveExam } = useExamHistory();

const showExitDialog = ref(false);
const showSubmitDialog = ref(false);

const stripOpt = (s) => (s || '').replace(/^(?:[A-Fa-f]\s*[.、)）：:．]\s*)+/, '')

/** 按序号升序排列的错误题号列表 */
const sortedWrong = computed(() => Array.from(wrongSet.value).sort((a, b) => a - b));
/** 格式化剩余时间为 mm:ss */
const timeStr = computed(() => {
  const m = Math.floor(timeLeft.value / 60)
    .toString()
    .padStart(2, "0");
  const s = (timeLeft.value % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
});

const examDiagramConfig = computed(() => questions.value[currentIdx.value]?.meta?.diagram || null)
const examDiagramSvg = computed(() => questions.value[currentIdx.value]?.meta?.diagramSvg || '')

/** 等级评语文本 */
const gradeText = computed(() => {
  if (score.value === questions.value.length) return '满分！太厉害了！'
  if (score.value / questions.value.length >= 0.8) return '优秀，继续加油！'
  if (score.value / questions.value.length >= 0.6) return '不错，还有进步空间'
  return '继续努力，你可以的！'
})

/**
 * 生成试卷：请求 /generate-paper 接口，初始化答题状态并启动倒计时
 * @returns {Promise<void>}
 */
const genPaper = async () => {
  const params = { bankName: props.examInfo.bank };
  if (props.examInfo.typeCounts) {
    params.counts = JSON.stringify(props.examInfo.typeCounts);
  }
  const r = await axios.get("/generate-paper", { params });
  questions.value = r.data;
  answers.value = Array(questions.value.length).fill(null);
  markedSet.value = new Set();
  currentIdx.value = 0;
  timeLeft.value = (props.examInfo.duration || 60) * 60;
  examStarted.value = true;
  submitted.value = false;
  score.value = 0;
  wrongSet.value = new Set();
  correctSet.value = new Set();
  wrongDetails.value = {};
  if (timer.value) clearInterval(timer.value);
  timer.value = setInterval(() => {
    timeLeft.value--;
    if (timeLeft.value <= 0) {
      clearInterval(timer.value);
      submitExam();
    }
  }, 1000);
};

watch(
  () => props.examInfo,
  (v) => {
    if (v?.bank) genPaper();
  },
  { immediate: true }
);

const goTo = (i) => {
  if (examStarted.value) currentIdx.value = i;
};
const prev = () => {
  if (currentIdx.value > 0) currentIdx.value--;
};
const next = () => {
  if (currentIdx.value < questions.value.length - 1) currentIdx.value++;
};
/** 判断是否为题型分组的起始位置（题型切换时显示分隔标题） */
const isNewTypeSection = (qi) =>
  qi === 0 || questions.value[qi]?.type !== questions.value[qi - 1]?.type;

const toggleMark = () => {
  if (markedSet.value.has(currentIdx.value)) markedSet.value.delete(currentIdx.value);
  else markedSet.value.add(currentIdx.value);
};

/**
 * 切换多选题选项：点击字母添加/移除选中状态
 * @param {number} i - 选项索引 (0=A, 1=B, ...)
 */
function toggleMultiOption(i) {
  const l = String.fromCharCode(65 + i);
  if (!Array.isArray(answers.value[currentIdx.value]))
    answers.value[currentIdx.value] = [];
  const a = [...answers.value[currentIdx.value]];
  const p = a.indexOf(l);
  p === -1 ? a.push(l) : a.splice(p, 1);
  answers.value[currentIdx.value] = a;
}

const emit = defineEmits(["exit-exam"]);

const onExitExam = () => {
  if (saved.value) {
    emit("exit-exam");
  } else {
    showExitDialog.value = true;
  }
};
const confirmExit = () => {
  showExitDialog.value = false;
  emit("exit-exam");
};

const onSubmitExam = () => {
  if (submitted.value) return;
  const na = answers.value.findIndex((a, i) => {
    if (questions.value[i].type === "多选题") return !Array.isArray(a) || a.length === 0;
    return a == null || a === "";
  });
  if (na !== -1) {
    toast.warning(`第${na + 1}题未作答`);
    return;
  }
  showSubmitDialog.value = true;
};

const confirmSubmit = () => {
  showSubmitDialog.value = false;
  submitExam();
};

const fmtAns = (a, q) =>
  q.type === "多选题" && Array.isArray(a) ? a.join(", ") : a || "";

/**
 * 交卷判分：逐题提交答案，统计正确/错误，满分时触发碎屑动画
 * @returns {Promise<void>}
 */
const submitExam = async () => {
  if (submitted.value) return;
  clearInterval(timer.value);
  submitted.value = true;
  examStarted.value = false;
  let cc = 0;
  const wr = new Set(),
    cr = new Set(),
    wd = {};
  for (let i = 0; i < questions.value.length; i++) {
    const q = questions.value[i],
      a = answers.value[i];
    let r;
    try {
      r = await api.submitAnswer(q.id, a, props.examInfo.bank);
    } catch {
      wr.add(i);
      continue;
    }
    if (r.data?.correct) {
      cc++;
      cr.add(i);
    } else {
      wr.add(i);
      if (r.data) wd[i] = { answer: r.data.answer, explanation: r.data.explanation };
    }
  }
  score.value = cc;
  wrongSet.value = wr;
  correctSet.value = cr;
  wrongDetails.value = wd;

  // 满分碎屑动画
  if (cc === questions.value.length) {
    startConfetti();
  }
};

// ─── 满分碎屑 ───
/**
 * 满分碎屑动画：使用 Canvas 绘制彩色粒子飘落效果
 * @returns {Promise<void>}
 */
async function startConfetti() {
  showConfetti.value = true;
  await nextTick();

  const canvas = confettiCanvas.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const parent = canvas.parentElement;
  if (!parent) return;

  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;

  const colors = ['#4a7dbf', '#5d9b6a', '#b8954a', '#6b9fd4', '#c2655a', '#e5b8a0', '#a8c4e0', '#8ec49a'];
  const particles = [];
  const count = 120;

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.3 - canvas.height * 0.2,
      w: 4 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 5,
      rot: Math.random() * 360,
      rv: (Math.random() - 0.5) * 10,
    });
  }

  const start = performance.now();
  const DURATION = 1200;

  function frame(now) {
    const elapsed = now - start;
    if (elapsed > DURATION) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      showConfetti.value = false;
      return;
    }
    const fadeOut = elapsed > DURATION * 0.7 ? 1 - (elapsed - DURATION * 0.7) / (DURATION * 0.3) : 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.rot += p.rv;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.globalAlpha = fadeOut * (p.y > canvas.height * 0.5 ? Math.max(0, 1 - (p.y - canvas.height * 0.5) / (canvas.height * 0.5)) : 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ─── 保存成绩 / 返回顶部 ───
/**
 * 保存考试成绩到历史记录（调用 useExamHistory composable）
 */
function saveExamRecord() {
  if (saved.value) return;
  saveExam({
    bankName: props.examInfo.bank,
    score: score.value,
    total: questions.value.length,
    wrongCount: wrongSet.value.size,
    duration: props.examInfo.duration || 0,
    questions: questions.value,
    answers: answers.value,
    wrongDetails: wrongDetails.value,
    wrongSet: wrongSet.value,
  });
  saved.value = true;
  toast.success('成绩已保存');
}

function scrollToTop() {
  const el = document.getElementById('exam-result-top');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// 用 IntersectionObserver 检测顶部栏是否滚出视野
function setupScrollObserver() {
  if (scrollObserver) scrollObserver.disconnect();
  const bar = document.getElementById('result-top-bar');
  if (!bar) return;
  scrollObserver = new IntersectionObserver(
    ([entry]) => { showBackToTop.value = !entry.isIntersecting; },
    { threshold: 0 }
  );
  scrollObserver.observe(bar);
}

onUnmounted(() => {
  if (timer.value) clearInterval(timer.value);
  if (scrollObserver) scrollObserver.disconnect();
});

// 提交后设置滚动监听
watch(submitted, (v) => {
  if (v) nextTick(() => setupScrollObserver());
});
</script>
