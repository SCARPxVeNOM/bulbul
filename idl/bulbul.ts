/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/bulbul.json`.
 */
export type Bulbul = {
  "address": "5c7PXFMxkMc3kKsNHoafJb3phNhZoz6jt5qm57heRpGF",
  "metadata": {
    "name": "bulbul",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "bulbul: a companion that evolves only from verified on-chain commitments"
  },
  "instructions": [
    {
      "name": "attestCheckin",
      "discriminator": [
        158,
        247,
        206,
        157,
        140,
        211,
        212,
        243
      ],
      "accounts": [
        {
          "name": "attestor",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "commitment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  105,
                  116,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "commitment.owner",
                "account": "commitment"
              },
              {
                "kind": "account",
                "path": "commitment.id",
                "account": "commitment"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "dayIndex",
          "type": "u8"
        }
      ]
    },
    {
      "name": "breakGoal",
      "discriminator": [
        198,
        247,
        9,
        163,
        76,
        59,
        144,
        213
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "goal"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "goal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "goal.id",
                "account": "goalVault"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  97,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "goal"
              }
            ]
          }
        },
        {
          "name": "ownerTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "completeGoal",
      "discriminator": [
        140,
        54,
        173,
        125,
        210,
        162,
        67,
        228
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true,
          "relations": [
            "goal"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "goal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "goal.id",
                "account": "goalVault"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  97,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "goal"
              }
            ]
          }
        },
        {
          "name": "ownerTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "createCommitment",
      "discriminator": [
        232,
        31,
        118,
        65,
        229,
        2,
        2,
        170
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "commitment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  105,
                  116,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "profile.commitmentsCreated",
                "account": "profile"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "commitment"
              }
            ]
          }
        },
        {
          "name": "ownerTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "stake",
          "type": "u64"
        },
        {
          "name": "focusMinutes",
          "type": "u16"
        },
        {
          "name": "requiredCheckins",
          "type": "u8"
        },
        {
          "name": "periodDays",
          "type": "u8"
        },
        {
          "name": "mode",
          "type": {
            "defined": {
              "name": "forfeitMode"
            }
          }
        }
      ]
    },
    {
      "name": "createGoal",
      "discriminator": [
        229,
        63,
        42,
        239,
        1,
        226,
        219,
        196
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "goal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "profile.goalsCreated",
                "account": "profile"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  97,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "goal"
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "targetAmount",
          "type": "u64"
        },
        {
          "name": "unlockAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "depositGoal",
      "discriminator": [
        114,
        73,
        87,
        3,
        40,
        210,
        0,
        58
      ],
      "accounts": [
        {
          "name": "owner",
          "signer": true,
          "relations": [
            "goal"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "goal",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  97,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "account",
                "path": "goal.id",
                "account": "goalVault"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  111,
                  97,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "goal"
              }
            ]
          }
        },
        {
          "name": "ownerTokenAccount",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "evolveCompanion",
      "discriminator": [
        252,
        123,
        249,
        57,
        70,
        210,
        86,
        177
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "profile.owner",
                "account": "profile"
              }
            ]
          }
        },
        {
          "name": "asset",
          "writable": true
        },
        {
          "name": "companionAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  112,
                  97,
                  110,
                  105,
                  111,
                  110,
                  95,
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initProfile",
      "discriminator": [
        210,
        162,
        212,
        95,
        95,
        186,
        89,
        119
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "region",
          "type": {
            "array": [
              "u8",
              2
            ]
          }
        }
      ]
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "poolVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "charityTokenAccount"
        },
        {
          "name": "program",
          "address": "5c7PXFMxkMc3kKsNHoafJb3phNhZoz6jt5qm57heRpGF"
        },
        {
          "name": "programData"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "configParams"
            }
          }
        }
      ]
    },
    {
      "name": "mintCompanion",
      "discriminator": [
        171,
        10,
        135,
        123,
        131,
        75,
        183,
        124
      ],
      "accounts": [
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              }
            ]
          }
        },
        {
          "name": "asset",
          "docs": [
            "A fresh keypair; Metaplex Core initializes it."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "companionAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  112,
                  97,
                  110,
                  105,
                  111,
                  110,
                  95,
                  97,
                  117,
                  116,
                  104
                ]
              }
            ]
          }
        },
        {
          "name": "mplCoreProgram",
          "address": "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "settleCommitment",
      "discriminator": [
        131,
        217,
        252,
        92,
        136,
        78,
        89,
        78
      ],
      "accounts": [
        {
          "name": "settler",
          "signer": true
        },
        {
          "name": "owner",
          "writable": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "profile",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  102,
                  105,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "commitment.owner",
                "account": "commitment"
              }
            ]
          }
        },
        {
          "name": "commitment",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  105,
                  116,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "commitment.owner",
                "account": "commitment"
              },
              {
                "kind": "account",
                "path": "commitment.id",
                "account": "commitment"
              }
            ]
          }
        },
        {
          "name": "escrow",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "commitment"
              }
            ]
          }
        },
        {
          "name": "ownerTokenAccount",
          "writable": true
        },
        {
          "name": "charityTokenAccount",
          "writable": true
        },
        {
          "name": "poolVault",
          "writable": true
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "charityTokenAccount"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "configParams"
            }
          }
        },
        {
          "name": "paused",
          "type": "bool"
        },
        {
          "name": "newAdmin",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "commitment",
      "discriminator": [
        61,
        112,
        129,
        128,
        24,
        147,
        77,
        87
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "goalVault",
      "discriminator": [
        175,
        228,
        196,
        226,
        155,
        35,
        89,
        57
      ]
    },
    {
      "name": "profile",
      "discriminator": [
        184,
        101,
        165,
        188,
        95,
        63,
        127,
        188
      ]
    }
  ],
  "events": [
    {
      "name": "checkinAttested",
      "discriminator": [
        47,
        232,
        92,
        163,
        154,
        240,
        135,
        212
      ]
    },
    {
      "name": "commitmentCreated",
      "discriminator": [
        179,
        58,
        10,
        188,
        241,
        19,
        191,
        229
      ]
    },
    {
      "name": "commitmentSettled",
      "discriminator": [
        55,
        253,
        253,
        55,
        211,
        151,
        103,
        56
      ]
    },
    {
      "name": "companionEvolved",
      "discriminator": [
        239,
        103,
        238,
        102,
        24,
        93,
        253,
        136
      ]
    },
    {
      "name": "goalBroken",
      "discriminator": [
        158,
        162,
        78,
        8,
        255,
        167,
        62,
        110
      ]
    },
    {
      "name": "goalCompleted",
      "discriminator": [
        104,
        165,
        29,
        238,
        190,
        42,
        208,
        252
      ]
    },
    {
      "name": "goalCreated",
      "discriminator": [
        40,
        74,
        205,
        224,
        20,
        51,
        92,
        239
      ]
    },
    {
      "name": "goalDeposited",
      "discriminator": [
        205,
        74,
        144,
        246,
        37,
        254,
        114,
        240
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "notUpgradeAuthority",
      "msg": "Signer is not the program upgrade authority"
    },
    {
      "code": 6001,
      "name": "notAdmin",
      "msg": "Signer is not the config admin"
    },
    {
      "code": 6002,
      "name": "notAttestor",
      "msg": "Signer is not the configured attestor"
    },
    {
      "code": 6003,
      "name": "notOwner",
      "msg": "Signer does not own this account"
    },
    {
      "code": 6004,
      "name": "invalidMintDecimals",
      "msg": "Mint must have 6 decimals"
    },
    {
      "code": 6005,
      "name": "wrongMint",
      "msg": "Token account has the wrong mint"
    },
    {
      "code": 6006,
      "name": "wrongTokenOwner",
      "msg": "Token account has the wrong owner"
    },
    {
      "code": 6007,
      "name": "tooManyRegions",
      "msg": "Too many restricted regions"
    },
    {
      "code": 6008,
      "name": "invalidRegion",
      "msg": "Region must be two uppercase ASCII letters"
    },
    {
      "code": 6009,
      "name": "uriTooLong",
      "msg": "Companion URI base is too long"
    },
    {
      "code": 6010,
      "name": "paused",
      "msg": "New commitments and goals are paused"
    },
    {
      "code": 6011,
      "name": "invalidGoalName",
      "msg": "Goal name must be 1-32 bytes"
    },
    {
      "code": 6012,
      "name": "amountTooSmall",
      "msg": "Amount is below the minimum"
    },
    {
      "code": 6013,
      "name": "invalidUnlockTime",
      "msg": "Unlock time must be 7-365 days from now"
    },
    {
      "code": 6014,
      "name": "goalTargetNotReached",
      "msg": "Goal target has not been reached"
    },
    {
      "code": 6015,
      "name": "goalStillLocked",
      "msg": "Goal is still locked"
    },
    {
      "code": 6016,
      "name": "invalidPeriod",
      "msg": "Period must be 1-64 days"
    },
    {
      "code": 6017,
      "name": "invalidRequiredCheckins",
      "msg": "Required check-ins must be between 1 and the period length"
    },
    {
      "code": 6018,
      "name": "invalidFocusMinutes",
      "msg": "Focus minutes must be between 5 and 720"
    },
    {
      "code": 6019,
      "name": "modeNotAllowedInRegion",
      "msg": "Pool mode is not available in your region; choose Soft or Charity"
    },
    {
      "code": 6020,
      "name": "deadlinePassed",
      "msg": "Commitment deadline has passed"
    },
    {
      "code": 6021,
      "name": "dayOutOfRange",
      "msg": "Day index is outside the commitment period"
    },
    {
      "code": 6022,
      "name": "futureDay",
      "msg": "Cannot check in for a future day"
    },
    {
      "code": 6023,
      "name": "alreadyCheckedIn",
      "msg": "Already checked in for this day"
    },
    {
      "code": 6024,
      "name": "notYetSettleable",
      "msg": "Commitment can only be settled after the deadline unless it has already succeeded"
    },
    {
      "code": 6025,
      "name": "companionAlreadyMinted",
      "msg": "Companion already minted"
    },
    {
      "code": 6026,
      "name": "companionNotMinted",
      "msg": "Companion has not been minted"
    },
    {
      "code": 6027,
      "name": "wrongCompanion",
      "msg": "Asset is not this profile's companion"
    },
    {
      "code": 6028,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    }
  ],
  "types": [
    {
      "name": "checkinAttested",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "commitment",
            "type": "pubkey"
          },
          {
            "name": "dayIndex",
            "type": "u8"
          },
          {
            "name": "checkins",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "commitment",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u32"
          },
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "focusMinutes",
            "docs": [
              "Continuous focus required for a day to count. Public so the attestor's rule is verifiable."
            ],
            "type": "u16"
          },
          {
            "name": "requiredCheckins",
            "type": "u8"
          },
          {
            "name": "periodDays",
            "type": "u8"
          },
          {
            "name": "checkins",
            "type": "u8"
          },
          {
            "name": "checkinBitmap",
            "type": "u64"
          },
          {
            "name": "mode",
            "type": {
              "defined": {
                "name": "forfeitMode"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "escrowBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "commitmentCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "commitment",
            "type": "pubkey"
          },
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "focusMinutes",
            "type": "u16"
          },
          {
            "name": "requiredCheckins",
            "type": "u8"
          },
          {
            "name": "periodDays",
            "type": "u8"
          },
          {
            "name": "mode",
            "type": {
              "defined": {
                "name": "forfeitMode"
              }
            }
          }
        ]
      }
    },
    {
      "name": "commitmentSettled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "commitment",
            "type": "pubkey"
          },
          {
            "name": "succeeded",
            "type": "bool"
          },
          {
            "name": "mode",
            "type": {
              "defined": {
                "name": "forfeitMode"
              }
            }
          },
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "bonus",
            "type": "u64"
          },
          {
            "name": "xpGained",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "companionEvolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "asset",
            "type": "pubkey"
          },
          {
            "name": "from",
            "type": {
              "defined": {
                "name": "stage"
              }
            }
          },
          {
            "name": "to",
            "type": {
              "defined": {
                "name": "stage"
              }
            }
          },
          {
            "name": "xp",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "attestor",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "charityTokenAccount",
            "type": "pubkey"
          },
          {
            "name": "poolVault",
            "type": "pubkey"
          },
          {
            "name": "restrictedRegions",
            "type": {
              "vec": {
                "array": [
                  "u8",
                  2
                ]
              }
            }
          },
          {
            "name": "companionUriBase",
            "type": "string"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "poolBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "configParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "attestor",
            "type": "pubkey"
          },
          {
            "name": "restrictedRegions",
            "type": {
              "vec": {
                "array": [
                  "u8",
                  2
                ]
              }
            }
          },
          {
            "name": "companionUriBase",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "forfeitMode",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "soft"
          },
          {
            "name": "charity"
          },
          {
            "name": "pool"
          }
        ]
      }
    },
    {
      "name": "goalBroken",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "goal",
            "type": "pubkey"
          },
          {
            "name": "returned",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "goalCompleted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "goal",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "xpGained",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "goalCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "goal",
            "type": "pubkey"
          },
          {
            "name": "targetAmount",
            "type": "u64"
          },
          {
            "name": "unlockAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "goalDeposited",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "goal",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "deposited",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "goalVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u32"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "targetAmount",
            "type": "u64"
          },
          {
            "name": "deposited",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "unlockAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "profile",
      "docs": [
        "Public, on-chain reputation. Other apps can read it directly."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "region",
            "type": {
              "array": [
                "u8",
                2
              ]
            }
          },
          {
            "name": "xp",
            "type": "u64"
          },
          {
            "name": "verifiedSavedTotal",
            "type": "u64"
          },
          {
            "name": "goalsCreated",
            "type": "u32"
          },
          {
            "name": "goalsCompleted",
            "type": "u32"
          },
          {
            "name": "goalsBroken",
            "type": "u32"
          },
          {
            "name": "commitmentsCreated",
            "type": "u32"
          },
          {
            "name": "commitmentsSucceeded",
            "type": "u32"
          },
          {
            "name": "commitmentsFailed",
            "type": "u32"
          },
          {
            "name": "companion",
            "type": "pubkey"
          },
          {
            "name": "companionStage",
            "docs": [
              "Stage last written to the companion asset."
            ],
            "type": {
              "defined": {
                "name": "stage"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "stage",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "curious"
          },
          {
            "name": "focused"
          },
          {
            "name": "evolving"
          },
          {
            "name": "legendary"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "commitmentSeed",
      "type": "bytes",
      "value": "[99, 111, 109, 109, 105, 116, 109, 101, 110, 116]"
    },
    {
      "name": "companionAuthSeed",
      "type": "bytes",
      "value": "[99, 111, 109, 112, 97, 110, 105, 111, 110, 95, 97, 117, 116, 104]"
    },
    {
      "name": "configSeed",
      "type": "bytes",
      "value": "[99, 111, 110, 102, 105, 103]"
    },
    {
      "name": "escrowSeed",
      "type": "bytes",
      "value": "[101, 115, 99, 114, 111, 119]"
    },
    {
      "name": "goalSeed",
      "type": "bytes",
      "value": "[103, 111, 97, 108]"
    },
    {
      "name": "goalVaultSeed",
      "type": "bytes",
      "value": "[103, 111, 97, 108, 95, 118, 97, 117, 108, 116]"
    },
    {
      "name": "poolSeed",
      "type": "bytes",
      "value": "[112, 111, 111, 108]"
    },
    {
      "name": "profileSeed",
      "type": "bytes",
      "value": "[112, 114, 111, 102, 105, 108, 101]"
    }
  ]
};
