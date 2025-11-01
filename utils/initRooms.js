import { readJson, writeJson } from "./fileUtils.js";

/**
 * 서버 실행 시 기본 강의실 데이터 초기화
 */
export const initializeRooms = () => {
  try {
    let rooms = [];
    
    // rooms.json 파일 읽기 시도
    try {
      rooms = readJson("rooms.json");
    } catch (error) {
      // 파일이 없거나 읽기 실패 시 빈 배열로 시작
      rooms = [];
    }

    // 파일이 존재하지 않거나 빈 배열이면 기본 데이터 생성
    if (!Array.isArray(rooms) || rooms.length === 0) {
      const defaultRooms = [
        { id: 1, name: "공대1호관 101호", location: "공대1호관", capacity: 50, equipments: ["projector", "whiteboard"], available: true },
        { id: 2, name: "공대1호관 102호", location: "공대1호관", capacity: 40, equipments: ["projector"], available: true },
        { id: 3, name: "공3호관 201호", location: "공3호관", capacity: 60, equipments: ["whiteboard"], available: true },
        { id: 4, name: "공3호관 202호", location: "공3호관", capacity: 70, equipments: ["projector", "whiteboard"], available: true },
        { id: 5, name: "공대5호관 301호", location: "공대5호관", capacity: 30, equipments: ["projector"], available: true },
        { id: 6, name: "공대5호관 302호", location: "공대5호관", capacity: 25, equipments: ["whiteboard"], available: true },
        { id: 7, name: "도서관 101호", location: "도서관", capacity: 20, equipments: ["projector", "whiteboard"], available: true },
        { id: 8, name: "도서관 102호", location: "도서관", capacity: 35, equipments: ["projector"], available: true },
        { id: 9, name: "자연대 201호", location: "자연대", capacity: 50, equipments: ["whiteboard"], available: true },
        { id: 10, name: "자연대 202호", location: "자연대", capacity: 60, equipments: ["projector"], available: true },
        { id: 11, name: "경상대 101호", location: "경상대", capacity: 45, equipments: ["whiteboard"], available: true },
        { id: 12, name: "경상대 102호", location: "경상대", capacity: 30, equipments: ["projector"], available: true },
        { id: 13, name: "인문대 301호", location: "인문대", capacity: 25, equipments: ["whiteboard"], available: true },
        { id: 14, name: "인문대 302호", location: "인문대", capacity: 30, equipments: ["projector"], available: true },
        { id: 15, name: "사과대 201호", location: "사과대", capacity: 40, equipments: ["projector", "whiteboard"], available: true },
        { id: 16, name: "사과대 202호", location: "사과대", capacity: 55, equipments: ["projector"], available: true },
        { id: 17, name: "교양관 101호", location: "교양관", capacity: 20, equipments: ["whiteboard"], available: true },
        { id: 18, name: "교양관 102호", location: "교양관", capacity: 35, equipments: ["projector"], available: true },
      ];

      writeJson("rooms.json", defaultRooms);
      console.log("🌱 18개의 기본 강의실 데이터가 자동 생성되었습니다.");
      return true;
    }
    
    return false; // 이미 데이터가 있음
  } catch (error) {
    console.error("강의실 데이터 초기화 오류:", error);
    return false;
  }
};

