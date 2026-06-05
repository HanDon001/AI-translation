package com.livetranslate.translate.domain.service;

import com.livetranslate.translate.domain.model.TranslateTask;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Wait-K 领域服务
 * 对应原 TypeScript 的 WaitKScheduler.ts
 */
@Slf4j
@Service
public class WaitKDomainService {

    /**
     * 创建翻译任务
     */
    public TranslateTask createTask(String sessionId, String sourceText, String sourceLang, String targetLang) {
        TranslateTask task = new TranslateTask();
        task.setTaskId(java.util.UUID.randomUUID().toString());
        task.setSessionId(sessionId);
        task.setSourceText(sourceText);
        task.setSourceLang(sourceLang);
        task.setTargetLang(targetLang);
        task.setStatus(TranslateTask.TaskStatus.PENDING);
        task.setCreatedAt(java.time.LocalDateTime.now());

        log.info("创建翻译任务: taskId={}, sourceText={}", task.getTaskId(), sourceText);
        return task;
    }

    /**
     * 执行翻译
     */
    public String translate(TranslateTask task) {
        task.setStatus(TranslateTask.TaskStatus.TRANSLATING);
        log.info("开始翻译: taskId={}", task.getTaskId());

        // TODO: 调用翻译服务（MyMemory 或 Qwen）
        // 这里是核心逻辑
        String translatedText = task.getSourceText(); // 临时返回原文

        task.setTranslatedText(translatedText);
        task.setStatus(TranslateTask.TaskStatus.COMPLETED);
        task.setCompletedAt(java.time.LocalDateTime.now());

        log.info("翻译完成: taskId={}, result={}", task.getTaskId(), translatedText);
        return translatedText;
    }
}
