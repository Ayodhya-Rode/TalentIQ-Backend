import cloudinary from "../config/cloudinary.js";

export const uploadToCloudinary = (fileBuffer, folder = "talentiq", resourceType = "auto", originalName = null) => {
  return new Promise((resolve, reject) => {
    const options = { folder, resource_type: resourceType };
    if (originalName) {
      options.public_id = originalName.replace(/\.[^/.]+$/, "");
      options.format = originalName.split(".").pop();
    }
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result.secure_url);
    });
    stream.end(fileBuffer);
  });
};