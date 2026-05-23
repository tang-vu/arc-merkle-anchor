// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title  MerkleAnchorRegistry
/// @notice Append-only on-chain registry for **any** auditable artifact. Each
///         anchor commits to (a) the SHA-256 of the artifact's canonical bytes
///         and (b) a Merkle root over its sub-parts. Anyone holding the root
///         (from the event log) can later prove that one specific sub-part —
///         one evidence URL, one line item, one log line — was part of the
///         on-chain commitment by submitting that sub-part's bytes plus a
///         ~200-byte inclusion proof. No need to download the full artifact,
///         no need to trust the publisher.
///
/// @dev    Hash function: **SHA-256** everywhere, via the Ethereum sha256
///         precompile (~60 gas per invocation — significantly cheaper than a
///         Solidity keccak loop). Off-chain proofs produced by the companion
///         `python/merkle.py` use the same sorted-pair algorithm — see
///         `verifyInclusion` for the verifier mirror.
///
///         Zero imports. Pure Solidity 0.8.26. Drop-in fork-friendly.
contract MerkleAnchorRegistry {
    /// @notice Emitted on every anchor.
    /// @param  id            Monotonic anchor ID assigned by the contract.
    /// @param  publisher     Address that anchored the artifact.
    /// @param  artifactId    Caller-defined stable identifier for the artifact
    ///                       (e.g. keccak256 of a URL, a UUID, a domain key).
    /// @param  contentHash   SHA-256 of the canonical bytes of the full artifact.
    /// @param  merkleRoot    SHA-256 binary-Merkle root over the artifact's
    ///                       sub-part hashes (sorted-pair convention).
    /// @param  schemaVersion ASCII-packed schema identifier, e.g. "anchor/1".
    /// @param  contentCid    Content-addressed pointer to the full artifact
    ///                       (IPFS, Irys, Arweave, S3, ...).
    /// @param  anchoredAt    Block timestamp.
    event Anchored(
        uint256 indexed id,
        address indexed publisher,
        bytes32 indexed artifactId,
        bytes32 contentHash,
        bytes32 merkleRoot,
        bytes16 schemaVersion,
        string contentCid,
        uint64 anchoredAt
    );

    /// @notice Total number of anchors ever published.
    uint256 public totalAnchors;

    /// @notice Anchor a single artifact.
    /// @param  artifactId    Caller-defined stable identifier.
    /// @param  contentHash   SHA-256 of the full artifact bytes (must be non-zero).
    /// @param  merkleRoot    SHA-256 Merkle root over sub-part hashes (must be non-zero).
    /// @param  schemaVersion ASCII-packed schema id (e.g. bytes16("anchor/1")).
    /// @param  contentCid    Content-addressed pointer (must be non-empty).
    /// @return id            The assigned anchor ID.
    function anchor(
        bytes32 artifactId,
        bytes32 contentHash,
        bytes32 merkleRoot,
        bytes16 schemaVersion,
        string calldata contentCid
    ) external returns (uint256 id) {
        require(contentHash != bytes32(0), "MAR: empty hash");
        require(merkleRoot != bytes32(0), "MAR: empty root");
        require(bytes(contentCid).length > 0, "MAR: empty cid");

        id = ++totalAnchors;
        emit Anchored(
            id, msg.sender, artifactId, contentHash, merkleRoot, schemaVersion, contentCid, uint64(block.timestamp)
        );
    }

    /// @notice Batched anchor. All arrays must be the same length and non-empty.
    function anchorBatch(
        bytes32[] calldata artifactIds,
        bytes32[] calldata contentHashes,
        bytes32[] calldata merkleRoots,
        bytes16[] calldata schemaVersions,
        string[] calldata contentCids
    ) external returns (uint256 firstId, uint256 lastId) {
        uint256 len = artifactIds.length;
        require(len > 0, "MAR: empty batch");
        require(
            len == contentHashes.length && len == merkleRoots.length && len == schemaVersions.length
                && len == contentCids.length,
            "MAR: length mismatch"
        );

        firstId = totalAnchors + 1;
        for (uint256 i = 0; i < len; ++i) {
            require(contentHashes[i] != bytes32(0), "MAR: empty hash");
            require(merkleRoots[i] != bytes32(0), "MAR: empty root");
            require(bytes(contentCids[i]).length > 0, "MAR: empty cid");

            uint256 id = ++totalAnchors;
            emit Anchored(
                id,
                msg.sender,
                artifactIds[i],
                contentHashes[i],
                merkleRoots[i],
                schemaVersions[i],
                contentCids[i],
                uint64(block.timestamp)
            );
        }
        lastId = totalAnchors;
    }

    /// @notice Verify a sorted-pair SHA-256 Merkle inclusion proof against a root.
    /// @param  root  Known Merkle root (read from an `Anchored` event).
    /// @param  leaf  SHA-256 of the canonical bytes of the sub-part being proven.
    /// @param  proof Bottom-up list of sibling hashes.
    /// @return Whether `leaf` is in the tree committed to by `root`.
    /// @dev    Mirrors python/merkle.py's `verify_proof`. Sorted-pair convention
    ///         (`sha256(min(a,b) || max(a,b))`) makes proofs direction-free.
    ///         Odd-level: lonely node is promoted (OZ-canonical — NOT duplicated,
    ///         so there is no second-preimage attack surface).
    function verifyInclusion(bytes32 root, bytes32 leaf, bytes32[] calldata proof)
        external
        pure
        returns (bool)
    {
        bytes32 h = leaf;
        uint256 len = proof.length;
        for (uint256 i = 0; i < len; ++i) {
            h = _hashPair(h, proof[i]);
        }
        return h == root;
    }

    /// @dev SHA-256 of the sorted-pair concatenation. Same as python/merkle.py `_h`.
    function _hashPair(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return a <= b ? sha256(abi.encodePacked(a, b)) : sha256(abi.encodePacked(b, a));
    }
}
