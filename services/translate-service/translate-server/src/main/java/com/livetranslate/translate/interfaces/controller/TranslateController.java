package com.livetranslate.translate.interfaces.controller;

import com.livetranslate.translate.application.service.TranslateApplicationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * 翻译控制器
 */
@Slf4j
@RestController
@RequestMapping("/api/translate")
@RequiredArgsConstructor
public class TranslateController {

    private final TranslateApplicationService translateApplicationService;

    @PostMapping
    public Map<String, Object> translate(@RequestParam String text,
                                    @RequestParam(defaultValue = "en") String sourceLang,
                                    @RequestParam(defaultValue = "zh") String targetLang) {
        String result = translateApplicationService.translate(null, text, sourceLang, targetLang);
        return Map.of("code", 0, "data", result, "message", "success");
    }
}
