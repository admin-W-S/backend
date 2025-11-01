import express from "express";
import * as waitlistController from "../controllers/waitlistController.js";

const router = express.Router();

router.post("/", waitlistController.createWaitlist);
router.get("/:userId", waitlistController.getMyWaitlist);
router.delete("/:id", waitlistController.cancelWaitlist);

export default router;

