import { readJson, writeJson } from "../utils/fileUtils.js";
import { sendSuccess, sendError } from "../utils/responseUtils.js";

/**
 * 사용자 알림 목록 조회
 */
export const getMyNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    const notifications = readJson("notifications.json");

    // 사용자의 알림만 필터링하고 최신순으로 정렬
    const userNotifications = notifications
      .filter((n) => n.userId === parseInt(userId))
      .sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

    return sendSuccess(res, userNotifications, "알림 목록 조회 성공");
  } catch (error) {
    console.error("알림 목록 조회 오류:", error);
    return sendError(res, "알림 목록 조회 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 알림 읽음 처리
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notifications = readJson("notifications.json");

    const notificationIndex = notifications.findIndex((n) => n.id === id);

    if (notificationIndex === -1) {
      return sendError(res, "알림을 찾을 수 없습니다.", 404);
    }

    // 읽음 처리
    notifications[notificationIndex] = {
      ...notifications[notificationIndex],
      read: true,
    };

    writeJson("notifications.json", notifications);

    return sendSuccess(res, notifications[notificationIndex], "알림 읽음 처리 완료");
  } catch (error) {
    console.error("알림 읽음 처리 오류:", error);
    return sendError(res, "알림 읽음 처리 중 오류가 발생했습니다.", 500);
  }
};

