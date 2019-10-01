pragma solidity ^0.5.5;

import "@openzeppelin/contracts/token/ERC20/ERC20Detailed.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";

contract DaiToken is ERC20Detailed, ERC20Mintable{
    constructor() ERC20Detailed("DAI", "DAI", 18) public {
        _mint(msg.sender, 100e6 * 1 ether);
    }
}
