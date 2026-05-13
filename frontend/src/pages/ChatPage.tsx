import { useState } from "react";
import { App as AntdApp, Drawer, Grid } from "antd";
import { ChatWorkspace } from "../components/ChatWorkspace";
import { AuthPanel } from "../components/AuthPanel";
import { useAuthSession } from "../hooks/useAuthSession";
import type { RagConversationState } from "../hooks/useRagConversation";

interface ChatPageProps {
  conversation: RagConversationState;
}

export function ChatPage({ conversation }: ChatPageProps) {
  const { message } = AntdApp.useApp();
  const screens = Grid.useBreakpoint();
  const [authDrawerOpen, setAuthDrawerOpen] = useState(false);
  const authSession = useAuthSession(message);
  const drawerWidth = screens.xl
    ? 560
    : screens.lg
      ? 520
      : screens.md
        ? 460
        : "100vw";

  return (
    <main
      className="relative isolate h-screen min-h-dvh overflow-hidden p-7 max-[1120px]:p-5 max-[720px]:p-3.5 [--message-shell-max:clamp(760px,96%,1440px)] max-[1120px]:[--message-shell-max:min(100%,920px)] max-[720px]:[--message-shell-max:100%]"
    >
      <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[1600px]">
        <ChatWorkspace
          messages={conversation.messages}
          prompt={conversation.prompt}
          maxResults={conversation.maxResults}
          minScore={conversation.minScore}
          streaming={conversation.streaming}
          authenticated={authSession.authStatus.authenticated}
          authUser={authSession.authStatus.user || null}
          onOpenDocuments="/documents"
          onOpenAuth={() => setAuthDrawerOpen(true)}
          onOpenAdmin={authSession.authStatus.authenticated && (authSession.authStatus.user?.roleCode === "ADMIN" || authSession.authStatus.user?.roleCode === "SUPER_ADMIN") ? "/admin" : undefined}
          onPromptChange={conversation.setPrompt}
          onMaxResultsChange={conversation.setMaxResults}
          onMinScoreChange={conversation.setMinScore}
          onSend={conversation.handleSend}
          onSendWithImage={conversation.handleSendWithImage}
          onCancel={conversation.handleCancel}
          onClearConversation={conversation.handleClearConversation}
        />
      </div>

      <Drawer
        open={authDrawerOpen}
        onClose={() => setAuthDrawerOpen(false)}
        placement="right"
        width={drawerWidth}
        closable={false}
        title={null}
        classNames={{
          mask: "!backdrop-blur-[3px]",
          wrapper: "!shadow-none",
          section: "!bg-[#fffaf4]",
          body: "!h-full !p-0"
        }}
      >
        <AuthPanel
          authenticated={authSession.authStatus.authenticated}
          authLoading={authSession.authLoading}
          authSubmitting={authSession.authSubmitting}
          authUser={authSession.authStatus.user || null}
          onClose={() => setAuthDrawerOpen(false)}
          onLogin={authSession.handleLogin}
          onRegister={authSession.handleRegister}
          onLogout={authSession.handleLogout}
        />
      </Drawer>
    </main>
  );
}
