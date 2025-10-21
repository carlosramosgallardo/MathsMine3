---

# Proof of Vote (PoV) SQL Schema

This schema defines the structure for the Proof of Vote (PoV) module on MathsMine3.xyz.

## Overview

PoV allows users to vote on community questions — but only if they've contributed to the game (even symbolic/fake mining counts).

## Structure

- **polls:** Stores public questions. Now includes a `wallet_address` column to record the creator's wallet, with a unique constraint ensuring that each wallet can create only one poll.
- **poll_votes:** Stores individual votes, limited to one vote per poll and wallet.

## Voting Requirements

- Wallet connected.
- Wallet listed in the `contributors` view.
- Minimum score requirement (e.g., 1).

## Notes

- No interference with core MathsMine3 logic or data.
- This module is fully self-contained.

---