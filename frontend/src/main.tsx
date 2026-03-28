import React from "react";
import ReactDOM from "react-dom/client";
import { App as AntdApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import App from "./App";
import "antd/dist/reset.css";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#f25b2a",
          colorInfo: "#f25b2a",
          colorSuccess: "#1d8f6f",
          borderRadius: 22,
          fontFamily:
            '"Space Grotesk", "Noto Sans SC", "Segoe UI", "PingFang SC", sans-serif'
        }
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
);
