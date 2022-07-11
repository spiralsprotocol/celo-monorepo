pragma solidity ^0.5.13;

/**
 * @title Breaker Box Interface
 * @notice Defines the basic interface for the Breaker Box
 */
interface IBreakerBox {
  struct TradingModeInfo {
    uint256 tradingMode;
    uint256 lastUpdatedTime;
    uint256 lastUpdatedBlock;
  }
  // TODO: Think about storing ref to breaker here then removing the mapping

  /**
   * @notice Emitted when a new breaker is added to the breaker box.
   * @param breaker The address of the new breaker.
   */
  event BreakerAdded(address indexed breaker);

  /**
   * @notice Emitted when a breaker is removed from the breaker box.
   * @param breaker The address of the breaker that was removed.
   */
  event BreakerRemoved(address indexed breaker);

  /**
   * @notice Emitted when a breaker is tripped by an exchange.
   * @param breaker The address of the breaker that was tripped.
   * @param exchange The address of the exchange.
   */
  event BreakerTripped(address indexed breaker, address indexed exchange);

  /**
   * @notice Emitted when a new exchange is added to the breaker box.
   * @param exchange The address of the exchange that was added.
   */
  event ExchangeAdded(address indexed exchange);

  /**
   * @notice Emitted when an exchange is removed from the breaker box.
   * @param exchange The address of the exchange that was removed.
   */
  event ExchangeRemoved(address indexed exchange);

  /**
   * @notice Emitted when the trading mode for an exchange is updated
   * @param exchange The address of the exchange.
   * @param tradingMode The new trading mode of the exchange.
   */
  event TradingModeUpdated(address indexed exchange, uint256 tradingMode);

  /**
   * @notice Emitted after a reset attempt is successful.
   * @param exchange The address of the exchange.
   * @param breaker The address of the breaker.
   */
  event ResetSuccessful(address indexed exchange, address indexed breaker);

  /**
   * @notice Emitted after a reset attempt fails when the exchange fails the breakers reset criteria.
   * @param exchange The address of the exchange.
   * @param breaker The address of the breaker.
   */
  event ResetAttemptCriteriaFail(address indexed exchange, address indexed breaker);

  /**
   * @notice Emitted after a reset attempt fails when cooldown time has not elapsed.
   * @param exchange The address of the exchange.
   * @param breaker The address of the breaker.
   */
  event ResetAttemptNotCool(address indexed exchange, address indexed breaker);

  /**
   * @notice Retrives an ordered array of all breaker addresses.
   */
  function getBreakers() external view returns (address[] memory);

  /**
   * @notice Checks if a breaker with the specified address has been added to the breaker box.
   * @param breaker The address of the breaker to check;
   * @return A bool indicating whether or not the breaker has been added.
   */
  function isBreaker(address breaker) external view returns (bool);

  /**
   * @notice Checks breakers for a specified exchange to determine the trading mode.
   * @param exchange The address of the exchange to run the checks for.
   * @return currentTradingMode Returns an int representing the current trading mode for the specified exchange.
   */
  function checkBreakers(address exchange) external returns (uint256 currentTradingMode);
}