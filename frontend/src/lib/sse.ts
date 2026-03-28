type SseEvent = {
  event: string;
  data: string;
};

function parseEventBlock(block: string): SseEvent | null {
  const lines = block.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n")
  };
}

export async function consumeSseStream(
  response: Response,
  onEvent: (event: SseEvent) => void
) {
  if (!response.ok) {
    const fallbackMessage = `请求失败: HTTP ${response.status}`;

    try {
      const payload = await response.json();
      throw new Error(payload.message || payload.error || fallbackMessage);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(fallbackMessage);
    }
  }

  if (!response.body) {
    throw new Error("服务端未返回可读取的流。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    buffer = buffer.replace(/\r\n/g, "\n");

    let separatorIndex = buffer.indexOf("\n\n");

    while (separatorIndex !== -1) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      const parsed = parseEventBlock(block);

      if (parsed) {
        onEvent(parsed);
      }

      separatorIndex = buffer.indexOf("\n\n");
    }

    if (done) {
      break;
    }
  }

  const tail = buffer.trim();

  if (tail) {
    const parsed = parseEventBlock(tail);

    if (parsed) {
      onEvent(parsed);
    }
  }
}
