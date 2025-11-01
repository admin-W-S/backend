import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";

// Routes
import authRoutes from "./routes/authRoutes.js";
import roomsRoutes from "./routes/roomsRoutes.js";
import reservationsRoutes from "./routes/reservationsRoutes.js";
import waitlistRoutes from "./routes/waitlistRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";

// Controllers (기존 호환성용)
import * as authController from "./controllers/authController.js";
import * as roomsController from "./controllers/roomsController.js";

// Utils
import { initializeRooms } from "./utils/initRooms.js";

// ===== 기본 세팅 =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ===== 라우트 설정 =====
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomsRoutes);
app.use("/api/reservations", reservationsRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/stats", statsRoutes);

// 기존 호환성을 위한 라우트 (API 프리픽스 없이)
app.post("/signup", authController.signup);
app.post("/login", authController.login);
app.get("/rooms", roomsController.getAllRooms);

// ===== 서버 실행 =====
const PORT = 4000;
const HOST = '0.0.0.0'; // 모든 네트워크 인터페이스에서 접속 가능

// 서버 시작 전 기본 강의실 데이터 초기화
initializeRooms();

// HTTP 서버 생성
const server = app.listen(PORT, HOST, () => {
  console.log(`✅ JSON-based backend running on port ${PORT}`);
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
  console.log(`✅ 네트워크 접속: http://10.22.151.157:${PORT}`);
  console.log(`✅ Waitlist feature loaded`);
});

// Socket.io 초기화 및 알림 스케줄러 시작은 서버 시작 후에 실행
setTimeout(async () => {
  // Socket.io 초기화
  const { initializeSocket } = await import("./utils/socketManager.js");
  await initializeSocket(server);

  // 알림 스케줄러 초기화
  const { startNotificationScheduler } = await import("./utils/notificationScheduler.js");
  startNotificationScheduler();

  console.log(`✅ Real-time & Notification features loaded successfully`);
}, 100);

// 알림 라우트 추가 (서버 시작 전에 등록)
import notificationsRoutes from "./routes/notificationsRoutes.js";
app.use("/api/notifications", notificationsRoutes);
