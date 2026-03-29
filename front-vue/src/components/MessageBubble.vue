<template>
  <article class="flex w-full items-start gap-2" :class="rowClass">
    <div
      class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold tracking-[0.04em]"
      :class="avatarClass"
      aria-hidden="true"
    >
      {{ avatarLabel }}
    </div>
    <div class="flex min-w-0 flex-col gap-0.5" :class="shellClass" :style="{ maxWidth: shellMaxWidth }">
      <div class="flex items-center gap-2 text-[11px] text-ink-950/[0.56]" :class="metaClass">
        <span>{{ speakerName }}</span>
        <span>{{ formatTime(message.createdAt) }}</span>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:border-ink-950/8 disabled:bg-ink-950/[0.04] disabled:text-ink-950/[0.32]"
          :class="copyButtonClass"
          :disabled="!copyableContent"
          :aria-label="copied ? '已复制消息' : '复制消息'"
          :title="copied ? '已复制' : '复制'"
          @click="void handleCopy()"
        >
          <CheckOutlined v-if="copied" />
          <CopyOutlined v-else />
          <span>{{ copied ? "已复制" : "复制" }}</span>
        </button>
      </div>

      <div
        class="inline-flex max-w-full flex-col rounded-[18px] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.06)]"
        :class="bubbleClass"
      >
        <div
          v-if="showSourceLoading"
          class="mb-2 inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium"
          :class="sourceLoadingClass"
        >
          <LoadingOutlined class="text-[12px]" />
          <span>正在检索文档</span>
          <span class="tabular-nums">{{ formatDuration(sourceLoadingSeconds) }}</span>
        </div>
        <details
          v-if="message.sources.length > 0"
          class="group mb-2 border-b pb-2"
          :class="sourceDividerClass"
        >
          <summary
            class="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium [&::-webkit-details-marker]:hidden"
            :class="sourceLabelClass"
          >
            <span>来源片段 · {{ message.sources.length }}</span>
            <span
              class="text-[10px] tracking-[0.2em] transition-transform group-open:rotate-180"
              :class="sourceHintClass"
              aria-hidden="true"
            >
              ▾
            </span>
          </summary>
          <div class="mt-2 grid gap-2">
            <section
              v-for="(source, index) in message.sources"
              :key="`${source.filename}-${index}`"
              class="border-l-[3px] pl-2.5"
              :class="sourceAccentClass"
            >
              <div class="flex items-center justify-between gap-2">
                <strong class="block truncate text-sm font-semibold" :class="sourceTitleClass">
                  {{ source.filename }}
                </strong>
                <span
                  class="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  :class="scoreClass"
                >
                  {{ formatScore(source.relevanceScore) }}
                </span>
              </div>
              <p class="mt-1 text-[13px] leading-[1.55]" :class="sourceExcerptClass">
                {{ source.excerpt }}
              </p>
            </section>
          </div>
        </details>

        <div class="whitespace-pre-wrap text-sm leading-6">
          <template v-if="message.content">
            {{ message.content }}
          </template>
          <template v-else-if="showThinkingTimer">
            <span>正在思考</span>
            <span class="ml-1 inline-block tabular-nums text-accent-500">
              {{ formatDuration(thinkingSeconds) }}
            </span>
          </template>
          <template v-else />
          <span
            v-if="message.status === 'streaming' && (showThinkingTimer || Boolean(message.content))"
            class="ml-1 inline-block h-[18px] w-2.5 translate-y-[3px] animate-pulse rounded"
            :class="isAssistant ? 'bg-accent-500' : 'bg-white/[0.92]'"
          />
        </div>

        <span
          v-if="message.status === 'error'"
          class="mt-2 inline-flex rounded-full bg-rose-500/[0.14] px-3 py-1 text-xs font-medium text-rose-700"
        >
          本轮生成失败
        </span>
        <span
          v-if="message.status === 'cancelled'"
          class="mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium"
          :class="isAssistant ? 'bg-amber-500/[0.16] text-amber-700' : 'bg-white/[0.18] text-white'"
        >
          已取消
        </span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { CheckOutlined, CopyOutlined, LoadingOutlined } from "@ant-design/icons-vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { ChatMessage } from "../types";

const props = defineProps<{
  message: ChatMessage;
}>();

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(iso));
}

function formatScore(score: number) {
  return score.toFixed(2);
}

function getElapsedSeconds(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}

function getElapsedSecondsFromTime(startedAt: number) {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const minuteSegment = String(minutes).padStart(2, "0");
  const secondSegment = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${minuteSegment}:${secondSegment}`;
  }

  return `${minuteSegment}:${secondSegment}`;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

const isAssistant = computed(() => props.message.role === "assistant");
const showSourceLoading = computed(
  () =>
    isAssistant.value &&
    props.message.status === "streaming" &&
    props.message.sources.length === 0
);
const showThinkingTimer = computed(
  () =>
    isAssistant.value &&
    props.message.status === "streaming" &&
    props.message.sources.length > 0 &&
    !props.message.content
);
const shellMaxWidth = "min(var(--message-shell-max, 920px), calc(100% - 5rem))";
const copyableContent = computed(() => props.message.content.trim());
const speakerName = computed(() => (isAssistant.value ? "Knowledge Copilot" : "You"));
const avatarLabel = computed(() => (isAssistant.value ? "AI" : "你"));
const rowClass = computed(() =>
  isAssistant.value ? "justify-start" : "flex-row-reverse justify-start"
);
const shellClass = computed(() => (isAssistant.value ? "items-start" : "items-end"));
const metaClass = computed(() => (isAssistant.value ? "justify-start" : "justify-end"));
const avatarClass = computed(() =>
  isAssistant.value
    ? "border border-sky-500/[0.14] bg-white text-ink-900"
    : "bg-accent-500 text-white"
);
const bubbleClass = computed(() =>
  isAssistant.value
    ? "rounded-tl-[8px] bg-white text-ink-950"
    : "rounded-tr-[8px] bg-accent-500 text-white"
);
const sourceDividerClass = computed(() =>
  isAssistant.value ? "border-ink-950/8" : "border-white/[0.2]"
);
const sourceLabelClass = computed(() =>
  isAssistant.value ? "text-ink-700" : "text-white/[0.82]"
);
const sourceHintClass = computed(() => (isAssistant.value ? "text-ink-500" : "text-white/70"));
const sourceAccentClass = computed(() =>
  isAssistant.value ? "border-accent-500/[0.28]" : "border-white/[0.32]"
);
const sourceTitleClass = computed(() => (isAssistant.value ? "text-ink-900" : "text-white"));
const sourceExcerptClass = computed(() =>
  isAssistant.value ? "text-ink-700" : "text-white/[0.88]"
);
const sourceLoadingClass = computed(() =>
  isAssistant.value
    ? "border-amber-500/[0.2] bg-amber-50 text-amber-700"
    : "border-white/[0.24] bg-white/[0.1] text-white/[0.9]"
);
const scoreClass = computed(() =>
  isAssistant.value
    ? "bg-accent-500/[0.12] text-accent-500"
    : "bg-white/[0.14] text-white"
);
const copyButtonClass = computed(() =>
  isAssistant.value
    ? "border-ink-950/10 bg-white/88 text-ink-700 hover:border-accent-500/[0.28] hover:text-accent-500"
    : "border-accent-500/[0.16] bg-accent-500/[0.08] text-accent-500 hover:border-accent-500/[0.3] hover:bg-accent-500/[0.12]"
);
const sourceLoadingSeconds = ref(getElapsedSeconds(props.message.createdAt));
const thinkingSeconds = ref(0);
const copied = ref(false);
let sourceLoadingTimer: number | null = null;
let thinkingTimer: number | null = null;
let copiedTimer: number | null = null;

function clearSourceLoadingTimer() {
  if (sourceLoadingTimer !== null) {
    window.clearInterval(sourceLoadingTimer);
    sourceLoadingTimer = null;
  }
}

function clearThinkingTimer() {
  if (thinkingTimer !== null) {
    window.clearInterval(thinkingTimer);
    thinkingTimer = null;
  }
}

function clearCopiedTimer() {
  if (copiedTimer !== null) {
    window.clearTimeout(copiedTimer);
    copiedTimer = null;
  }
}

watch(
  () => [props.message.createdAt, showSourceLoading.value],
  () => {
    sourceLoadingSeconds.value = getElapsedSeconds(props.message.createdAt);
    clearSourceLoadingTimer();

    if (!showSourceLoading.value) {
      return;
    }

    sourceLoadingTimer = window.setInterval(() => {
      sourceLoadingSeconds.value = getElapsedSeconds(props.message.createdAt);
    }, 1000);
  },
  { immediate: true }
);

watch(
  () => showThinkingTimer.value,
  () => {
    thinkingSeconds.value = 0;
    clearThinkingTimer();

    if (!showThinkingTimer.value) {
      return;
    }

    const startedAt = Date.now();
    thinkingTimer = window.setInterval(() => {
      thinkingSeconds.value = getElapsedSecondsFromTime(startedAt);
    }, 1000);
  },
  { immediate: true }
);

watch(copied, (next) => {
  clearCopiedTimer();

  if (!next) {
    return;
  }

  copiedTimer = window.setTimeout(() => {
    copied.value = false;
  }, 1500);
});

async function handleCopy() {
  if (!copyableContent.value) {
    return;
  }

  await copyText(copyableContent.value);
  copied.value = true;
}

onBeforeUnmount(() => {
  clearSourceLoadingTimer();
  clearThinkingTimer();
  clearCopiedTimer();
});
</script>
