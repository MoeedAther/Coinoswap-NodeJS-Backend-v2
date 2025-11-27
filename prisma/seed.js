import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("Starting seed...");

  // ---------- SEED ADMIN ----------
  const existingAdmin = await prisma.admin.findFirst();

  if (existingAdmin) {
    console.log("⏭️  Admin already exists. Skipping admin seed.");
  } else {
    // Create first admin
    const defaultEmail = process.env.ADMIN_EMAIL || "admin@coinoswap.com";
    const defaultPassword = process.env.ADMIN_PASSWORD || "Admin@123";
    const defaultName = process.env.ADMIN_NAME || "Super Admin";

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const admin = await prisma.admin.create({
      data: {
        email: defaultEmail,
        password: hashedPassword,
        name: defaultName,
        twoFactorEnabled: false,
      },
    });

    console.log("✅ First admin created successfully!");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📧 Email:", admin.email);
    console.log("🔑 Password:", defaultPassword);
    console.log("👤 Name:", admin.name);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⚠️  IMPORTANT: Please change the password after first login!");
  }

  // ---------- SEED SETTINGS - PARTNERS ----------
  const partnersKey = "partners";
  const existingPartners = await prisma.settings.findUnique({
    where: { key: partnersKey },
  });

  const partnersData = [
    { name: "changelly", isEnabled: true, hasGiveAway: false },
    { name: "changenow", isEnabled: true, hasGiveAway: false },
    { name: "changehero", isEnabled: true, hasGiveAway: false },
    { name: "simpleswap", isEnabled: true, hasGiveAway: false },
    { name: "godex", isEnabled: true, hasGiveAway: false },
    { name: "stealthex", isEnabled: true, hasGiveAway: false },
    { name: "letsexchange", isEnabled: true, hasGiveAway: false },
    { name: "exolix", isEnabled: true, hasGiveAway: false },
    { name: "easybit", isEnabled: true, hasGiveAway: false },
  ];

  if (existingPartners) {
    console.log("⏭️  Partners setting already exists. Skipping partners seed.");
  } else {
    await prisma.settings.create({
      data: {
        key: partnersKey,
        value: JSON.stringify(partnersData),
        type: "object",
      },
    });
    console.log("✅ Partners settings created successfully!");
    console.log("   - Total exchanges: 9");
    console.log("   - All exchanges enabled by default");
    console.log("   - All giveaways disabled by default");
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 Seed completed successfully!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
