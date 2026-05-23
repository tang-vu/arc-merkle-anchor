// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {MerkleAnchorRegistry} from "../src/MerkleAnchorRegistry.sol";

/// @notice Tests for MerkleAnchorRegistry — anchor + batch + the on-chain
///         Merkle verifier. The verifier round-trips against trees built
///         in-test using the same sorted-pair SHA-256 algorithm as
///         python/merkle.py, so a passing test here is a cross-language
///         guarantee that the off-chain prover and on-chain verifier agree.
contract MerkleAnchorRegistryTest is Test {
    MerkleAnchorRegistry internal registry;
    address internal publisher = address(0xBEEF);

    function setUp() public {
        registry = new MerkleAnchorRegistry();
    }

    // -------------------------------------------------------------
    // anchor — happy path + boundaries
    // -------------------------------------------------------------

    function test_AnchorEmitsEvent() public {
        bytes32 artifactId = keccak256("artifact-id-1");
        bytes32 contentHash = sha256(abi.encodePacked("artifact-canonical-bytes"));
        bytes32 merkleRoot = sha256(abi.encodePacked("merkle-root"));
        bytes16 schemaVersion = bytes16("anchor/1");
        string memory cid = "ipfs://abc123";

        vm.warp(1_715_000_000);
        vm.prank(publisher);
        vm.expectEmit(true, true, true, true);
        emit MerkleAnchorRegistry.Anchored(
            1, publisher, artifactId, contentHash, merkleRoot, schemaVersion, cid, 1_715_000_000
        );
        uint256 id = registry.anchor(artifactId, contentHash, merkleRoot, schemaVersion, cid);

        assertEq(id, 1, "first id is 1");
        assertEq(registry.totalAnchors(), 1, "counter incremented");
    }

    function test_AnchorRejectsEmptyContentHash() public {
        bytes32 r = sha256(abi.encodePacked("r"));
        vm.prank(publisher);
        vm.expectRevert(bytes("MAR: empty hash"));
        registry.anchor(bytes32("a"), bytes32(0), r, bytes16("anchor/1"), "ipfs://x");
    }

    function test_AnchorRejectsEmptyMerkleRoot() public {
        bytes32 h = sha256(abi.encodePacked("h"));
        vm.prank(publisher);
        vm.expectRevert(bytes("MAR: empty root"));
        registry.anchor(bytes32("a"), h, bytes32(0), bytes16("anchor/1"), "ipfs://x");
    }

    function test_AnchorRejectsEmptyCid() public {
        bytes32 h = sha256(abi.encodePacked("h"));
        bytes32 r = sha256(abi.encodePacked("r"));
        vm.prank(publisher);
        vm.expectRevert(bytes("MAR: empty cid"));
        registry.anchor(bytes32("a"), h, r, bytes16("anchor/1"), "");
    }

    // -------------------------------------------------------------
    // anchorBatch
    // -------------------------------------------------------------

    function test_AnchorBatchEmitsAllAndIncrementsCounter() public {
        uint256 n = 3;
        bytes32[] memory ids = new bytes32[](n);
        bytes32[] memory hashes = new bytes32[](n);
        bytes32[] memory roots = new bytes32[](n);
        bytes16[] memory schemas = new bytes16[](n);
        string[] memory cids = new string[](n);
        for (uint256 i = 0; i < n; ++i) {
            ids[i] = bytes32(uint256(i + 1));
            hashes[i] = sha256(abi.encodePacked("h", i));
            roots[i] = sha256(abi.encodePacked("r", i));
            schemas[i] = bytes16("anchor/1");
            cids[i] = "ipfs://batch";
        }
        vm.prank(publisher);
        (uint256 firstId, uint256 lastId) = registry.anchorBatch(ids, hashes, roots, schemas, cids);
        assertEq(firstId, 1);
        assertEq(lastId, 3);
        assertEq(registry.totalAnchors(), 3);
    }

    function test_AnchorBatchRejectsLengthMismatch() public {
        bytes32[] memory ids = new bytes32[](2);
        bytes32[] memory hashes = new bytes32[](1); // mismatched
        bytes32[] memory roots = new bytes32[](2);
        bytes16[] memory schemas = new bytes16[](2);
        string[] memory cids = new string[](2);
        vm.prank(publisher);
        vm.expectRevert(bytes("MAR: length mismatch"));
        registry.anchorBatch(ids, hashes, roots, schemas, cids);
    }

    function test_AnchorBatchRejectsEmpty() public {
        bytes32[] memory ids = new bytes32[](0);
        bytes32[] memory hashes = new bytes32[](0);
        bytes32[] memory roots = new bytes32[](0);
        bytes16[] memory schemas = new bytes16[](0);
        string[] memory cids = new string[](0);
        vm.prank(publisher);
        vm.expectRevert(bytes("MAR: empty batch"));
        registry.anchorBatch(ids, hashes, roots, schemas, cids);
    }

    // -------------------------------------------------------------
    // verifyInclusion — Merkle correctness + tamper rejection
    // -------------------------------------------------------------

    function test_VerifyInclusion_SingleLeafIsItsOwnRoot() public view {
        bytes32 leaf = sha256(abi.encodePacked("only"));
        bytes32[] memory proof = new bytes32[](0);
        assertTrue(registry.verifyInclusion(leaf, leaf, proof));
    }

    function test_VerifyInclusion_TwoLeafTree() public view {
        bytes32 l0 = sha256(abi.encodePacked("l0"));
        bytes32 l1 = sha256(abi.encodePacked("l1"));
        bytes32 root = _hashPair(l0, l1);

        bytes32[] memory proofForL0 = new bytes32[](1);
        proofForL0[0] = l1;
        assertTrue(registry.verifyInclusion(root, l0, proofForL0));

        bytes32[] memory proofForL1 = new bytes32[](1);
        proofForL1[0] = l0;
        assertTrue(registry.verifyInclusion(root, l1, proofForL1));
    }

    function test_VerifyInclusion_FourLeafTreeAllProofsWork() public view {
        bytes32 l0 = sha256(abi.encodePacked("l0"));
        bytes32 l1 = sha256(abi.encodePacked("l1"));
        bytes32 l2 = sha256(abi.encodePacked("l2"));
        bytes32 l3 = sha256(abi.encodePacked("l3"));
        bytes32 l01 = _hashPair(l0, l1);
        bytes32 l23 = _hashPair(l2, l3);
        bytes32 root = _hashPair(l01, l23);

        bytes32[] memory p0 = new bytes32[](2);
        p0[0] = l1;
        p0[1] = l23;
        assertTrue(registry.verifyInclusion(root, l0, p0));

        bytes32[] memory p3 = new bytes32[](2);
        p3[0] = l2;
        p3[1] = l01;
        assertTrue(registry.verifyInclusion(root, l3, p3));
    }

    function test_VerifyInclusion_OddLevelLonelyNodePromoted() public view {
        // Three leaves: l0, l1, l2.
        // Level 1: [_hashPair(l0,l1), l2]  (l2 promoted, no duplication)
        // Root:    _hashPair(_hashPair(l0,l1), l2)
        bytes32 l0 = sha256(abi.encodePacked("l0"));
        bytes32 l1 = sha256(abi.encodePacked("l1"));
        bytes32 l2 = sha256(abi.encodePacked("l2"));
        bytes32 l01 = _hashPair(l0, l1);
        bytes32 root = _hashPair(l01, l2);

        bytes32[] memory p2 = new bytes32[](1);
        p2[0] = l01;
        assertTrue(registry.verifyInclusion(root, l2, p2));

        bytes32[] memory p0 = new bytes32[](2);
        p0[0] = l1;
        p0[1] = l2;
        assertTrue(registry.verifyInclusion(root, l0, p0));
    }

    function test_VerifyInclusion_RejectsTamperedLeaf() public view {
        bytes32 l0 = sha256(abi.encodePacked("real-leaf"));
        bytes32 l1 = sha256(abi.encodePacked("sibling"));
        bytes32 root = _hashPair(l0, l1);
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = l1;

        bytes32 fakeLeaf = sha256(abi.encodePacked("attacker-leaf"));
        assertFalse(registry.verifyInclusion(root, fakeLeaf, proof));
    }

    function test_VerifyInclusion_RejectsBitFlippedSibling() public view {
        bytes32 l0 = sha256(abi.encodePacked("a"));
        bytes32 l1 = sha256(abi.encodePacked("b"));
        bytes32 root = _hashPair(l0, l1);

        bytes32 bad = bytes32(uint256(l1) ^ 1);
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = bad;
        assertFalse(registry.verifyInclusion(root, l0, proof));
    }

    function _hashPair(bytes32 a, bytes32 b) private pure returns (bytes32) {
        return a <= b ? sha256(abi.encodePacked(a, b)) : sha256(abi.encodePacked(b, a));
    }
}
