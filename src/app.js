import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import cookieParser from "cookie-parser";
import organizationRoutes from "./routes/organizationRoutes.js";

const app = express();
app.use(express.json());
app.use(cors());
app.use(cookieParser())

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);







export default app;
