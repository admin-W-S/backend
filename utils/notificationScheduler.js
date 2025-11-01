import { readJson, writeJson } from "./fileUtils.js";
import { v4 as uuidv4 } from "uuid";

let schedulerInterval = null;

/**
 * 30분 전 알림 생성 스케줄러
 */
export const startNotificationScheduler = () => {
  // 1분마다 예약 목록을 검사
  schedulerInterval = setInterval(() => {
    try {
      const reservations = readJson("reservations.json");
      const notifications = readJson("notifications.json");
      const rooms = readJson("rooms.json");

      const now = new Date();
      const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
      const currentTime = now.toTimeString().slice(0, 5); // HH:mm
      const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();

      // confirmed 상태인 예약만 확인
      const activeReservations = reservations.filter(
        (r) => r.status === "confirmed" && r.date === currentDate
      );

      for (const reservation of activeReservations) {
        // 예약 시작 시간 계산
        const [startHour, startMin] = reservation.startTime.split(":").map(Number);
        const startTimeMinutes = startHour * 60 + startMin;

        // 현재 시간에서 예약 시작 시간까지의 차이 계산 (분 단위)
        const timeDifference = startTimeMinutes - currentTimeMinutes;

        // 정확히 30분 전인지 확인 (29~31분 사이 허용)
        if (timeDifference >= 29 && timeDifference <= 31) {
          // 이미 알림이 생성되었는지 확인 (같은 예약의 같은 시간에 대해)
          const existingNotification = notifications.find(
            (n) =>
              n.userId === reservation.userId &&
              n.roomId === reservation.roomId &&
              n.timestamp &&
              new Date(n.timestamp).toISOString().split("T")[0] === currentDate &&
              n.message && n.message.includes(reservation.startTime)
          );

          if (!existingNotification) {
            // 강의실 정보 가져오기
            const room = rooms.find((r) => r.id === reservation.roomId);
            const roomName = room ? room.name : `강의실 ${reservation.roomId}`;
            const roomLocation = room ? room.location : "";

            // 알림 메시지 생성
            const message = `예약하신 ${roomName}${roomLocation ? ` ${roomLocation}` : ""}(${reservation.startTime} 시작) 이용 30분 전입니다.`;

            // 새 알림 생성
            const newNotification = {
              id: uuidv4(),
              userId: reservation.userId,
              roomId: reservation.roomId,
              message: message,
              timestamp: now.toISOString(),
              read: false,
            };

            notifications.push(newNotification);
            writeJson("notifications.json", notifications);

            console.log(
              `⏰ [Notification] 30분 전 알림 생성 → userId=${reservation.userId}, roomId=${reservation.roomId} (${reservation.startTime} 시작)`
            );
          }
        }
      }
    } catch (error) {
      console.error("알림 스케줄러 오류:", error);
    }
  }, 60000); // 1분(60000ms)마다 실행

  console.log("✅ Notification scheduler started (1 minute interval)");
};

/**
 * 스케줄러 중지
 */
export const stopNotificationScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("✅ Notification scheduler stopped");
  }
};

