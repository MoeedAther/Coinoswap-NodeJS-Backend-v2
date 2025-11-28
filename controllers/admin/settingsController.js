import prisma from "../../database/prisma.js";

class settingsController {
  // Get All Settings
  static getAllSettings = async (req, res) => {
    try {
      const settings = await prisma.settings.findMany({
        orderBy: {
          key: "asc",
        },
      });

      // Parse JSON values for object type settings
      const parsedSettings = settings.map((setting) => ({
        ...setting,
        value:
          setting.type === "object" ? JSON.parse(setting.value) : setting.value,
      }));

      return res.status(200).json({
        success: true,
        settings: parsedSettings,
        count: parsedSettings.length,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while fetching settings",
      });
    }
  };

  // Get Single Setting by Key
  static getSetting = async (req, res) => {
    try {
      const { key } = req.params;

      if (!key) {
        return res.status(400).json({
          success: false,
          message: "Setting key is required",
        });
      }

      const setting = await prisma.settings.findUnique({
        where: { key },
      });

      if (!setting) {
        return res.status(404).json({
          success: false,
          message: `Setting with key '${key}' not found`,
        });
      }

      const parsedValue =
        setting.type === "object" ? JSON.parse(setting.value) : setting.value;

      return res.status(200).json({
        success: true,
        setting: {
          ...setting,
          value: parsedValue,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while fetching setting",
      });
    }
  };

  // Create or Update Setting
  static upsertSetting = async (req, res) => {
    try {
      // ---------- CHECK AUTHENTICATION ----------
      if (!req.session.adminId) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const { key, value, type } = req.body;

      // ---------- VALIDATE INPUT ----------
      if (!key || value === undefined) {
        return res.status(400).json({
          success: false,
          message: "key and value are required",
        });
      }

      const validTypes = ["string", "number", "boolean", "object"];
      const settingType = type || "string";

      if (!validTypes.includes(settingType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
        });
      }

      // Validate value type matches specified type
      let processedValue = value;
      if (settingType === "object") {
        if (typeof value !== "object") {
          return res.status(400).json({
            success: false,
            message: "Value must be an object when type is 'object'",
          });
        }
        processedValue = JSON.stringify(value);
      } else {
        processedValue = String(value);
      }

      // ---------- UPSERT SETTING ----------
      const setting = await prisma.settings.upsert({
        where: { key },
        update: {
          value: processedValue,
          type: settingType,
        },
        create: {
          key,
          value: processedValue,
          type: settingType,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Setting '${key}' saved successfully`,
        setting: {
          ...setting,
          value: settingType === "object" ? JSON.parse(setting.value) : setting.value,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while saving setting",
      });
    }
  };

  // Delete Setting
  static deleteSetting = async (req, res) => {
    try {
      // ---------- CHECK AUTHENTICATION ----------
      if (!req.session.adminId) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const { key } = req.params;

      if (!key) {
        return res.status(400).json({
          success: false,
          message: "Setting key is required",
        });
      }

      // Check if setting exists
      const existingSetting = await prisma.settings.findUnique({
        where: { key },
      });

      if (!existingSetting) {
        return res.status(404).json({
          success: false,
          message: `Setting with key '${key}' not found`,
        });
      }

      // Delete setting
      await prisma.settings.delete({
        where: { key },
      });

      return res.status(200).json({
        success: true,
        message: `Setting '${key}' deleted successfully`,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while deleting setting",
      });
    }
  };
}

export default settingsController;
