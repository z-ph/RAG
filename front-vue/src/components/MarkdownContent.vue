<template>
  <div class="markdown-content" :class="[baseClass, toneClass, contentClass]" v-html="renderedHtml" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";

interface Props {
  content: string;
  tone?: "assistant" | "user" | "thinking";
}

const props = withDefaults(defineProps<Props>(), {
  tone: "assistant"
});

marked.use({
  gfm: true,
  breaks: true
});

marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const validLang = lang && hljs.getLanguage(lang) ? lang : "plaintext";
      const highlighted = hljs.highlight(text, { language: validLang }).value;
      return `<pre class="code-block"><code class="hljs language-${validLang}">${highlighted}</code></pre>`;
    }
  }
});

const renderedHtml = computed(() => {
  if (!props.content) return "";
  return marked.parse(props.content) as string;
});

const contentClass = computed(() => {
  switch (props.tone) {
    case "user":
      return "text-white";
    case "thinking":
      return "text-amber-950/90";
    default:
      return "text-ink-950";
  }
});

const baseClass = "min-w-0 break-words [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_li:last-child]:mb-0 [&_h1]:mb-3 [&_h1]:text-[1.05em] [&_h1]:font-semibold [&_h2]:mb-3 [&_h2]:text-[1.02em] [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:font-semibold [&_blockquote]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:italic [&_hr]:my-4 [&_hr]:border-0 [&_hr]:border-t [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_img]:max-w-full [&_img]:rounded-none [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-none [&_pre]:px-3 [&_pre]:py-2.5 [&_pre]:text-[13px] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_code]:rounded-none [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.92em] [&_table]:w-full [&_table]:min-w-[320px] [&_table]:border-collapse [&_th]:border-b [&_th]:px-2 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border-b [&_td]:px-2 [&_td]:py-2 [&_td]:align-top";

const toneClass = computed(() => {
  switch (props.tone) {
    case "user":
      return "[&_blockquote]:border-white/[0.28] [&_hr]:border-white/[0.16] [&_a]:text-white [&_pre]:bg-black/[0.18] [&_pre]:text-white/[0.94] [&_code]:bg-white/[0.14] [&_th]:border-white/[0.2] [&_td]:border-white/[0.16]";
    case "thinking":
      return "[&_blockquote]:border-amber-700/[0.24] [&_hr]:border-amber-700/[0.14] [&_a]:text-amber-800 [&_pre]:bg-amber-950/[0.09] [&_pre]:text-amber-950 [&_code]:bg-amber-950/[0.08] [&_th]:border-amber-700/[0.14] [&_td]:border-amber-700/[0.1]";
    default:
      return "[&_blockquote]:border-accent-500/[0.3] [&_hr]:border-ink-950/10 [&_a]:text-accent-500 [&_pre]:bg-ink-950 [&_pre]:text-white/[0.94] [&_code]:bg-ink-950/[0.07] [&_th]:border-ink-950/10 [&_td]:border-ink-950/8";
  }
});
</script>

<style scoped>
.markdown-content :deep(.table-wrapper) {
  margin: 0.75em 0;
  overflow-x: auto;
}
.markdown-content :deep(p) {
  margin: 0.5em 0;
}
.markdown-content :deep(p:first-child) {
  margin-top: 0;
}
.markdown-content :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
