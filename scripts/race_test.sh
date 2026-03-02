#!/bin/bash
# Пример проверки гонки с curl

# Предварительно создай заявку и назначь мастеру (или используй существующую ID=1)
REQUEST_ID=2
MASTER_ID=2

# Два параллельных запроса take
curl -X PATCH http://localhost:3000/api/requests/$REQUEST_ID/take \
  -H "Content-Type: application/json" \
  -d "{\"masterId\": $MASTER_ID}" &
curl -X PATCH http://localhost:3000/api/requests/$REQUEST_ID/take \
  -H "Content-Type: application/json" \
  -d "{\"masterId\": $MASTER_ID}" &
wait