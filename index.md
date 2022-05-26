# 9 Men’s Morris 
(Summer vacation edition)

## Part 0: Installation
* ### Simple Installation 
1.  Go to [Releases](https://github.com/Legedith/9-men-s-morris/releases)
2.  Find the latest release
3.  Download and follow instructions

* ### Building from source
1.  Clone the repo  
              `git clone https://github.com/Legedith/9-men-s-morris.git`
2.  cd into the cloned repo  
              `cd 9-men-s-morris`
3.  Compile using Javac  
              `javac morris.java`
4.  Run the compiled game  
              `java morris`

## Part 1: Analysis of the game 🕵️‍♀️
9 Men’s Morris is a classical 2 person game. 
The game starts with each player having three pieces each. 
The game consists of two phases; the placement phase and the movement phase. It’s won when either player manages to get three pieces in a row.
In the placement phase, the players take turns placing their pieces on the board. Once they run out of pieces, the placement phase begins. 
In the placement phase, the players can pick their pieces and place them at any blank location. 
The one who gets three in a row first wins. 


## Part 2: Design 🎨
For the Design of classes, we thought it wise to split the implementation into two classes. One depicting the game board containing all necessary variables to control and represent the game state, and the other to manage players and implement the rules and peculiarities of the game using the methods and variables of the game board. 
The inspiration for this came from the fact that even in real life, you can play multiple games on the same game board by modifying the rules, the pieces and such. 

_P.s. you can even play a variation of tic-tac-toe on the same game board._


## Part 3: Description of classes 🔧🔨
## _Class gameBoard_   
**Description of class**   
A class to implement the raw game board. You can create any game and rules using the methods of this game board.    
### Variables:   
board - a 2D array of integers that represents the game board   
turn - an integer that represents whose turn it is  
winner - an integer that represents the winner of the game  
placed - an integer that represents the number of pieces placed on the board  

### **Methods**:  
## Function **placePiece**  
_Description of function_  
Places a piece on the board  
Parameters:  
x - an integer that represents the x coordinate of the piece to be placed  
y - an integer that represents the y coordinate of the piece to be placed  
Returns:  
1 if the move is successful, 0 if not  

## Function **checkWin**  
_Description of function_  
Checks if any player has 3 in a row, column, or diagonal  
Board will have 1 for player 1, 2 for player 2, and 0 for empty  
Parameters: None  
Returns: 1 if player 1 wins, 2 if player 2 wins, 0 if no one wins  

## Function **move**  
_Description of function_  
Moves a piece from one space to another  
Parameters:  
fromRow - an integer that represents the row of the piece to be moved  
fromCol - an integer that represents the column of the piece to be moved  
toRow - an integer that represents the row to move the piece to  
toCol - an integer that represents the column to move the piece to  
Returns:  
1 if the move is successful, 0 if not  
 
## Function **getTurn**  
_Description of function_  
Returns the current turn  
  
## Function **setTurn**  
_Description of function_  
Sets the current turn  
Parameters:  
 turn - an integer that represents the turn to be set   
 Return: None

## Function **getPossibleMoves**  
_Description of function_  
Parameters: None
 Returns an array of possible moves  
 
## Function **getWinner**  
_Description of function_  
Returns the winner of the game  
  
## Function **isEmpty**  
_Description of function_  
Checks if the position on the board is empty  
Parameters:    
row - an integer that represents the row of the position to be checked  
col - an integer that represents the column of the position to be checked  
Returns:  
true if the position is empty, false if not  
  
## Function **printBoard**  
_Description of function_  
Prints the board with stars for empty spaces dashes for lines  
Parameters:  
None  
Returns:  
None  

## Function **getPlaced**  
_Description of function_    
Returns the number of pieces placed on the board  
  
## Function **decrementPlaced**  
_Description of function_  
Decrements the number of pieces placed on the board  
Parameters:  
None  
Returns:  
None  

