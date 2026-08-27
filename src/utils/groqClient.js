import Groq from "groq-sdk";
import config from "../config/config.js";

const groq = new Groq({ apiKey: config.groq_api_key });

export default groq;