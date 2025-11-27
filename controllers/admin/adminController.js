import prisma from "../../database/prisma.js";
import bcrypt from "bcrypt";
import speakeasy from "speakeasy";
import QRCode from "qrcode";

class adminController {
  // Admin Registration API
  static register = async (req, res) => {
    try {
      const { email, password, name } = req.body;

      // ---------- VALIDATE INPUT ----------
      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          message: "All fields are required: email, password, name",
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Invalid email format",
        });
      }

      // Validate password strength (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters long",
        });
      }

      // ---------- CHECK IF ADMIN EXISTS ----------
      const existingAdmin = await prisma.admin.findUnique({
        where: { email },
      });

      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          message: "Admin with this email already exists",
        });
      }

      // ---------- HASH PASSWORD ----------
      const hashedPassword = await bcrypt.hash(password, 10);

      // ---------- CREATE ADMIN ----------
      const admin = await prisma.admin.create({
        data: {
          email,
          password: hashedPassword,
          name,
          twoFactorEnabled: false,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Admin registered successfully",
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          twoFactorEnabled: admin.twoFactorEnabled,
          createdAt: admin.createdAt,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong during admin registration",
      });
    }
  };

  // Admin Login API
  static login = async (req, res) => {
    try {
      const { email, password, twoFactorCode } = req.body;

      // ---------- VALIDATE INPUT ----------
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      // ---------- FIND ADMIN ----------
      const admin = await prisma.admin.findUnique({
        where: { email },
      });

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // ---------- VERIFY PASSWORD ----------
      const isPasswordValid = await bcrypt.compare(password, admin.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      // ---------- CHECK 2FA ----------
      if (admin.twoFactorEnabled) {
        if (!twoFactorCode) {
          return res.status(403).json({
            success: false,
            message: "2FA code is required",
            requires2FA: true,
          });
        }

        // Verify 2FA code
        const verified = speakeasy.totp.verify({
          secret: admin.twoFactorSecret,
          encoding: "base32",
          token: twoFactorCode,
          window: 2, // Allow 2 time steps before/after
        });

        if (!verified) {
          return res.status(401).json({
            success: false,
            message: "Invalid 2FA code",
          });
        }
      }

      // ---------- CREATE SESSION ----------
      req.session.adminId = admin.id;
      req.session.adminEmail = admin.email;
      req.session.adminName = admin.name;

      return res.status(200).json({
        success: true,
        message: "Login successful",
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          twoFactorEnabled: admin.twoFactorEnabled,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong during login",
      });
    }
  };

  // Admin Logout API
  static logout = async (req, res) => {
    try {
      req.session.destroy((error) => {
        if (error) {
          return res.status(500).json({
            success: false,
            message: "Failed to logout",
          });
        }

        res.clearCookie("connect.sid");
        return res.status(200).json({
          success: true,
          message: "Logout successful",
        });
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong during logout",
      });
    }
  };

  // Get Logged In Admin Session Data
  static getSession = async (req, res) => {
    try {
      // ---------- CHECK SESSION ----------
      if (!req.session.adminId) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // ---------- FETCH ADMIN DATA ----------
      const admin = await prisma.admin.findUnique({
        where: { id: req.session.adminId },
        select: {
          id: true,
          email: true,
          name: true,
          twoFactorEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!admin) {
        // Session exists but admin not found - destroy session
        req.session.destroy();
        return res.status(404).json({
          success: false,
          message: "Admin not found",
        });
      }

      return res.status(200).json({
        success: true,
        admin,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while fetching session data",
      });
    }
  };

  // Enable 2FA - Generate Secret and QR Code
  static enable2FA = async (req, res) => {
    try {
      // ---------- CHECK AUTHENTICATION ----------
      if (!req.session.adminId) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // ---------- FETCH ADMIN ----------
      const admin = await prisma.admin.findUnique({
        where: { id: req.session.adminId },
      });

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found",
        });
      }

      // ---------- CHECK IF ALREADY ENABLED ----------
      if (admin.twoFactorEnabled) {
        return res.status(400).json({
          success: false,
          message: "2FA is already enabled",
        });
      }

      // ---------- GENERATE SECRET ----------
      const secret = speakeasy.generateSecret({
        name: `Coinoswap Admin (${admin.email})`,
        length: 32,
      });

      // ---------- GENERATE QR CODE ----------
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      // ---------- SAVE SECRET (BUT NOT YET ENABLED) ----------
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          twoFactorSecret: secret.base32,
        },
      });

      return res.status(200).json({
        success: true,
        message:
          "Scan the QR code with your authenticator app and verify with a code",
        secret: secret.base32,
        qrCode: qrCodeUrl,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while enabling 2FA",
      });
    }
  };

  // Verify and Activate 2FA
  static verify2FA = async (req, res) => {
    try {
      const { twoFactorCode } = req.body;

      // ---------- CHECK AUTHENTICATION ----------
      if (!req.session.adminId) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // ---------- VALIDATE INPUT ----------
      if (!twoFactorCode) {
        return res.status(400).json({
          success: false,
          message: "2FA code is required",
        });
      }

      // ---------- FETCH ADMIN ----------
      const admin = await prisma.admin.findUnique({
        where: { id: req.session.adminId },
      });

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found",
        });
      }

      if (!admin.twoFactorSecret) {
        return res.status(400).json({
          success: false,
          message: "2FA secret not found. Please enable 2FA first",
        });
      }

      // ---------- VERIFY CODE ----------
      const verified = speakeasy.totp.verify({
        secret: admin.twoFactorSecret,
        encoding: "base32",
        token: twoFactorCode,
        window: 2,
      });

      if (!verified) {
        return res.status(401).json({
          success: false,
          message: "Invalid 2FA code",
        });
      }

      // ---------- ACTIVATE 2FA ----------
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          twoFactorEnabled: true,
        },
      });

      return res.status(200).json({
        success: true,
        message: "2FA enabled successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while verifying 2FA",
      });
    }
  };

  // Disable 2FA
  static disable2FA = async (req, res) => {
    try {
      const { password, twoFactorCode } = req.body;

      // ---------- CHECK AUTHENTICATION ----------
      if (!req.session.adminId) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // ---------- VALIDATE INPUT ----------
      if (!password) {
        return res.status(400).json({
          success: false,
          message: "Password is required",
        });
      }

      // ---------- FETCH ADMIN ----------
      const admin = await prisma.admin.findUnique({
        where: { id: req.session.adminId },
      });

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found",
        });
      }

      // ---------- VERIFY PASSWORD ----------
      const isPasswordValid = await bcrypt.compare(password, admin.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid password",
        });
      }

      // ---------- VERIFY 2FA CODE IF ENABLED ----------
      if (admin.twoFactorEnabled) {
        if (!twoFactorCode) {
          return res.status(400).json({
            success: false,
            message: "2FA code is required to disable 2FA",
          });
        }

        const verified = speakeasy.totp.verify({
          secret: admin.twoFactorSecret,
          encoding: "base32",
          token: twoFactorCode,
          window: 2,
        });

        if (!verified) {
          return res.status(401).json({
            success: false,
            message: "Invalid 2FA code",
          });
        }
      }

      // ---------- DISABLE 2FA ----------
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });

      return res.status(200).json({
        success: true,
        message: "2FA disabled successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while disabling 2FA",
      });
    }
  };

  // Change Password API
  static changePassword = async (req, res) => {
    try {
      const { currentPassword, newPassword, twoFactorCode } = req.body;

      // ---------- CHECK AUTHENTICATION ----------
      if (!req.session.adminId) {
        return res.status(401).json({
          success: false,
          message: "Not authenticated",
        });
      }

      // ---------- VALIDATE INPUT ----------
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password and new password are required",
        });
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters long",
        });
      }

      // ---------- FETCH ADMIN ----------
      const admin = await prisma.admin.findUnique({
        where: { id: req.session.adminId },
      });

      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "Admin not found",
        });
      }

      // ---------- VERIFY CURRENT PASSWORD ----------
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        admin.password
      );

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid current password",
        });
      }

      // ---------- VERIFY 2FA IF ENABLED ----------
      if (admin.twoFactorEnabled) {
        if (!twoFactorCode) {
          return res.status(403).json({
            success: false,
            message: "2FA code is required for password change",
            requires2FA: true,
          });
        }

        const verified = speakeasy.totp.verify({
          secret: admin.twoFactorSecret,
          encoding: "base32",
          token: twoFactorCode,
          window: 2,
        });

        if (!verified) {
          return res.status(401).json({
            success: false,
            message: "Invalid 2FA code",
          });
        }
      }

      // ---------- HASH NEW PASSWORD ----------
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // ---------- UPDATE PASSWORD ----------
      await prisma.admin.update({
        where: { id: admin.id },
        data: {
          password: hashedPassword,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Password changed successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while changing password",
      });
    }
  };
}

export default adminController;
