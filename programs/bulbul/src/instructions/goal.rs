use anchor_lang::prelude::*;
use anchor_spl::token::{
    close_account, transfer_checked, CloseAccount, Mint, Token, TokenAccount, TransferChecked,
};

use crate::{
    constants::*,
    error::BulbulError,
    events::*,
    state::{Config, GoalVault, Profile},
    xp::goal_xp,
};

#[derive(Accounts)]
pub struct CreateGoal<'info> {
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
        space = 8 + GoalVault::INIT_SPACE,
        seeds = [GOAL_SEED, owner.key().as_ref(), &profile.goals_created.to_le_bytes()],
        bump
    )]
    pub goal: Account<'info, GoalVault>,
    #[account(
        init,
        payer = owner,
        seeds = [GOAL_VAULT_SEED, goal.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = goal,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_goal(
    ctx: Context<CreateGoal>,
    name: String,
    target_amount: u64,
    unlock_at: i64,
) -> Result<()> {
    require!(!ctx.accounts.config.paused, BulbulError::Paused);
    require!(
        !name.is_empty() && name.len() <= MAX_GOAL_NAME_LEN,
        BulbulError::InvalidGoalName
    );
    require!(target_amount >= MIN_GOAL_AMOUNT, BulbulError::AmountTooSmall);
    let now = Clock::get()?.unix_timestamp;
    let lock = unlock_at.checked_sub(now).ok_or(BulbulError::MathOverflow)?;
    require!(
        (MIN_GOAL_LOCK_SECONDS..=MAX_GOAL_LOCK_SECONDS).contains(&lock),
        BulbulError::InvalidUnlockTime
    );

    let profile = &mut ctx.accounts.profile;
    let id = profile.goals_created;
    profile.goals_created = id.checked_add(1).ok_or(BulbulError::MathOverflow)?;

    ctx.accounts.goal.set_inner(GoalVault {
        owner: ctx.accounts.owner.key(),
        id,
        name,
        target_amount,
        deposited: 0,
        created_at: now,
        unlock_at,
        bump: ctx.bumps.goal,
        vault_bump: ctx.bumps.vault,
    });
    emit!(GoalCreated {
        owner: ctx.accounts.owner.key(),
        goal: ctx.accounts.goal.key(),
        target_amount,
        unlock_at,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct DepositGoal<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [GOAL_SEED, owner.key().as_ref(), &goal.id.to_le_bytes()],
        bump = goal.bump,
        has_one = owner @ BulbulError::NotOwner,
    )]
    pub goal: Account<'info, GoalVault>,
    #[account(
        mut,
        seeds = [GOAL_VAULT_SEED, goal.key().as_ref()],
        bump = goal.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = owner_token_account.mint == config.usdc_mint @ BulbulError::WrongMint,
        constraint = owner_token_account.owner == owner.key() @ BulbulError::WrongTokenOwner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_deposit_goal(ctx: Context<DepositGoal>, amount: u64) -> Result<()> {
    require!(amount > 0, BulbulError::AmountTooSmall);
    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.owner_token_account.to_account_info(),
                mint: ctx.accounts.usdc_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        ),
        amount,
        USDC_DECIMALS,
    )?;
    let goal = &mut ctx.accounts.goal;
    goal.deposited = goal
        .deposited
        .checked_add(amount)
        .ok_or(BulbulError::MathOverflow)?;
    emit!(GoalDeposited {
        goal: goal.key(),
        amount,
        deposited: goal.deposited,
    });
    Ok(())
}

/// Shared by complete and break: pays the whole vault to the owner, then closes
/// the vault token account and the goal account (rent goes back to the owner).
#[derive(Accounts)]
pub struct CloseGoal<'info> {
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
        mut,
        close = owner,
        seeds = [GOAL_SEED, owner.key().as_ref(), &goal.id.to_le_bytes()],
        bump = goal.bump,
        has_one = owner @ BulbulError::NotOwner,
    )]
    pub goal: Account<'info, GoalVault>,
    #[account(
        mut,
        seeds = [GOAL_VAULT_SEED, goal.key().as_ref()],
        bump = goal.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = owner_token_account.mint == config.usdc_mint @ BulbulError::WrongMint,
        constraint = owner_token_account.owner == owner.key() @ BulbulError::WrongTokenOwner,
    )]
    pub owner_token_account: Account<'info, TokenAccount>,
    #[account(address = config.usdc_mint)]
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

impl<'info> CloseGoal<'info> {
    fn pay_out_and_close(&self) -> Result<u64> {
        let amount = self.vault.amount;
        let owner_key = self.owner.key();
        let id_bytes = self.goal.id.to_le_bytes();
        let seeds: &[&[u8]] = &[GOAL_SEED, owner_key.as_ref(), &id_bytes, &[self.goal.bump]];
        let signer = &[seeds];
        if amount > 0 {
            transfer_checked(
                CpiContext::new_with_signer(
                    self.token_program.key(),
                    TransferChecked {
                        from: self.vault.to_account_info(),
                        mint: self.usdc_mint.to_account_info(),
                        to: self.owner_token_account.to_account_info(),
                        authority: self.goal.to_account_info(),
                    },
                    signer,
                ),
                amount,
                USDC_DECIMALS,
            )?;
        }
        close_account(CpiContext::new_with_signer(
            self.token_program.key(),
            CloseAccount {
                account: self.vault.to_account_info(),
                destination: self.owner.to_account_info(),
                authority: self.goal.to_account_info(),
            },
            signer,
        ))?;
        Ok(amount)
    }
}

pub fn handle_complete_goal(ctx: Context<CloseGoal>) -> Result<()> {
    let goal = &ctx.accounts.goal;
    let now = Clock::get()?.unix_timestamp;
    require!(goal.deposited >= goal.target_amount, BulbulError::GoalTargetNotReached);
    require!(now >= goal.unlock_at, BulbulError::GoalStillLocked);

    let xp_gained = goal_xp(goal.target_amount, goal.unlock_at - goal.created_at)
        .ok_or(BulbulError::MathOverflow)?;
    let amount = ctx.accounts.pay_out_and_close()?;

    let profile = &mut ctx.accounts.profile;
    profile.xp = profile.xp.checked_add(xp_gained).ok_or(BulbulError::MathOverflow)?;
    profile.verified_saved_total = profile
        .verified_saved_total
        .checked_add(amount)
        .ok_or(BulbulError::MathOverflow)?;
    profile.goals_completed = profile
        .goals_completed
        .checked_add(1)
        .ok_or(BulbulError::MathOverflow)?;

    emit!(GoalCompleted {
        owner: ctx.accounts.owner.key(),
        goal: ctx.accounts.goal.key(),
        amount,
        xp_gained,
    });
    Ok(())
}

/// It's the user's own savings, so they can always get it back early, just without XP.
pub fn handle_break_goal(ctx: Context<CloseGoal>) -> Result<()> {
    let returned = ctx.accounts.pay_out_and_close()?;
    let profile = &mut ctx.accounts.profile;
    profile.goals_broken = profile
        .goals_broken
        .checked_add(1)
        .ok_or(BulbulError::MathOverflow)?;
    emit!(GoalBroken {
        owner: ctx.accounts.owner.key(),
        goal: ctx.accounts.goal.key(),
        returned,
    });
    Ok(())
}
