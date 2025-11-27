import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

// Create Prisma Client instance
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// Handle graceful shutdown
const cleanup = async () => {
  await prisma.$disconnect();
};

process.on("beforeExit", cleanup);
process.on("SIGINT", async () => {
  await cleanup();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await cleanup();
  process.exit(0);
});

export default prisma;
