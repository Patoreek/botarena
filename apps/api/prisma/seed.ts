import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth.js";

const prisma = new PrismaClient();

const TEST_EMAIL = "testing@gmail.com";
const TEST_PASSWORD = "Testing123!";

async function main() {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const existing = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (existing) {
    await prisma.user.update({
      where: { email: TEST_EMAIL },
      data: { passwordHash, name: "Test User" },
    });
    console.log("Updated test user password:", TEST_EMAIL);
    return;
  }
  await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      passwordHash,
      name: "Test User",
    },
  });
  console.log("Created test user:", TEST_EMAIL);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
