import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { runSlaEscalation } from './services/sla.service';

async function main() {
  const app = createApp();

  // Run SLA escalation every hour
  setInterval(() => {
    runSlaEscalation().catch((e) => console.error('[sla] escalation failed', e));
  }, 60 * 60 * 1000);

  app.listen(env.port, () => {
    console.log(`[server] Rwanda Digital Governance API running on http://localhost:${env.port}`);
    console.log(`[server] Environment: ${env.nodeEnv}`);
  });
}

main()
  .catch((err) => {
    console.error('[server] failed to start', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
