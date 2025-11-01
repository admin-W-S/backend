import { readJson, writeJson } from "../utils/fileUtils.js";
import { sendSuccess, sendError } from "../utils/responseUtils.js";

/**
 * 전체 강의실 목록 조회
 */
export const getAllRooms = async (req, res) => {
  try {
    const rooms = readJson("rooms.json");
    return sendSuccess(res, rooms, "강의실 목록 조회 성공");
  } catch (error) {
    console.error("강의실 목록 조회 오류:", error);
    return sendError(res, "강의실 목록 조회 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 단일 강의실 정보 조회
 */
export const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const rooms = readJson("rooms.json");
    const room = rooms.find((r) => r.id === parseInt(id));

    if (!room) {
      return sendError(res, "강의실을 찾을 수 없습니다.", 404);
    }

    return sendSuccess(res, room, "강의실 정보 조회 성공");
  } catch (error) {
    console.error("강의실 조회 오류:", error);
    return sendError(res, "강의실 조회 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 강의실 추가 (Admin만)
 */
export const createRoom = async (req, res) => {
  try {
    const { name, location, capacity, equipments, available } = req.body;

    // 필수 필드 검증
    if (!name || !location || !capacity) {
      return sendError(res, "이름, 위치, 수용 인원은 필수 입력 항목입니다.", 400);
    }

    // equipments를 배열로 변환 (없으면 빈 배열)
    const equipmentArray = Array.isArray(equipments) ? equipments : [];

    const rooms = readJson("rooms.json");

    const newRoom = {
      id: rooms.length ? Math.max(...rooms.map((r) => r.id)) + 1 : 1,
      name,
      location,
      capacity: parseInt(capacity),
      equipments: equipmentArray,
      available: available !== undefined ? available : true,
    };

    rooms.push(newRoom);
    writeJson("rooms.json", rooms);

    return sendSuccess(res, newRoom, "강의실 추가 성공", 201);
  } catch (error) {
    console.error("강의실 추가 오류:", error);
    return sendError(res, "강의실 추가 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 강의실 정보 수정 (Admin만)
 */
export const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const rooms = readJson("rooms.json");
    const roomIndex = rooms.findIndex((r) => r.id === parseInt(id));

    if (roomIndex === -1) {
      return sendError(res, "강의실을 찾을 수 없습니다.", 404);
    }

    // 기존 데이터와 병합
    const updatedRoom = {
      ...rooms[roomIndex],
      ...req.body,
      id: rooms[roomIndex].id, // id는 변경 불가
    };

    // capacity가 있으면 숫자로 변환
    if (updatedRoom.capacity) {
      updatedRoom.capacity = parseInt(updatedRoom.capacity);
    }

    rooms[roomIndex] = updatedRoom;
    writeJson("rooms.json", rooms);

    return sendSuccess(res, updatedRoom, "강의실 수정 성공");
  } catch (error) {
    console.error("강의실 수정 오류:", error);
    return sendError(res, "강의실 수정 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 강의실 삭제 (Admin만)
 */
export const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const rooms = readJson("rooms.json");
    const roomIndex = rooms.findIndex((r) => r.id === parseInt(id));

    if (roomIndex === -1) {
      return sendError(res, "강의실을 찾을 수 없습니다.", 404);
    }

    rooms.splice(roomIndex, 1);
    writeJson("rooms.json", rooms);

    return sendSuccess(res, null, "강의실 삭제 성공");
  } catch (error) {
    console.error("강의실 삭제 오류:", error);
    return sendError(res, "강의실 삭제 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 예약 가능한 강의실 조회 (빈 강의실 검색)
 */
export const getAvailableRooms = async (req, res) => {
  try {
    const { date, startTime, endTime, minCapacity, hasProjector, hasWhiteboard } = req.query;

    // 필수 필드 검증
    if (!date || !startTime || !endTime) {
      return sendError(res, "날짜, 시작 시간, 종료 시간은 필수 입력 항목입니다.", 400);
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

    const rooms = readJson("rooms.json");
    const reservations = readJson("reservations.json");

    // 시간 겹침 확인 함수
    const isTimeOverlap = (start1, end1, start2, end2) => {
      return (
        (start1 >= start2 && start1 < end2) ||
        (end1 > start2 && end1 <= end2) ||
        (start1 <= start2 && end1 >= end2)
      );
    };

    // 해당 시간대에 예약이 있는 roomId 목록 (confirmed 상태만)
    const unavailableRoomIds = reservations
      .filter((r) => {
        if (r.date !== date || r.status !== "confirmed") return false;
        return isTimeOverlap(startTime, endTime, r.startTime, r.endTime);
      })
      .map((r) => r.roomId);

    // 예약 가능한 강의실 필터링 (available 상태이고 예약되지 않은 강의실)
    let availableRooms = rooms.filter(
      (r) => r.available && !unavailableRoomIds.includes(r.id)
    );

    // 최소 수용인원 필터
    if (minCapacity) {
      const capacity = parseInt(minCapacity);
      if (!isNaN(capacity)) {
        availableRooms = availableRooms.filter((r) => r.capacity >= capacity);
      }
    }

    // 프로젝터 유무 필터
    if (hasProjector === "true" || hasProjector === true) {
      availableRooms = availableRooms.filter((r) =>
        r.equipments && r.equipments.includes("projector")
      );
    }

    // 화이트보드 유무 필터
    if (hasWhiteboard === "true" || hasWhiteboard === true) {
      availableRooms = availableRooms.filter((r) =>
        r.equipments && r.equipments.includes("whiteboard")
      );
    }

    return sendSuccess(res, availableRooms, "예약 가능한 강의실 조회 성공");
  } catch (error) {
    console.error("예약 가능한 강의실 조회 오류:", error);
    return sendError(res, "예약 가능한 강의실 조회 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 실시간 강의실 상태 조회
 */
export const getLiveRoomStatus = async (req, res) => {
  try {
    const rooms = readJson("rooms.json");
    const reservations = readJson("reservations.json");
    const now = new Date();
    const currentDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm

    // 현재 사용 중인 roomId 목록
    const inUseRoomIds = reservations
      .filter((r) => {
        if (r.date !== currentDate || r.status !== "confirmed") return false;
        // 현재 시간이 예약 시간대에 포함되는지 확인
        return currentTime >= r.startTime && currentTime < r.endTime;
      })
      .map((r) => r.roomId);

    const roomStatus = rooms.map((room) => ({
      roomId: room.id,
      name: room.name,
      status: inUseRoomIds.includes(room.id) ? "in-use" : "available",
    }));

    return sendSuccess(res, roomStatus, "실시간 강의실 상태 조회 성공");
  } catch (error) {
    console.error("실시간 강의실 상태 조회 오류:", error);
    return sendError(res, "실시간 강의실 상태 조회 중 오류가 발생했습니다.", 500);
  }
};

