package com.livetranslate.translate.interfaces.controller;

import com.livetranslate.common.web.result.Result;
import com.livetranslate.translate.application.service.TranslateApplicationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

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
    public Result<String> translate(@RequestParam String text,
                                    @RequestParam(defaultValue = "en") String sourceLang,
                                    @RequestParam(defaultValue = "zh") String targetLang) {
        String result = translateApplicationService.translate(null, text, sourceLang, targetLang);
        return Result.success(result);
    }
}
