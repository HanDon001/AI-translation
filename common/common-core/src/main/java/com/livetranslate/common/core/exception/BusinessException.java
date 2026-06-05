package com.livetranslate.common.core.exception;

import lombok.Getter;

/**
 * 业务异常
 */
@Getter
public class BusinessException extends RuntimeException {

    private final int code;

    public BusinessException(ErrorCodeEnum errorCode) {
        super(errorCode.getMessage());
        this.code = errorCode.getCode();
    }

    public BusinessException(ErrorCodeEnum errorCode, String message) {
        super(message);
        this.code = errorCode.getCode();
    }

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }
}
