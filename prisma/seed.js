const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const dbPath = path.join(__dirname, '../src/data/db.json');

async function main() {
  const rawData = fs.readFileSync(dbPath, 'utf8');
  const data = JSON.parse(rawData);

  console.log('Seeding database...');

  // 1. Seed User
  const passwordHash = await bcrypt.hash(data.user.password || 'password', 10);
  const user = await prisma.user.create({
    data: {
      email: data.user.email,
      password: passwordHash,
      name: data.user.name,
      phone: data.user.phone,
      location: data.user.location,
      bio: data.user.bio,
      avatar: data.user.avatar,
      joinDate: data.user.joinDate,
      role: 'user', // Default
      balance: data.dashboard.totalBalance || 0,
      notifications: {
        create: (data.dashboard.notifications || []).map(n => ({
            title: n.title,
            message: n.message,
            read: n.read,
            type: n.type,
            // time: new Date() // Use default now()
        }))
      },
      tickets: {
        create: (data.dashboard.supportTickets || []).map(t => ({
            subject: t.subject,
            status: t.status,
            category: t.category,
            messages: t.messages
        }))
      }
    }
  });

  console.log(`Created user: ${user.email}`);

  // 2. Seed Products (Products + Opportunities)
  for (const p of data.products) {
    await prisma.product.create({
      data: {
        id: p.id,
        name: p.name,
        type: p.type,
        color: p.color,
        returns: p.returns || '',
        roiPercent: p.roiPercent || 0,
        roiType: p.roiType || 'Fixed',
        durationDays: p.durationDays || 365,
        payoutFrequency: p.payoutFrequency || 'End of term',
        minAmount: JSON.stringify(p.minAmount || p.min), // Handle different formats
        maxAmount: JSON.stringify(p.maxAmount || {}),
        risk: p.risk || 'Low',
        status: p.status || 'active'
      }
    });
  }

  for (const o of data.opportunities) {
     // Check if ID exists to avoid collision
     const exists = await prisma.product.findUnique({ where: { id: o.id } });
     if (!exists) {
        await prisma.product.create({
            data: {
                id: o.id,
                name: o.title, // Map title to name
                type: o.category,
                color: o.color,
                returns: o.returns,
                roiPercent: o.roiPercent,
                roiType: o.roiType,
                durationDays: o.durationDays,
                payoutFrequency: o.payoutFrequency,
                minAmount: JSON.stringify(o.minAmount),
                maxAmount: JSON.stringify(o.maxAmount),
                risk: o.risk,
                status: o.status
            }
        });
     }
  }

  // 3. Seed Investments
  for (const inv of (data.dashboard.activeInvestments || [])) {
    // Determine product ID. db.json has 'productId', use that.
    // If productId is missing, try to match by name or skip/create default.
    let pid = inv.productId;
    if (!pid) {
        // Fallback or skip
        continue; 
    }
    
    // Check if product exists, if not, maybe it was deleted or mock data mismatch
    const productExists = await prisma.product.findUnique({ where: { id: pid } });
    
    await prisma.investment.create({
        data: {
            id: inv.id,
            userId: user.id,
            productId: pid,
            productName: inv.product,
            amount: inv.amount,
            startDate: new Date(inv.startDate), // Ensure date format
            maturityDate: new Date(inv.maturityDate),
            status: inv.status,
            currentValue: inv.currentValue,
            progress: inv.progress,
            roiPercent: inv.roiPercent
        }
    }); 
  }

  // 4. Seed Transactions
  for (const tx of (data.dashboard.recentTransactions || [])) {
     await prisma.transaction.create({
        data: {
            id: tx.id,
            userId: user.id,
            type: tx.type,
            amount: tx.amount,
            date: new Date(tx.date),
            status: tx.status,
            reference: tx.reference || `REF-${Math.random().toString(36).substring(7)}`,
            method: tx.method,
            bank: tx.bank,
            reason: tx.reason,
            product: tx.product
        }
     });
  }

  // 5. Seed KYC
  for (const k of (data.kycApprovals || [])) {
     await prisma.kYCApproval.create({
        data: {
            id: k.id,
            userId: user.id, // Linking to our single user for now
            user: k.user,
            status: k.status,
            submittedAt: new Date(k.submittedAt),
            approvedAt: k.approvedAt ? new Date(k.approvedAt) : null,
            rejectedAt: k.rejectedAt ? new Date(k.rejectedAt) : null
        }
     });
  }
  
  // 6. Platform Settings
  if (data.platformSettings) {
      await prisma.platformSettings.create({
          data: {
              maintenanceMode: data.platformSettings.maintenanceMode,
              depositLimits: JSON.stringify(data.platformSettings.limits?.deposit || {}),
              withdrawalLimits: JSON.stringify(data.platformSettings.limits?.withdrawal || {})
          }
      });
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
