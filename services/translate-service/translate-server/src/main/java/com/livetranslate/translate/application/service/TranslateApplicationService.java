package com.livetranslate.translate.application.service;

import com.livetranslate.translate.domain.model.TranslateTask;
import com.livetranslate.translate.domain.service.WaitKDomainService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 翻译应用服务
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TranslateApplicationService {

    private final WaitKDomainService waitKDomainService;

    /**
     * 执行翻译
     */
    public String translate(String sessionId, String sourceText, String sourceLang, String targetLang) {
        TranslateTask task = waitKDomainService.createTask(sessionId, sourceText, sourceLang, targetLang);
        return waitKDomainService.translate(task);
    }
}
