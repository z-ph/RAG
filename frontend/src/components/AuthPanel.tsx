import {
  CloseOutlined,
  KeyOutlined,
  LockOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined
} from "@ant-design/icons";
import {
  Button,
  Form,
  Input,
  Spin,
  Tabs,
  Tag
} from "antd";
import { useNavigate } from "react-router-dom";
import type { AuthUser } from "../types";

interface AuthPanelProps {
  authenticated: boolean;
  authLoading: boolean;
  authSubmitting: boolean;
  authUser: AuthUser | null;
  onClose: () => void;
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string, registrationCode: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

interface LoginFormValues {
  username: string;
  password: string;
}

interface RegisterFormValues {
  username: string;
  password: string;
  registrationCode: string;
}

interface CreateCodeFormValues {
  note?: string;
  expiresAt?: string;
}

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit"
});

export function AuthPanel(props: AuthPanelProps) {
  const navigate = useNavigate();
  const [loginForm] = Form.useForm<LoginFormValues>();
  const [registerForm] = Form.useForm<RegisterFormValues>();

  const isAdmin = props.authUser?.role === "ADMIN";

  function roleLabel(role?: string | null) {
    return role === "ADMIN" ? "管理员" : "成员";
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden px-6 py-6 max-[720px]:px-[18px] max-[720px]:py-[18px]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">
            用户认证
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink-950">
            {props.authenticated ? "用户管理" : "登录 / 注册"}
          </h2>
        </div>
        <Button
          type="text"
          shape="circle"
          className="!text-ink-500 hover:!bg-white/[0.8] hover:!text-ink-950"
          icon={<CloseOutlined />}
          onClick={props.onClose}
          title="关闭"
        />
      </div>

      <div className="mt-6 flex-1 overflow-auto">
        {props.authLoading ? (
          <div className="grid min-h-[200px] place-items-center">
            <Spin />
          </div>
        ) : props.authenticated && props.authUser ? (
          <div className="space-y-6">
            <div className="rounded-[28px] bg-white/[0.72] px-5 py-5 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-500">
                    已登录
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink-950">
                      <UserOutlined />
                      {props.authUser.username}
                    </span>
                    <Tag color={isAdmin ? "volcano" : "gold"} bordered={false}>
                      {roleLabel(props.authUser.role)}
                    </Tag>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-ink-500">
                    文档上传、删除需要管理员权限。
                  </p>
                </div>
                <Button
                  icon={<LogoutOutlined />}
                  onClick={() => void props.onLogout()}
                  loading={props.authSubmitting}
                >
                  退出
                </Button>
              </div>
            </div>

                {isAdmin ? (
              <div className="rounded-[28px] bg-white/[0.72] px-5 py-5 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.08)]">
                <p className="text-sm font-semibold text-ink-950">管理后台</p>
                <p className="mt-1 text-xs leading-6 text-ink-500">
                  进入后台管理系统，进行用户、角色、权限、注册码等高级管理操作。
                </p>
                <Button
                  type="primary"
                  className="mt-3 !bg-accent-500 hover:!bg-accent-400"
                  icon={<SettingOutlined />}
                  onClick={() => {
                    props.onClose();
                    navigate("/admin");
                  }}
                >
                  进入管理后台
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[28px] bg-white/[0.72] px-5 py-5 shadow-[inset_0_0_0_1px_rgba(19,34,56,0.08)]">
            <p className="text-sm leading-7 text-ink-700">
              文档管理需要登录。新用户必须使用管理员发放的一次性注册码注册。
            </p>
            <Tabs
              className="mt-4"
              items={[
                {
                  key: "login",
                  label: "登录",
                  children: (
                    <Form<LoginFormValues>
                      form={loginForm}
                      layout="vertical"
                      onFinish={(values) => void props.onLogin(values.username, values.password)}
                    >
                      <Form.Item
                        label="用户名"
                        name="username"
                        rules={[{ required: true, message: "请输入用户名" }]}
                      >
                        <Input prefix={<UserOutlined />} placeholder="例如：admin" />
                      </Form.Item>
                      <Form.Item
                        label="密码"
                        name="password"
                        rules={[{ required: true, message: "请输入密码" }]}
                      >
                        <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={props.authSubmitting}>
                        登录
                      </Button>
                    </Form>
                  )
                },
                {
                  key: "register",
                  label: "注册码注册",
                  children: (
                    <Form<RegisterFormValues>
                      form={registerForm}
                      layout="vertical"
                      onFinish={(values) =>
                        void props.onRegister(values.username, values.password, values.registrationCode)
                      }
                    >
                      <Form.Item
                        label="用户名"
                        name="username"
                        rules={[{ required: true, message: "请输入用户名" }]}
                      >
                        <Input prefix={<UserOutlined />} placeholder="3-32 位小写字母、数字或 ._-" />
                      </Form.Item>
                      <Form.Item
                        label="密码"
                        name="password"
                        rules={[{ required: true, message: "请输入密码" }]}
                      >
                        <Input.Password prefix={<LockOutlined />} placeholder="8-72 位密码" />
                      </Form.Item>
                      <Form.Item
                        label="注册码"
                        name="registrationCode"
                        rules={[{ required: true, message: "请输入注册码" }]}
                      >
                        <Input prefix={<KeyOutlined />} placeholder="例如：ABCD-EFGH-JKLM" />
                      </Form.Item>
                      <Button type="primary" htmlType="submit" loading={props.authSubmitting}>
                        注册
                      </Button>
                    </Form>
                  )
                }
              ]}
            />
          </div>
        )}
      </div>
    </section>
  );
}
