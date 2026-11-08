// Bipter — Pay in 4 on Solana (Anchor program)
//
// Build & deploy in Solana Playground (beta.solpg.io):
//   1. New project -> Anchor. Replace src/lib.rs with this file.
//   2. Build. Playground rewrites declare_id! with your program ID.
//   3. Deploy to devnet. Export the IDL (Build -> Export IDL) and hand over program ID + IDL json.
//
// Amounts are micro-units of a 6-decimal USDC-style mint.
//
// Deviation from the brief: CreditProfile and LpPosition are created by separate
// `init_credit` / `init_lp` instructions (instead of init_if_needed) so the build does not depend on the
// "init-if-needed" cargo feature. The client prepends it when the account is missing.
// A `payer` signer (the app's fee sponsor) pays rent for new accounts, so the
// buyer never needs SOL.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("Gr4cJ334mV89q7k6A7hQfqDve94u9AEqAucp3vgkf3H8");

pub const START_LIMIT: u64 = 100_000_000; // 100 USDC
pub const LIMIT_STEP: u64 = 25_000_000; // +25 USDC per repaid loan
pub const INSTALLMENTS: u8 = 4;

#[program]
pub mod bipter {
    use super::*;

    pub fn init_pool(ctx: Context<InitPool>, interval_secs: i64, grace_secs: i64) -> Result<()> {
        require!(interval_secs > 0 && grace_secs >= 0, BipterError::BadParams);
        let pool = &mut ctx.accounts.pool;
        pool.admin = ctx.accounts.admin.key();
        pool.mint = ctx.accounts.mint.key();
        pool.vault = ctx.accounts.vault.key();
        pool.interval_secs = interval_secs;
        pool.grace_secs = grace_secs;
        pool.total_deposited = 0;
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    pub fn init_lp(ctx: Context<InitLp>) -> Result<()> {
        let lp = &mut ctx.accounts.lp;
        lp.owner = ctx.accounts.owner.key();
        lp.deposited = 0;
        lp.bump = ctx.bumps.lp;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, BipterError::BadParams);
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner_token.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;
        let lp = &mut ctx.accounts.lp;
        lp.deposited = lp.deposited.checked_add(amount).ok_or(BipterError::Overflow)?;
        let pool = &mut ctx.accounts.pool;
        pool.total_deposited = pool.total_deposited.checked_add(amount).ok_or(BipterError::Overflow)?;
        Ok(())
    }

    pub fn init_credit(ctx: Context<InitCredit>) -> Result<()> {
        let c = &mut ctx.accounts.credit;
        c.buyer = ctx.accounts.buyer.key();
        c.limit = START_LIMIT;
        c.outstanding = 0;
        c.repaid_count = 0;
        c.defaulted = false;
        c.bump = ctx.bumps.credit;
        Ok(())
    }

    /// Client must put an SPL `approve(delegate = pool PDA, amount = 3 * installment)`
    /// before this instruction in the same transaction.
    pub fn create_loan(ctx: Context<CreateLoan>, nonce: u64, merchant_amount: u64, total_owed: u64) -> Result<()> {
        require!(total_owed > 0 && total_owed % (INSTALLMENTS as u64) == 0, BipterError::NotDivisibleBy4);
        require!(merchant_amount > 0 && merchant_amount <= total_owed, BipterError::BadParams);

        let credit = &mut ctx.accounts.credit;
        require!(!credit.defaulted, BipterError::Defaulted);
        let new_outstanding = credit.outstanding.checked_add(total_owed).ok_or(BipterError::Overflow)?;
        require!(new_outstanding <= credit.limit, BipterError::OverLimit);

        let installment = total_owed / (INSTALLMENTS as u64);

        // 1) buyer pays installment 1 into the vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_token.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            installment,
        )?;

        // 2) pool pays the merchant in full (item + delivery), signing as the Pool PDA
        let seeds: &[&[u8]] = &[b"pool", &[ctx.accounts.pool.bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.merchant_token.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                &[seeds],
            ),
            merchant_amount,
        )?;

        let now = Clock::get()?.unix_timestamp;
        let loan = &mut ctx.accounts.loan;
        loan.buyer = ctx.accounts.buyer.key();
        loan.merchant = ctx.accounts.merchant_token.owner;
        loan.nonce = nonce;
        loan.merchant_amount = merchant_amount;
        loan.total_owed = total_owed;
        loan.installment = installment;
        loan.paid = 1;
        loan.next_due = now.checked_add(ctx.accounts.pool.interval_secs).ok_or(BipterError::Overflow)?;
        loan.created_at = now;
        loan.status = LoanStatus::Active;
        loan.bump = ctx.bumps.loan;

        credit.outstanding = new_outstanding;
        Ok(())
    }

    /// Anyone can call once the installment is due. Pulls exactly one installment
    /// from the buyer via the capped delegation held by the Pool PDA.
    pub fn pay_installment(ctx: Context<PayInstallment>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let loan = &mut ctx.accounts.loan;
        require!(loan.status == LoanStatus::Active, BipterError::NotActive);
        require!(now >= loan.next_due, BipterError::NotDue);

        let seeds: &[&[u8]] = &[b"pool", &[ctx.accounts.pool.bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.buyer_token.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.pool.to_account_info(),
                },
                &[seeds],
            ),
            loan.installment,
        )?;

        loan.paid += 1;
        loan.next_due = loan.next_due.checked_add(ctx.accounts.pool.interval_secs).ok_or(BipterError::Overflow)?;

        if loan.paid == INSTALLMENTS {
            loan.status = LoanStatus::Repaid;
            let credit = &mut ctx.accounts.credit;
            credit.limit = credit.limit.checked_add(LIMIT_STEP).ok_or(BipterError::Overflow)?;
            credit.outstanding = credit.outstanding.saturating_sub(loan.total_owed);
            credit.repaid_count += 1;
        }
        Ok(())
    }

    /// Demo only: make the next installment due now.
    pub fn admin_force_due(ctx: Context<AdminForceDue>) -> Result<()> {
        let loan = &mut ctx.accounts.loan;
        require!(loan.status == LoanStatus::Active, BipterError::NotActive);
        loan.next_due = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Anyone can mark a loan defaulted after the grace period. The pool takes the loss.
    pub fn mark_default(ctx: Context<MarkDefault>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let loan = &mut ctx.accounts.loan;
        require!(loan.status == LoanStatus::Active, BipterError::NotActive);
        let deadline = loan.next_due.checked_add(ctx.accounts.pool.grace_secs).ok_or(BipterError::Overflow)?;
        require!(now > deadline, BipterError::GraceNotOver);
        loan.status = LoanStatus::Defaulted;
        ctx.accounts.credit.defaulted = true;
        Ok(())
    }
}

/* ------------------------------ accounts ------------------------------ */

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub admin: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub interval_secs: i64,
    pub grace_secs: i64,
    pub total_deposited: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CreditProfile {
    pub buyer: Pubkey,
    pub limit: u64,
    pub outstanding: u64,
    pub repaid_count: u32,
    pub defaulted: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum LoanStatus {
    Active,
    Repaid,
    Defaulted,
}

#[account]
#[derive(InitSpace)]
pub struct Loan {
    pub buyer: Pubkey,
    pub merchant: Pubkey,
    pub nonce: u64,
    pub merchant_amount: u64,
    pub total_owed: u64,
    pub installment: u64,
    pub paid: u8,
    pub next_due: i64,
    pub created_at: i64,
    pub status: LoanStatus,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct LpPosition {
    pub owner: Pubkey,
    pub deposited: u64,
    pub bump: u8,
}

/* ------------------------------ contexts ------------------------------ */

#[derive(Accounts)]
pub struct InitPool<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(init, payer = admin, space = 8 + Pool::INIT_SPACE, seeds = [b"pool"], bump)]
    pub pool: Account<'info, Pool>,
    #[account(init, payer = admin, seeds = [b"vault"], bump, token::mint = mint, token::authority = pool)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [b"pool"], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut, address = pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = pool.mint, token::authority = owner)]
    pub owner_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"lp", owner.key().as_ref()], bump = lp.bump, has_one = owner)]
    pub lp: Account<'info, LpPosition>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitLp<'info> {
    pub owner: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(init, payer = payer, space = 8 + LpPosition::INIT_SPACE, seeds = [b"lp", owner.key().as_ref()], bump)]
    pub lp: Account<'info, LpPosition>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitCredit<'info> {
    /// CHECK: only used as a PDA seed and stored as the profile owner
    pub buyer: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(init, payer = payer, space = 8 + CreditProfile::INIT_SPACE, seeds = [b"credit", buyer.key().as_ref()], bump)]
    pub credit: Account<'info, CreditProfile>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct CreateLoan<'info> {
    pub buyer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [b"pool"], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut, address = pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"credit", buyer.key().as_ref()], bump = credit.bump)]
    pub credit: Account<'info, CreditProfile>,
    #[account(init, payer = payer, space = 8 + Loan::INIT_SPACE, seeds = [b"loan", buyer.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub loan: Account<'info, Loan>,
    #[account(mut, token::mint = pool.mint, token::authority = buyer)]
    pub buyer_token: Account<'info, TokenAccount>,
    #[account(mut, token::mint = pool.mint)]
    pub merchant_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayInstallment<'info> {
    #[account(seeds = [b"pool"], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut, address = pool.vault)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"loan", loan.buyer.as_ref(), &loan.nonce.to_le_bytes()], bump = loan.bump)]
    pub loan: Account<'info, Loan>,
    #[account(mut, seeds = [b"credit", loan.buyer.as_ref()], bump = credit.bump)]
    pub credit: Account<'info, CreditProfile>,
    #[account(mut, token::mint = pool.mint, token::authority = loan.buyer)]
    pub buyer_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminForceDue<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [b"pool"], bump = pool.bump, has_one = admin)]
    pub pool: Account<'info, Pool>,
    #[account(mut, seeds = [b"loan", loan.buyer.as_ref(), &loan.nonce.to_le_bytes()], bump = loan.bump)]
    pub loan: Account<'info, Loan>,
}

#[derive(Accounts)]
pub struct MarkDefault<'info> {
    #[account(seeds = [b"pool"], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(mut, seeds = [b"loan", loan.buyer.as_ref(), &loan.nonce.to_le_bytes()], bump = loan.bump)]
    pub loan: Account<'info, Loan>,
    #[account(mut, seeds = [b"credit", loan.buyer.as_ref()], bump = credit.bump)]
    pub credit: Account<'info, CreditProfile>,
}

#[error_code]
pub enum BipterError {
    #[msg("Bad parameters")]
    BadParams,
    #[msg("total_owed must be divisible by 4")]
    NotDivisibleBy4,
    #[msg("Credit profile is defaulted")]
    Defaulted,
    #[msg("Over credit limit")]
    OverLimit,
    #[msg("Loan is not active")]
    NotActive,
    #[msg("Installment not due yet")]
    NotDue,
    #[msg("Grace period not over")]
    GraceNotOver,
    #[msg("Arithmetic overflow")]
    Overflow,
}
