# WebSocket 协议文档

## 1. 连接地址

```
ws://localhost:3000/ws/asr
```

## 2. 消息格式

### 2.1 客户端 → 服务端

#### 设置 API Key
```json
{
  "type": "set_api_key",
  "payload": {
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

#### 发送音频数据
```json
{
  "type": "audio_chunk",
  "payload": {
    "window_id": 0,
    "start_ms": 0,
    "duration": 400,
    "pcm_data": "base64..."
  }
}
```

#### 配置参数
```json
{
  "type": "config",
  "payload": {
    "sourceLang": "en",
    "targetLang": "zh",
    "sampleRate": 16000
  }
}
```

### 2.2 服务端 → 客户端

#### ASR 部分结果
```json
{
  "type": "asr_partial",
  "payload": {
    "text": "Hello",
    "isFinal": false
  }
}
```

#### ASR 最终结果
```json
{
  "type": "asr_final",
  "payload": {
    "text": "Hello world",
    "isFinal": true
  }
}
```

#### 字幕补丁
```json
{
  "type": "subtitle_patch",
  "payload": {
    "action": "ADD_TEMP",
    "target_range": [0, 400],
    "new_text": "你好世界",
    "style": "temp"
  }
}
```

#### 错误
```json
{
  "type": "error",
  "payload": {
    "message": "错误信息"
  }
}
```
