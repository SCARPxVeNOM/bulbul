#![allow(dead_code)]

use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    bulbul::{core_cpi::MPL_CORE_ID, error::BulbulError, constants::*, state::*},
    litesvm::LiteSVM,
    solana_account::Account,
    solana_clock::Clock,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

pub const TOKEN_PROGRAM_ID: Pubkey = anchor_spl::token::ID;
const BPF_LOADER_UPGRADEABLE: Pubkey =
    anchor_lang::pubkey!("BPFLoaderUpgradeab1e11111111111111111111111");

pub const INDIA: [u8; 2] = *b"IN";
pub const USA: [u8; 2] = *b"US";
pub const URI_BASE: &str = "https://bulbul.app/companion";

pub struct Env {
    pub svm: LiteSVM,
    pub admin: Keypair,
    pub attestor: Keypair,
    pub usdc: Pubkey,
    pub charity: Pubkey,
}

pub struct User {
    pub kp: Keypair,
    pub usdc: Pubkey,
}

impl User {
    pub fn key(&self) -> Pubkey {
        self.kp.pubkey()
    }
}

pub fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[CONFIG_SEED], &bulbul::ID).0
}
pub fn pool_pda() -> Pubkey {
    Pubkey::find_program_address(&[POOL_SEED], &bulbul::ID).0
}
pub fn profile_pda(owner: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[PROFILE_SEED, owner.as_ref()], &bulbul::ID).0
}
pub fn goal_pda(owner: &Pubkey, id: u32) -> Pubkey {
    Pubkey::find_program_address(&[GOAL_SEED, owner.as_ref(), &id.to_le_bytes()], &bulbul::ID).0
}
pub fn goal_vault_pda(goal: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[GOAL_VAULT_SEED, goal.as_ref()], &bulbul::ID).0
}
pub fn commitment_pda(owner: &Pubkey, id: u32) -> Pubkey {
    Pubkey::find_program_address(&[COMMITMENT_SEED, owner.as_ref(), &id.to_le_bytes()], &bulbul::ID).0
}
pub fn escrow_pda(commitment: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[ESCROW_SEED, commitment.as_ref()], &bulbul::ID).0
}
pub fn companion_auth_pda() -> Pubkey {
    Pubkey::find_program_address(&[COMPANION_AUTH_SEED], &bulbul::ID).0
}
fn program_data_pda() -> Pubkey {
    Pubkey::find_program_address(&[bulbul::ID.as_ref()], &BPF_LOADER_UPGRADEABLE).0
}

pub fn ix<D: InstructionData, A: ToAccountMetas>(data: D, accounts: A) -> Instruction {
    Instruction::new_with_bytes(bulbul::ID, &data.data(), accounts.to_account_metas(None))
}

pub fn err_code(e: BulbulError) -> u32 {
    u32::from(e)
}

impl Env {
    /// Fresh SVM with bulbul + the real Metaplex Core program, USDC mint, charity
    /// account, and `admin` set as the program's upgrade authority. Config is NOT initialized.
    pub fn bare() -> Env {
        let mut svm = LiteSVM::new();
        svm.add_program(
            bulbul::ID,
            include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/bulbul.so")),
        )
        .unwrap();
        svm.add_program(MPL_CORE_ID, include_bytes!("../fixtures/mpl_core.so")).unwrap();

        let admin = Keypair::new();
        let attestor = Keypair::new();
        svm.airdrop(&admin.pubkey(), 100_000_000_000).unwrap();
        svm.airdrop(&attestor.pubkey(), 1_000_000_000).unwrap();

        let mut env = Env {
            svm,
            admin,
            attestor,
            usdc: Pubkey::new_unique(),
            charity: Pubkey::new_unique(),
        };
        env.set_upgrade_authority(Some(env.admin.pubkey()));
        let usdc = env.usdc;
        env.create_mint(usdc, USDC_DECIMALS);
        let charity_owner = Pubkey::new_unique();
        env.create_token_account(env.charity, usdc, charity_owner, 0);
        env.set_time(1_800_000_000);
        env
    }

    pub fn new() -> Env {
        let mut env = Env::bare();
        env.init_config(vec![INDIA]).unwrap();
        env
    }

    pub fn set_upgrade_authority(&mut self, authority: Option<Pubkey>) {
        let addr = program_data_pda();
        let mut acct = self.svm.get_account(&addr).unwrap();
        // UpgradeableLoaderState::ProgramData { slot: u64, upgrade_authority_address: Option<Pubkey> }
        acct.data[0..4].copy_from_slice(&3u32.to_le_bytes());
        match authority {
            Some(a) => {
                acct.data[12] = 1;
                acct.data[13..45].copy_from_slice(a.as_ref());
            }
            None => {
                acct.data[12] = 0;
                acct.data[13..45].fill(0);
            }
        }
        self.svm.set_account(addr, acct).unwrap();
    }

    pub fn create_mint(&mut self, mint: Pubkey, decimals: u8) {
        let mut data = vec![0u8; 82];
        data[0..4].copy_from_slice(&1u32.to_le_bytes());
        data[4..36].copy_from_slice(Pubkey::new_unique().as_ref());
        data[36..44].copy_from_slice(&u64::MAX.to_le_bytes());
        data[44] = decimals;
        data[45] = 1;
        self.put(mint, data, TOKEN_PROGRAM_ID);
    }

    pub fn create_token_account(&mut self, addr: Pubkey, mint: Pubkey, owner: Pubkey, amount: u64) {
        let mut data = vec![0u8; 165];
        data[0..32].copy_from_slice(mint.as_ref());
        data[32..64].copy_from_slice(owner.as_ref());
        data[64..72].copy_from_slice(&amount.to_le_bytes());
        data[108] = 1;
        self.put(addr, data, TOKEN_PROGRAM_ID);
    }

    fn put(&mut self, addr: Pubkey, data: Vec<u8>, owner: Pubkey) {
        let lamports = self.svm.minimum_balance_for_rent_exemption(data.len());
        self.svm
            .set_account(addr, Account { lamports, data, owner, executable: false, rent_epoch: 0 })
            .unwrap();
    }

    pub fn balance(&self, token_account: &Pubkey) -> u64 {
        let acct = self.svm.get_account(token_account).unwrap();
        u64::from_le_bytes(acct.data[64..72].try_into().unwrap())
    }

    pub fn exists(&self, addr: &Pubkey) -> bool {
        self.svm.get_account(addr).is_some_and(|a| a.lamports > 0)
    }

    pub fn now(&self) -> i64 {
        self.svm.get_sysvar::<Clock>().unix_timestamp
    }

    pub fn set_time(&mut self, ts: i64) {
        let mut clock: Clock = self.svm.get_sysvar();
        clock.unix_timestamp = ts;
        self.svm.set_sysvar(&clock);
    }

    pub fn advance(&mut self, secs: i64) {
        let now = self.now();
        self.set_time(now + secs);
    }

    pub fn send(&mut self, ixs: &[Instruction], payer: &Keypair, extra: &[&Keypair]) -> Result<(), String> {
        self.svm.expire_blockhash();
        let mut signers: Vec<&Keypair> = vec![payer];
        signers.extend_from_slice(extra);
        let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &self.svm.latest_blockhash());
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &signers).unwrap();
        self.svm
            .send_transaction(tx)
            .map(|_| ())
            .map_err(|e| format!("{:?}\n{}", e.err, e.meta.logs.join("\n")))
    }

    pub fn account<T: AccountDeserialize>(&self, addr: &Pubkey) -> T {
        let acct = self.svm.get_account(addr).unwrap();
        T::try_deserialize(&mut acct.data.as_slice()).unwrap()
    }

    pub fn config_params(&self, restricted: Vec<[u8; 2]>) -> bulbul::ConfigParams {
        bulbul::ConfigParams {
            attestor: self.attestor.pubkey(),
            restricted_regions: restricted,
            companion_uri_base: URI_BASE.to_string(),
        }
    }

    pub fn init_config_ix(&self, admin: &Pubkey, mint: Pubkey, restricted: Vec<[u8; 2]>) -> Instruction {
        ix(
            bulbul::instruction::InitializeConfig { params: self.config_params(restricted) },
            bulbul::accounts::InitializeConfig {
                admin: *admin,
                config: config_pda(),
                usdc_mint: mint,
                pool_vault: pool_pda(),
                charity_token_account: self.charity,
                program: bulbul::ID,
                program_data: program_data_pda(),
                token_program: TOKEN_PROGRAM_ID,
                system_program: system_program::ID,
            },
        )
    }

    pub fn init_config(&mut self, restricted: Vec<[u8; 2]>) -> Result<(), String> {
        let admin = self.admin.insecure_clone();
        let ix = self.init_config_ix(&admin.pubkey(), self.usdc, restricted);
        self.send(&[ix], &admin, &[])
    }

    pub fn update_config_ix(&self, admin: &Pubkey, restricted: Vec<[u8; 2]>, paused: bool) -> Instruction {
        ix(
            bulbul::instruction::UpdateConfig {
                params: self.config_params(restricted),
                paused,
                new_admin: None,
            },
            bulbul::accounts::UpdateConfig {
                admin: *admin,
                config: config_pda(),
                charity_token_account: self.charity,
            },
        )
    }

    pub fn user(&mut self, region: [u8; 2], usdc: u64) -> User {
        let kp = Keypair::new();
        self.svm.airdrop(&kp.pubkey(), 10_000_000_000).unwrap();
        let token = Pubkey::new_unique();
        let mint = self.usdc;
        self.create_token_account(token, mint, kp.pubkey(), usdc);
        let user = User { kp, usdc: token };
        let init = ix(
            bulbul::instruction::InitProfile { region },
            bulbul::accounts::InitProfile {
                owner: user.key(),
                profile: profile_pda(&user.key()),
                system_program: system_program::ID,
            },
        );
        self.send(&[init], &user.kp, &[]).unwrap();
        user
    }

    pub fn profile(&self, owner: &Pubkey) -> Profile {
        self.account(&profile_pda(owner))
    }

    // ---- goals ----

    pub fn create_goal(&mut self, user: &User, name: &str, target: u64, unlock_at: i64) -> Result<Pubkey, String> {
        let id = self.profile(&user.key()).goals_created;
        let goal = goal_pda(&user.key(), id);
        let ix = ix(
            bulbul::instruction::CreateGoal { name: name.to_string(), target_amount: target, unlock_at },
            bulbul::accounts::CreateGoal {
                owner: user.key(),
                config: config_pda(),
                profile: profile_pda(&user.key()),
                goal,
                vault: goal_vault_pda(&goal),
                usdc_mint: self.usdc,
                token_program: TOKEN_PROGRAM_ID,
                system_program: system_program::ID,
            },
        );
        self.send(&[ix], &user.kp, &[]).map(|_| goal)
    }

    pub fn deposit_ix(&self, owner: &Pubkey, owner_token: Pubkey, goal: Pubkey, amount: u64) -> Instruction {
        ix(
            bulbul::instruction::DepositGoal { amount },
            bulbul::accounts::DepositGoal {
                owner: *owner,
                config: config_pda(),
                goal,
                vault: goal_vault_pda(&goal),
                owner_token_account: owner_token,
                usdc_mint: self.usdc,
                token_program: TOKEN_PROGRAM_ID,
            },
        )
    }

    pub fn deposit(&mut self, user: &User, goal: Pubkey, amount: u64) -> Result<(), String> {
        let ix = self.deposit_ix(&user.key(), user.usdc, goal, amount);
        self.send(&[ix], &user.kp, &[])
    }

    fn close_goal_accounts(&self, user: &User, goal: Pubkey) -> bulbul::accounts::CloseGoal {
        bulbul::accounts::CloseGoal {
            owner: user.key(),
            config: config_pda(),
            profile: profile_pda(&user.key()),
            goal,
            vault: goal_vault_pda(&goal),
            owner_token_account: user.usdc,
            usdc_mint: self.usdc,
            token_program: TOKEN_PROGRAM_ID,
        }
    }

    pub fn complete_goal(&mut self, user: &User, goal: Pubkey) -> Result<(), String> {
        let ix = ix(bulbul::instruction::CompleteGoal {}, self.close_goal_accounts(user, goal));
        self.send(&[ix], &user.kp, &[])
    }

    pub fn break_goal(&mut self, user: &User, goal: Pubkey) -> Result<(), String> {
        let ix = ix(bulbul::instruction::BreakGoal {}, self.close_goal_accounts(user, goal));
        self.send(&[ix], &user.kp, &[])
    }

    // ---- commitments ----

    pub fn create_commitment(
        &mut self,
        user: &User,
        stake: u64,
        required: u8,
        period_days: u8,
        mode: ForfeitMode,
    ) -> Result<Pubkey, String> {
        self.create_focus_commitment(user, stake, 120, required, period_days, mode)
    }

    pub fn create_focus_commitment(
        &mut self,
        user: &User,
        stake: u64,
        focus_minutes: u16,
        required: u8,
        period_days: u8,
        mode: ForfeitMode,
    ) -> Result<Pubkey, String> {
        let id = self.profile(&user.key()).commitments_created;
        let commitment = commitment_pda(&user.key(), id);
        let ix = ix(
            bulbul::instruction::CreateCommitment {
                stake,
                focus_minutes,
                required_checkins: required,
                period_days,
                mode,
            },
            bulbul::accounts::CreateCommitment {
                owner: user.key(),
                config: config_pda(),
                profile: profile_pda(&user.key()),
                commitment,
                escrow: escrow_pda(&commitment),
                owner_token_account: user.usdc,
                usdc_mint: self.usdc,
                token_program: TOKEN_PROGRAM_ID,
                system_program: system_program::ID,
            },
        );
        self.send(&[ix], &user.kp, &[]).map(|_| commitment)
    }

    pub fn attest_with(&mut self, signer: &Keypair, commitment: Pubkey, day_index: u8) -> Result<(), String> {
        let ix = ix(
            bulbul::instruction::AttestCheckin { day_index },
            bulbul::accounts::AttestCheckin {
                attestor: signer.pubkey(),
                config: config_pda(),
                commitment,
            },
        );
        self.send(&[ix], signer, &[])
    }

    pub fn attest(&mut self, commitment: Pubkey, day_index: u8) -> Result<(), String> {
        let attestor = self.attestor.insecure_clone();
        self.attest_with(&attestor, commitment, day_index)
    }

    pub fn settle(&mut self, settler: &Keypair, user: &User, commitment: Pubkey) -> Result<(), String> {
        let ix = ix(
            bulbul::instruction::SettleCommitment {},
            bulbul::accounts::SettleCommitment {
                settler: settler.pubkey(),
                owner: user.key(),
                config: config_pda(),
                profile: profile_pda(&user.key()),
                commitment,
                escrow: escrow_pda(&commitment),
                owner_token_account: user.usdc,
                charity_token_account: self.charity,
                pool_vault: pool_pda(),
                usdc_mint: self.usdc,
                token_program: TOKEN_PROGRAM_ID,
            },
        );
        self.send(&[ix], settler, &[])
    }

    // ---- companion ----

    pub fn mint_companion(&mut self, user: &User) -> Result<Pubkey, String> {
        let asset = Keypair::new();
        let ix = ix(
            bulbul::instruction::MintCompanion {},
            bulbul::accounts::MintCompanion {
                owner: user.key(),
                config: config_pda(),
                profile: profile_pda(&user.key()),
                asset: asset.pubkey(),
                companion_authority: companion_auth_pda(),
                mpl_core_program: MPL_CORE_ID,
                system_program: system_program::ID,
            },
        );
        self.send(&[ix], &user.kp, &[&asset]).map(|_| asset.pubkey())
    }

    pub fn evolve_ix(&self, payer: &Pubkey, owner: &Pubkey, asset: Pubkey) -> Instruction {
        ix(
            bulbul::instruction::EvolveCompanion {},
            bulbul::accounts::EvolveCompanion {
                payer: *payer,
                config: config_pda(),
                profile: profile_pda(owner),
                asset,
                companion_authority: companion_auth_pda(),
                mpl_core_program: MPL_CORE_ID,
                system_program: system_program::ID,
            },
        )
    }
}

#[track_caller]
pub fn assert_custom(res: Result<impl std::fmt::Debug, String>, code: u32) {
    match res {
        Ok(v) => panic!("expected Custom({code}), got Ok({v:?})"),
        Err(msg) => assert!(
            msg.contains(&format!("Custom({code})")),
            "expected Custom({code}), got:\n{msg}"
        ),
    }
}

#[track_caller]
pub fn assert_err(res: Result<impl std::fmt::Debug, String>, e: BulbulError) {
    assert_custom(res, err_code(e));
}

pub const ANCHOR_CONSTRAINT_SEEDS: u32 = 2006;

/// Metaplex Core error codes (mpl-core 0.12.1 generated errors).
pub const CORE_INVALID_AUTHORITY: u32 = 9;
pub const CORE_NO_APPROVALS: u32 = 26;
