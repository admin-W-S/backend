import express from "express";
import * as reservationsController from "../controllers/reservationsController.js";

const router = express.Router();

router.post("/", reservationsController.createReservation);
router.get("/my/:userId", reservationsController.getMyReservations);
router.get("/room/:roomId", reservationsController.getRoomReservations);
router.delete("/:id", reservationsController.cancelReservation);

export default router;

