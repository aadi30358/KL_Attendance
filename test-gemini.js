import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config({ path: "./server/.env" });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function test() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent("Hello!");
        console.log("SUCCESS:", result.response.text());
    } catch (e) {
        console.error(e);
    }
}
test();
