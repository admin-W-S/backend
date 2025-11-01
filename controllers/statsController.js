import { readJson } from "../utils/fileUtils.js";
import { sendSuccess, sendError } from "../utils/responseUtils.js";

/**
 * 인기 강의실 통계 (예약 횟수 TOP 5)
 */
export const getPopularRooms = async (req, res) => {
  try {
    const rooms = readJson("rooms.json");
    const reservations = readJson("reservations.json");

    // roomId별 예약 횟수 계산 (누적 - 모든 예약 포함, 상태 무관)
    const reservationCounts = {};
    reservations.forEach((r) => {
      // 모든 예약을 카운트 (확정, 대기, 취소 모두 포함)
      reservationCounts[r.roomId] = (reservationCounts[r.roomId] || 0) + 1;
    });

    // 예약 횟수로 정렬하고 TOP 5 추출
    const sortedRooms = Object.entries(reservationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([roomId, count]) => {
        const room = rooms.find((r) => r.id === parseInt(roomId));
        return {
          roomId: parseInt(roomId),
          name: room ? room.name : `강의실 ${roomId}`,
          count,
        };
      });

    return sendSuccess(res, sortedRooms, "인기 강의실 통계 조회 성공");
  } catch (error) {
    console.error("인기 강의실 통계 조회 오류:", error);
    return sendError(res, "인기 강의실 통계 조회 중 오류가 발생했습니다.", 500);
  }
};

