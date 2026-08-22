import dotenv from "dotenv";
dotenv.config();

// Required environment variables list
const requiredEnvVars = [
  "PORT",
  "BREVO_API_KEY",
  "BREVO_SENDER_EMAIL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_RESET_PASSWORD_SECRET",
  "FRONTEND_URL"
];

// Checks all required variables are present in the environment
requiredEnvVars.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

const config = {
  port: process.env.PORT || 4000,
  brevoApiKey: process.env.BREVO_API_KEY,
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET,
  jwt_refresh_secret:process.env.JWT_REFRESH_SECRET,
  jwt_reset_password_secret: process.env.JWT_RESET_PASSWORD_SECRET,
  frontend_url: process.env.FRONTEND_URL
};

export default config;
