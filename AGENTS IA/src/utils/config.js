import dotenv from "dotenv";
import { Langfuse } from "langfuse";
import { CallbackHandler } from "langfuse-langchain";

dotenv.config();

export const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
export const MISTRAL_MODEL = "mistral-large-latest";

export const API_SPA_ENDPOINT = process.env.API_SPA_ENDPOINT;
export const API_SPA_TOKEN = process.env.API_SPA_TOKEN;

export const API_CLIENT_ENDPOINT =
    process.env.API_CLIENT_ENDPOINT;
export const API_CLIENT_TOKEN =
    process.env.API_CLIENT_TOKEN;

export const API_RESERVATION_ENDPOINT =
    process.env.API_RESERVATION_ENDPOINT;
export const API_RESERVATION_TOKEN =
    process.env.API_RESERVATION_TOKEN;

export const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    projectName: "hotel-reception-bot",
});

export const langfuseHandler = new CallbackHandler({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: "https://cloud.langfuse.com",
});
