import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");

/**
 * JSON 파일 읽기
 * @param {string} filename - 파일명 (예: "users.json")
 * @returns {Array|Object} JSON 데이터
 */
export const readJson = (filename) => {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      // 파일이 없으면 기본값 반환
      const defaultValue = (filename === "waitlist.json" || filename === "notifications.json") ? [] : [];
      writeJson(filename, defaultValue);
      return defaultValue;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`파일 읽기 오류 (${filename}):`, error);
    throw error;
  }
};

/**
 * JSON 파일 쓰기
 * @param {string} filename - 파일명
 * @param {Array|Object} data - 저장할 데이터
 */
export const writeJson = (filename, data) => {
  try {
    const filePath = path.join(DATA_DIR, filename);
    // data 폴더가 없으면 생성
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`파일 쓰기 오류 (${filename}):`, error);
    throw error;
  }
};

