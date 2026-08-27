import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();

const allowedMimeTypes  = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
];

const allowedExtensions = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    console.log("Received file:", file.originalname, file.mimetype);
    const ext = path.extname(file.originalname).toLowerCase();
    const mimetypeOk = allowedMimeTypes.includes(file.mimetype);
    const extensionOk = allowedExtensions.includes(ext);

    if (mimetypeOk || extensionOk) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only PDF, DOC, DOCX, JPEG, and PNG are allowed.",
        ),
      );
    }
  },
});

export default upload;
