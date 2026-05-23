# Python helpers

Off-chain prover (`merkle.py`) + end-to-end example (`anchor_example.py`).

## merkle.py — zero-dep prover

Pure stdlib (`hashlib`). Drop this file into any Python project; no
`pip install` needed.

```python
from merkle import merkle_root, merkle_proof, verify_proof, sha256_leaf

leaves = [sha256_leaf(part_bytes) for part_bytes in artifact_sub_parts]
root = merkle_root(leaves)

# Later, prove leaves[i] was committed in `root`.
proof = merkle_proof(leaves, i)
assert verify_proof(leaves[i], proof, root)
```

The algorithm is byte-identical to `MerkleAnchorRegistry.verifyInclusion`,
so an off-chain proof verifies on-chain via eth_call without modification.

Run the self-test:

```bash
python merkle.py
```

## anchor_example.py — end-to-end on Arc

Reads `RPC`, `DEPLOYER_PRIVATE_KEY`, and `MERKLE_ANCHOR_ADDRESS` from the
parent directory's `.env`. Sends one real `anchor(...)` tx, then proves
sub-part `#2` both off-chain (Python) and on-chain (eth_call against the
deployed contract).

```bash
pip install -r requirements.txt
python anchor_example.py
```
