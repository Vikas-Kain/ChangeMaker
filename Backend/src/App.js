import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';

dotenv.config({ path: '../.env' });

const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:4000',
    credentials: true
}))

app.use(express.json({limit: "16kb"}));     // parse json data in body with 16 kb limit
app.use(express.urlencoded({extended: true, limit: "16kb"}));   // accepts encoded urls, can also parse nested objects
app.use(express.static("public"));  // use public folder as static storage
app.use(cookieParser());    // to parse and access cookies coming in HTTP request


// Import routes
import userRouter from './routers/user.router.js';

app.use('/api/v1/users', userRouter);

export { app }