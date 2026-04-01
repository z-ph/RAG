<template>
  <section class="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
    <div class="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-4">
      <div class="flex flex-col items-stretch justify-between gap-3 border-b border-ink-950/8 pb-4 min-[721px]:flex-row min-[721px]:items-center">
        <div class="flex items-center gap-2.5 text-sm font-bold tracking-[0.08em] text-ink-900">
          <MessageOutlined />
          <span>对话流</span>
        </div>
        <div class="flex flex-wrap items-center gap-2 min-[721px]:justify-end">
          <a-button
            class="!rounded-full !border-ink-950/10 !bg-sky-50/90 !px-4 !text-ink-900 !shadow-none hover:!border-accent-500/[0.25] hover:!text-accent-500"
            @click="emit('open-documents')"
          >
            <template #icon>
              <DatabaseOutlined />
            </template>
            文档控制台
          </a-button>
          <a-select
            class="!w-[108px]"
            :value="props.maxResults"
            :options="maxResultOptions"
            @update:value="handleMaxResultsChange"
          />
          <a-button
            class="!rounded-full !border-white/[0.7] !bg-white/[0.85] !px-4 !text-ink-700 !shadow-none hover:!border-accent-500/[0.25] hover:!text-accent-500"
            @click="emit('clear-conversation')"
          >
            <template #icon>
              <ClearOutlined />
            </template>
            清空对话
          </a-button>
          <!-- User button -->
          <a-button
            :class="[
              '!rounded-full !px-4 !shadow-none',
              props.authenticated
                ? '!border-volcano-200 !bg-volcano-50/80 !text-volcano-700 hover:!border-volcano-300 hover:!text-volcano-800'
                : '!border-ink-950/10 !bg-white/[0.72] !text-ink-700 hover:!border-accent-500/[0.25] hover:!text-accent-500'
            ]"
            @click="emit('open-auth')"
          >
            <template #icon>
              <UserOutlined />
            </template>
            {{ props.authenticated && props.authUser
              ? `${props.authUser.username} (${props.authUser.role === 'ADMIN' ? '管理' : '成员'})`
              : '用户登录' }}
          </a-button>
        </div>
      </div>

      <div class="flex min-h-0 flex-col gap-2.5 overflow-y-auto overflow-x-hidden pr-0.5">
        <MessageBubble v-for="entry in props.messages" :key="entry.id" :message="entry" />
      </div>

      <div class="flex items-center gap-1">
        <a-input
          :value="props.prompt"
          placeholder="输入你的问题。"
          @update:value="handlePromptChange"
          @pressEnter="handlePressEnter"
        />
        <a-button
          :type="props.streaming ? 'default' : 'primary'"
          :danger="props.streaming"
          size="large"
          :class="props.streaming
            ? '!rounded-full !px-6 !shadow-none'
            : '!rounded-full !border-none !bg-accent-500 !px-6 !shadow-none hover:!bg-accent-400'"
          :disabled="!props.streaming && !props.prompt.trim()"
          @click="handleAction"
        >
          <template #icon>
            <PauseCircleFilled v-if="props.streaming" />
            <SendOutlined v-else />
          </template>
        </a-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import {
  ClearOutlined,
  DatabaseOutlined,
  MessageOutlined,
  PauseCircleFilled,
  SendOutlined,
  UserOutlined
} from "@ant-design/icons-vue";
import type { ChatMessage } from "../types";
import MessageBubble from "./MessageBubble.vue";

const props = defineProps<{
  messages: ChatMessage[];
  prompt: string;
  maxResults: number;
  streaming: boolean;
  authenticated: boolean;
  authUser: { username: string; role: string } | null;
}>();

const emit = defineEmits<{
  (event: "open-documents"): void;
  (event: "open-auth"): void;
  (event: "update:prompt", value: string): void;
  (event: "update:maxResults", value: number): void;
  (event: "send"): void;
  (event: "cancel"): void;
  (event: "clear-conversation"): void;
}>();

const maxResultOptions = [16, 64, 256, 1024].map((value) => ({
  label: String(value),
  value
}));

function handlePromptChange(value: string) {
  emit("update:prompt", value);
}

function handleMaxResultsChange(value: number) {
  emit("update:maxResults", value);
}

function handlePressEnter(event: KeyboardEvent) {
  if (!event.shiftKey && !props.streaming) {
    event.preventDefault();
    emit("send");
  }
}

function handleAction() {
  if (props.streaming) {
    emit("cancel");
    return;
  }

  emit("send");
}
</script>
