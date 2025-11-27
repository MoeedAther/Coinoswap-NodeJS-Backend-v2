import express from "express";
import adminController from "../controllers/admin/adminController.js";
import settingsController from "../controllers/admin/settingsController.js";

const router = express.Router();

// ...................................... Admin Authentication APIs .........................................../
router.post("/register", adminController.register);
router.post("/login", adminController.login);
router.post("/logout", adminController.logout);
router.get("/session", adminController.getSession);

// ...................................... Admin 2FA APIs .........................................../
router.post("/2fa/enable", adminController.enable2FA);
router.post("/2fa/verify", adminController.verify2FA);
router.post("/2fa/disable", adminController.disable2FA);

// ...................................... Admin Password Management .........................................../
router.post("/change-password", adminController.changePassword);

// ...................................... Admin Settings Management .........................................../
// Partners Settings
router.get("/settings/partners", settingsController.getPartners);
router.put("/settings/partners", settingsController.updatePartners);
router.post("/settings/partners/toggle", settingsController.togglePartner);

// General Settings
router.get("/settings", settingsController.getAllSettings);
router.get("/settings/:key", settingsController.getSetting);
router.post("/settings", settingsController.upsertSetting);
router.delete("/settings/:key", settingsController.deleteSetting);

export default router;
