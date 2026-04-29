#!/bin/sh
curl -N -s http://222.200.112.60/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-shiliuziyyds" \
  -d '{"model":"glm-4.6v-flash","messages":[{"role":"user","content":"你好"}],"stream":true}'
