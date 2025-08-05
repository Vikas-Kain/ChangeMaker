import { app } from './App.js';
import dotenv from 'dotenv';
import connectDB from './db/index.js';

dotenv.config({ path: '../.env' });

const port = process.env.PORT || 8000;

connectDB()
.then(() => {
    app.on("errror", (error) => {
        console.log('Error seting up server:', error);
        throw error;
    })
    app.listen(port, () => {
        console.log(`App serving at http://localhost:${port}`);
    })
})
.catch((err) => {
    console.log('Error connecting DB:', err);
})