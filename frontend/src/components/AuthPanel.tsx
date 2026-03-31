import {
  CloseOutlined,
  DeleteOutlined,
  KeyOutlined,
  LoadingOutlined,
  LockOutlined,
  LogoutOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  UserOutlined
} from "@ant-design/icons";
import {
  Button,
  Empty,
  Form,
  Input,
  Spin,
  Tabs,
  Tag
} from "antd";
import type { AuthUser, RegistrationCode } from "../types";

interface AuthPanelProps {
  authenticated: boolean;
  authLoading: boolean;
  authSubmitting: boolean;
  authUser: AuthUser | null;
  registrationCodes: RegistrationCode[];
  registrationCodesLoading: boolean;
  codeCreating: boolean;
  codeMutatingId: number | null;
  onClose: () => void;
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string, registrationCode: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onRefreshRegistrationCodes: () => Promise<void>;
  onCreateRegistrationCode: (note: string, expiresAt: string | null) => Promise<void>;
  onDisableRegistrationCode: (id: number) => Promise<void>;
  onDeleteRegistrationCode: (id: number) => Promise<void>;
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
  const [loginForm] = Form.useForm<LoginFormValues>();
  const [registerForm] = Form.useForm<RegisterFormValues>();
  const [createCodeForm] = Form.useForm<CreateCodeFormValues>();

  const isAdmin = props.authUser?.role === "ADMIN";

  function formatDate(value?: string | null) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return dateFormatter.format(parsed);
  }

  function roleLabel(role?: string | null) {
    return role === "ADMIN" ? "管理员" : "成员";
  }

  function statusLabel(status: string) {
    if (status === "USED") {
      return "已使用";
    }
    if (status === "DISABLED") {
      return "已禁用";
    }
    if (status === "EXPIRED") {
      return "已过期";
    }
    return "可用";
  }

  function statusColor(status: string) {
    if (status === "USED") {
      return "blue";
    }
    if (status === "DISABLED") {
      return "red";
    }
    if (status === "EXPIRED") {
      return "orange";
    }
    return "green";
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
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-950">注册码管理</p>
                    <p className="mt-1 text-xs leading-6 text-ink-500">
                      管理员生成一次性注册码，用户注册后立即失效；支持手动禁用和删除。
                    </p>
                  </div>
                  <Button
                    type="text"
                    size="small"
                    className="!px-0 !text-ink-500 hover:!text-accent-500"
                    icon={<ReloadOutlined />}
                    onClick={() => void props.onRefreshRegistrationCodes()}
                  >
                    重载
                  </Button>
                </div>

                <Form<CreateCodeFormValues>
                  form={createCodeForm}
                  layout="vertical"
                  className="mt-4"
                  onFinish={(values) =>
                    void props.onCreateRegistrationCode(values.note || "", values.expiresAt || null)
                  }
                >
                  <Form.Item label="备注" name="note">
                    <Input placeholder="例如：运维同事 / 试用账号" />
                  </Form.Item>
                  <Form.Item
                    label="有效期截止时间"
                    name="expiresAt"
                    extra="留空表示不限制有效期"
                  >
                    <Input type="datetime-local" />
                  </Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={props.codeCreating ? <LoadingOutlined /> : <SafetyCertificateOutlined />}
                    loading={props.codeCreating}
                  >
                    生成一次性注册码
                  </Button>
                </Form>

                <div className="mt-6 border-t border-ink-950/8 pt-4">
                  {props.registrationCodesLoading ? (
                    <div className="grid min-h-[120px] place-items-center">
                      <Spin />
                    </div>
                  ) : props.registrationCodes.length === 0 ? (
                    <Empty
                      description="还没有可管理的注册码"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <div className="max-h-[320px] space-y-3 overflow-auto pr-1">
                      {props.registrationCodes.map((item) => (
                        <article
                          key={item.id}
                          className="border-b border-ink-950/8 pb-3 last:border-b-0 last:pb-0"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-2 rounded-full bg-ink-950/6 px-3 py-1 text-xs font-semibold tracking-[0.14em] text-ink-900">
                                  <KeyOutlined />
                                  {item.code}
                                </span>
                                <Tag color={statusColor(item.status)} bordered={false}>
                                  {statusLabel(item.status)}
                                </Tag>
                              </div>
                              {item.note ? (
                                <p className="mt-2 text-sm text-ink-900">{item.note}</p>
                              ) : null}
                              <div className="mt-2 space-y-1 text-xs leading-6 text-ink-500">
                                <p>创建者：{item.createdBy} · {formatDate(item.createdAt)}</p>
                                <p>有效期：{formatDate(item.expiresAt) || "长期有效"}</p>
                                {item.usedAt ? (
                                  <p>使用记录：{item.usedBy || "未知用户"} · {formatDate(item.usedAt)}</p>
                                ) : null}
                                {item.disabledAt && item.status === "DISABLED" ? (
                                  <p>禁用时间：{formatDate(item.disabledAt)}</p>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Button
                                size="small"
                                icon={<StopOutlined />}
                                disabled={item.status !== "AVAILABLE"}
                                loading={props.codeMutatingId === item.id}
                                onClick={() => void props.onDisableRegistrationCode(item.id)}
                              >
                                禁用
                              </Button>
                              <Button
                                size="small"
                                danger
                                type="text"
                                icon={<DeleteOutlined />}
                                loading={props.codeMutatingId === item.id}
                                onClick={() => void props.onDeleteRegistrationCode(item.id)}
                              >
                                删除
                              </Button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
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
