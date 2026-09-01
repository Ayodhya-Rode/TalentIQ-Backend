import dotenv from "dotenv";
dotenv.config();
import ImageKit from "imagekit";

// Required environment variables list
const requiredEnvVars = [
  "PORT",
  "BREVO_API_KEY",
  "BREVO_SENDER_EMAIL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_RESET_PASSWORD_SECRET",
  "FRONTEND_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "GROQ_API_KEY",
  "IMAGEKIT_PUBLIC_KEY",
  "IMAGEKIT_PRIVATE_KEY",
  "IMAGEKIT_URL_ENDPOINT",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "B2_ACCESS_KEY_ID",
  "B2_SECRET_ACCESS_KEY",
  "B2_BUCKET_NAME",
  "B2_ENDPOINT",
  "B2_REGION",
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
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET,
  jwt_reset_password_secret: process.env.JWT_RESET_PASSWORD_SECRET,
  frontend_url: process.env.FRONTEND_URL,
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
  groq_api_key: process.env.GROQ_API_KEY,
  imagekit: new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  }),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
  livekitApiKey: process.env.LIVEKIT_API_KEY,
  livekitApiSecret: process.env.LIVEKIT_API_SECRET,
  livekitUrl: process.env.LIVEKIT_URL,
  b2: {
    bucketAccessKeyId: process.env.B2_ACCESS_KEY_ID,
    bucketSecretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    bucketName: process.env.B2_BUCKET_NAME,
    bucketEndpoint: process.env.B2_ENDPOINT,
    bucketRegion: process.env.B2_REGION,
  },
};

export default config;
