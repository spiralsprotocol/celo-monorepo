// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.5.13;

import { Test, console2 as console } from "celo-foundry/Test.sol";

import { WithRegistry } from "../utils/WithRegistry.sol";

import { MockSortedOracles } from "contracts/stability/test/MockSortedOracles.sol";
import { MedianDeltaBreaker } from "contracts/stability/MedianDeltaBreaker.sol";
import {
  SortedLinkedListWithMedian
} from "contracts/common/linkedlists/SortedLinkedListWithMedian.sol";

contract MedianDeltaBreakerTest is Test, WithRegistry {
  address deployer;
  address someGuy;

  MockSortedOracles sortedOracles;
  MedianDeltaBreaker breaker;

  uint256 minThreshold = 0.15 * 10**24; // 15%
  uint256 maxThreshold = 0.25 * 10**24; // 25%
  uint256 timeMultiplier = 0.0075 * 10**24;
  uint256 coolDownTime = 5 minutes;

  event BreakerTriggered(address indexed exchange);
  event BreakerReset(address indexed exchange);
  event CooldownTimeUpdated(uint256 newCooldownTime);
  event MinPriceChangeUpdated(uint256 newMinPriceChangeThreshold);
  event MaxPriceChangeUpdated(uint256 newMaxPriceChangeThreshold);
  event PriceChangeMultiplierUpdated(uint256 newPriceChangeMultiplier);

  function setUp() public {
    deployer = actor("deployer");
    someGuy = actor("someGuy");

    changePrank(deployer);
    setupSortedOracles();

    breaker = new MedianDeltaBreaker(
      address(registry),
      coolDownTime,
      minThreshold,
      maxThreshold,
      timeMultiplier
    );
  }

  function setupSortedOracles() public {
    sortedOracles = new MockSortedOracles();
    registry.setAddressFor("SortedOracles", address(sortedOracles));
    setupGetTimestamps(new uint256[](1));
  }

  function setupGetTimestamps(uint256[] memory timestamps) public {
    vm.mockCall(
      address(sortedOracles),
      abi.encodeWithSelector(sortedOracles.getTimestamps.selector),
      abi.encode(new address[](1), timestamps, new SortedLinkedListWithMedian.MedianRelation[](1))
    );
  }
}

contract MedianDeltaBreakerTest_constructorAndSetters is MedianDeltaBreakerTest {
  /* ---------- Constructor ---------- */

  function test_constructor_shouldSetOwner() public {
    assertEq(breaker.owner(), deployer);
  }

  function test_constructor_shouldSetRegistry() public {
    assertEq(address(breaker.registry()), address(registry));
  }

  function test_constructor_shouldSetCooldownTime() public {
    assertEq(breaker.cooldownTime(), coolDownTime);
  }

  function test_constructor_shouldSetMinThreshold() public {
    assertEq(breaker.minPriceChangeThreshold(), minThreshold);
  }

  function test_constructor_shouldSetMaxThreshold() public {
    assertEq(breaker.maxPriceChangeThreshold(), maxThreshold);
  }

  function test_constructor_shouldSetTimeMultiplier() public {
    assertEq(breaker.priceChangeThresholdTimeMultiplier(), timeMultiplier);
  }

  /* ---------- Setters ---------- */

  function test_setCooldownTime_whenCallerIsNotOwner_shouldRevert() public {
    vm.expectRevert("Ownable: caller is not the owner");
    changePrank(someGuy);
    breaker.setCooldownTime(2 minutes);
  }

  function test_setCooldownTime_whenCallerIsOwner_shouldUpdateAndEmit() public {
    uint256 testCooldown = 39 minutes;
    vm.expectEmit(false, false, false, true);
    emit CooldownTimeUpdated(testCooldown);

    breaker.setCooldownTime(testCooldown);

    assertEq(breaker.cooldownTime(), testCooldown);
  }

  function test_setMinThreshold_whenCallerIsNotOwner_shouldRevert() public {
    vm.expectRevert("Ownable: caller is not the owner");
    changePrank(someGuy);

    breaker.setMinPriceChangeThreshold(123456);
  }

  function test_setMinThreshold_whenValueGreaterThanOne_shouldRevert() public {
    vm.expectRevert("min price change threshold must be less than 1");

    breaker.setMinPriceChangeThreshold(1.01 * 10**24);
  }

  function test_setMinThreshold_whenCallerIsOwner_shouldUpdateAndEmit() public {
    uint256 testThreshold = 0.1 * 10**24;
    vm.expectEmit(false, false, false, true);
    emit MinPriceChangeUpdated(testThreshold);

    breaker.setMinPriceChangeThreshold(testThreshold);

    assertEq(breaker.minPriceChangeThreshold(), testThreshold);
  }

  function test_setMaxThreshold_whenCallerIsNotOwner_shouldRevert() public {
    vm.expectRevert("Ownable: caller is not the owner");
    changePrank(someGuy);

    breaker.setMaxPriceChangeThreshold(123456);
  }

  function test_setMaxThreshold_whenValueGreaterThanOne_shouldRevert() public {
    vm.expectRevert("max price change threshold must be less than 1");

    breaker.setMaxPriceChangeThreshold(5 * 10**24);
  }

  function test_setMaxThreshold_whenCallerIsOwner_shouldUpdateAndEmit() public {
    uint256 testThreshold = 0.1 * 10**24;
    vm.expectEmit(false, false, false, true);
    emit MaxPriceChangeUpdated(testThreshold);

    breaker.setMaxPriceChangeThreshold(testThreshold);

    assertEq(breaker.maxPriceChangeThreshold(), testThreshold);
  }

  function test_setPriceChangeMultiplier_whenCallerIsNotOwner_shouldRevert() public {
    vm.expectRevert("Ownable: caller is not the owner");
    changePrank(someGuy);

    breaker.setPriceChangeMultiplier(123456);
  }

  function test_setPriceChangeMultiplier_whenValueIsZero_shouldRevert() public {
    vm.expectRevert("price change multiplier must be greater than 0");

    breaker.setPriceChangeMultiplier(0);
  }

  function test_setPriceChangeMultiplier_whenCallerIsOwner_shouldUpdateAndEmit() public {
    uint256 testMultiplier = 2 * 10**24;
    vm.expectEmit(false, false, false, true);
    emit PriceChangeMultiplierUpdated(testMultiplier);

    breaker.setPriceChangeMultiplier(testMultiplier);

    assertEq(breaker.priceChangeThresholdTimeMultiplier(), testMultiplier);
  }

  /* ---------- Getters ---------- */

  function test_getTradingMode_shouldReturnTradingMode() public {
    assertEq(breaker.getTradingMode(), 1);
  }

  function test_getCooldown_shouldReturnCooldown() public {
    assertEq(breaker.getCooldown(), coolDownTime);
  }
}
