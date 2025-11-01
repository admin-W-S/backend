import { readJson, writeJson } from "../utils/fileUtils.js";
import { sendSuccess, sendError } from "../utils/responseUtils.js";
import { v4 as uuidv4 } from "uuid";
import { emitReservationUpdate } from "../utils/socketManager.js";

/**
 * 시간 문자열 비교 함수 (HH:mm 형식)
 */
const timeCompare = (time1, time2) => {
  const [h1, m1] = time1.split(":").map(Number);
  const [h2, m2] = time2.split(":").map(Number);
  const minutes1 = h1 * 60 + m1;
  const minutes2 = h2 * 60 + m2;
  return minutes1 - minutes2;
};

/**
 * 시간이 겹치는지 확인
 */
const isTimeOverlap = (start1, end1, start2, end2) => {
  return (
    (timeCompare(start1, start2) >= 0 && timeCompare(start1, end2) < 0) ||
    (timeCompare(end1, start2) > 0 && timeCompare(end1, end2) <= 0) ||
    (timeCompare(start1, start2) <= 0 && timeCompare(end1, end2) >= 0)
  );
};

/**
 * 예약 생성
 */
export const createReservation = async (req, res) => {
  try {
    const { roomId, userId, date, startTime, endTime, purpose, participants } = req.body;
    
    // 디버깅: 요청 데이터 확인
    console.log("예약 생성 요청:", { roomId, userId, date, startTime, endTime, purpose, participants });

    // 필수 필드 검증
    if (!roomId || !userId || !date || !startTime || !endTime) {
      return sendError(res, "모든 필드는 필수 입력 항목입니다.", 400);
    }

    // 날짜 형식 검증
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return sendError(res, "날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)", 400);
    }

    // 시간 형식 검증
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return sendError(res, "시간 형식이 올바르지 않습니다. (HH:mm)", 400);
    }

    // 종료 시간이 시작 시간보다 늦어야 함
    if (timeCompare(endTime, startTime) <= 0) {
      return sendError(res, "종료 시간은 시작 시간보다 늦어야 합니다.", 400);
    }

    // 예약은 1시간 단위인지 확인 (선택사항, 1시간 이상이면 통과)
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    const durationMinutes = endMinutes - startMinutes;

    // 과거 날짜 예약 불가
    const now = new Date();
    const reserveDate = new Date(date);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const reserveDateOnly = new Date(
      reserveDate.getFullYear(),
      reserveDate.getMonth(),
      reserveDate.getDate()
    );

    if (reserveDateOnly < today) {
      return sendError(res, "과거 날짜는 예약할 수 없습니다.", 400);
    }

    // 최대 7일 전(오늘+6일) 제한
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 6); // 오늘 + 6일 = 최대 7일 전
    if (reserveDateOnly > maxDate) {
      return sendError(res, "예약은 최대 7일 전(오늘+6일)까지만 가능합니다.", 400);
    }

    // 오늘이면 시간도 확인
    if (
      reserveDateOnly.getTime() === today.getTime() &&
      timeCompare(startTime, now.toTimeString().slice(0, 5)) <= 0
    ) {
      return sendError(res, "과거 시간은 예약할 수 없습니다.", 400);
    }

    const rooms = readJson("rooms.json");
    const reservations = readJson("reservations.json");

    // 강의실 존재 확인
    const room = rooms.find((r) => r.id === parseInt(roomId));
    if (!room) {
      return sendError(res, "강의실을 찾을 수 없습니다.", 404);
    }

    // 강의실이 사용 가능한지 확인
    if (!room.available) {
      return sendError(res, "사용할 수 없는 강의실입니다.", 400);
    }

    // 참여 인원 검증 (그룹 예약)
    // participants는 회원 ID(숫자) 또는 비회원 정보(학번 등 문자열)를 포함할 수 있음
    const participantsList = Array.isArray(participants) ? participants : [];
    const totalParticipants = 1 + participantsList.length; // 예약자 + 참여 인원
    
    // 참여 인원이 강의실 최대 수용인원을 초과하는지 확인
    if (totalParticipants > room.capacity) {
      return sendError(
        res,
        `참여 인원(${totalParticipants}명)이 강의실 최대 수용인원(${room.capacity}명)을 초과합니다.`,
        400
      );
    }

    // 중복 시간대 예약 확인
    const overlap = reservations.find(
      (r) =>
        r.roomId === parseInt(roomId) &&
        r.date === date &&
        r.status === "confirmed" &&
        isTimeOverlap(startTime, endTime, r.startTime, r.endTime)
    );

    if (overlap) {
      return sendError(res, "해당 시간대에 이미 예약이 있습니다.", 400);
    }

    // 사용자별 미래 예약 개수 확인 (최대 3개)
    // 현재 예약을 추가하기 전에 이미 3개 이상이면 막아야 함
    // 위에서 선언한 now 변수 재사용
    const todayStr = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    // 예약자의 미래 예약 개수 확인
    const futureReservations = reservations.filter(
      (r) => {
        // 같은 사용자의 예약이고, 상태가 confirmed인 것만 확인
        if (r.userId !== parseInt(userId) || r.status !== "confirmed") return false;
        
        // 날짜가 미래거나, 오늘이면 시간이 미래여야 함
        const reservationDate = r.date;
        const reservationStartTime = r.startTime;
        
        // 날짜 비교
        if (reservationDate > todayStr) return true;
        if (reservationDate === todayStr && timeCompare(reservationStartTime, currentTime) > 0) return true;
        
        return false;
      }
    );

    // 이미 3개 이상의 미래 예약이 있으면 새로 추가할 수 없음
    if (futureReservations.length >= 3) {
      return sendError(
        res,
        `1인당 최대 3개의 미래 예약만 허용됩니다. (현재: ${futureReservations.length}개)`,
        400
      );
    }

    // 참여 인원들의 예약 개수 확인 (그룹 예약)
    // 회원만 예약 개수 체크, 비회원은 체크하지 않음
    if (participantsList.length > 0) {
      const users = readJson("users.json");
      
      for (const participantInfo of participantsList) {
        // participantInfo가 숫자면 회원 ID, 문자열이면 비회원 정보(학번 등)
        const isNumeric = !isNaN(participantInfo) && !isNaN(parseFloat(participantInfo));
        
        if (isNumeric) {
          // 회원인 경우
          const participantUserId = parseInt(participantInfo);
          
          // 참여 인원이 회원 목록에 존재하는지 확인
          const participantUser = users.find(u => u.id === participantUserId);
          if (!participantUser) {
            return sendError(res, `참여 인원(ID: ${participantUserId})을 찾을 수 없습니다.`, 404);
          }

          // 참여 인원의 미래 예약 개수 확인
          const participantFutureReservations = reservations.filter(
            (r) => {
              // 참여 인원이 예약자인 경우 또는 참여 인원 목록에 포함된 경우
              // participants 배열에 숫자 ID가 포함되어 있는지 확인
              const isOwner = r.userId === participantUserId;
              const isParticipant = Array.isArray(r.participants) && r.participants.some(
                p => typeof p === 'number' ? p === participantUserId : parseInt(p) === participantUserId
              );
              
              if (!isOwner && !isParticipant) return false;
              if (r.status !== "confirmed") return false;
              
              // 날짜가 미래거나, 오늘이면 시간이 미래여야 함
              const reservationDate = r.date;
              const reservationStartTime = r.startTime;
              
              // 날짜 비교
              if (reservationDate > todayStr) return true;
              if (reservationDate === todayStr && timeCompare(reservationStartTime, currentTime) > 0) return true;
              
              return false;
            }
          );

          // 참여 인원 중 한 명이라도 현재 예약 개수가 3개 이상이면 전체 예약 실패
          if (participantFutureReservations.length >= 3) {
            return sendError(
              res,
              `참여 인원(ID: ${participantUserId})의 현재 예약 개수가 3개입니다. 전체 예약이 실패합니다.`,
              400
            );
          }
        }
        // 비회원인 경우 (문자열) - 예약 개수 체크하지 않음
      }
    }

    // 새 예약 생성 - purpose, location, participants 항상 포함
    // participants는 회원 ID(숫자) 또는 비회원 정보(학번 등 문자열)를 포함
    const processedParticipants = Array.isArray(participants) ? participants.map(p => {
      // 숫자면 정수로 변환, 문자열이면 그대로 유지
      const isNumeric = !isNaN(p) && !isNaN(parseFloat(p));
      return isNumeric ? parseInt(p) : String(p).trim();
    }) : [];
    
    const newReservation = {
      id: uuidv4(),
      roomId: parseInt(roomId),
      userId: parseInt(userId),
      date,
      startTime,
      endTime,
      purpose: (purpose !== undefined && purpose !== null) ? String(purpose).trim() : "",
      location: (room.location !== undefined && room.location !== null) ? String(room.location).trim() : "",
      participants: processedParticipants,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };
    
    // 디버깅: 생성된 예약 데이터 확인
    console.log("생성된 예약:", JSON.stringify(newReservation, null, 2));
    console.log("purpose 필드:", newReservation.purpose);
    console.log("location 필드:", newReservation.location);

    reservations.push(newReservation);
    writeJson("reservations.json", reservations);
    
    // 저장 후 확인
    const savedReservations = readJson("reservations.json");
    const savedReservation = savedReservations.find(r => r.id === newReservation.id);
    console.log("저장된 예약 확인:", JSON.stringify(savedReservation, null, 2));

    // Socket.io 이벤트 전송 (실시간 현황 업데이트)
    emitReservationUpdate({
      roomId: parseInt(roomId),
      date: date,
      startTime: startTime,
      endTime: endTime,
      status: "reserved"
    });

    return sendSuccess(res, newReservation, "예약 성공", 201);
  } catch (error) {
    console.error("예약 생성 오류:", error);
    return sendError(res, "예약 생성 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 사용자의 예약 목록 조회
 */
export const getMyReservations = async (req, res) => {
  try {
    const { userId } = req.params;
    const reservations = readJson("reservations.json");

    // 사용자의 예약만 필터링 (취소된 예약도 포함하여 누적 통계 유지)
    // 예약자인 경우 또는 참여 인원으로 포함된 경우 모두 포함
    const userIdNum = parseInt(userId);
    const userReservations = reservations.filter(
      (r) => {
        const isOwner = r.userId === userIdNum;
        const isParticipant = Array.isArray(r.participants) && r.participants.includes(userIdNum);
        return isOwner || isParticipant;
      }
    );

    // 날짜와 시간 순으로 정렬 (최신순)
    userReservations.sort((a, b) => {
      if (a.date !== b.date) {
        return new Date(b.date) - new Date(a.date);
      }
      return timeCompare(b.startTime, a.startTime);
    });

    return sendSuccess(res, userReservations, "예약 목록 조회 성공");
  } catch (error) {
    console.error("예약 목록 조회 오류:", error);
    return sendError(res, "예약 목록 조회 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 특정 강의실의 전체 예약 현황 조회 (타임라인)
 */
export const getRoomReservations = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { date } = req.query; // 선택적: 특정 날짜만 조회
    
    const reservations = readJson("reservations.json");
    const users = readJson("users.json");
    
    // 특정 강의실의 예약만 필터링
    let roomReservations = reservations.filter(
      (r) => r.roomId === parseInt(roomId)
    );
    
    // 날짜 필터링 (선택적)
    if (date) {
      roomReservations = roomReservations.filter((r) => r.date === date);
    }
    
    // 취소된 예약 제외 (타임라인에는 활성 예약만 표시)
    roomReservations = roomReservations.filter((r) => r.status === "confirmed");
    
    // 예약자 정보 추가
    const reservationsWithUserInfo = roomReservations.map((r) => {
      const user = users.find((u) => u.id === r.userId);
      return {
        ...r,
        userName: user ? user.name : "알 수 없음",
        userEmail: user ? user.email : "",
      };
    });
    
    // 날짜와 시간 순으로 정렬 (오름차순: 과거부터 미래로)
    reservationsWithUserInfo.sort((a, b) => {
      if (a.date !== b.date) {
        return new Date(a.date) - new Date(b.date);
      }
      return timeCompare(a.startTime, b.startTime);
    });

    return sendSuccess(
      res,
      reservationsWithUserInfo,
      "강의실 예약 현황 조회 성공"
    );
  } catch (error) {
    console.error("강의실 예약 현황 조회 오류:", error);
    return sendError(res, "강의실 예약 현황 조회 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 예약 취소
 */
export const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const reservations = readJson("reservations.json");
    const waitlist = readJson("waitlist.json");

    const reservationIndex = reservations.findIndex((r) => r.id === id);

    if (reservationIndex === -1) {
      return sendError(res, "예약을 찾을 수 없습니다.", 404);
    }

    const canceledReservation = reservations[reservationIndex];

    // 예약 삭제하지 않고 상태만 "cancelled"로 변경 (누적 통계 유지)
    reservations[reservationIndex] = {
      ...canceledReservation,
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
    };
    writeJson("reservations.json", reservations);

    // 5️⃣ 예약 취소 시 자동 대기 승격 로직
    // 해당 예약에 대한 대기열 확인 (같은 roomId, date, startTime 기준)
    const relatedWaitlist = waitlist.filter(
      (w) =>
        w.roomId === canceledReservation.roomId &&
        w.date === canceledReservation.date &&
        w.startTime === canceledReservation.startTime &&
        w.status === "waiting"
    );

    // 같은 roomId, date, startTime 기준으로 createdAt 순으로 정렬 (1순위 ~ N순위)
    relatedWaitlist.sort((a, b) => {
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    // 대기 1순위부터 순차적으로 확인하며 승격 가능한 사용자 찾기
    if (relatedWaitlist.length > 0) {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const currentTime = now.toTimeString().slice(0, 5);

      let promoted = false;

      for (let i = 0; i < relatedWaitlist.length; i++) {
        const waitlistItem = relatedWaitlist[i];
        const waitlistUserId = waitlistItem.userId;

        // 2️⃣ 대기 1순위 사용자의 reservations.json에서 미래 예약이 3개 이상이면:
        const waitlistUserFutureReservations = reservations.filter(
          (r) => {
            // 같은 사용자의 예약이고, 상태가 confirmed인 것만 확인
            if (r.userId !== waitlistUserId || r.status !== "confirmed") return false;

            // 날짜가 미래거나, 오늘이면 시간이 미래여야 함
            const reservationDate = r.date;
            const reservationStartTime = r.startTime;

            // 날짜 비교
            if (reservationDate > todayStr) return true;
            if (reservationDate === todayStr && timeCompare(reservationStartTime, currentTime) > 0) return true;

            return false;
          }
        );

        // 대기 1순위 사용자의 예약이 3개 미만이면 승격
        if (waitlistUserFutureReservations.length < 3) {
          // 3️⃣ 조건을 만족하는 사용자가 있으면:
          // 대기 목록에서 제거
          const waitlistIndex = waitlist.findIndex((w) => w.id === waitlistItem.id);
          waitlist.splice(waitlistIndex, 1);
          writeJson("waitlist.json", waitlist);

          // 강의실 정보 가져오기
          const rooms = readJson("rooms.json");
          const room = rooms.find((r) => r.id === waitlistItem.roomId);

          // reservations.json에 예약 자동 추가
          const newReservation = {
            id: waitlistItem.id,
            roomId: waitlistItem.roomId,
            userId: waitlistItem.userId,
            date: waitlistItem.date,
            startTime: waitlistItem.startTime,
            endTime: waitlistItem.endTime,
            purpose: "",
            location: (room?.location !== undefined && room?.location !== null) ? String(room.location).trim() : "",
            participants: [],
            status: "confirmed",
            createdAt: new Date().toISOString(),
          };

          reservations.push(newReservation);
          writeJson("reservations.json", reservations);

          // 콘솔 출력
          console.log(`🎯 대기열 처리: roomId=${waitlistItem.roomId}, 1순위 userId=${waitlistUserId} → 예약 자동 승격`);
          console.log(`🎯 대기 1순위 사용자(userId: ${waitlistUserId})가 자동으로 예약되었습니다.`);

          promoted = true;
          break;
        } else {
          // 2️⃣ 대기 1순위 사용자의 예약이 3개라면 해당 대기 신청 삭제하고 다음 사용자 확인
          const waitlistIndex = waitlist.findIndex((w) => w.id === waitlistItem.id);
          waitlist.splice(waitlistIndex, 1);
          writeJson("waitlist.json", waitlist);
          console.log(`⚠️ 대기 1순위 사용자(userId: ${waitlistUserId})의 예약이 3개여서 대기 신청 삭제, 다음 사용자 확인`);
        }
      }

      if (!promoted && relatedWaitlist.length > 0) {
        console.log(`⚠️ 모든 대기 사용자의 예약이 3개여서 자동 할당 실패`);
      }
    }

    // Socket.io 이벤트 전송 (실시간 현황 업데이트 - 취소 시 available로 변경)
    emitReservationUpdate({
      roomId: canceledReservation.roomId,
      date: canceledReservation.date,
      startTime: canceledReservation.startTime,
      endTime: canceledReservation.endTime,
      status: "available"
    });

    return sendSuccess(res, null, "예약 취소 성공");
  } catch (error) {
    console.error("예약 취소 오류:", error);
    return sendError(res, "예약 취소 중 오류가 발생했습니다.", 500);
  }
};

