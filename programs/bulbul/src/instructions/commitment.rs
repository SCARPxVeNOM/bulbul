use anchor_lang::prelude::*;
use anchor_spl::token::{
    close_account, transfer_checked, CloseAccount, Mint, Token, TokenAccount, TransferChecked,
};

use crate::{
    constants::*,
    error::BulbulError,
    events::*,
    state::{Commitment, Config, ForfeitMode, Profile},
    xp::{commitment_xp, pool_bonus},
};

#[derive(Accounts)]
pub struct CreateCommitment<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [PROFILE_SEED, owner.key().as_ref()],
        bump = profile.bump,
    )]
    pub profile: Account<'info, Profile>,
    #[account(
        init,
        payer = owner,
        space = 8 + Commitment::INIT_SPACE,
        seeds = [COMMITMENT_SEED, owner.key().as_ref(), &profile.commitments_created.to_le_bytes()],
        bump
    )]
    pub commitment: Account<'info, Commitment>,
    #[account(
        init,
        payer = owner,
        seeds = [ESCROW_SEED, commitment.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = commitment,
    )]
    pub escrow: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = owner_token_account.mint == config.usdc_mint @ BulbulError::WrongMint,
        constraint = owner_token_account.owner == owner.key() @ BulbulError::WrongTokenOwner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_commitment(
    ctx: Context<CreateCommitment>,
    stake: u64,
    focus_minutes: u16,
    required_checkins: u8,
    period_days: u8,
    mode: ForfeitMode,
) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, BulbulError::Paused);
    require!(stake >= MIN_STAKE, BulbulError::AmountTooSmall);
    require!(
        (MIN_FOCUS_MINUTES..=MAX_FOCUS_MINUTES).contains(&focus_minutes),
        BulbulError::InvalidFocusMinutes
    );
    require!(
        (1..=MAX_PERIOD_DAYS).contains(&period_days),
        BulbulError::InvalidPeriod
    );
    require!(
        (1..=period_days).contains(&required_checkins),
        BulbulError::InvalidRequiredCheckins
    );
    if mode == ForfeitMode::Pool {
        require!(
            !config.is_restricted(&ctx.accounts.profile.region),
            BulbulError::ModeNotAllowedInRegion
        );
    }

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.owner_token_account.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        stake,
        USDC_DECIMALS,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let deadline = now
        .checked_add(i64::from(period_days) * SECONDS_PER_DAY)
        .ok_or(BulbulError::MathOverflow)?;
    let profile = &mut ctx.accounts.profile;
    let id = profile.commitments_created;
    profile.commitments_created = id.checked_add(1).ok_or(BulbulError::MathOverflow)?;

    ctx.accounts.commitment.set_inner(Commitment {
        owner: ctx.accounts.owner.key(),
        id,
        stake,
        focus_minutes,
        required_checkins,
        period_days,
        checkins: 0,
        checkin_bitmap: 0,
        mode,
        created_at: now,
        deadline,
        bump: ctx.bumps.commitment,
        escrow_bump: ctx.bumps.escrow,
    });
    emit!(CommitmentCreated {
        owner: ctx.accounts.owner.key(),
        commitment: ctx.accounts.commitment.key(),
        stake,
        focus_minutes,
        required_checkins,
        period_days,
        mode,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct AttestCheckin<'info> {
    pub attestor: Signer<'info>,
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = attestor @ BulbulError::NotAttestor,
    )]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [COMMITMENT_SEED, commitment.owner.as_ref(), &commitment.id.to_le_bytes()],
        bump = commitment.bump,
    )]
    pub commitment: Account<'info, Commitment>,
}

/// Each day can be attested once. Only the result goes on-chain; session data stays off-chain.
pub fn handle_attest_checkin(ctx: Context<AttestCheckin>, day_index: u8) -> Result<()> {
    let commitment = &mut ctx.accounts.commitment;
    let now = Clock::get()?.unix_timestamp;
    require!(now < commitment.deadline, BulbulError::DeadlinePassed);
    require!(day_index < commitment.period_days, BulbulError::DayOutOfRange);
    let elapsed_days = (now - commitment.created_at) / SECONDS_PER_DAY;
    require!(i64::from(day_index) <= elapsed_days, BulbulError::FutureDay);
    let bit = 1u64 << day_index;
    require!(commitment.checkin_bitmap & bit == 0, BulbulError::AlreadyCheckedIn);

    commitment.checkin_bitmap |= bit;
    commitment.checkins = commitment
        .checkins
        .checked_add(1)
        .ok_or(BulbulError::MathOverflow)?;
    emit!(CheckinAttested {
        commitment: commitment.key(),
        day_index,
        checkins: commitment.checkins,
    });
    Ok(())
}

/// Permissionless crank: anyone can settle once the outcome is decided.
#[derive(Accounts)]
pub struct SettleCommitment<'info> {
    pub settler: Signer<'info>,
    /// CHECK: receives refunds and rent; checked against `commitment.owner`.
    #[account(mut, address = commitment.owner @ BulbulError::NotOwner)]
    pub owner: UncheckedAccount<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [PROFILE_SEED, commitment.owner.as_ref()],
        bump = profile.bump,
    )]
    pub profile: Account<'info, Profile>,
    #[account(
        mut,
        close = owner,
        seeds = [COMMITMENT_SEED, commitment.owner.as_ref(), &commitment.id.to_le_bytes()],
        bump = commitment.bump,
    )]
    pub commitment: Account<'info, Commitment>,
    #[account(
        mut,
        seeds = [ESCROW_SEED, commitment.key().as_ref()],
        bump = commitment.escrow_bump,
    )]
    pub escrow: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = owner_token_account.mint == config.usdc_mint @ BulbulError::WrongMint,
        constraint = owner_token_account.owner == commitment.owner @ BulbulError::WrongTokenOwner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,
    #[account(mut, address = config.charity_token_account)]
    pub charity_token_account: Account<'info, TokenAccount>,
    #[account(mut, address = config.pool_vault)]
    pub pool_vault: Account<'info, TokenAccount>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

impl<'info> SettleCommitment<'info> {
    fn send_from_escrow(&self, to: &Account<'info, TokenAccount>, amount: u64) -> Result<()> {
        let owner = self.commitment.owner;
        let id_bytes = self.commitment.id.to_le_bytes();
        let seeds: &[&[u8]] = &[COMMITMENT_SEED, owner.as_ref(), &id_bytes, &[self.commitment.bump]];
        transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.key(),
                TransferChecked {
                    from: self.escrow.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: to.to_account_info(),
                    authority: self.commitment.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            USDC_DECIMALS,
        )
    }

    fn pay_pool_bonus(&self, amount: u64) -> Result<()> {
        let seeds: &[&[u8]] = &[CONFIG_SEED, &[self.config.bump]];
        transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.key(),
                TransferChecked {
                    from: self.pool_vault.to_account_info(),
                    mint: self.usdc_mint.to_account_info(),
                    to: self.owner_token_account.to_account_info(),
                    authority: self.config.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            USDC_DECIMALS,
        )
    }

    fn close_escrow(&self) -> Result<()> {
        let owner = self.commitment.owner;
        let id_bytes = self.commitment.id.to_le_bytes();
        let seeds: &[&[u8]] = &[COMMITMENT_SEED, owner.as_ref(), &id_bytes, &[self.commitment.bump]];
        close_account(CpiContext::new_with_signer(
            self.token_program.key(),
            CloseAccount {
                account: self.escrow.to_account_info(),
                destination: self.owner.to_account_info(),
                authority: self.commitment.to_account_info(),
            },
            &[seeds],
        ))
    }
}

pub fn handle_settle_commitment(ctx: Context<SettleCommitment>) -> Result<()> {
    let accts = &ctx.accounts;
    let commitment = &accts.commitment;
    let succeeded = commitment.succeeded();
    let now = Clock::get()?.unix_timestamp;
    require!(
        succeeded || now >= commitment.deadline,
        BulbulError::NotYetSettleable
    );

    let stake = accts.escrow.amount;
    let mode = commitment.mode;
    let mut bonus = 0;
    let mut xp_gained = 0;

    if succeeded {
        accts.send_from_escrow(&accts.owner_token_account, stake)?;
        if mode == ForfeitMode::Pool {
            bonus = pool_bonus(accts.pool_vault.amount, commitment.stake)
                .ok_or(BulbulError::MathOverflow)?;
            if bonus > 0 {
                accts.pay_pool_bonus(bonus)?;
            }
        }
        xp_gained = commitment_xp(commitment.checkins).ok_or(BulbulError::MathOverflow)?;
    } else {
        match mode {
            ForfeitMode::Soft => accts.send_from_escrow(&accts.owner_token_account, stake)?,
            ForfeitMode::Charity => accts.send_from_escrow(&accts.charity_token_account, stake)?,
            ForfeitMode::Pool => accts.send_from_escrow(&accts.pool_vault, stake)?,
        }
    }
    accts.close_escrow()?;

    let profile = &mut ctx.accounts.profile;
    if succeeded {
        profile.xp = profile.xp.checked_add(xp_gained).ok_or(BulbulError::MathOverflow)?;
        profile.commitments_succeeded = profile
            .commitments_succeeded
            .checked_add(1)
            .ok_or(BulbulError::MathOverflow)?;
    } else {
        profile.commitments_failed = profile
            .commitments_failed
            .checked_add(1)
            .ok_or(BulbulError::MathOverflow)?;
    }

    emit!(CommitmentSettled {
        owner: ctx.accounts.commitment.owner,
        commitment: ctx.accounts.commitment.key(),
        succeeded,
        mode,
        stake,
        bonus,
        xp_gained,
    });
    Ok(())
}
