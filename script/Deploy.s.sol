// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MerkleAnchorRegistry} from "../src/MerkleAnchorRegistry.sol";

/// @notice Deploys MerkleAnchorRegistry to the configured RPC. Run with:
///
///   forge script script/Deploy.s.sol \
///     --rpc-url $RPC --broadcast --private-key $DEPLOYER_PRIVATE_KEY
///
/// After deploy, paste the printed address into .env as MERKLE_ANCHOR_ADDRESS
/// so the Python example can read it.
contract Deploy is Script {
    function run() external returns (MerkleAnchorRegistry registry) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(pk);
        registry = new MerkleAnchorRegistry();
        vm.stopBroadcast();
        console2.log("MerkleAnchorRegistry deployed at", address(registry));
        console2.log("Total anchors at deploy", registry.totalAnchors());
    }
}
