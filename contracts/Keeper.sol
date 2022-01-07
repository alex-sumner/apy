// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;

import "hardhat/console.sol";

contract Keeper {

    int256 value;

    event Upkept(int256 indexed value);

    function performUpkeep(int256 _value) public {
        value = _value;
        console.log("updated value to");
        console.logInt(_value);
        emit Upkept(_value);
    }

}
