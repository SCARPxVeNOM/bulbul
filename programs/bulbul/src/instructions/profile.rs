use anchor_lang::prelude::*;

use crate::{
    constants::*,
    instructions::config::validate_region,
    state::{Profile, Stage},
};

#[derive(Accounts)]
pub struct InitProfile<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Profile::INIT_SPACE,
        seeds = [PROFILE_SEED, owner.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,
    pub system_program: Program<'info, System>,
}

/// Region is fixed at creation so a user can't hop regions to unlock Pool mode.
pub fn handle_init_profile(ctx: Context<InitProfile>, region: [u8; 2]) -> Result<()> {
    validate_region(&region)?;
    ctx.accounts.profile.set_inner(Profile {
        owner: ctx.accounts.owner.key(),
        region,
        xp: 0,
        verified_saved_total: 0,
        goals_created: 0,
        goals_completed: 0,
        goals_broken: 0,
        commitments_created: 0,
        commitments_succeeded: 0,
        commitments_failed: 0,
        companion: Pubkey::default(),
        companion_stage: Stage::Curious,
        created_at: Clock::get()?.unix_timestamp,
        bump: ctx.bumps.profile,
    });
    Ok(())
}
