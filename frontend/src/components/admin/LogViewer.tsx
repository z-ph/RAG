import { useState, useEffect, useCallback } from "react";
import { Table, Select, DatePicker, Input, Tag, Space, Typography, Card } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { queryLogs } from "../../lib/adminApi";
import type { LogPage } from "../../lib/adminApi";

const { Search } = Input;
const { Text } = Typography;

const LAYER_OPTIONS = [
  { value: "", label: "全部" },
  { value: "network", label: "网络层" },
  { value: "database", label: "数据库层" },
  { value: "model-session", label: "模型会话层" },
  { value: "app", label: "应用层" },
];

const LEVEL_OPTIONS = [
  { value: "", label: "全部" },
  { value: "INFO", label: "INFO" },
  { value: "ERROR", label: "ERROR" },
];

const LAYER_COLORS: Record<string, string> = {
  network: "blue",
  database: "green",
  "model-session": "purple",
  app: "default",
};

const LEVEL_COLORS: Record<string, string> = {
  INFO: "blue",
  ERROR: "red",
  WARN: "orange",
};

export function LogViewer() {
  const [layer, setLayer] = useState("");
  const [level, setLevel] = useState("");
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<LogPage | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await queryLogs({
        layer: layer || undefined,
        date,
        level: level || undefined,
        keyword: keyword || undefined,
        page,
        size: pageSize,
      });
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [layer, date, level, keyword, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (value: string) => {
    setKeyword(value);
    setPage(1);
  };

  const columns: ColumnsType<Record<string, unknown>> = [
    {
      title: "时间",
      dataIndex: "timestamp",
      key: "timestamp",
      width: 180,
      render: (ts: string) => (
        <Text className="text-xs font-mono">{ts ? ts.replace("T", " ").substring(0, 19) : "-"}</Text>
      ),
    },
    {
      title: "级别",
      dataIndex: "level",
      key: "level",
      width: 70,
      render: (lvl: string) => (
        <Tag color={LEVEL_COLORS[lvl] || "default"}>{lvl || "-"}</Tag>
      ),
    },
    {
      title: "层",
      dataIndex: "layer",
      key: "layer",
      width: 100,
      render: (l: string) => (
        <Tag color={LAYER_COLORS[l] || "default"}>{l || "-"}</Tag>
      ),
    },
    {
      title: "内容",
      key: "content",
      render: (_, record) => {
        const { timestamp, ver, level: lvl, layer: l, ...rest } = record;
        return (
          <pre className="text-xs font-mono whitespace-pre-wrap break-all m-0 max-h-32 overflow-auto">
            {JSON.stringify(rest, null, 2)}
          </pre>
        );
      },
    },
  ];

  return (
    <div>
      <Card className="mb-4">
        <Space wrap>
          <Select
            value={layer}
            onChange={(v) => { setLayer(v); setPage(1); }}
            options={LAYER_OPTIONS}
            style={{ width: 130 }}
          />
          <Select
            value={level}
            onChange={(v) => { setLevel(v); setPage(1); }}
            options={LEVEL_OPTIONS}
            style={{ width: 100 }}
          />
          <DatePicker
            value={date ? dayjs(date) : null}
            onChange={(d) => { setDate(d ? d.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD")); setPage(1); }}
            allowClear={false}
          />
          <Search
            placeholder="关键词搜索"
            onSearch={handleSearch}
            allowClear
            style={{ width: 200 }}
          />
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={data?.items || []}
        rowKey={(_, idx) => String(idx)}
        loading={loading}
        size="small"
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 800 }}
      />
    </div>
  );
}
