import mysql from "mysql";
import dotenv from "dotenv";

dotenv.config(process.env.HOST);

console.log(
  process.env.DB_HOST,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  process.env.DB_DATABASE
);
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

const connectDB = () => {
  db.connect((error) => {
    if (error) {
      console.log("Database connection failed");
    } else {
      console.log("Database connection successful");
    }
  });

  // Handle database connection errors
  db.on("error", (error) => {
    if (
      error.code === "PROTOCOL_CONNECTION_LOST" ||
      error.code === "ECONNREFUSED" ||
      error.code === "ER_ACCESS_DENIED_ERROR"
    ) {
      console.log("Critical database error occurred");
    }
  });
};

// module.exports=connect, connectDB;
export { db, connectDB };
