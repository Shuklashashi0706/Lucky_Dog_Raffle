declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    TELEGRAM_BOT_TOKEN: string;
    RENDER_WEBHOOK_URL: string;
    ALCHEMY_RPC_API_KEY:string;
  }
}
