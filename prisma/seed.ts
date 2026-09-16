import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { env } from "../src/config/env";

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash(env.adminSeedPassword, 10);
  await prisma.user.upsert({
    where: { email: env.adminSeedEmail },
    create: { email: env.adminSeedEmail, password: hashed, name: "Admin", role: "ADMIN" },
    update: {},
  });
  console.log(`Seeded admin user: ${env.adminSeedEmail}`);

  await prisma.dataSource.upsert({
    where: { id: "mock-source" },
    create: {
      id: "mock-source",
      name: "Mock Data Source",
      kind: "GMP",
      baseUrl: "https://example.com/mock-source",
      enabled: true,
    },
    update: {},
  });

  const allotmentSeed = [
    { registrar: "Kfin Technologies Ltd", url: "https://kfintech.com/ipostatus/", note: "Issues registered with Kfin" },
    {
      registrar: "Link Intime India Pvt Ltd",
      url: "https://linkintime.co.in/initial_offer/public-issues.html",
      note: "Issues registered with Link Intime",
    },
    { registrar: "Bigshare Services Pvt Ltd", url: "https://ipo.bigshareonline.com/ipo_status.html", note: "Issues registered with Bigshare" },
    { registrar: "BSE", url: "https://www.bseindia.com/investors/appli_check.aspx", note: "General BSE allotment lookup" },
    { registrar: "NSE", url: "https://www.nseindia.com/invest/initial-public-offerings", note: "NSE IPO information" },
  ];

  for (const source of allotmentSeed) {
    const existing = await prisma.allotmentSource.findFirst({ where: { registrar: source.registrar, ipoSlug: null } });
    if (!existing) await prisma.allotmentSource.create({ data: source });
  }
  console.log("Seeded allotment sources");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
