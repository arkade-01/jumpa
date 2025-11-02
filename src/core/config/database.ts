import mongoose from "mongoose";
import { config } from "./config";

const DB_URL = config.dbUrl;

// Check for the required environment variable
if (!DB_URL) {
  throw new Error("DB_URL is not defined in the environment variables");
}

// Use the url from the environment variable
const url = DB_URL;

// Create a function to connect to the database
const connectToDatabase = async () => {
  try {
    const app = await mongoose.connect(url);
    console.log("✅ Connected to MongoDB successfully!");
    return app;
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error);
    process.exit(1); // Exit the process with failure
  }
};

export default connectToDatabase;
