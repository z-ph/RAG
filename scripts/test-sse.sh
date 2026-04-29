#!/bin/sh
curl -N -s -X POST http://localhost:8080/api/rag/ask/stream \
  -H "Content-Type: application/json" \
  -d '{"question":"你好"}' | head -c 500
