use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{constants::*, error::BulbulError, program::Bulbul, state::Config};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ConfigParams {
    pub attestor: Pubkey,
    pub restricted_regions: Vec<[u8; 2]>,
    pub companion_uri_base: String,
}

impl ConfigParams {
    fn validate(&self) -> Result<()> {
        require!(
            self.restricted_regions.len() <= MAX_RESTRICTED_REGIONS,
            BulbulError::TooManyRegions
        );
        for region in &self.restricted_regions {
            validate_region(region)?;
        }
        require!(
            self.companion_uri_base.len() <= MAX_URI_BASE_LEN,
            BulbulError::UriTooLong
        );
        Ok(())
    }
}

pub fn validate_region(region: &[u8; 2]) -> Result<()> {
    require!(
        region.iter().all(|b| b.is_ascii_uppercase()),
        BulbulError::InvalidRegion
    );
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Config::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(constraint = usdc_mint.decimals == USDC_DECIMALS @ BulbulError::InvalidMintDecimals)]
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = admin,
        seeds = [POOL_SEED],
        bump,
        token::mint = usdc_mint,
        token::authority = config,
    )]
    pub pool_vault: Account<'info, TokenAccount>,
    #[account(constraint = charity_token_account.mint == usdc_mint.key() @ BulbulError::WrongMint)]
    pub charity_token_account: Account<'info, TokenAccount>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, Bulbul>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(admin.key())
            @ BulbulError::NotUpgradeAuthority
    )]
    pub program_data: Account<'info, ProgramData>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_config(ctx: Context<InitializeConfig>, params: ConfigParams) -> Result<()> {
    params.validate()?;
    ctx.accounts.config.set_inner(Config {
        admin: ctx.accounts.admin.key(),
        attestor: params.attestor,
        usdc_mint: ctx.accounts.usdc_mint.key(),
        charity_token_account: ctx.accounts.charity_token_account.key(),
        pool_vault: ctx.accounts.pool_vault.key(),
        restricted_regions: params.restricted_regions,
        companion_uri_base: params.companion_uri_base,
        paused: false,
        bump: ctx.bumps.config,
        pool_bump: ctx.bumps.pool_vault,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
        has_one = admin @ BulbulError::NotAdmin,
    )]
    pub config: Account<'info, Config>,
    #[account(constraint = charity_token_account.mint == config.usdc_mint @ BulbulError::WrongMint)]
    pub charity_token_account: Account<'info, TokenAccount>,
}

pub fn handle_update_config(
    ctx: Context<UpdateConfig>,
    params: ConfigParams,
    paused: bool,
    new_admin: Option<Pubkey>,
) -> Result<()> {
    params.validate()?;
    let config = &mut ctx.accounts.config;
    config.attestor = params.attestor;
    config.restricted_regions = params.restricted_regions;
    config.companion_uri_base = params.companion_uri_base;
    config.charity_token_account = ctx.accounts.charity_token_account.key();
    config.paused = paused;
    if let Some(admin) = new_admin {
        config.admin = admin;
    }
    Ok(())
}
