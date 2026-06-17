import { db } from './index.ts';
import { chartOfAccounts, transactions, journalEntries, journalEntryLines, members, appSettings } from './schema.ts';
import { eq, and, sql } from 'drizzle-orm';

// Seeding standard chart of accounts
export async function seedChartOfAccounts() {
  try {
    const coas = [
      {
        code: '1010',
        name: 'Cash on Hand & Bank',
        type: 'asset',
        normalBalance: 'debit',
        description: 'Cooperative primary operating cash in bank or cashier drawer'
      },
      {
        code: '2010',
        name: 'Member Savings Liability',
        type: 'liability',
        normalBalance: 'credit',
        description: 'Deposits, withdrawable balances, and savings held for members'
      },
      {
        code: '3010',
        name: 'Member Share Capital Equity',
        type: 'equity',
        normalBalance: 'credit',
        description: 'Paid-up membership capital and equity contributions'
      }
    ];

    for (const coa of coas) {
      await db.insert(chartOfAccounts)
        .values(coa)
        .onConflictDoNothing();
    }
    console.log("Chart of Accounts successfully seeded.");
  } catch (err) {
    console.error("Critical error seeding Chart of Accounts:", err);
  }
}

export const seedAppSettings = async () => {
  try {
    const defaults = [
      { key: 'app_name', value: 'Coop Management' },
      { key: 'app_subtitle', value: 'Enterprise Core' },
      { key: 'currency_symbol', value: '$' },
      // Share Capital Rules
      { key: 'share_par_value_cents', value: '10000' },      // ₱100.00 par value per share
      { key: 'share_min_shares', value: '10' },              // minimum 10 shares
      { key: 'share_max_shares', value: '1000' },            // maximum 1000 shares
      { key: 'share_min_monthly_contrib_cents', value: '50000' }, // ₱500.00/month minimum
      // Cooperative Parameters
      { key: 'loan_min_tenure_months', value: '6' },         // 6 months membership before loan eligibility
      { key: 'loan_savings_multiplier', value: '3' },        // max loan = 3x savings balance
    ];
    await db.insert(appSettings).values(defaults).onConflictDoNothing();
    console.log('App settings seeded.');
  } catch (err) {
    console.error('Critical error seeding app settings:', err);
  }
};

export interface MemberBalances {
  savingsInCents: number;
  shareCapitalInCents: number;
}

/**
 * Derives a member's absolute balances as of this moment from the double-entry ledger lines.
 * This is the SINGLE SOURCE OF TRUTH for balances.
 */
export async function calculateMemberBalances(memberId: number): Promise<MemberBalances> {
  try {
    // Member Savings (2010) balance: Normal is Credit. Balance = Credits - Debits.
    const savingsResult = await db.select({
      type: journalEntryLines.entryType,
      sum: sql<string>`coalesce(sum(${journalEntryLines.amount}), 0)`
    })
    .from(journalEntryLines)
    .where(
      and(
        eq(journalEntryLines.coaCode, '2010'),
        eq(journalEntryLines.memberId, memberId)
      )
    )
    .groupBy(journalEntryLines.entryType);

    let savingsCredits = 0;
    let savingsDebits = 0;
    for (const row of savingsResult) {
      if (row.type === 'credit') savingsCredits = parseInt(row.sum, 10);
      if (row.type === 'debit') savingsDebits = parseInt(row.sum, 10);
    }
    const savingsInCents = savingsCredits - savingsDebits;

    // Member Share Capital (3010) balance: Normal is Credit. Balance = Credits - Debits.
    const capitalResult = await db.select({
      type: journalEntryLines.entryType,
      sum: sql<string>`coalesce(sum(${journalEntryLines.amount}), 0)`
    })
    .from(journalEntryLines)
    .where(
      and(
        eq(journalEntryLines.coaCode, '3010'),
        eq(journalEntryLines.memberId, memberId)
      )
    )
    .groupBy(journalEntryLines.entryType);

    // Member Share Capital (3010) balance: Normal is Credit. Balance = Credits - Debits.
    let capCreditsValue = 0;
    let capDebitsValue = 0;
    for (const row of capitalResult) {
      if (row.type === 'credit') capCreditsValue = parseInt(row.sum, 10);
      if (row.type === 'debit') capDebitsValue = parseInt(row.sum, 10);
    }
    const shareCapitalInCents = capCreditsValue - capDebitsValue;

    return {
      savingsInCents,
      shareCapitalInCents
    };
  } catch (error) {
    console.error(`Error calculating ledger balance for member ${memberId}:`, error);
    throw new Error(`Failed to calculate member ledger balances`, { cause: error });
  }
}

/**
 * Creates and posts a transaction, auto-generating balanced Journal Entries
 */
export async function createAndPostTransaction(
  memberId: number,
  transactionType: 'deposit' | 'withdrawal' | 'share_capital_contribution' | 'manual_adjustment',
  amountInCents: number,
  description: string,
  createdById: number,
  manualDebitCoa?: string, // Only for manual adjustments
  manualCreditCoa?: string // Only for manual adjustments
): Promise<any> {
  if (amountInCents <= 0) {
    throw new Error("Transaction amount must be greater than zero.");
  }

  // Generate Reference Number
  const timestampStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rands = Math.floor(100000 + Math.random() * 90000);
  const referenceNumber = `TXN-${timestampStr}-${rands}`;

  return await db.transaction(async (tx) => {
    // 1. Verify member exists and is active
    const member = await tx.select().from(members).where(eq(members.id, memberId)).limit(1);
    if (member.length === 0) {
      throw new Error(`Member with ID ${memberId} not found.`);
    }
    if (!member[0].isActive) {
      throw new Error("Unable to complete transaction on a deactivated member account.");
    }

    // 2. Perform transaction-specific state calculations & validations
    if (transactionType === 'withdrawal') {
      // Calculate current savings balance directly in transaction boundary
      const balances = await calculateMemberBalances(memberId);
      if (balances.savingsInCents < amountInCents) {
        throw new Error(
          `Insufficient savings balance. Current balance is $${(balances.savingsInCents / 100).toFixed(2)}, ` +
          `requested withdrawal is $${(amountInCents / 100).toFixed(2)}.`
        );
      }
    }

    // 3. Insert transaction log
    const [txn] = await tx.insert(transactions)
      .values({
        memberId,
        transactionType,
        amount: amountInCents,
        status: 'completed',
        referenceNumber,
        description,
        createdBy: createdById,
      })
      .returning();

    // 4. Create general journal entry
    const [journalHeading] = await tx.insert(journalEntries)
      .values({
        transactionId: txn.id,
        description: description || `${transactionType.toUpperCase()} - Ref: ${referenceNumber}`,
      })
      .returning();

    // 5. Post journal entry lines based on transaction double-entry ledger matrix
    if (transactionType === 'deposit') {
      // Savings Deposit:
      // Debit: 1010 Asset +$amount
      // Credit: 2010 Liability (Member Savings) +$amount
      await tx.insert(journalEntryLines).values({
        journalEntryId: journalHeading.id,
        coaCode: '1010',
        memberId: null, // Bank holds general cash
        entryType: 'debit',
        amount: amountInCents
      });

      await tx.insert(journalEntryLines).values({
        journalEntryId: journalHeading.id,
        coaCode: '2010',
        memberId: memberId, // Attributed to member's savings subsidiary ledger
        entryType: 'credit',
        amount: amountInCents
      });

    } else if (transactionType === 'withdrawal') {
      // Savings Withdrawal:
      // Debit: 2010 Liability (Member Savings) -$amount
      // Credit: 1010 Asset -$amount
      await tx.insert(journalEntryLines).values({
        journalEntryId: journalHeading.id,
        coaCode: '2010',
        memberId: memberId, // Liabilities reduce
        entryType: 'debit',
        amount: amountInCents
      });

      await tx.insert(journalEntryLines).values({
        journalEntryId: journalHeading.id,
        coaCode: '1010',
        memberId: null, // Cash reduces
        entryType: 'credit',
        amount: amountInCents
      });

    } else if (transactionType === 'share_capital_contribution') {
      // Share Capital Contribution:
      // Debit: 1010 Asset +$amount
      // Credit: 3010 Equity (Member Capital) +$amount
      await tx.insert(journalEntryLines).values({
        journalEntryId: journalHeading.id,
        coaCode: '1010',
        memberId: null,
        entryType: 'debit',
        amount: amountInCents
      });

      await tx.insert(journalEntryLines).values({
        journalEntryId: journalHeading.id,
        coaCode: '3010',
        memberId: memberId,
        entryType: 'credit',
        amount: amountInCents
      });

    } else if (transactionType === 'manual_adjustment') {
      if (!manualDebitCoa || !manualCreditCoa) {
        throw new Error("COA codes are strictly required for manual ledger adjustments.");
      }

      // Manual adjustment mapping debit and credit
      await tx.insert(journalEntryLines).values({
        journalEntryId: journalHeading.id,
        coaCode: manualDebitCoa,
        memberId: (manualDebitCoa === '2010' || manualDebitCoa === '3010') ? memberId : null,
        entryType: 'debit',
        amount: amountInCents
      });

      await tx.insert(journalEntryLines).values({
        journalEntryId: journalHeading.id,
        coaCode: manualCreditCoa,
        memberId: (manualCreditCoa === '2010' || manualCreditCoa === '3010') ? memberId : null,
        entryType: 'credit',
        amount: amountInCents
      });
    }

    return txn;
  });
}

/**
 * Reverses a transaction immutably by posting opposing journal entries of identical value
 */
export async function reverseTransaction(
  transactionId: number,
  reversedById: number,
  reversalReason: string
): Promise<any> {
  return await db.transaction(async (tx) => {
    // 1. Locate original transaction
    const txn = await tx.select().from(transactions).where(eq(transactions.id, transactionId)).limit(1);
    if (txn.length === 0) {
      throw new Error(`Transaction with ID ${transactionId} not found.`);
    }

    const originalTxn = txn[0];
    if (originalTxn.status === 'reversed') {
      throw new Error("This transaction has already been reversed.");
    }

    // 2. Fetch original journal heading
    const originalEntry = await tx.select().from(journalEntries).where(eq(journalEntries.transactionId, originalTxn.id)).limit(1);
    if (originalEntry.length === 0) {
      throw new Error("Journal entry mapping not found for original transaction.");
    }

    // 3. Fetch original lines
    const originalLines = await tx.select().from(journalEntryLines).where(eq(journalEntryLines.journalEntryId, originalEntry[0].id));
    if (originalLines.length === 0) {
      throw new Error("Journal entry lines not found under original heading.");
    }

    // 4. Validate withdrawals before reversal (reversing a withdrawal is like making a deposit. This is always safe.
    // Reversing a savings deposit acts as a withdrawal, so we must check if member has enough savings to handle it!)
    if (originalTxn.transactionType === 'deposit') {
      const balances = await calculateMemberBalances(originalTxn.memberId);
      if (balances.savingsInCents < originalTxn.amount) {
        throw new Error(
          `Unable to reverse deposit. Reversing this deposit reduces the member's savings by $${(originalTxn.amount/100).toFixed(2)}, ` +
          `but their active balance is only $${(balances.savingsInCents/100).toFixed(2)}.`
        );
      }
    }

    // 5. Create a new reversal transaction log
    const timestampStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rands = Math.floor(100000 + Math.random() * 90000);
    const revRefNum = `TXN-REV-${timestampStr}-${rands}`;

    const [reversalTxn] = await tx.insert(transactions)
      .values({
        memberId: originalTxn.memberId,
        transactionType: 'reversal',
        amount: originalTxn.amount,
        status: 'completed',
        referenceNumber: revRefNum,
        description: `REVERSAL of Ref ${originalTxn.referenceNumber}. Reason: ${reversalReason}`,
        createdBy: reversedById,
        reversingTransactionId: originalTxn.id
      })
      .returning();

    // 6. Update the original transaction status to reversed, link to reversal transaction
    await tx.update(transactions)
      .set({
        status: 'reversed',
        reversingTransactionId: reversalTxn.id
      })
      .where(eq(transactions.id, originalTxn.id));

    // 7. Place balancing reversal journal entry
    const [revJournalHeading] = await tx.insert(journalEntries)
      .values({
        transactionId: reversalTxn.id,
        description: `REVERSAL of TXN [Ref: ${originalTxn.referenceNumber}]`
      })
      .returning();

    // 8. Output opposing ledger journal entry lines (Debit becomes Credit, Credit becomes Debit)
    for (const originLine of originalLines) {
      const reverseType = originLine.entryType === 'debit' ? 'credit' : 'debit';
      await tx.insert(journalEntryLines).values({
        journalEntryId: revJournalHeading.id,
        coaCode: originLine.coaCode,
        memberId: originLine.memberId,
        entryType: reverseType,
        amount: originLine.amount
      });
    }

    return reversalTxn;
  });
}
