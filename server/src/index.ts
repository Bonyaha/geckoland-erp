import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
/* ROUTE IMPORTS */
import dashboardRoutes from "./routes/dashboardRoutes";
import productRoutes from "./routes/productRoutes";
import userRoutes from "./routes/userRoutes";
import expenseRoutes from "./routes/expenseRoutes";
import notificationRoutes from './routes/notificationRoutes'
import authRoutes from './routes/authRoutes'

/* CONFIGURATIONS */
dotenv.config();
const app = express();
app.use(express.json());
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

/* ROUTES */
 app.use("/dashboard", dashboardRoutes); // http://localhost:8001/dashboard
app.use("/products", productRoutes); // http://localhost:8001/products
app.use("/users", userRoutes); // http://localhost:8001/users
app.use("/expenses", expenseRoutes); // http://localhost:8001/expenses
app.use('/notifications', notificationRoutes) // http://localhost:8001/notifications/gmail
app.use("/auth", authRoutes); // http://localhost:8001/auth/gmail/auth
app.get("/hello", (req, res) => {
  res.send("Welcome to the ERP server!");
});
/* SERVER */
const port = Number(process.env.PORT) || 3001;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});