import { readJson, writeJson } from "../utils/fileUtils.js";
import { sendSuccess, sendError } from "../utils/responseUtils.js";

/**
 * 회원가입
 */
export const signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 필수 필드 검증
    if (!name || !email || !password) {
      return sendError(res, "이름, 이메일, 비밀번호는 필수 입력 항목입니다.", 400);
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(res, "올바른 이메일 형식이 아닙니다.", 400);
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      return sendError(res, "비밀번호는 최소 6자 이상이어야 합니다.", 400);
    }

    const users = readJson("users.json");

    // 이메일 중복 확인
    if (users.find((u) => u.email === email)) {
      return sendError(res, "이미 존재하는 이메일입니다.", 400);
    }

    // 새 사용자 생성
    const newUser = {
      id: users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1,
      name,
      email,
      password,
      role: role || "student",
    };

    users.push(newUser);
    writeJson("users.json", users);

    return sendSuccess(res, newUser, "회원가입 성공", 201);
  } catch (error) {
    console.error("회원가입 오류:", error);
    return sendError(res, "회원가입 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 로그인
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 필수 필드 검증
    if (!email || !password) {
      return sendError(res, "이메일과 비밀번호를 입력해주세요.", 400);
    }

    const users = readJson("users.json");

    const user = users.find((u) => u.email === email && u.password === password);
    if (!user) {
      return sendError(res, "이메일 또는 비밀번호가 올바르지 않습니다.", 401);
    }

    return sendSuccess(res, user, "로그인 성공");
  } catch (error) {
    console.error("로그인 오류:", error);
    return sendError(res, "로그인 중 오류가 발생했습니다.", 500);
  }
};

/**
 * 학생 목록 조회 (그룹 예약용)
 */
export const getStudents = async (req, res) => {
  try {
    const users = readJson("users.json");
    
    // 학생만 필터링
    const students = users
      .filter((u) => u.role === "student")
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
      }));

    return sendSuccess(res, students, "학생 목록 조회 성공");
  } catch (error) {
    console.error("학생 목록 조회 오류:", error);
    return sendError(res, "학생 목록 조회 중 오류가 발생했습니다.", 500);
  }
};

