<template>
  <div class="markdown-content" :class="contentClass" v-html="sanitizedHtml" />
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  content: string;
  tone?: "assistant" | "user" | "thinking";
}

const props = withDefaults(defineProps<Props>(), {
  tone: "assistant"
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

// Simple markdown to HTML conversion
const sanitizedHtml = computed(() => {
  if (!props.content) return "";

  let html = props.content
    // Escape HTML
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, "<pre class=\"code-block\"><code>$2</code></pre>")
    .replace(/`([^`]+)`/g, "<code class=\"inline-code\">$1</code>")
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Headers
    .replace(/^### (.+)$/gm, "<h3 class=\"md-h3\">$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class=\"md-h2\">$1</h2>")
    .replace(/^# (.+)$/gm, "<h1 class=\"md-h1\">$1</h1>")
    // Lists
    .replace(/^- (.+)$/gm, "<li class=\"md-li\">$1</li>")
    // Paragraphs (lines not starting with special chars)
    .replace(/^(?!<[hli]|<pre|<code)(.+)$/gm, "<p class=\"md-p\">$1</p>")
    // Newlines
    .replace(/\n/g, "");

  return html;
});
</script>

<style scoped>
.markdown-content :deep(.md-p) {
  margin: 0.5em 0;
}
.markdown-content :deep(.md-p:first-child) {
  margin-top: 0;
}
.markdown-content :deep(.md-p:last-child) {
  margin-bottom: 0;
}
.markdown-content :deep(.md-h1),
.markdown-content :deep(.md-h2),
.markdown-content :deep(.md-h3) {
  margin: 0.8em 0 0.4em;
  font-weight: 600;
}
.markdown-content :deep(.md-h1:first-child),
.markdown-content :deep(.md-h2:first-child),
.markdown-content :deep(.md-h3:first-child) {
  margin-top: 0;
}
.markdown-content :deep(.md-h1) {
  font-size: 1.25em;
}
.markdown-content :deep(.md-h2) {
  font-size: 1.1em;
}
.markdown-content :deep(.md-h3) {
  font-size: 1em;
}
.markdown-content :deep(.md-li) {
  margin: 0.25em 0;
  padding-left: 1.5em;
  position: relative;
}
.markdown-content :deep(.md-li::before) {
  content: "•";
  position: absolute;
  left: 0.5em;
  color: currentColor;
  opacity: 0.6;
}
.markdown-content :deep(.code-block) {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 6px;
  padding: 0.75em 1em;
  margin: 0.5em 0;
  overflow-x: auto;
  font-family: monospace;
  font-size: 0.9em;
}
.markdown-content :deep(.inline-code) {
  background: rgba(0, 0, 0, 0.05);
  border-radius: 4px;
  padding: 0.1em 0.3em;
  font-family: monospace;
  font-size: 0.9em;
}
</style>
