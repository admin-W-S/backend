/**
 * 성공 응답 생성
 * @param {Object} res - Express response 객체
 * @param {any} data - 응답 데이터
 * @param {string} message - 성공 메시지
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 200)
 */
export const sendSuccess = (res, data, message = "성공", statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * 에러 응답 생성
 * @param {Object} res - Express response 객체
 * @param {string} message - 에러 메시지
 * @param {number} statusCode - HTTP 상태 코드 (기본값: 500)
 */
export const sendError = (res, message = "오류가 발생했습니다.", statusCode = 500) => {
  res.status(statusCode).json({
    success: false,
    message,
    data: null,
  });
};

