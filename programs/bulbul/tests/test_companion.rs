mod common;

use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{
            instruction::{AccountMeta, Instruction},
            system_program,
        },
    },
    bulbul::{
        constants::*,
        core_cpi::MPL_CORE_ID,
        error::BulbulError,
        state::{ForfeitMode, Stage},
    },
    common::*,
    solana_keypair::Keypair,
    solana_signer::Signer,
};

const DAY: i64 = SECONDS_PER_DAY;

fn asset_data(env: &Env, asset: &Pubkey) -> Vec<u8> {
    let acct = env.svm.get_account(asset).unwrap();
    assert_eq!(acct.owner, MPL_CORE_ID);
    acct.data
}

fn contains(haystack: &[u8], needle: &str) -> bool {
    haystack.windows(needle.len()).any(|w| w == needle.as_bytes())
}

/// Give the user enough XP for Focused (>= 100): two 5-day streaks = 140 XP.
fn earn_focused(env: &mut Env, user: &User) {
    for _ in 0..2 {
        let c = env.create_commitment(user, ONE_USDC, 5, 5, ForfeitMode::Soft).unwrap();
        for day in 0..5u8 {
            env.attest(c, day).unwrap();
            env.advance(DAY);
        }
        let k = user.kp.insecure_clone();
        env.settle(&k, user, c).unwrap();
    }
    assert_eq!(Stage::from_xp(env.profile(&user.key()).xp), Stage::Focused);
}

#[test]
fn mint_creates_soulbound_core_asset_controlled_by_program() {
    let mut env = Env::new();
    let user = env.user(USA, 10 * ONE_USDC);
    let asset = env.mint_companion(&user).unwrap();

    let data = asset_data(&env, &asset);
    // BaseAssetV1: key(1) | owner(32) | update_authority tag(1) + pubkey(32) | name | uri ...
    assert_eq!(&data[1..33], user.key().as_ref());
    assert_eq!(data[33], 1, "update authority should be an Address");
    assert_eq!(&data[34..66], companion_auth_pda().as_ref());
    assert!(contains(&data, COMPANION_NAME));
    assert!(contains(&data, &format!("{URI_BASE}/curious.json")));
    assert!(contains(&data, "Curious"));

    let profile = env.profile(&user.key());
    assert_eq!(profile.companion, asset);
    assert_eq!(profile.companion_stage, Stage::Curious);
}

#[test]
fn cannot_mint_twice() {
    let mut env = Env::new();
    let user = env.user(USA, 10 * ONE_USDC);
    env.mint_companion(&user).unwrap();
    assert_err(env.mint_companion(&user), BulbulError::CompanionAlreadyMinted);
}

#[test]
fn evolves_only_after_verified_progress() {
    let mut env = Env::new();
    let user = env.user(USA, 10 * ONE_USDC);
    let asset = env.mint_companion(&user).unwrap();

    // Syncing with no new progress keeps it Curious.
    let ix = env.evolve_ix(&user.key(), &user.key(), asset);
    env.send(&[ix], &user.kp, &[]).unwrap();
    assert_eq!(env.profile(&user.key()).companion_stage, Stage::Curious);

    earn_focused(&mut env, &user);

    // Anyone can crank the sync, not just the owner.
    let cranker = Keypair::new();
    env.svm.airdrop(&cranker.pubkey(), 1_000_000_000).unwrap();
    let ix = env.evolve_ix(&cranker.pubkey(), &user.key(), asset);
    env.send(&[ix], &cranker, &[]).unwrap();

    let profile = env.profile(&user.key());
    assert_eq!(profile.companion_stage, Stage::Focused);
    let data = asset_data(&env, &asset);
    assert!(contains(&data, "Focused"));
    assert!(contains(&data, &format!("{URI_BASE}/focused.json")));
    assert!(contains(&data, &profile.xp.to_string()));
}

#[test]
fn evolve_rejects_foreign_asset() {
    let mut env = Env::new();
    let a = env.user(USA, 10 * ONE_USDC);
    let b = env.user(USA, 10 * ONE_USDC);
    env.mint_companion(&a).unwrap();
    let b_asset = env.mint_companion(&b).unwrap();
    let ix = env.evolve_ix(&a.key(), &a.key(), b_asset);
    assert_err(env.send(&[ix], &a.kp, &[]), BulbulError::WrongCompanion);
}

#[test]
fn evolve_requires_minted_companion() {
    let mut env = Env::new();
    let user = env.user(USA, 10 * ONE_USDC);
    let ix = env.evolve_ix(&user.key(), &user.key(), Pubkey::default());
    assert_err(env.send(&[ix], &user.kp, &[]), BulbulError::CompanionNotMinted);
}

#[test]
fn owner_cannot_transfer_companion() {
    let mut env = Env::new();
    let user = env.user(USA, 10 * ONE_USDC);
    let asset = env.mint_companion(&user).unwrap();
    let buyer = Pubkey::new_unique();

    // mpl-core TransferV1 (discriminator 14), compression_proof: None.
    let transfer = Instruction {
        program_id: MPL_CORE_ID,
        accounts: vec![
            AccountMeta::new(asset, false),
            AccountMeta::new_readonly(MPL_CORE_ID, false),
            AccountMeta::new(user.key(), true),
            AccountMeta::new_readonly(user.key(), true),
            AccountMeta::new_readonly(buyer, false),
            AccountMeta::new_readonly(system_program::ID, false),
            AccountMeta::new_readonly(MPL_CORE_ID, false),
        ],
        data: vec![14, 0],
    };
    // Rejected by the PermanentFreezeDelegate plugin: the companion is soulbound.
    assert_custom(env.send(&[transfer], &user.kp, &[]), CORE_INVALID_AUTHORITY);
    assert_eq!(&asset_data(&env, &asset)[1..33], user.key().as_ref());
}

#[test]
fn owner_cannot_edit_attributes_directly() {
    let mut env = Env::new();
    let user = env.user(USA, 10 * ONE_USDC);
    let asset = env.mint_companion(&user).unwrap();

    // UpdatePluginV1 (discriminator 6) writing stage=Legendary, signed by the owner.
    let mut data = vec![6u8, 6u8];
    data.extend_from_slice(&1u32.to_le_bytes());
    for s in ["stage", "Legendary"] {
        data.extend_from_slice(&(s.len() as u32).to_le_bytes());
        data.extend_from_slice(s.as_bytes());
    }
    let forge = Instruction {
        program_id: MPL_CORE_ID,
        accounts: vec![
            AccountMeta::new(asset, false),
            AccountMeta::new_readonly(MPL_CORE_ID, false),
            AccountMeta::new(user.key(), true),
            AccountMeta::new_readonly(user.key(), true),
            AccountMeta::new_readonly(system_program::ID, false),
            AccountMeta::new_readonly(MPL_CORE_ID, false),
        ],
        data,
    };
    // Only the program's companion PDA is approved to edit attributes.
    assert_custom(env.send(&[forge], &user.kp, &[]), CORE_NO_APPROVALS);
    assert!(!contains(&asset_data(&env, &asset), "Legendary"));
}
