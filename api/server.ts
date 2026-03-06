// Vercel Node.js serverless function — Express BFF entry point
export default async function handler(req: any, res: any) {
  const { default: app } = await import('../server/src/index.js');
  return app(req, res);
}
