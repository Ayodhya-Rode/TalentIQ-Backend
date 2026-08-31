import cron from "node-cron";
import { cleanupAbandonedBookings, sendUpcomingReminders } from "../controllers/bookingController.js";

export const startBookingCleanupJob = () => {
  cron.schedule("*/5 * * * *", async () => {
    await cleanupAbandonedBookings();
    await sendUpcomingReminders();
  });
};