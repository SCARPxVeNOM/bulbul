//! Minimal Metaplex Core CPI. The `mpl-core` crate pins Solana 2.x types, which
//! conflict with Anchor 1.2, so the three instructions we use are encoded by hand
//! from the mpl-core 0.12.1 generated layouts (Borsh).

use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};

pub const MPL_CORE_ID: Pubkey = pubkey!("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");

const IX_CREATE_V2: u8 = 20;
const IX_UPDATE_PLUGIN_V1: u8 = 6;
const IX_UPDATE_V1: u8 = 15;

const DATA_STATE_ACCOUNT: u8 = 0;
const PLUGIN_PERMANENT_FREEZE_DELEGATE: u8 = 5;
const PLUGIN_ATTRIBUTES: u8 = 6;
const PLUGIN_AUTHORITY_UPDATE_AUTHORITY: u8 = 2;
const OPTION_NONE: u8 = 0;
const OPTION_SOME: u8 = 1;

/// Marker for an omitted optional account, per the Kinobi/mpl-core convention.
fn none_account() -> AccountMeta {
    AccountMeta::new_readonly(MPL_CORE_ID, false)
}

fn push_str(buf: &mut Vec<u8>, s: &str) {
    buf.extend_from_slice(&(s.len() as u32).to_le_bytes());
    buf.extend_from_slice(s.as_bytes());
}

fn attributes_plugin(buf: &mut Vec<u8>, attrs: &[(&str, String)]) {
    buf.push(PLUGIN_ATTRIBUTES);
    buf.extend_from_slice(&(attrs.len() as u32).to_le_bytes());
    for (k, v) in attrs {
        push_str(buf, k);
        push_str(buf, v);
    }
}

pub struct CreateCompanion<'a, 'info> {
    pub asset: &'a AccountInfo<'info>,
    pub payer: &'a AccountInfo<'info>,
    pub owner: &'a AccountInfo<'info>,
    pub update_authority: &'a AccountInfo<'info>,
    pub system_program: &'a AccountInfo<'info>,
    pub mpl_core_program: &'a AccountInfo<'info>,
}

/// Creates a soulbound (permanently frozen) Core asset whose update authority is
/// the program's companion PDA, with an Attributes plugin only that PDA can edit.
pub fn create_companion(
    accts: CreateCompanion,
    name: &str,
    uri: &str,
    attrs: &[(&str, String)],
) -> Result<()> {
    let mut data = vec![IX_CREATE_V2, DATA_STATE_ACCOUNT];
    push_str(&mut data, name);
    push_str(&mut data, uri);
    data.push(OPTION_SOME);
    data.extend_from_slice(&2u32.to_le_bytes());
    attributes_plugin(&mut data, attrs);
    data.extend_from_slice(&[OPTION_SOME, PLUGIN_AUTHORITY_UPDATE_AUTHORITY]);
    data.extend_from_slice(&[PLUGIN_PERMANENT_FREEZE_DELEGATE, 1]);
    data.extend_from_slice(&[OPTION_SOME, PLUGIN_AUTHORITY_UPDATE_AUTHORITY]);
    data.push(OPTION_NONE);

    let ix = Instruction {
        program_id: MPL_CORE_ID,
        accounts: vec![
            AccountMeta::new(accts.asset.key(), true),
            none_account(),
            none_account(),
            AccountMeta::new(accts.payer.key(), true),
            AccountMeta::new_readonly(accts.owner.key(), false),
            AccountMeta::new_readonly(accts.update_authority.key(), false),
            AccountMeta::new_readonly(accts.system_program.key(), false),
            none_account(),
        ],
        data,
    };
    invoke_signed(
        &ix,
        &[
            accts.asset.clone(),
            accts.payer.clone(),
            accts.owner.clone(),
            accts.update_authority.clone(),
            accts.system_program.clone(),
            accts.mpl_core_program.clone(),
        ],
        &[],
    )?;
    Ok(())
}

pub struct UpdateCompanion<'a, 'info> {
    pub asset: &'a AccountInfo<'info>,
    pub payer: &'a AccountInfo<'info>,
    pub authority: &'a AccountInfo<'info>,
    pub system_program: &'a AccountInfo<'info>,
    pub mpl_core_program: &'a AccountInfo<'info>,
}

impl<'a, 'info> UpdateCompanion<'a, 'info> {
    fn metas(&self) -> Vec<AccountMeta> {
        vec![
            AccountMeta::new(self.asset.key(), false),
            none_account(),
            AccountMeta::new(self.payer.key(), true),
            AccountMeta::new_readonly(self.authority.key(), true),
            AccountMeta::new_readonly(self.system_program.key(), false),
            none_account(),
        ]
    }

    fn infos(&self) -> [AccountInfo<'info>; 5] {
        [
            self.asset.clone(),
            self.payer.clone(),
            self.authority.clone(),
            self.system_program.clone(),
            self.mpl_core_program.clone(),
        ]
    }

    pub fn set_attributes(&self, attrs: &[(&str, String)], signer_seeds: &[&[&[u8]]]) -> Result<()> {
        let mut data = vec![IX_UPDATE_PLUGIN_V1];
        attributes_plugin(&mut data, attrs);
        let ix = Instruction {
            program_id: MPL_CORE_ID,
            accounts: self.metas(),
            data,
        };
        invoke_signed(&ix, &self.infos(), signer_seeds)?;
        Ok(())
    }

    pub fn set_uri(&self, uri: &str, signer_seeds: &[&[&[u8]]]) -> Result<()> {
        let mut data = vec![IX_UPDATE_V1, OPTION_NONE, OPTION_SOME];
        push_str(&mut data, uri);
        data.push(OPTION_NONE);
        let ix = Instruction {
            program_id: MPL_CORE_ID,
            accounts: self.metas(),
            data,
        };
        invoke_signed(&ix, &self.infos(), signer_seeds)?;
        Ok(())
    }
}
