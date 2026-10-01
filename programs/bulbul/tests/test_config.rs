mod common;

use {
    anchor_lang::prelude::Pubkey,
    bulbul::{error::BulbulError, state::Config},
    common::*,
    solana_keypair::Keypair,
    solana_signer::Signer,
};

#[test]
fn initialize_config_sets_fields() {
    let env = Env::new();
    let config: Config = env.account(&config_pda());
    assert_eq!(config.admin, env.admin.pubkey());
    assert_eq!(config.attestor, env.attestor.pubkey());
    assert_eq!(config.usdc_mint, env.usdc);
    assert_eq!(config.charity_token_account, env.charity);
    assert_eq!(config.pool_vault, pool_pda());
    assert_eq!(config.restricted_regions, vec![INDIA]);
    assert_eq!(config.companion_uri_base, URI_BASE);
    assert!(!config.paused);
    assert_eq!(env.balance(&pool_pda()), 0);
}

#[test]
fn only_upgrade_authority_can_initialize() {
    let mut env = Env::bare();
    let intruder = Keypair::new();
    env.svm.airdrop(&intruder.pubkey(), 10_000_000_000).unwrap();
    let ix = env.init_config_ix(&intruder.pubkey(), env.usdc, vec![]);
    assert_err(env.send(&[ix], &intruder, &[]), BulbulError::NotUpgradeAuthority);
}

#[test]
fn immutable_program_cannot_be_initialized() {
    let mut env = Env::bare();
    env.set_upgrade_authority(None);
    assert_err(env.init_config(vec![]), BulbulError::NotUpgradeAuthority);
}

#[test]
fn rejects_mint_without_six_decimals() {
    let mut env = Env::bare();
    let bad_mint = Pubkey::new_unique();
    env.create_mint(bad_mint, 9);
    let admin = env.admin.insecure_clone();
    let ix = env.init_config_ix(&admin.pubkey(), bad_mint, vec![]);
    assert_err(env.send(&[ix], &admin, &[]), BulbulError::InvalidMintDecimals);
}

#[test]
fn rejects_invalid_region_code() {
    let mut env = Env::bare();
    assert_err(env.init_config(vec![*b"in"]), BulbulError::InvalidRegion);
}

#[test]
fn rejects_too_many_regions() {
    let mut env = Env::bare();
    let regions: Vec<[u8; 2]> = (0..17u8).map(|i| [b'A' + i, b'A']).collect();
    assert_err(env.init_config(regions), BulbulError::TooManyRegions);
}

#[test]
fn cannot_initialize_twice() {
    let mut env = Env::new();
    // System program: account already in use.
    assert_custom(env.init_config(vec![]), 0);
}

#[test]
fn admin_can_update_and_pause() {
    let mut env = Env::new();
    let admin = env.admin.insecure_clone();
    let ix = env.update_config_ix(&admin.pubkey(), vec![INDIA, *b"PK"], true);
    env.send(&[ix], &admin, &[]).unwrap();
    let config: Config = env.account(&config_pda());
    assert_eq!(config.restricted_regions, vec![INDIA, *b"PK"]);
    assert!(config.paused);
}

#[test]
fn non_admin_cannot_update() {
    let mut env = Env::new();
    let intruder = Keypair::new();
    env.svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();
    let ix = env.update_config_ix(&intruder.pubkey(), vec![], false);
    assert_err(env.send(&[ix], &intruder, &[]), BulbulError::NotAdmin);
}
