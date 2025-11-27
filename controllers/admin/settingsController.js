import prisma from "../../database/prisma.js";

class settingsController {
  // Get Partners Settings
  static getPartners = async (req, res) => {
    try {
      const partners = await prisma.settings.findUnique({
        where: { key: "partners" },
      });

      if (!partners) {
        return res.status(404).json({
          success: false,
          message: "Partners settings not found",
        });
      }

      const partnersData = JSON.parse(partners.value);

      // Count enabled exchanges and giveaways
      const enabledCount = partnersData.filter((p) => p.isEnabled === true).length;
      const giveAwayCount = partnersData.filter((p) => p.hasGiveAway === true).length;

      return res.status(200).json({
        success: true,
        partners: partnersData,
        totalExchanges: partnersData.length,
        enabledExchanges: enabledCount,
        disabledExchanges: partnersData.length - enabledCount,
        activeGiveAways: giveAwayCount,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while fetching partners settings",
      });
    }
  };

  // Update Partners Settings
  static updatePartners = async (req, res) => {
    try {
      // ---------- CHECK AUTHENTICATION ----------
      if (!req.session.adminId) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const { partners } = req.body;

      // ---------- VALIDATE INPUT ----------
      if (!partners || !Array.isArray(partners)) {
        return res.status(400).json({
          success: false,
          message: "Partners array is required",
        });
      }

      // Validate exchange names
      const validExchanges = [
        "changelly",
        "changenow",
        "changehero",
        "simpleswap",
        "godex",
        "stealthex",
        "letsexchange",
        "exolix",
        "easybit",
      ];

      // Validate each partner object
      for (const partner of partners) {
        if (!partner.name || typeof partner.name !== "string") {
          return res.status(400).json({
            success: false,
            message: "Each partner must have a valid name (string)",
          });
        }

        if (!validExchanges.includes(partner.name)) {
          return res.status(400).json({
            success: false,
            message: `Invalid exchange name: ${partner.name}`,
            validExchanges,
          });
        }

        if (typeof partner.isEnabled !== "boolean") {
          return res.status(400).json({
            success: false,
            message: `Partner ${partner.name} must have isEnabled as boolean`,
          });
        }

        if (typeof partner.hasGiveAway !== "boolean") {
          return res.status(400).json({
            success: false,
            message: `Partner ${partner.name} must have hasGiveAway as boolean`,
          });
        }
      }

      // ---------- UPDATE SETTINGS ----------
      await prisma.settings.upsert({
        where: { key: "partners" },
        update: {
          value: JSON.stringify(partners),
        },
        create: {
          key: "partners",
          value: JSON.stringify(partners),
          type: "object",
        },
      });

      // Count enabled exchanges and giveaways
      const enabledCount = partners.filter((p) => p.isEnabled === true).length;
      const giveAwayCount = partners.filter((p) => p.hasGiveAway === true).length;

      return res.status(200).json({
        success: true,
        message: "Partners settings updated successfully",
        partners,
        totalExchanges: partners.length,
        enabledExchanges: enabledCount,
        disabledExchanges: partners.length - enabledCount,
        activeGiveAways: giveAwayCount,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while updating partners settings",
      });
    }
  };

  // Toggle Single Partner
  static togglePartner = async (req, res) => {
    try {
      // ---------- CHECK AUTHENTICATION ----------
      if (!req.session.adminId) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      const { partnerName, isEnabled, hasGiveAway } = req.body;

      // ---------- VALIDATE INPUT ----------
      if (!partnerName) {
        return res.status(400).json({
          success: false,
          message: "partnerName is required",
        });
      }

      if (isEnabled !== undefined && typeof isEnabled !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isEnabled must be boolean if provided",
        });
      }

      if (hasGiveAway !== undefined && typeof hasGiveAway !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "hasGiveAway must be boolean if provided",
        });
      }

      const validExchanges = [
        "changelly",
        "changenow",
        "changehero",
        "simpleswap",
        "godex",
        "stealthex",
        "letsexchange",
        "exolix",
        "easybit",
      ];

      if (!validExchanges.includes(partnerName)) {
        return res.status(400).json({
          success: false,
          message: `Invalid partner name: ${partnerName}`,
          validExchanges,
        });
      }

      // ---------- UPDATE PARTNER ----------
      const existingSettings = await prisma.settings.findUnique({
        where: { key: "partners" },
      });

      if (!existingSettings) {
        return res.status(404).json({
          success: false,
          message: "Partners settings not found",
        });
      }

      const partnersData = JSON.parse(existingSettings.value);
      const partnerIndex = partnersData.findIndex((p) => p.name === partnerName);

      if (partnerIndex === -1) {
        return res.status(404).json({
          success: false,
          message: `Partner ${partnerName} not found`,
        });
      }

      // Update only provided fields
      if (isEnabled !== undefined) {
        partnersData[partnerIndex].isEnabled = isEnabled;
      }
      if (hasGiveAway !== undefined) {
        partnersData[partnerIndex].hasGiveAway = hasGiveAway;
      }

      await prisma.settings.update({
        where: { key: "partners" },
        data: {
          value: JSON.stringify(partnersData),
        },
      });

      // Count enabled exchanges and giveaways
      const enabledCount = partnersData.filter((p) => p.isEnabled === true).length;
      const giveAwayCount = partnersData.filter((p) => p.hasGiveAway === true).length;

      return res.status(200).json({
        success: true,
        message: `${partnerName} has been updated successfully`,
        partners: partnersData,
        totalExchanges: partnersData.length,
        enabledExchanges: enabledCount,
        disabledExchanges: partnersData.length - enabledCount,
        activeGiveAways: giveAwayCount,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while toggling partner",
      });
    }
  };

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
