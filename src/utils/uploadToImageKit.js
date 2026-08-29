import config from "../config/config.js";

/**
 * Upload a file buffer to ImageKit.
 *
 * @param {Buffer} fileBuffer - The file's raw bytes
 * @param {string} folder - ImageKit folder path
 * @param {string} originalName - Original filename
 * @returns {Promise<string>} The file's public URL
 */
export const uploadToImageKit = (
  fileBuffer,
  folder = "talentiq",
  originalName = "file",
) => {
  return new Promise((resolve, reject) => {
    config.imagekit.upload(
      {
        file: fileBuffer,
        fileName: originalName,
        folder,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result.url);
      },
    );
  });
};