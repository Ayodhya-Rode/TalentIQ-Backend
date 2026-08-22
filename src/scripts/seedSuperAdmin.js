import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../config/db.js";

const seedSuperAdmin = async () => {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD; 

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Super Admin already exists");
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: "SUPER_ADMIN",
      isVerified: true, // skip OTP flow entirely for this one
    },
  });

};

seedSuperAdmin();