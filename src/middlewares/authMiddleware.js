import jwt from "jsonwebtoken";
import config from "../config/config.js";

/**
 * Middleware to protect routes and authorize users based on their roles.
 * To verify is user is logged in or not 
 */

export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.jwt_access_secret);
    req.user = decoded; // { id, role }
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

/**
 * Middleware to authorize users based on their roles.
 * which roles are allowed to do this action.
 * Usage: authorize('admin', 'user') - allows access to users with 'admin' or 'user' roles. 
 */

export const authorize = (...allowedRoles) => {
  return (req, res, next) => {

    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "You don't have permission for this action" });
    }
    next();
  };
};