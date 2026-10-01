use anchor_lang::prelude::*;

use crate::{
    constants::*,
    core_cpi::{self, CreateCompanion, UpdateCompanion, MPL_CORE_ID},
    error::BulbulError,
    events::CompanionEvolved,
    state::{Config, Profile, Stage},
};

fn companion_uri(config: &Config, stage: Stage) -> String {
    format!("{}/{}.json", config.companion_uri_base, stage.slug())
}

fn companion_attributes(profile: &Profile, stage: Stage) -> Vec<(&'static str, String)> {
    vec![
        ("stage", stage.name().to_string()),
        ("xp", profile.xp.to_string()),
        ("verified_saved", profile.verified_saved_total.to_string()),
        ("goals_completed", profile.goals_completed.to_string()),
        ("streaks_completed", profile.commitments_succeeded.to_string()),
    ]
}

#[derive(Accounts)]
pub struct MintCompanion<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [PROFILE_SEED, owner.key().as_ref()],
        bump = profile.bump,
        constraint = profile.companion == Pubkey::default() @ BulbulError::CompanionAlreadyMinted,
    )]
    pub profile: Account<'info, Profile>,
    /// A fresh keypair; Metaplex Core initializes it.
    #[account(mut)]
    pub asset: Signer<'info>,
    /// CHECK: PDA that is the asset's update authority; only this program can sign for it.
    #[account(seeds = [COMPANION_AUTH_SEED], bump)]
    pub companion_authority: UncheckedAccount<'info>,
    /// CHECK: Metaplex Core program, checked by address.
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_mint_companion(ctx: Context<MintCompanion>) -> Result<()> {
    let profile = &ctx.accounts.profile;
    let stage = Stage::from_xp(profile.xp);
    let uri = companion_uri(&ctx.accounts.config, stage);
    let attrs = companion_attributes(profile, stage);

    core_cpi::create_companion(
        CreateCompanion {
            asset: &ctx.accounts.asset.to_account_info(),
            payer: &ctx.accounts.owner.to_account_info(),
            owner: &ctx.accounts.owner.to_account_info(),
            update_authority: &ctx.accounts.companion_authority.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
            mpl_core_program: &ctx.accounts.mpl_core_program.to_account_info(),
        },
        COMPANION_NAME,
        &uri,
        &attrs,
    )?;

    let profile = &mut ctx.accounts.profile;
    profile.companion = ctx.accounts.asset.key();
    profile.companion_stage = stage;
    Ok(())
}

/// Permissionless: syncs the asset to the profile's verified on-chain state.
/// Evolution can't be faked because XP only moves through settled goals and commitments.
#[derive(Accounts)]
pub struct EvolveCompanion<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [PROFILE_SEED, profile.owner.as_ref()],
        bump = profile.bump,
        constraint = profile.companion != Pubkey::default() @ BulbulError::CompanionNotMinted,
    )]
    pub profile: Account<'info, Profile>,
    /// CHECK: Must be the profile's companion; Metaplex Core validates the asset itself.
    #[account(mut, address = profile.companion @ BulbulError::WrongCompanion)]
    pub asset: UncheckedAccount<'info>,
    /// CHECK: PDA update authority, signs via seeds.
    #[account(seeds = [COMPANION_AUTH_SEED], bump)]
    pub companion_authority: UncheckedAccount<'info>,
    /// CHECK: Metaplex Core program, checked by address.
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handle_evolve_companion(ctx: Context<EvolveCompanion>) -> Result<()> {
    let profile = &ctx.accounts.profile;
    let from = profile.companion_stage;
    let to = Stage::from_xp(profile.xp);
    let attrs = companion_attributes(profile, to);

    let bump = [ctx.bumps.companion_authority];
    let seeds: &[&[u8]] = &[COMPANION_AUTH_SEED, &bump];
    let update = UpdateCompanion {
        asset: &ctx.accounts.asset.to_account_info(),
        payer: &ctx.accounts.payer.to_account_info(),
        authority: &ctx.accounts.companion_authority.to_account_info(),
        system_program: &ctx.accounts.system_program.to_account_info(),
        mpl_core_program: &ctx.accounts.mpl_core_program.to_account_info(),
    };
    update.set_attributes(&attrs, &[seeds])?;
    if to != from {
        update.set_uri(&companion_uri(&ctx.accounts.config, to), &[seeds])?;
    }

    let profile = &mut ctx.accounts.profile;
    profile.companion_stage = to;
    emit!(CompanionEvolved {
        owner: profile.owner,
        asset: profile.companion,
        from,
        to,
        xp: profile.xp,
    });
    Ok(())
}
