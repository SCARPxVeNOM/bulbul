pub mod constants;
pub mod core_cpi;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;
pub mod xp;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("5c7PXFMxkMc3kKsNHoafJb3phNhZoz6jt5qm57heRpGF");

#[program]
pub mod bulbul {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, params: ConfigParams) -> Result<()> {
        instructions::config::handle_initialize_config(ctx, params)
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        params: ConfigParams,
        paused: bool,
        new_admin: Option<Pubkey>,
    ) -> Result<()> {
        instructions::config::handle_update_config(ctx, params, paused, new_admin)
    }

    pub fn init_profile(ctx: Context<InitProfile>, region: [u8; 2]) -> Result<()> {
        instructions::profile::handle_init_profile(ctx, region)
    }

    pub fn create_goal(
        ctx: Context<CreateGoal>,
        name: String,
        target_amount: u64,
        unlock_at: i64,
    ) -> Result<()> {
        instructions::goal::handle_create_goal(ctx, name, target_amount, unlock_at)
    }

    pub fn deposit_goal(ctx: Context<DepositGoal>, amount: u64) -> Result<()> {
        instructions::goal::handle_deposit_goal(ctx, amount)
    }

    pub fn complete_goal(ctx: Context<CloseGoal>) -> Result<()> {
        instructions::goal::handle_complete_goal(ctx)
    }

    pub fn break_goal(ctx: Context<CloseGoal>) -> Result<()> {
        instructions::goal::handle_break_goal(ctx)
    }

    pub fn create_commitment(
        ctx: Context<CreateCommitment>,
        stake: u64,
        focus_minutes: u16,
        required_checkins: u8,
        period_days: u8,
        mode: ForfeitMode,
    ) -> Result<()> {
        instructions::commitment::handle_create_commitment(
            ctx,
            stake,
            focus_minutes,
            required_checkins,
            period_days,
            mode,
        )
    }

    pub fn attest_checkin(ctx: Context<AttestCheckin>, day_index: u8) -> Result<()> {
        instructions::commitment::handle_attest_checkin(ctx, day_index)
    }

    pub fn settle_commitment(ctx: Context<SettleCommitment>) -> Result<()> {
        instructions::commitment::handle_settle_commitment(ctx)
    }

    pub fn mint_companion(ctx: Context<MintCompanion>) -> Result<()> {
        instructions::companion::handle_mint_companion(ctx)
    }

    pub fn evolve_companion(ctx: Context<EvolveCompanion>) -> Result<()> {
        instructions::companion::handle_evolve_companion(ctx)
    }
}
