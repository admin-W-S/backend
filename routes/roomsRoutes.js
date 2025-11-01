import express from "express";
import * as roomsController from "../controllers/roomsController.js";

const router = express.Router();

router.get("/", roomsController.getAllRooms);
router.get("/available", roomsController.getAvailableRooms);
router.get("/live", roomsController.getLiveRoomStatus);
router.get("/:id", roomsController.getRoomById);
router.post("/", roomsController.createRoom);
router.put("/:id", roomsController.updateRoom);
router.delete("/:id", roomsController.deleteRoom);

export default router;

