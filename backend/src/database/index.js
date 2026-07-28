const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: '../../.env' }); // Adjust according to where your .env is loaded

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
