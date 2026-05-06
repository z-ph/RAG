import { Spin } from "antd";

export function LazyPageFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-canvas px-6">
      <div className="text-center">
        <Spin size="large" />
        <p className="mt-4 text-sm text-ink-500">页面加载中...</p>
      </div>
    </div>
  );
}
