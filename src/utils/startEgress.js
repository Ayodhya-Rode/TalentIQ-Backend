import {
  EgressClient,
  EncodedFileType,
  S3Upload,
  RoomServiceClient,
} from "livekit-server-sdk";
import config from "../config/config.js";

// Initialize the EgressClient with LiveKit credentials
const egressClient = new EgressClient(
  config.livekitUrl,
  config.livekitApiKey,
  config.livekitApiSecret,
);

const roomService = new RoomServiceClient(
  config.livekitUrl,
  config.livekitApiKey,
  config.livekitApiSecret,
);

export async function ensureRoomExists(roomName) {
  try {
    await roomService.createRoom({ name: roomName });
  } catch (err) {
    console.error(`Failed to ensure room "${roomName}" exists:`, err.message);
    throw err;
  }
}

// Function to start recording a LiveKit room and save it to Backblaze B2
export async function startRecording(roomName) {
  const output = {
    fileType: EncodedFileType.MP4,
    filepath: `recordings/${roomName}-{time}.mp4`,
    output: {
      case: "s3",
      value: new S3Upload({
        accessKey: config.b2.bucketAccessKeyId,
        secret: config.b2.bucketSecretAccessKey,
        bucket: config.b2.bucketName,
        endpoint: config.b2.bucketEndpoint,
        region: config.b2.bucketRegion,
        forcePathStyle: true,
      }),
    },
  };

  try {
    const egressInfo = await egressClient.startRoomCompositeEgress(
      roomName,
      output,
    );
    return egressInfo;
  } catch (err) {
    console.error(
      `Failed to start recording for room "${roomName}":`,
      err.message,
    );
    throw new Error(`Could not start recording: ${err.message}`);
  }
}
