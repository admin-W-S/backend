import { readJson, writeJson } from "../utils/fileUtils.js";
import { sendSuccess, sendError } from "../utils/responseUtils.js";
import { v4 as uuidv4 } from "uuid";

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
 * 대기 등록
 */
export const createWaitlist = async (req, res) => {
  try {
    const { userId, roomId, date, startTime, endTime } = req.body;

    // 필수 필드 검증
    if (!userId || !roomId || !date || !startTime || !endTime) {
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

    // 과거 날짜 대기 등록 불가
    const now = new Date();
    const reserveDate = new Date(date);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const reserveDateOnly = new Date(
      reserveDate.getFullYear(),
      reserveDate.getMonth(),
      reserveDate.getDate()
    );

    if (reserveDateOnly < today) {
      return sendError(res, "과거 날짜는 대기 등록할 수 없습니다.", 400);
    }

    const rooms = readJson("rooms.json");
    const waitlist = readJson("waitlist.json");
    const reservations = readJson("reservations.json");

    // 강의실 존재 확인
    const room = rooms.find((r) => r.id === parseInt(roomId));
    if (!room) {
      return sendError(res, "강의실을 찾을 수 없습니다.", 404);
    }

    // 사용자별 미래 예약 개수 확인 (최대 3개) - 대기 신청 전에 확인
    const todayStr = now.toISOString().split("T")[0];
    const currentTime = now.toTimeString().slice(0, 5);
    
    const userFutureReservations = reservations.filter(
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

    // 2️⃣ 해당 userId의 reservations.json에서 미래 예약이 3개 이상이면 오류
    if (userFutureReservations.length >= 3) {
      return sendError(
        res,
        "이미 3개의 예약이 존재하므로 대기 신청이 불가합니다.",
        400
      );
    }

    // 1️⃣ reservations.json에서 동일 roomId, date, time에 예약이 존재하는지 확인
    const overlappingReservation = reservations.find(
      (r) =>
        r.roomId === parseInt(roomId) &&
        r.date === date &&
        r.status === "confirmed" &&
        isTimeOverlap(startTime, endTime, r.startTime, r.endTime)
    );

    // 예약이 없으면 대기 신청 불가 (예약이 꽉 찬 시간대에만 대기 가능)
    if (!overlappingReservation) {
      return sendError(
        res,
        "해당 시간대는 비어있습니다. 예약이 가능합니다.",
        400
      );
    }

    // 사용자별 대기 목록 개수 확인 (최대 3개)
    const userWaitlist = waitlist.filter(
      (w) => w.userId === parseInt(userId) && w.status === "waiting"
    );

    if (userWaitlist.length >= 3) {
      return sendError(res, "1인당 최대 3개의 대기 목록만 등록 가능합니다.", 400);
    }

    // 중복 대기 등록 확인 (같은 사용자, 같은 강의실, 같은 시간대)
    const duplicate = waitlist.find(
      (w) =>
        w.userId === parseInt(userId) &&
        w.roomId === parseInt(roomId) &&
        w.date === date &&
        w.startTime === startTime &&
        w.endTime === endTime &&
        w.status === "waiting"
    );

    // 3️⃣ 동일한 시간/강의실/사용자의 기존 대기 신청이 있다면 오류
    if (duplicate) {
      return sendError(res, "이미 같은 시간에 대기 중입니다.", 400);
    }

    // 4️⃣ 위 조건을 모두 통과하면 waitlist.json에 추가
    // id는 자동 증가 (uuid 사용)
    const newWaitlist = {
      id: uuidv4(),
      userId: parseInt(userId),
      roomId: parseInt(roomId),
      date,
      startTime,
      endTime,
      status: "waiting",
      createdAt: new Date().toISOString(),
    };

    waitlist.push(newWaitlist);
    writeJson("waitlist.json", waitlist);

    return sendSuccess(res, newWaitlist, "대기 신청이 완료되었습니다.", 201);
  } catch (error) {
    console.error("대기 등록 오류:", error);
    return sendError(res, "대기 등록 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 사용자의 대기 목록 조회
 */
export const getMyWaitlist = async (req, res) => {
  try {
    const { userId } = req.params;
    const waitlist = readJson("waitlist.json");

    const userWaitlist = waitlist
      .filter((w) => w.userId === parseInt(userId) && w.status === "waiting")
      .map((w) => ({
        roomId: w.roomId,
        date: w.date,
        startTime: w.startTime,
        endTime: w.endTime,
        status: w.status,
      }));

    // 날짜와 시간 순으로 정렬 (최신순)
    userWaitlist.sort((a, b) => {
      if (a.date !== b.date) {
        return new Date(b.date) - new Date(a.date);
      }
      const timeCompare = (t1, t2) => {
        const [h1, m1] = t1.split(":").map(Number);
        const [h2, m2] = t2.split(":").map(Number);
        return h2 * 60 + m2 - (h1 * 60 + m1);
      };
      return timeCompare(b.startTime, a.startTime);
    });

    return sendSuccess(res, userWaitlist, "대기 목록 조회 성공");
  } catch (error) {
    console.error("대기 목록 조회 오류:", error);
    return sendError(res, "대기 목록 조회 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 대기 신청 취소
 */
export const cancelWaitlist = async (req, res) => {
  try {
    const { id } = req.params;
    const waitlist = readJson("waitlist.json");

    const waitlistIndex = waitlist.findIndex((w) => w.id === id);

    if (waitlistIndex === -1) {
      return sendError(res, "대기 신청을 찾을 수 없습니다.", 404);
    }

    // 대기 신청 삭제
    waitlist.splice(waitlistIndex, 1);
    writeJson("waitlist.json", waitlist);

    return sendSuccess(res, null, "대기 신청이 성공적으로 취소되었습니다.");
  } catch (error) {
    console.error("대기 신청 취소 오류:", error);
    return sendError(res, "대기 신청 취소 중 오류가 발생했습니다.", 500);
  }
};

