import express from "express";
import * as notificationsController from "../controllers/notificationsController.js";

const router = express.Router();

router.get("/:userId", notificationsController.getMyNotifications);
router.patch("/:id", notificationsController.markNotificationAsRead);

export default router;

