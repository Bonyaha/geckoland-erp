"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server/src/index.ts
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const body_parser_1 = __importDefault(require("body-parser"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const node_cron_1 = __importDefault(require("node-cron"));
const gmailService_1 = require("./services/gmailService");
/* ROUTE IMPORTS */
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const expenseRoutes_1 = __importDefault(require("./routes/expenseRoutes"));
const notificationRoutes_1 = __importDefault(require("./routes/notificationRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
/* CONFIGURATIONS */
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, helmet_1.default)());
app.use(helmet_1.default.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use((0, morgan_1.default)("common"));
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: false }));
app.use((0, cors_1.default)());
/* ROUTES */
app.use("/dashboard", dashboardRoutes_1.default); // http://localhost:8001/dashboard
app.use("/products", productRoutes_1.default); // http://localhost:8001/products
app.use("/users", userRoutes_1.default); // http://localhost:8001/users
app.use("/expenses", expenseRoutes_1.default); // http://localhost:8001/expenses
app.use('/notifications', notificationRoutes_1.default); // http://localhost:8001/notifications/gmail
app.use("/auth", authRoutes_1.default); // http://localhost:8001/auth/gmail/auth
app.get("/hello", (req, res) => {
    res.send("Welcome to the ERP server!");
});
/* GMAIL WATCH RENEWAL SCHEDULER */
// This schedule runs at 2:00 AM every day. This doesn't handle authentication - it only renews the Gmail watch subscription (which expires every 7 days).
node_cron_1.default.schedule('0 2 * * *', () => {
    console.log('🤖 Running scheduled job to restart Gmail watch...');
    (0, gmailService_1.restartGmailWatch)()
        .then((result) => {
        if (result) {
            console.log('✅ Gmail watch renewed successfully. Expires:', new Date(parseInt(result.expiration || '0')));
        }
        else {
            console.log('⏭️  Gmail watch not started - no valid token available');
        }
    })
        .catch((error) => {
        console.error('🤖 Failed to restart Gmail watch automatically:', error.message);
    });
});
/* SERVER */
const port = Number(process.env.PORT) || 3001;
app.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
    // Also trigger a restart on server startup
    console.log('Attempting to start/restart Gmail watch on server startup...');
    (0, gmailService_1.restartGmailWatch)()
        .then((result) => {
        if (result) {
            console.log('✅ Initial Gmail watch started successfully');
        }
        else {
            console.log('⏭️  Gmail watch not started - authorization needed first');
        }
    })
        .catch((err) => {
        console.log('⏭️  Could not start initial watch:', err.message);
    });
});
